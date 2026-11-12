import Link from "next/link";
import { Avatar } from "@/components/avatar";
import { StatTile } from "@/components/charts";
import { db } from "@/lib/db";
import { addDays, dbDateFromIso, todayInTimeZone } from "@/lib/domain/dates";
import { formatDate, formatMoney, whatsappLink } from "@/lib/format";
import { memberView, memberWhere, type MemberView } from "@/lib/members";
import { requireUser } from "@/lib/session";
import { getSettings } from "@/lib/settings";

const RECENT_EXPIRED_DAYS = 30;

export default async function InicioPage() {
  const user = await requireUser();
  const isAdmin = user.role === "ADMIN";
  const settings = await getSettings();
  const tz = settings.timezone;
  const today = todayInTimeZone(tz);
  const soon = settings.expiringSoonDays;

  const expiredWhere = {
    deletedAt: null,
    suspendedAt: null,
    currentEndDate: { gte: dbDateFromIso(addDays(today, -RECENT_EXPIRED_DAYS)), lt: dbDateFromIso(today) },
  };

  const [expiring, expired, todayStats] = await Promise.all([
    db.member.findMany({
      where: memberWhere("por_vencer", undefined, today, soon),
      orderBy: { currentEndDate: "asc" },
      take: 50,
    }),
    db.member.findMany({ where: expiredWhere, orderBy: { currentEndDate: "desc" }, take: 50 }),
    db.$queryRaw<{ entries: number; revenue: number }[]>`
      SELECT
        (SELECT COUNT(*)::int FROM "CheckIn"
          WHERE result = 'ALLOWED' AND ((at AT TIME ZONE 'UTC') AT TIME ZONE ${tz})::date = ${today}::date) AS entries,
        (SELECT COALESCE(SUM("amountCents"), 0)::float8 FROM "Payment"
          WHERE "voidedAt" IS NULL AND (("paidAt" AT TIME ZONE 'UTC') AT TIME ZONE ${tz})::date = ${today}::date) AS revenue`,
  ]);
  const stats = todayStats[0] ?? { entries: 0, revenue: 0 };

  const contact = (m: (typeof expiring)[number], view: MemberView) => {
    if (!m.phone) return null;
    const msg =
      view.status === "VENCIDO"
        ? `Hola ${m.firstName}, tu membresía en ${settings.gymName} venció el ${formatDate(view.endDate)}. ¡Te esperamos para renovar!`
        : `Hola ${m.firstName}, tu membresía en ${settings.gymName} vence el ${formatDate(view.endDate)}. ¡Renueva para no perder tu acceso!`;
    return whatsappLink(m.phone, msg);
  };

  const renderList = (rows: typeof expiring, empty: string) =>
    rows.length === 0 ? (
      <p className="card text-center text-sm text-zinc-500">{empty}</p>
    ) : (
      <ul className="divide-y divide-zinc-100 overflow-hidden rounded-xl border border-zinc-200 bg-white">
        {rows.map((m) => {
          const view = memberView(m, today, soon);
          const wa = contact(m, view);
          const days = view.daysLeft ?? 0;
          const when =
            days === 0
              ? "vence hoy"
              : days > 0
                ? `vence en ${days} ${days === 1 ? "día" : "días"}`
                : `venció hace ${-days} ${days === -1 ? "día" : "días"}`;
          return (
            <li key={m.id} className="flex items-center gap-3 px-4 py-3">
              <Link href={`/socios/${m.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                <Avatar src={view.photoUrl} name={view.fullName} size={40} />
                <span className="min-w-0">
                  <span className="block truncate font-medium">{view.fullName}</span>
                  <span className="text-xs text-zinc-500">
                    {when} · {formatDate(view.endDate)}
                  </span>
                </span>
              </Link>
              {wa && (
                <a
                  href={wa}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-secondary shrink-0 px-3"
                  aria-label={`Enviar WhatsApp a ${view.fullName}`}
                >
                  WhatsApp
                </a>
              )}
            </li>
          );
        })}
      </ul>
    );

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold">Inicio</h1>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Entradas hoy" value={String(stats.entries)} />
        <StatTile label="Por vencer" value={String(expiring.length)} hint={`próximos ${soon} días`} />
        <StatTile label="Vencidos" value={String(expired.length)} hint={`últimos ${RECENT_EXPIRED_DAYS} días`} />
        {isAdmin && <StatTile label="Ingresos hoy" value={formatMoney(stats.revenue, settings.currency)} />}
      </div>

      <section className="space-y-2">
        <div className="flex items-baseline justify-between">
          <h2 className="font-semibold">Por vencer</h2>
          <Link href="/socios?estado=por_vencer" className="text-sm text-zinc-500 underline">
            Ver todos
          </Link>
        </div>
        {renderList(expiring, `Nadie vence en los próximos ${soon} días.`)}
      </section>

      <section className="space-y-2">
        <div className="flex items-baseline justify-between">
          <h2 className="font-semibold">Vencidos recientemente</h2>
          <Link href="/socios?estado=vencidos" className="text-sm text-zinc-500 underline">
            Ver todos
          </Link>
        </div>
        {renderList(expired, `Sin vencimientos en los últimos ${RECENT_EXPIRED_DAYS} días.`)}
      </section>

      <p className="text-xs text-zinc-500">
        El botón de WhatsApp abre un mensaje prellenado; el teléfono debe incluir el código de país (ej. +52).
      </p>
    </div>
  );
}
