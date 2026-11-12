import Link from "next/link";
import { Avatar } from "@/components/avatar";
import { StatusBadge } from "@/components/status-badge";
import { db } from "@/lib/db";
import { todayInTimeZone } from "@/lib/domain/dates";
import { formatDate } from "@/lib/format";
import { FILTER_LABEL, MEMBER_FILTERS, memberView, memberWhere, parseFilter, type MemberFilter } from "@/lib/members";
import { requireUser } from "@/lib/session";
import { getSettings } from "@/lib/settings";

const PAGE_SIZE = 30;

export default async function SociosPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; estado?: string; page?: string }>;
}) {
  await requireUser();
  const sp = await searchParams;
  const settings = await getSettings();
  const today = todayInTimeZone(settings.timezone);
  const filter = parseFilter(sp.estado);
  const q = sp.q?.trim() ?? "";
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);
  const soon = settings.expiringSoonDays;

  const where = memberWhere(filter, q, today, soon);
  const [total, rows, counts] = await Promise.all([
    db.member.count({ where }),
    db.member.findMany({
      where,
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    Promise.all(MEMBER_FILTERS.map((f) => db.member.count({ where: memberWhere(f, undefined, today, soon) }))),
  ]);
  const members = rows.map((m) => memberView(m, today, soon));
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const href = (params: { estado?: MemberFilter; page?: number }) => {
    const s = new URLSearchParams();
    const estado = params.estado ?? filter;
    if (estado !== "todos") s.set("estado", estado);
    if (q) s.set("q", q);
    if (params.page && params.page > 1) s.set("page", String(params.page));
    const qs = s.toString();
    return qs ? `/socios?${qs}` : "/socios";
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Socios</h1>
        <Link href="/socios/nuevo" className="btn-primary">
          + Nuevo
        </Link>
      </div>

      <form className="flex gap-2" role="search">
        {filter !== "todos" && <input type="hidden" name="estado" value={filter} />}
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
                    #{m.memberNumber} · vence {formatDate(m.endDate)}
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
