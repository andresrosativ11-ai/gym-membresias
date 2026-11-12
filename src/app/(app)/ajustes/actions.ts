"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import type { FormState } from "@/components/action-form";
import { db } from "@/lib/db";
import { isUniqueViolation } from "@/lib/members";
import { requireAdmin } from "@/lib/session";
import { firstError, settingsSchema, staffSchema } from "@/lib/validation";

export async function createStaff(_prev: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  const parsed = staffSchema.safeParse({
    name: fd.get("name") ?? "",
    email: fd.get("email") ?? "",
    role: fd.get("role") ?? "",
    password: fd.get("password") ?? "",
  });
  if (!parsed.success) return { error: firstError(parsed.error) };
  const { password, ...data } = parsed.data;
  try {
    await db.user.create({ data: { ...data, passwordHash: await bcrypt.hash(password, 10) } });
  } catch (e) {
    if (isUniqueViolation(e)) return { error: "Ya existe un usuario con ese email" };
    throw e;
  }
  revalidatePath("/ajustes");
  return { ok: `Usuario ${data.email} creado` };
}

export async function setStaffActive(userId: string, active: boolean): Promise<void> {
  const me = await requireAdmin();
  if (userId === me.id) return; // nunca desactivarse a uno mismo
  await db.user.update({ where: { id: userId }, data: { active } });
  revalidatePath("/ajustes");
}

export async function updateSettings(_prev: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  const parsed = settingsSchema.safeParse({
    gymName: fd.get("gymName") ?? "",
    timezone: fd.get("timezone") ?? "",
    currency: String(fd.get("currency") ?? "").toUpperCase(),
    expiringSoonDays: fd.get("expiringSoonDays") ?? "",
  });
  if (!parsed.success) return { error: firstError(parsed.error) };

  // Un solo gimnasio → todos los planes usan la moneda configurada (no convierte montos).
  await db.$transaction([
    db.settings.upsert({ where: { id: 1 }, update: parsed.data, create: { id: 1, ...parsed.data } }),
    db.plan.updateMany({ data: { currency: parsed.data.currency } }),
  ]);
  revalidatePath("/", "layout");
  return { ok: "Ajustes guardados" };
}
