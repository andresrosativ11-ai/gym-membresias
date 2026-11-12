import { addDays, daysBetween, periodEnd, type ISODate, type PlanDuration } from "./dates";

export type MemberStatus = "ACTIVO" | "POR_VENCER" | "VENCIDO" | "SUSPENDIDO" | "SIN_MEMBRESIA" | "BAJA";

export type StatusInput = {
  suspendedAt: Date | null;
  deletedAt: Date | null;
  currentEndDate: ISODate | null;
};

export type StatusResult = {
  status: MemberStatus;
  /** Días hasta el vencimiento (0 = vence hoy, negativo = vencido). */
  daysLeft: number | null;
};

/** El estado se deriva siempre; nunca se persiste. */
export function computeStatus(member: StatusInput, today: ISODate, expiringSoonDays: number): StatusResult {
  const daysLeft = member.currentEndDate ? daysBetween(today, member.currentEndDate) : null;
  if (member.deletedAt) return { status: "BAJA", daysLeft };
  if (member.suspendedAt) return { status: "SUSPENDIDO", daysLeft };
  if (daysLeft === null) return { status: "SIN_MEMBRESIA", daysLeft };
  if (daysLeft < 0) return { status: "VENCIDO", daysLeft };
  if (daysLeft <= expiringSoonDays) return { status: "POR_VENCER", daysLeft };
  return { status: "ACTIVO", daysLeft };
}

/**
 * Periodo de una nueva membresía/renovación:
 * - Si la actual sigue vigente (vence hoy o después), la nueva empieza al día
 *   siguiente del vencimiento, sin perder días.
 * - Si ya venció o no existe, empieza hoy.
 */
export function computeNewPeriod(
  currentEndDate: ISODate | null,
  today: ISODate,
  plan: PlanDuration,
): { startDate: ISODate; endDate: ISODate } {
  const startDate = currentEndDate && currentEndDate >= today ? addDays(currentEndDate, 1) : today;
  return { startDate, endDate: periodEnd(startDate, plan) };
}

export const STATUS_LABEL: Record<MemberStatus, string> = {
  ACTIVO: "Activo",
  POR_VENCER: "Por vencer",
  VENCIDO: "Vencido",
  SUSPENDIDO: "Suspendido",
  SIN_MEMBRESIA: "Sin membresía",
  BAJA: "Baja",
};
