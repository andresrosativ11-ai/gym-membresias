"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { FormState } from "@/components/action-form";
import { db } from "@/lib/db";
import { addDays, dbDateFromIso, isoFromDbDate } from "@/lib/domain/dates";
import { canFreeze, frozenDays, shiftPeriod } from "@/lib/domain/freeze";
import { computeNewPeriod, computeStatus } from "@/lib/domain/membership";
import { buildMemberSearchText } from "@/lib/domain/search";
import { formatDate, formatMoney } from "@/lib/format";
import { isUniqueViolation, newAccessCode, statusInput } from "@/lib/members";
import { requireAdmin, requireUser } from "@/lib/session";
import { getSettings, gymToday } from "@/lib/settings";
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
    paidDate: fd.get("paidDate") ?? "",
  });
  if (!parsed.success) return { error: firstError(parsed.error) };
  const input = parsed.data;
  const plan = await db.plan.findFirst({ where: { id: input.planId, active: true } });
  if (!plan) return { error: "Selecciona un plan válido" };
  const today = await gymToday();
  const paidDate = input.paidDate ?? today;
  if (paidDate > today) return { error: "La fecha del pago no puede ser futura" };
  if (paidDate < addDays(today, -366)) return { error: "La fecha del pago es demasiado antigua" };

  try {
    const period = await db.$transaction(async (tx) => {
      // Bloquea la fila para evitar dos asignaciones simultáneas (doble toque).
      await tx.$queryRaw`SELECT id FROM "Member" WHERE id = ${memberId} FOR UPDATE`;
      const member = await tx.member.findUnique({ where: { id: memberId } });
      if (!member || member.deletedAt) throw new DomainError("Socio no encontrado o dado de baja");
      if (member.frozenSince) throw new DomainError("La membresía está congelada: descongélala antes de renovar");

      const current = member.currentEndDate ? isoFromDbDate(member.currentEndDate) : null;
      // El periodo arranca en la fecha real del pago (puede ser anterior a hoy).
      const p = computeNewPeriod(current, paidDate, plan);
      const payment = await tx.payment.create({
        data: {
          memberId,
          amountCents: input.amountCents,
          method: input.method,
          reference: input.reference,
          // Pago de hoy: hora exacta. Pago anterior: mediodía UTC de ese día
          // (cae en el mismo día calendario en América).
          paidAt: paidDate === today ? new Date() : new Date(`${paidDate}T12:00:00Z`),
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

function revalidateMember(memberId: string) {
  revalidatePath(`/socios/${memberId}`);
  revalidatePath("/socios");
  revalidatePath("/inicio");
}

/** Congela la membresía vigente desde hoy: no puede entrar y los días dejan de correr. */
export async function freezeMember(memberId: string, _prev: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  const reason = String(fd.get("reason") ?? "").trim().slice(0, 200) || null;
  const settings = await getSettings();
  const today = await gymToday();
  try {
    await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Member" WHERE id = ${memberId} FOR UPDATE`;
      const member = await tx.member.findUnique({ where: { id: memberId } });
      if (!member) throw new DomainError("Socio no encontrado");
      const { status } = computeStatus(statusInput(member), today, settings.expiringSoonDays);
      if (!canFreeze(status)) throw new DomainError("Solo se puede congelar una membresía vigente");
      await tx.member.update({
        where: { id: memberId },
        data: { frozenSince: dbDateFromIso(today), frozenReason: reason },
      });
    });
  } catch (e) {
    if (e instanceof DomainError) return { error: e.message };
    throw e;
  }
  revalidateMember(memberId);
  return { ok: "Membresía congelada" };
}

/**
 * Descongela: corre el vencimiento (y las renovaciones adelantadas) tantos días
 * como estuvo congelada, y deja el registro en el historial.
 */
export async function unfreezeMember(memberId: string): Promise<FormState> {
  const user = await requireAdmin();
  const today = await gymToday();
  try {
    const result = await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Member" WHERE id = ${memberId} FOR UPDATE`;
      const member = await tx.member.findUnique({ where: { id: memberId } });
      if (!member?.frozenSince) throw new DomainError("La membresía no está congelada");
      const since = isoFromDbDate(member.frozenSince);
      const days = frozenDays(since, today);

      const affected = await tx.membership.findMany({
        where: { memberId, voidedAt: null, endDate: { gte: member.frozenSince } },
      });
      for (const ms of affected) {
        const shifted = shiftPeriod(
          { startDate: isoFromDbDate(ms.startDate), endDate: isoFromDbDate(ms.endDate) },
          since,
          days,
        );
        await tx.membership.update({
          where: { id: ms.id },
          data: { startDate: dbDateFromIso(shifted.startDate), endDate: dbDateFromIso(shifted.endDate) },
        });
      }
      const latest = await tx.membership.findFirst({
        where: { memberId, voidedAt: null },
        orderBy: { endDate: "desc" },
      });
      await tx.membershipFreeze.create({
        data: {
          memberId,
          startDate: member.frozenSince,
          endDate: dbDateFromIso(today),
          days,
          reason: member.frozenReason,
          createdById: user.id,
        },
      });
      await tx.member.update({
        where: { id: memberId },
        data: { frozenSince: null, frozenReason: null, currentEndDate: latest?.endDate ?? null },
      });
      return { days, endDate: latest ? isoFromDbDate(latest.endDate) : null };
    });
    revalidateMember(memberId);
    const d = result.days;
    return {
      ok:
        d === 0
          ? "Membresía descongelada (mismo día, el vencimiento no cambia)"
          : `Membresía descongelada: se corrió ${d} ${d === 1 ? "día" : "días"}, ahora vence el ${formatDate(result.endDate)}`,
    };
  } catch (e) {
    if (e instanceof DomainError) return { error: e.message };
    throw e;
  }
}
