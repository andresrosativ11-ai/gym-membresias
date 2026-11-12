"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { FormState } from "@/components/action-form";
import { db } from "@/lib/db";
import { dbDateFromIso, isoFromDbDate } from "@/lib/domain/dates";
import { computeNewPeriod } from "@/lib/domain/membership";
import { buildMemberSearchText } from "@/lib/domain/search";
import { formatDate, formatMoney } from "@/lib/format";
import { isUniqueViolation, newAccessCode } from "@/lib/members";
import { requireAdmin, requireUser } from "@/lib/session";
import { gymToday } from "@/lib/settings";
import { deletePhoto, PhotoError, savePhoto } from "@/lib/storage";
import { firstError, memberSchema, paymentSchema, type MemberInput } from "@/lib/validation";

class DomainError extends Error {}

function parseMember(fd: FormData) {
  return memberSchema.safeParse({
    firstName: fd.get("firstName") ?? "",
    lastName: fd.get("lastName") ?? "",
    documentId: fd.get("documentId") ?? "",
    email: fd.get("email") ?? "",
    phone: fd.get("phone") ?? "",
    birthDate: fd.get("birthDate") ?? "",
    enrolledAt: fd.get("enrolledAt") ?? "",
    notes: fd.get("notes") ?? "",
    notifyWhatsapp: fd.get("notifyWhatsapp") === "on",
    notifyEmail: fd.get("notifyEmail") === "on",
  });
}

function toDb(m: MemberInput) {
  const email = m.email?.toLowerCase() ?? null;
  return {
    ...m,
    email,
    birthDate: m.birthDate ? dbDateFromIso(m.birthDate) : null,
    enrolledAt: dbDateFromIso(m.enrolledAt),
    searchText: buildMemberSearchText({ ...m, email }),
  };
}

function photoFile(fd: FormData): File | null {
  const f = fd.get("photo");
  return f instanceof File && f.size > 0 ? f : null;
}

export async function createMember(_prev: FormState, fd: FormData): Promise<FormState> {
  await requireUser();
  const parsed = parseMember(fd);
  if (!parsed.success) return { error: firstError(parsed.error) };

  let photoKey: string | null = null;
  try {
    const file = photoFile(fd);
    if (file) photoKey = await savePhoto(file);
  } catch (e) {
    if (e instanceof PhotoError) return { error: e.message };
    throw e;
  }

  let id: string;
  try {
    const member = await db.member.create({
      data: { ...toDb(parsed.data), photoKey, accessCode: newAccessCode() },
    });
    id = member.id;
  } catch (e) {
    if (photoKey) await deletePhoto(photoKey);
    if (isUniqueViolation(e)) return { error: "Ya existe un socio con ese documento" };
    throw e;
  }

  revalidatePath("/socios");
  redirect(`/socios/${id}`);
}

export async function updateMember(id: string, _prev: FormState, fd: FormData): Promise<FormState> {
  await requireUser();
  const parsed = parseMember(fd);
  if (!parsed.success) return { error: firstError(parsed.error) };

  const existing = await db.member.findUnique({ where: { id }, select: { photoKey: true } });
  if (!existing) return { error: "Socio no encontrado" };

  let newPhotoKey: string | null = null;
  try {
    const file = photoFile(fd);
    if (file) newPhotoKey = await savePhoto(file);
  } catch (e) {
    if (e instanceof PhotoError) return { error: e.message };
    throw e;
  }

  try {
    await db.member.update({
      where: { id },
      data: { ...toDb(parsed.data), ...(newPhotoKey ? { photoKey: newPhotoKey } : {}) },
    });
  } catch (e) {
    if (newPhotoKey) await deletePhoto(newPhotoKey);
    if (isUniqueViolation(e)) return { error: "Ya existe un socio con ese documento" };
    throw e;
  }
  if (newPhotoKey && existing.photoKey) await deletePhoto(existing.photoKey);

  revalidatePath("/socios");
  redirect(`/socios/${id}`);
}

/**
 * Cobra y asigna/renueva un plan: registra el pago, calcula el periodo y
 * actualiza el vencimiento, todo en una transacción.
 */
export async function assignPlan(memberId: string, _prev: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = paymentSchema.safeParse({
    planId: fd.get("planId") ?? "",
    amountCents: fd.get("amount") ?? "",
    method: fd.get("method") ?? "",
    reference: fd.get("reference") ?? "",
  });
  if (!parsed.success) return { error: firstError(parsed.error) };
  const input = parsed.data;
  const plan = await db.plan.findFirst({ where: { id: input.planId, active: true } });
  if (!plan) return { error: "Selecciona un plan válido" };
  const today = await gymToday();

  try {
    const period = await db.$transaction(async (tx) => {
      // Bloquea la fila para evitar dos asignaciones simultáneas (doble toque).
      await tx.$queryRaw`SELECT id FROM "Member" WHERE id = ${memberId} FOR UPDATE`;
      const member = await tx.member.findUnique({ where: { id: memberId } });
      if (!member || member.deletedAt) throw new DomainError("Socio no encontrado o dado de baja");

      const current = member.currentEndDate ? isoFromDbDate(member.currentEndDate) : null;
      const p = computeNewPeriod(current, today, plan);
      const payment = await tx.payment.create({
        data: {
          memberId,
          amountCents: input.amountCents,
          method: input.method,
          reference: input.reference,
          paidAt: new Date(),
          receivedById: user.id,
        },
      });
      await tx.membership.create({
        data: {
          memberId,
          planId: plan.id,
          startDate: dbDateFromIso(p.startDate),
          endDate: dbDateFromIso(p.endDate),
          priceCents: plan.priceCents,
          paymentId: payment.id,
          createdById: user.id,
        },
      });
      await tx.member.update({ where: { id: memberId }, data: { currentEndDate: dbDateFromIso(p.endDate) } });
      return p;
    });
    revalidatePath(`/socios/${memberId}`);
    revalidatePath("/socios");
    revalidatePath("/inicio");
    return {
      ok: `${plan.name}: ${formatDate(period.startDate)} → ${formatDate(period.endDate)} · cobrado ${formatMoney(
        input.amountCents,
        plan.currency,
      )}`,
    };
  } catch (e) {
    if (e instanceof DomainError) return { error: e.message };
    throw e;
  }
}

/**
 * Corrige un error: anula la renovación más reciente y su pago. No borra nada
 * (queda el rastro de auditoría); el vencimiento se recalcula sin ella.
 */
export async function voidLastMembership(memberId: string): Promise<void> {
  await requireAdmin();
  await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Member" WHERE id = ${memberId} FOR UPDATE`;
    const last = await tx.membership.findFirst({
      where: { memberId, voidedAt: null },
      orderBy: [{ endDate: "desc" }, { createdAt: "desc" }],
    });
    if (!last) return;
    const now = new Date();
    await tx.membership.update({ where: { id: last.id }, data: { voidedAt: now } });
    if (last.paymentId) await tx.payment.update({ where: { id: last.paymentId }, data: { voidedAt: now } });
    const prev = await tx.membership.findFirst({
      where: { memberId, voidedAt: null },
      orderBy: { endDate: "desc" },
    });
    await tx.member.update({ where: { id: memberId }, data: { currentEndDate: prev?.endDate ?? null } });
  });
  revalidatePath(`/socios/${memberId}`);
  revalidatePath("/socios");
  revalidatePath("/inicio");
}

export async function setSuspended(memberId: string, suspend: boolean, fd: FormData): Promise<void> {
  await requireAdmin();
  const reason = String(fd.get("reason") ?? "").trim().slice(0, 200) || null;
  await db.member.update({
    where: { id: memberId },
    data: suspend ? { suspendedAt: new Date(), suspendReason: reason } : { suspendedAt: null, suspendReason: null },
  });
  revalidatePath(`/socios/${memberId}`);
  revalidatePath("/socios");
}

export async function setDeleted(memberId: string, deleted: boolean): Promise<void> {
  await requireAdmin();
  await db.member.update({ where: { id: memberId }, data: { deletedAt: deleted ? new Date() : null } });
  revalidatePath(`/socios/${memberId}`);
  revalidatePath("/socios");
}

export async function regenerateAccessCode(memberId: string): Promise<void> {
  await requireAdmin();
  await db.member.update({ where: { id: memberId }, data: { accessCode: newAccessCode() } });
  revalidatePath(`/socios/${memberId}`);
}
