import type { ISODate } from "./dates";
import { computeStatus, type StatusInput } from "./membership";

export type CheckInResult =
  | "ALLOWED"
  | "DENIED_EXPIRED"
  | "DENIED_SUSPENDED"
  | "DENIED_NO_MEMBERSHIP"
  | "DENIED_INACTIVE";

export type AccessDecision = {
  allowed: boolean;
  result: CheckInResult;
  message: string;
};

export function evaluateAccess(member: StatusInput, today: ISODate, expiringSoonDays: number): AccessDecision {
  const { status, daysLeft } = computeStatus(member, today, expiringSoonDays);
  switch (status) {
    case "BAJA":
      return { allowed: false, result: "DENIED_INACTIVE", message: "Socio dado de baja" };
    case "SUSPENDIDO":
      return { allowed: false, result: "DENIED_SUSPENDED", message: "Membresía suspendida" };
    case "SIN_MEMBRESIA":
      return { allowed: false, result: "DENIED_NO_MEMBERSHIP", message: "No tiene membresía asignada" };
    case "VENCIDO": {
      const d = Math.abs(daysLeft ?? 0);
      return {
        allowed: false,
        result: "DENIED_EXPIRED",
        message: `Membresía vencida hace ${d} ${d === 1 ? "día" : "días"}`,
      };
    }
    case "POR_VENCER":
      return {
        allowed: true,
        result: "ALLOWED",
        message:
          daysLeft === 0
            ? "Acceso permitido — vence hoy"
            : `Acceso permitido — vence en ${daysLeft} ${daysLeft === 1 ? "día" : "días"}`,
      };
    case "ACTIVO":
      return { allowed: true, result: "ALLOWED", message: "Acceso permitido" };
  }
}

/** Ventana para ignorar el mismo QR escaneado varias veces seguidas. */
export const DUPLICATE_WINDOW_MS = 60_000;

export function isDuplicateCheckIn(lastAllowedAt: Date | null, now: Date): boolean {
  return lastAllowedAt !== null && now.getTime() - lastAllowedAt.getTime() < DUPLICATE_WINDOW_MS;
}
