import "server-only";
import { randomBytes } from "node:crypto";
import { Prisma } from "@prisma/client";
import { addDays, dbDateFromIso, isoFromDbDate, type ISODate } from "./domain/dates";
import { computeStatus, type StatusInput } from "./domain/membership";
import { normalizeSearch } from "./domain/search";
import { photoUrl } from "./storage";

export const MEMBER_FILTERS = [
  "todos",
  "vigentes",
  "por_vencer",
  "inactivos",
  "vencidos",
  "congelados",
  "suspendidos",
  "sin_membresia",
  "bajas",
] as const;
export type MemberFilter = (typeof MEMBER_FILTERS)[number];

export const FILTER_LABEL: Record<MemberFilter, string> = {
  todos: "Todos",
  vigentes: "Vigentes",
  por_vencer: "Por vencer",
  inactivos: "Inactivos",
  vencidos: "Vencidos",
  congelados: "Congelados",
  suspendidos: "Suspendidos",
  sin_membresia: "Sin membresía",
  bajas: "Bajas",
};

export function parseFilter(value: string | undefined): MemberFilter {
  return MEMBER_FILTERS.includes(value as MemberFilter) ? (value as MemberFilter) : "todos";
}

/** Acepta solo fechas "YYYY-MM-DD" válidas; cualquier otra cosa se ignora. */
export function parseIsoParam(value: string | undefined): ISODate | undefined {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value ? value : undefined;
}

export const DEFAULT_INACTIVE_DAYS = 10;

export type EnrolledRange = { from?: ISODate; to?: ISODate };

/** Traduce un filtro de estado + texto de búsqueda + rango de inscripción a un WHERE de Prisma. */
export function memberWhere(
  filter: MemberFilter,
  q: string | undefined,
  today: ISODate,
  expiringSoonDays: number,
  options: { enrolled?: EnrolledRange; inactiveDays?: number } = {},
): Prisma.MemberWhereInput {
  const { enrolled = {}, inactiveDays = DEFAULT_INACTIVE_DAYS } = options;
  const t = dbDateFromIso(today);
  const soon = dbDateFromIso(addDays(today, expiringSoonDays));
  const live = { deletedAt: null, suspendedAt: null, frozenSince: null };
  // Medianoche UTC del día de corte: diferencia de pocas horas con la hora local, irrelevante en una ventana de días.
  const inactiveCutoff = dbDateFromIso(addDays(today, -inactiveDays));
  const byFilter: Record<MemberFilter, Prisma.MemberWhereInput> = {
    todos: { deletedAt: null },
    vigentes: { ...live, currentEndDate: { gte: t } },
    por_vencer: { ...live, currentEndDate: { gte: t, lte: soon } },
    inactivos: {
      ...live,
      currentEndDate: { gte: t },
      // Los recién inscritos aún no cuentan como inactivos.
      enrolledAt: { lte: inactiveCutoff },
      checkIns: { none: { result: "ALLOWED", at: { gte: inactiveCutoff } } },
    },
    vencidos: { ...live, currentEndDate: { lt: t } },
    congelados: { deletedAt: null, suspendedAt: null, frozenSince: { not: null } },
    suspendidos: { deletedAt: null, suspendedAt: { not: null } },
    sin_membresia: { ...live, currentEndDate: null },
    bajas: { deletedAt: { not: null } },
  };

  const and: Prisma.MemberWhereInput[] = [byFilter[filter]];
  if (enrolled.from || enrolled.to) {
    and.push({
      enrolledAt: {
        ...(enrolled.from && { gte: dbDateFromIso(enrolled.from) }),
        ...(enrolled.to && { lte: dbDateFromIso(enrolled.to) }),
      },
    });
  }
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
  frozenSince: Date | null;
};

/** Datos de la fila de BD que necesita el cálculo de estado. */
export function statusInput(m: Pick<MemberRow, "suspendedAt" | "deletedAt" | "currentEndDate" | "frozenSince">): StatusInput {
  return {
    suspendedAt: m.suspendedAt,
    deletedAt: m.deletedAt,
    currentEndDate: m.currentEndDate ? isoFromDbDate(m.currentEndDate) : null,
    frozenSince: m.frozenSince ? isoFromDbDate(m.frozenSince) : null,
  };
}

export function memberView(m: MemberRow, today: ISODate, expiringSoonDays: number) {
  const input = statusInput(m);
  const endDate = input.currentEndDate;
  const { status, daysLeft } = computeStatus(input, today, expiringSoonDays);
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
