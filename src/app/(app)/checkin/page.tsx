import Link from "next/link";
import { db } from "@/lib/db";
import { todayInTimeZone } from "@/lib/domain/dates";
import { requireUser } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import { CheckInPanel } from "./checkin-panel";

export default async function CheckInPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  await requireUser();
  const { error } = await searchParams;
  const settings = await getSettings();
  const today = todayInTimeZone(settings.timezone);

  // "at" se guarda en UTC; se convierte a la hora local del gimnasio para contar el día.
  const [{ allowed, denied }] = await db.$queryRaw<{ allowed: number; denied: number }[]>`
    SELECT
      COUNT(*) FILTER (WHERE result = 'ALLOWED')::int AS allowed,
      COUNT(*) FILTER (WHERE result <> 'ALLOWED')::int AS denied
    FROM "CheckIn"
    WHERE ((at AT TIME ZONE 'UTC') AT TIME ZONE ${settings.timezone})::date = ${today}::date
  `;

  const recent = await db.checkIn.findMany({
    orderBy: { at: "desc" },
    take: 8,
    include: { member: { select: { id: true, firstName: true, lastName: true } } },
  });
  const time = new Intl.DateTimeFormat("es-MX", { timeZone: settings.timezone, timeStyle: "short" });

  return (
    <div className="space-y-4">
      {error === "forbidden" && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Esa sección es solo para administradores.
        </p>
      )}
      <div className="flex items-baseline justify-between">
        <h1 className="text-xl font-bold">Check-in</h1>
        <p className="text-sm text-zinc-600">
          Hoy: <strong>{allowed}</strong> entradas
          {denied > 0 && <span className="text-red-700"> · {denied} rechazos</span>}
        </p>
      </div>

      <CheckInPanel />

      <section className="card text-sm">
        <h2 className="mb-2 font-semibold">Últimos registros</h2>
        {recent.length === 0 ? (
          <p className="text-zinc-500">Aún no hay entradas.</p>
        ) : (
          <ul className="divide-y divide-zinc-100">
            {recent.map((c) => (
              <li key={c.id} className="flex items-center justify-between py-2">
                {c.member ? (
                  <Link href={`/socios/${c.member.id}`} className="truncate">
                    {c.member.firstName} {c.member.lastName}
                  </Link>
                ) : (
                  <span>—</span>
                )}
                <span className={c.result === "ALLOWED" ? "text-green-700" : "text-red-700"}>
                  {time.format(c.at)} {c.result === "ALLOWED" ? "✓" : "✕"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
