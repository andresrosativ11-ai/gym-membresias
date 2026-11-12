import type { ISODate } from "./domain/dates";

export function formatMoney(cents: number, currency: string): string {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency }).format(cents / 100);
}

export function formatDate(date: ISODate | null | undefined): string {
  if (!date) return "—";
  const [y, m, d] = date.split("-");
  return `${d}/${m}/${y}`;
}

export function formatDateTime(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("es-MX", {
    timeZone,
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/** Etiqueta corta de un cubo de gráfico: "11 nov" (día) o "nov 2026" (mes). */
export function formatBucketLabel(key: ISODate, unit: "day" | "month"): string {
  const [y, m, d] = key.split("-");
  const month = MONTHS[Number(m) - 1];
  return unit === "day" ? `${Number(d)} ${month}` : `${month} ${y}`;
}

/** Enlace de WhatsApp (solo dígitos; requiere código de país en el teléfono). */
export function whatsappLink(phone: string, message: string): string | null {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 8) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

export const PAYMENT_METHOD_LABEL: Record<string, string> = {
  CASH: "Efectivo",
  CARD: "Tarjeta",
  TRANSFER: "Transferencia",
  OTHER: "Otro",
};

export function planDurationLabel(plan: { durationMonths: number | null; durationDays: number | null }): string {
  if (plan.durationMonths) return plan.durationMonths === 1 ? "1 mes" : `${plan.durationMonths} meses`;
  if (plan.durationDays) return plan.durationDays === 1 ? "1 día" : `${plan.durationDays} días`;
  return "—";
}
