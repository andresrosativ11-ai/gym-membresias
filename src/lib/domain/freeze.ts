import { addDays, daysBetween, type ISODate } from "./dates";
import type { MemberStatus } from "./membership";

/** Solo se congela una membresía vigente (no vencida, suspendida ni dada de baja). */
export function canFreeze(status: MemberStatus): boolean {
  return status === "ACTIVO" || status === "POR_VENCER";
}

/** Días que estuvo congelada: desde el día de congelar hasta el día antes de descongelar. */
export function frozenDays(frozenSince: ISODate, today: ISODate): number {
  return Math.max(0, daysBetween(frozenSince, today));
}

/**
 * Corre un periodo de membresía por los días congelados. Solo se mueven las
 * partes que caen desde el día de congelar en adelante: el vencimiento de la
 * membresía en curso y, si había renovaciones adelantadas, también su inicio.
 */
export function shiftPeriod(
  period: { startDate: ISODate; endDate: ISODate },
  frozenSince: ISODate,
  days: number,
): { startDate: ISODate; endDate: ISODate } {
  if (days <= 0 || period.endDate < frozenSince) return period;
  return {
    startDate: period.startDate >= frozenSince ? addDays(period.startDate, days) : period.startDate,
    endDate: addDays(period.endDate, days),
  };
}

/** Días desde la última visita permitida (null = nunca vino). */
export function daysSinceVisit(lastVisit: ISODate | null, today: ISODate): number | null {
  return lastVisit ? daysBetween(lastVisit, today) : null;
}
