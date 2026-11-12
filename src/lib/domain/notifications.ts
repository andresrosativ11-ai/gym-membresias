import { daysBetween, type ISODate } from "./dates";

export type NotificationKind = "EXPIRING_SOON" | "EXPIRED";
export type Channel = "WHATSAPP" | "EMAIL";

/** Resultado común de un envío por cualquier proveedor. */
export type SendResult =
  | { ok: true; messageId: string | null }
  | { ok: false; error: string; retryable: boolean };

/** Días después del vencimiento en que aún se envía "vencida" (por si el cron falló algún día). */
export const EXPIRED_WINDOW_DAYS = 3;
export const MAX_ATTEMPTS = 3;

/**
 * Normaliza un teléfono al formato que exige WhatsApp: solo dígitos, con código
 * de país (E.164 sin "+"). Devuelve null si no parece un número válido.
 */
export function normalizeWhatsappNumber(phone: string, countryCode: string): string | null {
  const trimmed = phone.trim();
  let digits = trimmed.replace(/\D/g, "");
  if (!digits) return null;

  if (trimmed.startsWith("+")) {
    // ya es internacional
  } else if (digits.startsWith("00")) {
    digits = digits.slice(2);
  } else if (digits.startsWith(countryCode) && digits.length >= countryCode.length + 10) {
    // ya incluye el código de país
  } else {
    if (digits.startsWith("0")) digits = digits.slice(1); // prefijo troncal nacional
    digits = countryCode + digits;
  }
  return digits.length >= 10 && digits.length <= 15 ? digits : null;
}

/** Qué aviso corresponde según el vencimiento, o null si ninguno. */
export function notificationTypeFor(endDate: ISODate, today: ISODate, expiringSoonDays: number): NotificationKind | null {
  const daysLeft = daysBetween(today, endDate);
  if (daysLeft >= 0 && daysLeft <= expiringSoonDays) return "EXPIRING_SOON";
  if (daysLeft < 0 && daysLeft >= -EXPIRED_WINDOW_DAYS) return "EXPIRED";
  return null;
}

/**
 * Decide si enviar según el registro existente para (membresía, tipo, canal).
 * SENDING se trata como enviado: ante la duda, no duplicar un mensaje al socio.
 */
export function decideAttempt(existing: { status: string; attempts: number } | null): "new" | "retry" | "skip" {
  if (!existing) return "new";
  if (existing.status === "FAILED" && existing.attempts < MAX_ATTEMPTS) return "retry";
  return "skip";
}
