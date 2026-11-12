/* eslint-disable @next/next/no-img-element -- QR en data URL */
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { StatusBadge } from "@/components/status-badge";
import { db } from "@/lib/db";
import { isoFromDbDate, todayInTimeZone } from "@/lib/domain/dates";
import { isPortalCode } from "@/lib/domain/portal";
import { formatDate, formatDateTime, formatMoney, PAYMENT_METHOD_LABEL } from "@/lib/format";
import { memberView } from "@/lib/members";
import { getSettings } from "@/lib/settings";

/**
 * Portal público del socio. Sin sesión: el enlace secreto (= código del QR) es la
 * credencial. Solo muestra datos de ESTE socio; nada del gimnasio ni de otros socios.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Mi membresía",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function PortalSocioPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  if (!isPortalCode(code)) notFound();

  const settings = await getSettings();
  const today = todayInTimeZone(settings.timezone);
  const m = await db.member.findUnique({
    where: { accessCode: code },
    include: {
      memberships: {
        where: { voidedAt: null },
        include: { plan: { select: { name: true } } },
        orderBy: [{ endDate: "desc" }, { createdAt: "desc" }],
        take: 1,
      },
      payments: {
        where: { voidedAt: null },
        include: { membership: { include: { plan: { select: { name: true, currency: true } } } } },
        orderBy: { paidAt: "desc" },
        take: 10,
      },
    },
  });
  if (!m || m.deletedAt) notFound();

  const view = memberView(m, today, settings.expiringSoonDays);
  const current = m.memberships[0];
  const qr = await QRCode.toDataURL(m.accessCode, { margin: 1, width: 480 });
  const canEnter = view.status === "ACTIVO" || view.status === "POR_VENCER";

  return (
    <main className="mx-auto min-h-dvh max-w-md space-y-4 px-4 py-6">
      <header className="text-center">
        <p className="text-sm font-semibold text-zinc-500">{settings.gymName}</p>
        <h1 className="text-2xl font-bold">Hola, {m.firstName}</h1>
        <p className="text-sm text-zinc-500">Socio #{m.memberNumber}</p>
      </header>

      <section className="card space-y-2 text-center">
        <StatusBadge status={view.status} daysLeft={view.daysLeft} />
        {current && <p className="font-medium">Plan {current.plan.name}</p>}
        {view.endDate ? (
          <p className="text-sm text-zinc-600">
            {view.status === "VENCIDO" ? "Venció el " : "Vence el "}
            <strong>{formatDate(view.endDate)}</strong>
            {view.daysLeft != null && view.daysLeft >= 0 && (
              <> · {view.daysLeft === 0 ? "hoy" : view.daysLeft === 1 ? "queda 1 día" : `quedan ${view.daysLeft} días`}</>
            )}
          </p>
        ) : (
          <p className="text-sm text-zinc-600">Todavía no tienes una membresía.</p>
        )}
        {view.status === "VENCIDO" && <p className="text-sm text-zinc-600">Pasa por recepción para renovar.</p>}
        {view.status === "SUSPENDIDO" && (
          <p className="text-sm text-zinc-600">Tu acceso está suspendido. Consulta en recepción.</p>
        )}
      </section>

      <section className="card flex flex-col items-center gap-2 text-center">
        <h2 className="font-semibold">Tu código de entrada</h2>
        <img
          src={qr}
          alt="Tu código QR de entrada"
          width={240}
          height={240}
          className={`rounded-lg ${canEnter ? "" : "opacity-40"}`}
        />
        <p className="text-sm text-zinc-600">
          Muéstralo en recepción o dicta tu número <strong>#{m.memberNumber}</strong>.
        </p>
      </section>

      <section className="card text-sm">
        <h2 className="mb-2 font-semibold">Mis pagos</h2>
        {m.payments.length === 0 ? (
          <p className="text-zinc-500">Sin pagos registrados.</p>
        ) : (
          <ul className="divide-y divide-zinc-100">
            {m.payments.map((p) => (
              <li key={p.id} className="flex justify-between gap-2 py-2">
                <span>
                  {formatDateTime(p.paidAt, settings.timezone).split(",")[0]}
                  {p.membership && <span className="text-zinc-500"> · {p.membership.plan.name}</span>}
                </span>
                <span className="text-right">
                  <span className="font-medium">
                    {formatMoney(p.amountCents, p.membership?.plan.currency ?? settings.currency)}
                  </span>
                  <span className="block text-xs text-zinc-500">{PAYMENT_METHOD_LABEL[p.method]}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {current && (
        <p className="text-center text-xs text-zinc-400">
          Membresía actual: {formatDate(isoFromDbDate(current.startDate))} → {formatDate(isoFromDbDate(current.endDate))}
        </p>
      )}
      <p className="text-center text-xs text-zinc-400">Este enlace es personal. No lo compartas.</p>
    </main>
  );
}
