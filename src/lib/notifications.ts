import "server-only";
import type { Member } from "@prisma/client";
import { db } from "./db";
import { addDays, dbDateFromIso, isoFromDbDate, todayInTimeZone } from "./domain/dates";
import { buildReminderEmail } from "./domain/email-templates";
import {
  decideAttempt,
  EXPIRED_WINDOW_DAYS,
  MAX_ATTEMPTS,
  normalizeWhatsappNumber,
  notificationTypeFor,
  type Channel,
  type NotificationKind,
  type SendResult,
} from "./domain/notifications";
import { getEmailConfig, sendEmail, type EmailConfig } from "./email";
import { formatDate } from "./format";
import { isUniqueViolation } from "./members";
import { getSettings } from "./settings";
import { getWhatsAppConfig, sendTemplate, type WhatsAppConfig } from "./whatsapp";

export const CHANNELS: Channel[] = ["WHATSAPP", "EMAIL"];
export const CHANNEL_LABEL: Record<Channel, string> = { WHATSAPP: "WhatsApp", EMAIL: "Email" };

export type RunItem = {
  memberId: string;
  name: string;
  channel: Channel;
  type: NotificationKind;
  to: string | null;
  status: "PREVIEW" | "SENT" | "FAILED";
  error?: string;
};

export type ChannelState = { enabled: boolean; configured: boolean; blockedReason?: string };

export type RunSummary = {
  dryRun: boolean;
  channels: Record<Channel, ChannelState>;
  sent: number;
  failed: number;
  items: RunItem[];
};

type Settings = Awaited<ReturnType<typeof getSettings>>;

/** Destinatario del canal para un socio (o null si no tiene un dato válido). */
function contactFor(channel: Channel, member: Member, settings: Settings): string | null {
  if (channel === "WHATSAPP") return member.phone ? normalizeWhatsappNumber(member.phone, settings.countryCode) : null;
  return member.email ? member.email.trim().toLowerCase() : null;
}

function consents(channel: Channel, member: Member): boolean {
  return channel === "WHATSAPP" ? member.notifyWhatsapp && !!member.phone : member.notifyEmail && !!member.email;
}

/**
 * Envía (o previsualiza con dryRun) los avisos pendientes por cada canal activo:
 *  - "por vencer": vence en los próximos N días (Settings.expiringSoonDays)
 *  - "vencida": venció hace 1–3 días y no renovó
 * Idempotente: una fila en NotificationLog por (membresía, tipo, canal) se reclama
 * ANTES de enviar, así que dos ejecuciones simultáneas no duplican mensajes.
 */
export async function runNotifications({ dryRun }: { dryRun: boolean }): Promise<RunSummary> {
  const settings = await getSettings();
  const wa = getWhatsAppConfig();
  const em = getEmailConfig();

  const channels: Record<Channel, ChannelState> = {
    WHATSAPP: { enabled: settings.whatsappEnabled, configured: wa !== null },
    EMAIL: { enabled: settings.emailEnabled, configured: em !== null },
  };
  for (const ch of CHANNELS) {
    const s = channels[ch];
    if (!s.configured) s.blockedReason = "Faltan las credenciales en el servidor.";
    else if (!s.enabled) s.blockedReason = "El envío automático está desactivado.";
  }
  const summary: RunSummary = { dryRun, channels, sent: 0, failed: 0, items: [] };

  // La vista previa muestra todos los canales; el envío real solo los listos.
  const active = CHANNELS.filter((ch) => dryRun || !channels[ch].blockedReason);
  if (active.length === 0) return summary;

  const today = todayInTimeZone(settings.timezone);
  const soon = settings.expiringSoonDays;
  const members = await db.member.findMany({
    where: {
      deletedAt: null,
      suspendedAt: null,
      currentEndDate: {
        gte: dbDateFromIso(addDays(today, -EXPIRED_WINDOW_DAYS)),
        lte: dbDateFromIso(addDays(today, soon)),
      },
      OR: [
        ...(active.includes("WHATSAPP") ? [{ notifyWhatsapp: true, phone: { not: null } }] : []),
        ...(active.includes("EMAIL") ? [{ notifyEmail: true, email: { not: null } }] : []),
      ],
    },
    include: { memberships: { where: { voidedAt: null }, orderBy: { endDate: "desc" }, take: 1 } },
    orderBy: { currentEndDate: "asc" },
  });

  const jobs = members.flatMap((m) => {
    const membership = m.memberships[0];
    if (!membership || !m.currentEndDate) return [];
    const endDate = isoFromDbDate(m.currentEndDate);
    const type = notificationTypeFor(endDate, today, soon);
    if (!type) return [];
    return active
      .filter((channel) => consents(channel, m))
      .map((channel) => ({ member: m, membershipId: membership.id, endDate, type, channel }));
  });

  const logs = await db.notificationLog.findMany({
    where: { membershipId: { in: [...new Set(jobs.map((j) => j.membershipId))] } },
  });
  const logFor = (membershipId: string, type: NotificationKind, channel: Channel) =>
    logs.find((l) => l.membershipId === membershipId && l.type === type && l.channel === channel) ?? null;

  for (const { member, membershipId, type, endDate, channel } of jobs) {
    const name = `${member.firstName} ${member.lastName}`;
    const to = contactFor(channel, member, settings);
    const existing = logFor(membershipId, type, channel);
    const decision = decideAttempt(existing);
    if (decision === "skip") continue;
    const base = { memberId: member.id, name, channel, type, to };

    if (dryRun) {
      summary.items.push({ ...base, status: "PREVIEW", error: to ? undefined : "Dato de contacto inválido" });
      continue;
    }

    // 1) Reclamar el envío (gana una sola ejecución).
    let logId: string;
    if (decision === "new") {
      try {
        const log = await db.notificationLog.create({
          data: { membershipId, memberId: member.id, type, channel, status: "SENDING" },
        });
        logId = log.id;
      } catch (e) {
        if (isUniqueViolation(e)) continue; // otra ejecución lo tomó
        throw e;
      }
    } else {
      const claimed = await db.notificationLog.updateMany({
        where: { id: existing!.id, status: "FAILED", attempts: { lt: MAX_ATTEMPTS } },
        data: { status: "SENDING", attempts: { increment: 1 }, error: null },
      });
      if (claimed.count === 0) continue;
      logId = existing!.id;
    }

    // 2) Enviar.
    let result: SendResult;
    if (!to) {
      result = { ok: false, error: channel === "WHATSAPP" ? "Teléfono inválido" : "Email inválido", retryable: false };
    } else if (channel === "WHATSAPP") {
      const cfg = wa as WhatsAppConfig;
      result = await sendTemplate(cfg, to, cfg.templates[type], cfg.language, [
        member.firstName,
        settings.gymName,
        formatDate(endDate),
      ]);
    } else {
      const email = buildReminderEmail(type, { firstName: member.firstName, gymName: settings.gymName, endDate });
      result = await sendEmail(em as EmailConfig, { to, ...email, idempotencyKey: `notif-${logId}` });
    }

    // 3) Registrar resultado.
    if (result.ok) {
      await db.notificationLog.update({
        where: { id: logId },
        data: { status: "SENT", providerMessageId: result.messageId, sentAt: new Date() },
      });
      summary.sent++;
      summary.items.push({ ...base, status: "SENT" });
    } else {
      await db.notificationLog.update({
        where: { id: logId },
        data: { status: "FAILED", error: result.error, ...(result.retryable ? {} : { attempts: MAX_ATTEMPTS }) },
      });
      summary.failed++;
      summary.items.push({ ...base, status: "FAILED", error: result.error });
    }
  }
  return summary;
}

/** Mensaje de prueba por WhatsApp con la plantilla estándar "hello_world". */
export async function sendTestWhatsapp(phone: string) {
  const cfg = getWhatsAppConfig();
  if (!cfg) return { ok: false as const, error: "Faltan WHATSAPP_TOKEN y/o WHATSAPP_PHONE_NUMBER_ID en el servidor." };
  const settings = await getSettings();
  const to = normalizeWhatsappNumber(phone, settings.countryCode);
  if (!to) return { ok: false as const, error: "Teléfono inválido" };
  const result = await sendTemplate(cfg, to, "hello_world", "en_US", []);
  return result.ok ? { ok: true as const, to: `+${to}` } : { ok: false as const, error: result.error };
}

/** Email de prueba con el mismo diseño del aviso "por vencer". */
export async function sendTestEmail(address: string) {
  const cfg = getEmailConfig();
  if (!cfg) return { ok: false as const, error: "Faltan RESEND_API_KEY y/o EMAIL_FROM en el servidor." };
  const settings = await getSettings();
  const email = buildReminderEmail("EXPIRING_SOON", {
    firstName: "Prueba",
    gymName: settings.gymName,
    endDate: todayInTimeZone(settings.timezone),
  });
  const result = await sendEmail(cfg, { to: address, ...email, subject: `[Prueba] ${email.subject}` });
  return result.ok ? { ok: true as const, to: address } : { ok: false as const, error: result.error };
}
