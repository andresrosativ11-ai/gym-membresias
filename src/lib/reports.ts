import "server-only";
import { Prisma } from "@prisma/client";
import { db } from "./db";
import { bucketKeys, bucketUnit, type Period } from "./domain/periods";

/** Convierte una columna timestamp (guardada en UTC) a hora local del gimnasio. */
function local(column: string, tz: string): Prisma.Sql {
  return Prisma.sql`((${Prisma.raw(column)} AT TIME ZONE 'UTC') AT TIME ZONE ${tz})`;
}

function inPeriod(column: string, tz: string, period: Period): Prisma.Sql {
  return Prisma.sql`${local(column, tz)}::date BETWEEN ${period.from}::date AND ${period.to}::date`;
}

export type Bucket = { key: string; value: number; count: number };

function fillBuckets(period: Period, rows: { bucket: string; value: number; count: number }[]): Bucket[] {
  const byKey = new Map(rows.map((r) => [r.bucket, r]));
  return bucketKeys(period.from, period.to, bucketUnit(period.from, period.to)).map((key) => ({
    key,
    value: byKey.get(key)?.value ?? 0,
    count: byKey.get(key)?.count ?? 0,
  }));
}

export async function revenueReport(period: Period, tz: string) {
  const unit = bucketUnit(period.from, period.to);
  const paid = local(`p."paidAt"`, tz);
  const where = Prisma.sql`p."voidedAt" IS NULL AND ${inPeriod(`p."paidAt"`, tz, period)}`;

  const [totals, buckets, byMethod, byPlan] = await Promise.all([
    db.$queryRaw<{ cents: number; count: number }[]>`
      SELECT COALESCE(SUM(p."amountCents"), 0)::float8 AS cents, COUNT(*)::int AS count
      FROM "Payment" p WHERE ${where}`,
    db.$queryRaw<{ bucket: string; value: number; count: number }[]>`
      SELECT to_char(date_trunc(${unit}, ${paid}), 'YYYY-MM-DD') AS bucket,
             SUM(p."amountCents")::float8 AS value, COUNT(*)::int AS count
      FROM "Payment" p WHERE ${where}
      GROUP BY 1 ORDER BY 1`,
    db.$queryRaw<{ method: string; value: number; count: number }[]>`
      SELECT p.method::text AS method, SUM(p."amountCents")::float8 AS value, COUNT(*)::int AS count
      FROM "Payment" p WHERE ${where}
      GROUP BY 1 ORDER BY 2 DESC`,
    db.$queryRaw<{ plan: string; value: number; count: number }[]>`
      SELECT COALESCE(pl.name, 'Sin plan') AS plan, SUM(p."amountCents")::float8 AS value, COUNT(*)::int AS count
      FROM "Payment" p
      LEFT JOIN "Membership" m ON m."paymentId" = p.id
      LEFT JOIN "Plan" pl ON pl.id = m."planId"
      WHERE ${where}
      GROUP BY 1 ORDER BY 2 DESC`,
  ]);

  return {
    unit,
    totalCents: totals[0]?.cents ?? 0,
    count: totals[0]?.count ?? 0,
    buckets: fillBuckets(period, buckets),
    byMethod,
    byPlan,
  };
}

export async function attendanceReport(period: Period, tz: string) {
  const unit = bucketUnit(period.from, period.to);
  const at = local(`c."at"`, tz);
  const where = Prisma.sql`${inPeriod(`c."at"`, tz, period)}`;

  const [totals, buckets, byHour] = await Promise.all([
    db.$queryRaw<{ allowed: number; denied: number; members: number }[]>`
      SELECT COUNT(*) FILTER (WHERE c.result = 'ALLOWED')::int AS allowed,
             COUNT(*) FILTER (WHERE c.result <> 'ALLOWED')::int AS denied,
             COUNT(DISTINCT c."memberId") FILTER (WHERE c.result = 'ALLOWED')::int AS members
      FROM "CheckIn" c WHERE ${where}`,
    db.$queryRaw<{ bucket: string; value: number; count: number }[]>`
      SELECT to_char(date_trunc(${unit}, ${at}), 'YYYY-MM-DD') AS bucket,
             COUNT(*)::float8 AS value, COUNT(*)::int AS count
      FROM "CheckIn" c WHERE ${where} AND c.result = 'ALLOWED'
      GROUP BY 1 ORDER BY 1`,
    db.$queryRaw<{ hour: number; value: number }[]>`
      SELECT EXTRACT(HOUR FROM ${at})::int AS hour, COUNT(*)::float8 AS value
      FROM "CheckIn" c WHERE ${where} AND c.result = 'ALLOWED'
      GROUP BY 1 ORDER BY 1`,
  ]);

  const hours = new Map(byHour.map((h) => [h.hour, h.value]));
  return {
    unit,
    allowed: totals[0]?.allowed ?? 0,
    denied: totals[0]?.denied ?? 0,
    uniqueMembers: totals[0]?.members ?? 0,
    buckets: fillBuckets(period, buckets),
    byHour: Array.from({ length: 24 }, (_, hour) => ({ hour, value: hours.get(hour) ?? 0 })),
  };
}

/** Pagos detallados del periodo (para exportar a CSV). */
export async function paymentsForExport(period: Period, tz: string) {
  return db.$queryRaw<
    {
      paidAt: string;
      memberNumber: number;
      memberName: string;
      plan: string | null;
      amountCents: number;
      method: string;
      reference: string | null;
      receivedBy: string;
      voided: boolean;
    }[]
  >`
    SELECT to_char(${local(`p."paidAt"`, tz)}, 'YYYY-MM-DD HH24:MI') AS "paidAt",
           mb."memberNumber" AS "memberNumber",
           mb."firstName" || ' ' || mb."lastName" AS "memberName",
           pl.name AS plan,
           p."amountCents" AS "amountCents",
           p.method::text AS method,
           p.reference AS reference,
           u.name AS "receivedBy",
           (p."voidedAt" IS NOT NULL) AS voided
    FROM "Payment" p
    JOIN "Member" mb ON mb.id = p."memberId"
    JOIN "User" u ON u.id = p."receivedById"
    LEFT JOIN "Membership" m ON m."paymentId" = p.id
    LEFT JOIN "Plan" pl ON pl.id = m."planId"
    WHERE ${inPeriod(`p."paidAt"`, tz, period)}
    ORDER BY p."paidAt"`;
}
