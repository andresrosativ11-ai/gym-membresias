import Link from "next/link";
import { db } from "@/lib/db";
import { todayInTimeZone } from "@/lib/domain/dates";
import {
  CHECKIN_FILTER_LABEL,
  CHECKIN_RESULT_FILTERS,
  checkInQueryString,
  checkInWhere,
  parseCheckInFilters,
  type CheckInResultFilter,
} from "@/lib/checkins";
import { CHECKIN_METHOD_LABEL, CHECKIN_RESULT_LABEL, formatDate, formatDateTime } from "@/lib/format";
import { requireUser } from "@/lib/session";
import { getSettings } from "@/lib/settings";

const PAGE_SIZE = 50;

export default async function HistorialEntradasPage({
  searchParams,
}: {
  searchParams: Promise<{ desde?: string; hasta?: string; resultado?: string; socio?: string; page?: string }>;
}) {
  const user = await requireUser();
  const sp = await searchParams;
  const settings = await getSettings();
  const tz = settings.timezone;
  const today = todayInTimeZone(tz);
  const f = parseCheckInFilters(sp, today);
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);

  const base = checkInWhere({ ...f, result: "todos" }, tz);
  const where = checkInWhere(f, tz);
  const [member, total, totalAll, allowed, rows] = await Promise.all([
    f.memberId
      ? db.member.findUnique({ where: { id: f.memberId }, select: { id: true, firstName: true, lastName: true } })
      : null,
    db.checkIn.count({ where }),
    db.checkIn.count({ where: base }),
    db.checkIn.count({ where: { ...base, result: "ALLOWED" } }),
    db.checkIn.findMany({
      where,
      orderBy: { at: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        member: { select: { id: true, memberNumber: true, firstName: true, lastName: true } },
        staff: { select: { name: true } },
      },
    }),
  ]);
  const denied = totalAll - allowed;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const href = (extra: { resultado?: CheckInResultFilter; page?: number; sinSocio?: boolean }) => {
    const ff = { ...f, result: extra.resultado ?? f.result, memberId: extra.sinSocio ? null : f.memberId };
    return `/checkin/historial?${checkInQueryString(ff, extra.page && extra.page > 1 ? { page: String(extra.page) } : {})}`;
  };

  return (
    <div className="space-y-4">
      <Link href="/checkin" className="text-sm text-zinc-500">
        ← Check-in
      </Link>
      <h1 className="text-xl font-bold">Historial de entradas</h1>

      {member && (
        <p className="flex items-center justify-between rounded-lg bg-zinc-100 px-3 py-2 text-sm">
          <span>
            Socio:{" "}
            <Link href={`/socios/${member.id}`} className="font-medium underline">
              {member.firstName} {member.lastName}
            </Link>
          </span>
          <Link href={href({ sinSocio: true })} className="text-zinc-500 underline">
            Ver todos
          </Link>
        </p>
      )}

      <form className="card space-y-3">
        {f.memberId && <input type="hidden" name="socio" value={f.memberId} />}
        {f.result !== "todos" && <input type="hidden" name="resultado" value={f.result} />}
        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className="field-label">Desde</span>
            <input type="date" name="desde" defaultValue={f.from} max={today} className="field-input" />
          </label>
          <label className="block">
            <span className="field-label">Hasta</span>
            <input type="date" name="hasta" defaultValue={f.to} max={today} className="field-input" />
          </label>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn-secondary">Filtrar</button>
          {user.role === "ADMIN" && (
            <a href={`/checkin/historial/entradas.csv?${checkInQueryString(f)}`} className="btn-secondary">
              Descargar CSV
            </a>
          )}
        </div>
      </form>

      <nav aria-label="Filtrar por resultado" className="flex gap-2">
        {CHECKIN_RESULT_FILTERS.map((r) => (
          <Link
            key={r}
            href={href({ resultado: r })}
            aria-current={r === f.result ? "page" : undefined}
            className={`rounded-full border px-3 py-1.5 text-sm font-medium ${
              r === f.result ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-300 bg-white text-zinc-700"
            }`}
          >
            {CHECKIN_FILTER_LABEL[r]}{" "}
            <span className="opacity-60">{r === "todos" ? totalAll : r === "permitidos" ? allowed : denied}</span>
          </Link>
        ))}
      </nav>

      <p className="text-xs text-zinc-500">
        {formatDate(f.from)} – {formatDate(f.to)}
      </p>

      {rows.length === 0 ? (
        <p className="card text-center text-sm text-zinc-500">No hay entradas en este periodo.</p>
      ) : (
        <ul className="divide-y divide-zinc-100 overflow-hidden rounded-xl border border-zinc-200 bg-white text-sm">
          {rows.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
              <div className="min-w-0">
                {c.member ? (
                  <Link href={`/socios/${c.member.id}`} className="block truncate font-medium">
                    {c.member.firstName} {c.member.lastName}{" "}
                    <span className="font-normal text-zinc-500">#{c.member.memberNumber}</span>
                  </Link>
                ) : (
                  <span className="text-zinc-500">—</span>
                )}
                <p className="text-xs text-zinc-500">
                  {formatDateTime(c.at, tz)} · {CHECKIN_METHOD_LABEL[c.method] ?? c.method} · {c.staff.name}
                </p>
              </div>
              <span className={`shrink-0 text-xs font-medium ${c.result === "ALLOWED" ? "text-green-700" : "text-red-700"}`}>
                {CHECKIN_RESULT_LABEL[c.result] ?? c.result}
              </span>
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
            Página {page} de {pages} · {total} registros
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
