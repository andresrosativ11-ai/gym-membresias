import "server-only";
import { randomBytes } from "node:crypto";
import { Prisma } from "@prisma/client";
import { addDays, dbDateFromIso, isoFromDbDate, type ISODate } from "./domain/dates";
import { computeStatus } from "./domain/membership";
import { normalizeSearch } from "./domain/search";
import { photoUrl } from "./storage";

export const MEMBER_FILTERS = [
  "todos",
  "vigentes",
  "por_vencer",
  "vencidos",
  "suspendidos",
  "sin_membresia",
  "bajas",
] as const;
export type MemberFilter = (typeof MEMBER_FILTERS)[number];

export const FILTER_LABEL: Record<MemberFilter, string> = {
  todos: "Todos",
  vigentes: "Vigentes",
  por_vencer: "Por vencer",
  vencidos: "Vencidos",
  suspendidos: "Suspendidos",
  sin_membresia: "Sin membresía",
  bajas: "Bajas",
};

export function parseFilter(value: string | undefined): MemberFilter {
  return MEMBER_FILTERS.includes(value as MemberFilter) ? (value as MemberFilter) : "todos";
}

/** Traduce un filtro de estado + texto de búsqueda a un WHERE de Prisma. */
export function memberWhere(
  filter: MemberFilter,
  q: string | undefined,
  today: ISODate,
  expiringSoonDays: number,
): Prisma.MemberWhereInput {
  const t = dbDateFromIso(today);
  const soon = dbDateFromIso(addDays(today, expiringSoonDays));
  const live = { deletedAt: null, suspendedAt: null };
  const byFilter: Record<MemberFilter, Prisma.MemberWhereInput> = {
    todos: { deletedAt: null },
    vigentes: { ...live, currentEndDate: { gte: t } },
    por_vencer: { ...live, currentEndDate: { gte: t, lte: soon } },
    vencidos: { ...live, currentEndDate: { lt: t } },
    suspendidos: { deletedAt: null, suspendedAt: { not: null } },
    sin_membresia: { ...live, currentEndDate: null },
    bajas: { deletedAt: { not: null } },
  };

  const and: Prisma.MemberWhereInput[] = [byFilter[filter]];
  // searchText ya está en minúsculas y sin acentos: "lop" encuentra "López".
  const terms = normalizeSearch(q ?? "").split(" ").filter(Boolean).slice(0, 5);
  for (const term of terms) {
    const or: Prisma.MemberWhereInput[] = [{ searchText: { contains: term } }];
    if (/^\d{1,9}$/.test(term)) or.push({ memberNumber: Number(term) });
    and.push({ OR: or });
  }
  return { AND: and };
}

type MemberRow = {
  id: string;
  memberNumber: number;
  firstName: string;
  lastName: string;
  photoKey: string | null;
  suspendedAt: Date | null;
  deletedAt: Date | null;
  currentEndDate: Date | null;
};

export function memberView(m: MemberRow, today: ISODate, expiringSoonDays: number) {
  const endDate = m.currentEndDate ? isoFromDbDate(m.currentEndDate) : null;
  const { status, daysLeft } = computeStatus(
    { suspendedAt: m.suspendedAt, deletedAt: m.deletedAt, currentEndDate: endDate },
    today,
    expiringSoonDays,
  );
  return {
    id: m.id,
    memberNumber: m.memberNumber,
    fullName: `${m.firstName} ${m.lastName}`,
    photoUrl: photoUrl(m.photoKey),
    endDate,
    status,
    daysLeft,
  };
}
export type MemberView = ReturnType<typeof memberView>;

/** Token opaco para el QR (no contiene datos personales). */
export function newAccessCode(): string {
  return randomBytes(18).toString("base64url");
}

export function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}
