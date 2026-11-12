/**
 * Gráficos ligeros en HTML/CSS (sin librería), renderizados en el servidor.
 * Una sola serie por gráfico → un solo color (--series-1), sin leyenda; el
 * título nombra la serie. Cada barra tiene tooltip (hover/foco) y hay vista de tabla.
 */

export function StatTile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="card p-3">
      <p className="text-xs font-medium text-zinc-500">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-zinc-500">{hint}</p>}
    </div>
  );
}

export type BarDatum = { key: string; label: string; value: number; valueLabel: string };

export function BarChart({
  title,
  data,
  emptyText = "Sin datos en el periodo.",
}: {
  title: string;
  data: BarDatum[];
  emptyText?: string;
}) {
  const max = Math.max(0, ...data.map((d) => d.value));
  const peak = data.find((d) => d.value === max);
  const ticks = data.length > 2 ? [data[0], data[Math.floor((data.length - 1) / 2)], data[data.length - 1]] : data;

  return (
    <figure className="card">
      <figcaption className="mb-1 flex items-baseline justify-between gap-2">
        <span className="font-semibold">{title}</span>
        {max > 0 && peak && <span className="text-xs text-zinc-500">máx. {peak.valueLabel}</span>}
      </figcaption>
      {max === 0 ? (
        <p className="py-8 text-center text-sm text-zinc-500">{emptyText}</p>
      ) : (
        <>
          <div className="flex h-40 items-end gap-[2px] border-b border-zinc-300 pt-6" role="list">
            {data.map((d) => (
              <div
                key={d.key}
                role="listitem"
                tabIndex={0}
                aria-label={`${d.label}: ${d.valueLabel}`}
                className="group relative flex h-full flex-1 items-end outline-none"
              >
                <div
                  className="w-full rounded-t-[4px] bg-[var(--series-1)] transition-opacity group-hover:opacity-80 group-focus:opacity-80"
                  style={{ height: `${(d.value / max) * 100}%` }}
                />
                <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-zinc-900 px-2 py-1 text-xs text-white shadow group-hover:block group-focus:block">
                  {d.label}: <strong>{d.valueLabel}</strong>
                </span>
              </div>
            ))}
          </div>
          <div className="mt-1 flex justify-between text-[11px] text-zinc-500">
            {ticks.map((t) => (
              <span key={t.key}>{t.label}</span>
            ))}
          </div>
        </>
      )}
      <details className="mt-2 text-sm">
        <summary className="cursor-pointer text-zinc-500">Ver tabla</summary>
        <table className="mt-2 w-full text-left">
          <tbody>
            {data.map((d) => (
              <tr key={d.key} className="border-t border-zinc-100">
                <td className="py-1">{d.label}</td>
                <td className="py-1 text-right tabular-nums">{d.valueLabel}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}

/** Desglose de un total: nombre, cifra y barra proporcional a la participación. */
export function MeterList({
  title,
  rows,
}: {
  title: string;
  rows: { key: string; label: string; value: number; valueLabel: string; detail?: string }[];
}) {
  const total = rows.reduce((s, r) => s + r.value, 0);
  return (
    <section className="card">
      <h3 className="mb-3 font-semibold">{title}</h3>
      {total === 0 ? (
        <p className="text-sm text-zinc-500">Sin datos en el periodo.</p>
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => {
            const share = r.value / total;
            return (
              <li key={r.key}>
                <div className="flex items-baseline justify-between gap-2 text-sm">
                  <span className="truncate">{r.label}</span>
                  <span className="shrink-0 tabular-nums">
                    <strong>{r.valueLabel}</strong>{" "}
                    <span className="text-zinc-500">
                      {Math.round(share * 100)}%{r.detail && ` · ${r.detail}`}
                    </span>
                  </span>
                </div>
                <div className="mt-1 h-2 rounded-full bg-zinc-100">
                  <div className="h-2 rounded-full bg-[var(--series-1)]" style={{ width: `${share * 100}%` }} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
