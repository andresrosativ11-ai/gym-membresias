import Link from "next/link";
import { BarChart, MeterList, StatTile } from "@/components/charts";
import { db } from "@/lib/db";
import { todayInTimeZone } from "@/lib/domain/dates";
import { PERIOD_PRESETS, PRESET_LABEL, resolvePeriod } from "@/lib/domain/periods";
import { formatBucketLabel, formatDate, formatMoney, PAYMENT_METHOD_LABEL } from "@/lib/format";
import { memberWhere, type MemberFilter } from "@/lib/members";
import { attendanceReport, revenueReport } from "@/lib/reports";
import { requireAdmin } from "@/lib/session";
import { getSettings } from "@/lib/settings";

const pagos = (n: number) => `${n} ${n === 1 ? "pago" : "pagos"}`;
const entradas = (n: number) => `${n} ${n === 1 ? "entrada" : "entradas"}`;

const SNAPSHOT: { filter: MemberFilter; label: string }[] = [
  { filter: "vigentes", label: "Vigentes" },
  { filter: "por_vencer", label: "Por vencer" },
  { filter: "vencidos", label: "Vencidos" },
  { filter: "suspendidos", label: "Suspendidos" },
  { filter: "sin_membresia", label: "Sin membresía" },
];

export default async function ReportesPage({
  searchParams,
}: {
  searchParams: Promise<{ preset?: string; from?: string; to?: string }>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const settings = await getSettings();
  const tz = settings.timezone;
  const today = todayInTimeZone(tz);
  const period = resolvePeriod(sp, today);
  const money = (cents: number) => formatMoney(cents, settings.currency);

  const [revenue, attendance, snapshot] = await Promise.all([
    revenueReport(period, tz),
    attendanceReport(period, tz),
    Promise.all(
      SNAPSHOT.map((s) => db.member.count({ where: memberWhere(s.filter, undefined, today, settings.expiringSoonDays) })),
    ),
  ]);

  const avgTicket = revenue.count > 0 ? revenue.totalCents / revenue.count : 0;
  const csvHref = `/reportes/pagos.csv?from=${period.from}&to=${period.to}`;
  const busiestHour = attendance.byHour.reduce((a, b) => (b.value > a.value ? b : a));

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Reportes</h1>

      {/* Filtros de periodo: una sola fila arriba de los gráficos */}
      <section className="space-y-2">
        <nav aria-label="Periodo" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
          {PERIOD_PRESETS.map((p) => (
            <Link
              key={p}
              href={`/reportes?preset=${p}`}
              aria-current={period.preset === p ? "page" : undefined}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-sm font-medium ${
                period.preset === p ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-300 bg-white text-zinc-700"
              }`}
            >
              {PRESET_LABEL[p]}
            </Link>
          ))}
        </nav>
        <form className="flex flex-wrap items-end gap-2">
          <label className="text-xs text-zinc-600">
            Desde
            <input type="date" name="from" defaultValue={period.from} className="field-input mt-1 min-h-10" />
          </label>
          <label className="text-xs text-zinc-600">
            Hasta
            <input type="date" name="to" defaultValue={period.to} className="field-input mt-1 min-h-10" />
          </label>
          <button className="btn-secondary min-h-10">Aplicar</button>
        </form>
        <p className="text-sm text-zinc-500">
          {formatDate(period.from)} – {formatDate(period.to)}
        </p>
      </section>

      <section aria-label="Ingresos" className="space-y-3">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <StatTile label="Ingresos" value={money(revenue.totalCents)} />
          <StatTile label="Pagos" value={String(revenue.count)} />
          <StatTile label="Ticket promedio" value={money(avgTicket)} />
        </div>
        <BarChart
          title={`Ingresos por ${revenue.unit === "day" ? "día" : "mes"}`}
          data={revenue.buckets.map((b) => ({
            key: b.key,
            label: formatBucketLabel(b.key, revenue.unit),
            value: b.value,
            valueLabel: money(b.value),
          }))}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <MeterList
            title="Por método de pago"
            rows={revenue.byMethod.map((r) => ({
              key: r.method,
              label: PAYMENT_METHOD_LABEL[r.method] ?? r.method,
              value: r.value,
              valueLabel: money(r.value),
              detail: pagos(r.count),
            }))}
          />
          <MeterList
            title="Por plan"
            rows={revenue.byPlan.map((r) => ({
              key: r.plan,
              label: r.plan,
              value: r.value,
              valueLabel: money(r.value),
              detail: pagos(r.count),
            }))}
          />
        </div>
        <a href={csvHref} className="btn-secondary w-full" download>
          Exportar pagos del periodo (CSV)
        </a>
      </section>

      <section aria-label="Asistencia" className="space-y-3">
        <h2 className="pt-2 text-lg font-bold">Asistencia</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <StatTile label="Entradas" value={String(attendance.allowed)} />
          <StatTile label="Socios distintos" value={String(attendance.uniqueMembers)} />
          <StatTile label="Accesos rechazados" value={String(attendance.denied)} />
        </div>
        <BarChart
          title={`Entradas por ${attendance.unit === "day" ? "día" : "mes"}`}
          data={attendance.buckets.map((b) => ({
            key: b.key,
            label: formatBucketLabel(b.key, attendance.unit),
            value: b.value,
            valueLabel: entradas(b.value),
          }))}
        />
        <BarChart
          title="Entradas por hora del día"
          data={attendance.byHour.slice(5, 24).map((h) => ({
            key: String(h.hour),
            label: `${h.hour}:00`,
            value: h.value,
            valueLabel: entradas(h.value),
          }))}
        />
        {busiestHour.value > 0 && (
          <p className="text-sm text-zinc-600">
            Hora pico: <strong>{busiestHour.hour}:00</strong> ({entradas(busiestHour.value)} en el periodo).
          </p>
        )}
      </section>

      <section aria-label="Estado actual de socios" className="space-y-3">
        <h2 className="pt-2 text-lg font-bold">Socios hoy</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {SNAPSHOT.map((s, i) => (
            <Link key={s.filter} href={`/socios?estado=${s.filter}`}>
              <StatTile label={s.label} value={String(snapshot[i])} />
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
