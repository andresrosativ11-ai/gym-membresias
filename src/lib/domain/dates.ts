/**
 * Utilidades de fechas calendario. Todas las fechas de negocio se manejan como
 * cadenas ISO "YYYY-MM-DD" para evitar errores de zona horaria.
 */
export type ISODate = string;

const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

function parse(date: ISODate): { y: number; m: number; d: number } {
  const match = ISO_RE.exec(date);
  if (!match) throw new Error(`Fecha inválida: ${date}`);
  return { y: Number(match[1]), m: Number(match[2]), d: Number(match[3]) };
}

function toUtc(date: ISODate): Date {
  const { y, m, d } = parse(date);
  return new Date(Date.UTC(y, m - 1, d));
}

function fromUtc(date: Date): ISODate {
  return date.toISOString().slice(0, 10);
}

function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export function addDays(date: ISODate, days: number): ISODate {
  const dt = toUtc(date);
  dt.setUTCDate(dt.getUTCDate() + days);
  return fromUtc(dt);
}

/** Suma meses; si el día no existe en el mes destino, usa el último día. */
export function addMonthsClamped(date: ISODate, months: number): ISODate {
  const { y, m, d } = parse(date);
  const total = y * 12 + (m - 1) + months;
  const ty = Math.floor(total / 12);
  const tm = (total % 12) + 1;
  const td = Math.min(d, daysInMonth(ty, tm));
  return `${String(ty).padStart(4, "0")}-${String(tm).padStart(2, "0")}-${String(td).padStart(2, "0")}`;
}

export type PlanDuration = {
  durationMonths?: number | null;
  durationDays?: number | null;
};

/**
 * Último día (inclusive) de un periodo que inicia en `start`.
 * - Meses: termina el día anterior al mismo día del mes destino
 *   (15-ene → 14-feb). Si ese día no existe en el mes destino, termina el
 *   último día de ese mes (31-ene → 28-feb).
 * - Días: start + días - 1.
 */
export function periodEnd(start: ISODate, plan: PlanDuration): ISODate {
  if (plan.durationMonths && plan.durationMonths > 0) {
    const { d } = parse(start);
    const target = addMonthsClamped(start, plan.durationMonths);
    const clamped = parse(target).d < d;
    return clamped ? target : addDays(target, -1);
  }
  if (plan.durationDays && plan.durationDays > 0) {
    return addDays(start, plan.durationDays - 1);
  }
  throw new Error("El plan no tiene una duración válida");
}

/** Días calendario de `from` a `to` (negativo si `to` es anterior). */
export function daysBetween(from: ISODate, to: ISODate): number {
  return Math.round((toUtc(to).getTime() - toUtc(from).getTime()) / 86_400_000);
}

/** Fecha calendario actual en la zona horaria indicada. */
export function todayInTimeZone(timeZone: string, now: Date = new Date()): ISODate {
  // en-CA formatea como YYYY-MM-DD
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** Columnas Postgres DATE llegan como Date a medianoche UTC. */
export function isoFromDbDate(date: Date): ISODate {
  return fromUtc(date);
}

export function dbDateFromIso(date: ISODate): Date {
  return toUtc(date);
}
