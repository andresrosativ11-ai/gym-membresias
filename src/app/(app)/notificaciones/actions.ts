"use server";

import { revalidatePath } from "next/cache";
import type { FormState } from "@/components/action-form";
import { db } from "@/lib/db";
import { runNotifications, sendTestEmail, sendTestWhatsapp, type RunSummary } from "@/lib/notifications";
import { requireAdmin } from "@/lib/session";

export async function saveNotificationSettings(_prev: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  const countryCode = String(fd.get("countryCode") ?? "").replace(/\D/g, "");
  if (!/^\d{1,4}$/.test(countryCode)) return { error: "Código de país inválido (ej. 52 para México)" };
  const data = {
    whatsappEnabled: fd.get("whatsappEnabled") === "on",
    emailEnabled: fd.get("emailEnabled") === "on",
    countryCode,
  };
  await db.settings.upsert({ where: { id: 1 }, update: data, create: { id: 1, ...data } });
  revalidatePath("/notificaciones");
  revalidatePath("/ajustes");
  return { ok: "Configuración guardada" };
}

export async function previewNotificationsAction(): Promise<RunSummary> {
  await requireAdmin();
  return runNotifications({ dryRun: true });
}

export async function runNotificationsAction(): Promise<RunSummary> {
  await requireAdmin();
  const summary = await runNotifications({ dryRun: false });
  revalidatePath("/notificaciones");
  return summary;
}

export async function sendTestWhatsappAction(_prev: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  const phone = String(fd.get("phone") ?? "").trim();
  if (!phone) return { error: "Escribe un teléfono" };
  const r = await sendTestWhatsapp(phone);
  return r.ok
    ? { ok: `WhatsApp de prueba enviado a ${r.to}. Si no llega, revisa que ese número pueda recibir mensajes de tu cuenta.` }
    : { error: r.error };
}

export async function sendTestEmailAction(_prev: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  const address = String(fd.get("email") ?? "").trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) return { error: "Escribe un email válido" };
  const r = await sendTestEmail(address);
  return r.ok ? { ok: `Email de prueba enviado a ${r.to}. Revisa también la carpeta de spam.` } : { error: r.error };
}
