/* eslint-disable @next/next/no-img-element -- QR en data URL */
import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { ConfirmButton } from "@/components/action-form";
import { Avatar } from "@/components/avatar";
import { StatusBadge } from "@/components/status-badge";
import { db } from "@/lib/db";
import { isoFromDbDate, todayInTimeZone } from "@/lib/domain/dates";
import { portalInviteMessage, portalUrl } from "@/lib/domain/portal";
import {
  formatDate,
  formatDateTime,
  formatMoney,
  PAYMENT_METHOD_LABEL,
  planDurationLabel,
  whatsappLink,
} from "@/lib/format";
import { memberView } from "@/lib/members";
import { requireUser } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import {
  assignPlan,
  regenerateAccessCode,
  setDeleted,
  setSuspended,
  voidLastMembership,
} from "../actions";
import { AssignPlanForm } from "./assign-plan-form";

const RESULT_LABEL: Record<string, string> = {
  ALLOWED: "Permitido",
  DENIED_EXPIRED: "Rechazado: vencido",
  DENIED_SUSPENDED: "Rechazado: suspendido",
  DENIED_NO_MEMBERSHIP: "Rechazado: sin membresía",
  DENIED_INACTIVE: "Rechazado: baja",
};

export default async function SocioPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const isAdmin = user.role === "ADMIN";
  const { id } = await params;
  const settings = await getSettings();
  const today = todayInTimeZone(settings.timezone);

  const [m, plans] = await Promise.all([
    db.member.findUnique({
      where: { id },
      include: {
        memberships: { include: { plan: true }, orderBy: [{ endDate: "desc" }, { createdAt: "desc" }], take: 12 },
        checkIns: { orderBy: { at: "desc" }, take: 10 },
        payments: {
          orderBy: { paidAt: "desc" },
          take: 12,
          include: { receivedBy: { select: { name: true } }, membership: { include: { plan: true } } },
        },
      },
    }),
    db.plan.findMany({ where: { active: true }, orderBy: { priceCents: "asc" } }),
  ]);
  if (!m) notFound();
  const notifications = await db.notificationLog.findMany({
    where: { memberId: id },
    orderBy: { sentAt: "desc" },
    take: 10,
  });

  const view = memberView(m, today, settings.expiringSoonDays);
  const qr = await QRCode.toDataURL(m.accessCode, { margin: 1, width: 320 });
  const hasActiveRenewal = m.memberships.some((ms) => !ms.voidedAt);

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const portal = portalUrl(`${proto}://${host}`, m.accessCode);
  const inviteLink = m.phone
    ? whatsappLink(m.phone, portalInviteMessage(m.firstName, settings.gymName, portal), settings.countryCode)
    : null;

  return (
    <div className="space-y-4">
      <Link href="/socios" className="text-sm text-zinc-500">
        ← Socios
      </Link>

      <section className="card flex items-center gap-4">
        <Avatar src={view.photoUrl} name={view.fullName} size={80} />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-bold">{view.fullName}</h1>
          <p className="text-sm text-zinc-500">Socio #{m.memberNumber}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <StatusBadge status={view.status} daysLeft={view.daysLeft} />
            <span className="text-sm text-zinc-600">Vence: {formatDate(view.endDate)}</span>
          </div>
          {m.suspendedAt && m.suspendReason && (
            <p className="mt-1 text-sm text-zinc-600">Motivo: {m.suspendReason}</p>
          )}
        </div>
      </section>

      <div className="flex flex-wrap gap-2">
        <Link href={`/socios/${id}/editar`} className="btn-secondary">
          Editar datos
        </Link>
      </div>

      {!m.deletedAt && (
        <section className="card">
          <h2 className="mb-3 font-semibold">Cobrar y renovar</h2>
          <AssignPlanForm
            action={assignPlan.bind(null, id)}
            today={today}
            currentEndDate={view.endDate}
            plans={plans.map((p) => ({
              id: p.id,
              name: p.name,
              priceLabel: `${formatMoney(p.priceCents, p.currency)} / ${planDurationLabel(p)}`,
              priceInput: (p.priceCents / 100).toFixed(2),
              durationMonths: p.durationMonths,
              durationDays: p.durationDays,
            }))}
          />
        </section>
      )}

      <section className="card flex flex-col items-center gap-3 sm:flex-row sm:items-start">
        <img src={qr} alt={`Código QR de ${view.fullName}`} width={160} height={160} className="rounded-lg" />
        <div className="space-y-2 text-sm">
          <h2 className="font-semibold">Código de acceso</h2>
          <p className="text-zinc-600">
            El socio puede mostrar este QR en recepción o dictar su número <strong>#{m.memberNumber}</strong>.
          </p>
          <a href={qr} download={`qr-socio-${m.memberNumber}.png`} className="btn-secondary">
            Descargar QR
          </a>
        </div>
      </section>

      {!m.deletedAt && (
        <section className="card space-y-2 text-sm">
          <h2 className="font-semibold">Portal del socio</h2>
          <p className="text-zinc-600">
            Enlace personal donde el socio ve su membresía, sus pagos y su QR, sin contraseña. Si se filtra, usa
            «Regenerar QR»: el enlace anterior deja de funcionar.
          </p>
          <div className="flex flex-wrap gap-2">
            {inviteLink ? (
              <a href={inviteLink} target="_blank" rel="noopener noreferrer" className="btn-primary">
                Enviar acceso por WhatsApp
              </a>
            ) : (
              <span className="text-zinc-500">Agrega un teléfono para enviarlo por WhatsApp.</span>
            )}
            <a href={portal} target="_blank" rel="noopener noreferrer" className="btn-secondary">
              Ver portal
            </a>
          </div>
          <p className="break-all rounded bg-zinc-50 p-2 font-mono text-xs text-zinc-600 select-all">{portal}</p>
        </section>
      )}

      <section className="card text-sm">
        <h2 className="mb-2 font-semibold">Datos</h2>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
          <dt className="text-zinc-500">Documento</dt>
          <dd>{m.documentId ?? "—"}</dd>
          <dt className="text-zinc-500">Teléfono</dt>
          <dd>{m.phone ?? "—"}</dd>
          <dt className="text-zinc-500">Email</dt>
          <dd className="truncate">{m.email ?? "—"}</dd>
          <dt className="text-zinc-500">Nacimiento</dt>
          <dd>{m.birthDate ? formatDate(isoFromDbDate(m.birthDate)) : "—"}</dd>
          <dt className="text-zinc-500">Inscripción</dt>
          <dd>{formatDate(isoFromDbDate(m.enrolledAt))}</dd>
          <dt className="text-zinc-500">Avisos</dt>
          <dd>
            {[m.notifyWhatsapp && "WhatsApp", m.notifyEmail && "Email"].filter(Boolean).join(" y ") || "No acepta"}
          </dd>
        </dl>
        {notifications.length > 0 && (
          <>
            <h3 className="mt-3 mb-1 font-medium">Avisos enviados</h3>
            <ul className="divide-y divide-zinc-100">
              {notifications.map((n) => (
                <li key={n.id} className="flex justify-between gap-2 py-1.5">
                  <span>
                    {n.channel === "EMAIL" ? "Email" : "WhatsApp"} · {n.type === "EXPIRING_SOON" ? "Por vencer" : "Vencida"} ·{" "}
                    <span className="text-zinc-500">{formatDateTime(n.updatedAt, settings.timezone)}</span>
                  </span>
                  <span
                    className={n.status === "SENT" ? "text-green-700" : n.status === "FAILED" ? "text-red-700" : ""}
                    title={n.error ?? undefined}
                  >
                    {n.status === "SENT" ? "Enviado" : n.status === "FAILED" ? "Falló" : "Enviando"}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
        {m.notes && <p className="mt-2 whitespace-pre-wrap text-zinc-700">{m.notes}</p>}
      </section>

      <section className="card text-sm">
        <h2 className="mb-2 font-semibold">Historial de membresías</h2>
        {m.memberships.length === 0 ? (
          <p className="text-zinc-500">Sin membresías.</p>
        ) : (
          <ul className="divide-y divide-zinc-100">
            {m.memberships.map((ms) => (
              <li key={ms.id} className={`flex justify-between py-2 ${ms.voidedAt ? "text-zinc-400" : ""}`}>
                <span className={ms.voidedAt ? "line-through" : ""}>
                  {ms.plan.name}{" "}
                  <span className={ms.voidedAt ? "" : "text-zinc-500"}>
                    {formatDate(isoFromDbDate(ms.startDate))} → {formatDate(isoFromDbDate(ms.endDate))}
                  </span>
                </span>
                {ms.voidedAt && <span className="text-xs font-medium">Anulada</span>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card text-sm">
        <h2 className="mb-2 font-semibold">Pagos</h2>
        {m.payments.length === 0 ? (
          <p className="text-zinc-500">Sin pagos registrados.</p>
        ) : (
          <ul className="divide-y divide-zinc-100">
            {m.payments.map((p) => (
              <li key={p.id} className={`py-2 ${p.voidedAt ? "text-zinc-400" : ""}`}>
                <div className="flex justify-between">
                  <span className={p.voidedAt ? "line-through" : "font-medium"}>
                    {formatMoney(p.amountCents, p.membership?.plan.currency ?? settings.currency)}
                  </span>
                  <span>{p.voidedAt ? "Anulado" : PAYMENT_METHOD_LABEL[p.method]}</span>
                </div>
                <p className="text-xs text-zinc-500">
                  {formatDateTime(p.paidAt, settings.timezone)} · {p.membership?.plan.name ?? "—"} · recibió{" "}
                  {p.receivedBy.name}
                  {p.reference && ` · ref. ${p.reference}`}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card text-sm">
        <h2 className="mb-2 font-semibold">Últimas entradas</h2>
        {m.checkIns.length === 0 ? (
          <p className="text-zinc-500">Sin registros.</p>
        ) : (
          <ul className="divide-y divide-zinc-100">
            {m.checkIns.map((c) => (
              <li key={c.id} className="flex justify-between py-2">
                <span>{formatDateTime(c.at, settings.timezone)}</span>
                <span className={c.result === "ALLOWED" ? "text-green-700" : "text-red-700"}>
                  {RESULT_LABEL[c.result]}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {isAdmin && (
        <section className="card space-y-3 text-sm">
          <h2 className="font-semibold">Administración</h2>
          {m.suspendedAt ? (
            <form action={setSuspended.bind(null, id, false)}>
              <button className="btn-secondary">Reactivar (quitar suspensión)</button>
            </form>
          ) : (
            <form action={setSuspended.bind(null, id, true)} className="flex gap-2">
              <input name="reason" placeholder="Motivo de suspensión" className="field-input" />
              <ConfirmButton message="¿Suspender a este socio? No podrá ingresar.">Suspender</ConfirmButton>
            </form>
          )}
          <div className="flex flex-wrap gap-2">
            <form action={regenerateAccessCode.bind(null, id)}>
              <ConfirmButton message="El QR actual y el enlace del portal dejarán de funcionar. ¿Continuar?">Regenerar QR</ConfirmButton>
            </form>
            {hasActiveRenewal && (
              <form action={voidLastMembership.bind(null, id)}>
                <ConfirmButton message="¿Anular la última renovación y su pago? Se usa para corregir errores; queda registrada como anulada.">
                  Anular última renovación
                </ConfirmButton>
              </form>
            )}
            {m.deletedAt ? (
              <form action={setDeleted.bind(null, id, false)}>
                <button className="btn-secondary">Restaurar socio</button>
              </form>
            ) : (
              <form action={setDeleted.bind(null, id, true)}>
                <ConfirmButton message="¿Dar de baja a este socio?" className="btn-danger">
                  Dar de baja
                </ConfirmButton>
              </form>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
