import "server-only";
import type { Prisma } from "@prisma/client";
import { addDays, startOfDayInTimeZone, type ISODate } from "./domain/dates";
import { parseIsoParam } from "./members";

export const CHECKIN_RESULT_FILTERS = ["todos", "permitidos", "rechazados"] as const;
export type CheckInResultFilter = (typeof CHECKIN_RESULT_FILTERS)[number];

export const CHECKIN_FILTER_LABEL: Record<CheckInResultFilter, string> = {
  todos: "Todos",
  permitidos: "Permitidos",
  rechazados: "Rechazados",
};

export type CheckInHistoryFilters = {
  from: ISODate;
  to: ISODate;
  result: CheckInResultFilter;
  memberId: string | null;
};

/** Lee los filtros de la URL. Sin fechas: últimos 7 días. */
export function parseCheckInFilters(
  sp: { desde?: string; hasta?: string; resultado?: string; socio?: string },
  today: ISODate,
): CheckInHistoryFilters {
  let from = parseIsoParam(sp.desde) ?? addDays(today, -6);
  let to = parseIsoParam(sp.hasta) ?? today;
  if (from > to) [from, to] = [to, from];
  const result = CHECKIN_RESULT_FILTERS.includes(sp.resultado as CheckInResultFilter)
    ? (sp.resultado as CheckInResultFilter)
    : "todos";
  const memberId = sp.socio && /^[a-z0-9]{1,40}$/i.test(sp.socio) ? sp.socio : null;
  return { from, to, result, memberId };
}

export function checkInWhere(f: CheckInHistoryFilters, timeZone: string): Prisma.CheckInWhereInput {
  return {
    // Días completos en la hora del gimnasio: [desde 00:00, hasta+1 00:00).
    at: { gte: startOfDayInTimeZone(f.from, timeZone), lt: startOfDayInTimeZone(addDays(f.to, 1), timeZone) },
    ...(f.result === "permitidos" && { result: "ALLOWED" }),
    ...(f.result === "rechazados" && { result: { not: "ALLOWED" } }),
    ...(f.memberId && { memberId: f.memberId }),
  };
}

export function checkInQueryString(f: CheckInHistoryFilters, extra: Record<string, string> = {}): string {
  const s = new URLSearchParams({ desde: f.from, hasta: f.to });
  if (f.result !== "todos") s.set("resultado", f.result);
  if (f.memberId) s.set("socio", f.memberId);
  for (const [k, v] of Object.entries(extra)) s.set(k, v);
  return s.toString();
}
