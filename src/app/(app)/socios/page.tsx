import Link from "next/link";
import { Avatar } from "@/components/avatar";
import { StatusBadge } from "@/components/status-badge";
import { db } from "@/lib/db";
import { isoFromDbDate, todayInTimeZone } from "@/lib/domain/dates";
import { daysSinceVisit } from "@/lib/domain/freeze";
import { formatDate } from "@/lib/format";
import {
  FILTER_LABEL,
  MEMBER_FILTERS,
  memberView,
  memberWhere,
  parseFilter,
  parseIsoParam,
  type MemberFilter,
} from "@/lib/members";
import { requireUser } from "@/lib/session";
import { getSettings } from "@/lib/settings";

const PAGE_SIZE = 30;

export default async function SociosPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; estado?: string; page?: string; desde?: string; hasta?: string }>;
}) {
  await requireUser();
  const sp = await searchParams;
  const settings = await getSettings();
  const today = todayInTimeZone(settings.timezone);
  const filter = parseFilter(sp.estado);
  const q = sp.q?.trim() ?? "";
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);
  const soon = settings.expiringSoonDays;
  let desde = parseIsoParam(sp.desde);
  let hasta = parseIsoParam(sp.hasta);
  if (desde && hasta && desde > hasta) [desde, hasta] = [hasta, desde];
  const enrolled = { from: desde, to: hasta };
  const hasDateFilter = Boolean(desde || hasta);

  const opts = { enrolled, inactiveDays: settings.inactiveDays };
  const where = memberWhere(filter, q, today, soon, opts);
  const [total, rows, counts] = await Promise.all([
    db.member.count({ where }),
    db.member.findMany({
      where,
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        checkIns: { where: { result: "ALLOWED" }, orderBy: { at: "desc" }, take: 1, select: { at: true } },
      },
    }),
    Promise.all(MEMBER_FILTERS.map((f) => db.member.count({ where: memberWhere(f, undefined, today, soon, opts) }))),
  ]);
  const members = rows.map((m) => {
    const last = m.checkIns[0]?.at;
    return {
      ...memberView(m, today, soon),
      enrolledAt: isoFromDbDate(m.enrolledAt),
      sinceVisit: daysSinceVisit(last ? todayInTimeZone(settings.timezone, last) : null, today),
    };
  });
  const visitLabel = (d: number | null) =>
    d === null ? "nunca vino" : d === 0 ? "vino hoy" : `última visita hace ${d} ${d === 1 ? "día" : "días"}`;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const href = (params: { estado?: MemberFilter; page?: number; sinFechas?: boolean }) => {
    const s = new URLSearchParams();
    const estado = params.estado ?? filter;
    if (estado !== "todos") s.set("estado", estado);
    if (q) s.set("q", q);
    if (!params.sinFechas) {
      if (desde) s.set("desde", desde);
      if (hasta) s.set("hasta", hasta);
    }
    if (params.page && params.page > 1) s.set("page", String(params.page));
    const qs = s.toString();
    return qs ? `/socios?${qs}` : "/socios";
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Socios</h1>
        <div className="flex gap-2">
          <Link href="/socios/accesos" className="btn-secondary">
            Enviar accesos
          </Link>
          <Link href="/socios/nuevo" className="btn-primary">
            + Nuevo
          </Link>
        </div>
      </div>

      <form className="flex gap-2" role="search">
        {filter !== "todos" && <input type="hidden" name="estado" value={filter} />}
        {desde && <input type="hidden" name="desde" value={desde} />}
        {hasta && <input type="hidden" name="hasta" value={hasta} />}
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Nombre, documento, email o nº de socio"
          className="field-input"
          aria-label="Buscar socios"
        />
        <button className="btn-secondary">Buscar</button>
      </form>

      <details open={hasDateFilter} className="rounded-xl border border-zinc-200 bg-white px-4 py-3">
        <summary className="cursor-pointer text-sm font-medium text-zinc-700">
          Fecha de inscripción
          {hasDateFilter && (
            <span className="ml-2 font-normal text-zinc-500">
              {desde ? formatDate(desde) : "…"} – {hasta ? formatDate(hasta) : "…"}
            </span>
          )}
        </summary>
        <form className="mt-3 space-y-3">
          {filter !== "todos" && <input type="hidden" name="estado" value={filter} />}
          {q && <input type="hidden" name="q" value={q} />}
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="field-label">Desde</span>
              <input type="date" name="desde" defaultValue={desde} max={today} className="field-input" />
            </label>
            <label className="block">
              <span className="field-label">Hasta</span>
              <input type="date" name="hasta" defaultValue={hasta} max={today} className="field-input" />
            </label>
          </div>
          <div className="flex gap-2">
            <button className="btn-secondary">Filtrar</button>
            {hasDateFilter && (
              <Link href={href({ sinFechas: true })} className="btn-secondary">
                Quitar fechas
              </Link>
            )}
          </div>
        </form>
      </details>

      <nav aria-label="Filtrar por estado" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {MEMBER_FILTERS.map((f, i) => (
          <Link
            key={f}
            href={href({ estado: f })}
            aria-current={f === filter ? "page" : undefined}
            className={`shrink-0 rounded-full border px-3 py-1.5 text-sm font-medium ${
              f === filter ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-300 bg-white text-zinc-700"
            }`}
          >
            {FILTER_LABEL[f]} <span className="opacity-60">{counts[i]}</span>
          </Link>
        ))}
      </nav>

      {filter === "inactivos" && (
        <p className="text-xs text-zinc-500">
          Socios con membresía vigente que no han venido en los últimos {settings.inactiveDays} días (se cambia en
          Ajustes).
        </p>
      )}

      {members.length === 0 ? (
        <p className="card text-center text-sm text-zinc-500">No hay socios que coincidan.</p>
      ) : (
        <ul className="divide-y divide-zinc-100 overflow-hidden rounded-xl border border-zinc-200 bg-white">
          {members.map((m) => (
            <li key={m.id}>
              <Link href={`/socios/${m.id}`} className="flex items-center gap-3 px-4 py-3 active:bg-zinc-50">
                <Avatar src={m.photoUrl} name={m.fullName} size={44} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{m.fullName}</p>
                  <p className="text-xs text-zinc-500">
                    #{m.memberNumber} ·{" "}
                    {filter === "inactivos" ? (
                      <span className="text-amber-700">{visitLabel(m.sinceVisit)}</span>
                    ) : (
                      <>inscrito {formatDate(m.enrolledAt)}</>
                    )}{" "}
                    · vence {formatDate(m.endDate)}
                  </p>
                </div>
                <StatusBadge status={m.status} daysLeft={m.daysLeft} />
              </Link>
            </li>
          ))}
        </ul>
      )}

      {pages > 1 && (
        <div className="flex items-center justify-between text-sm">
          {page > 1 ? (
            <Link href={href({ page: page - 1 })} className="btn-secondary">
              ← Anterior
            </Link>
          ) : (
            <span />
          )}
          <span className="text-zinc-500">
            Página {page} de {pages} · {total} socios
          </span>
          {page < pages ? (
            <Link href={href({ page: page + 1 })} className="btn-secondary">
              Siguiente →
            </Link>
          ) : (
            <span />
          )}
        </div>
      )}
    </div>
  );
}
