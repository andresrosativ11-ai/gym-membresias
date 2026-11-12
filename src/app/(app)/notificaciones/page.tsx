import Link from "next/link";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { db } from "@/lib/db";
import { getEmailConfig } from "@/lib/email";
import { formatDateTime } from "@/lib/format";
import { requireAdmin } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import { getWhatsAppConfig } from "@/lib/whatsapp";
import { saveNotificationSettings, sendTestEmailAction, sendTestWhatsappAction } from "./actions";
import { NotificationsRunner } from "./runner";

function Check({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <span aria-hidden className={ok ? "text-green-700" : "text-red-700"}>
        {ok ? "✓" : "✕"}
      </span>
      <span>
        <span className="sr-only">{ok ? "Listo: " : "Pendiente: "}</span>
        {children}
      </span>
    </li>
  );
}

const statusText = (s: string, attempts: number) =>
  s === "SENT" ? "Enviado" : s === "FAILED" ? `Falló (${attempts}/3)` : "Enviando";
const statusColor = (s: string) => (s === "SENT" ? "text-green-700" : s === "FAILED" ? "text-red-700" : "text-zinc-600");

export default async function NotificacionesPage() {
  await requireAdmin();
  const settings = await getSettings();
  const wa = getWhatsAppConfig();
  const em = getEmailConfig();
  const live = { deletedAt: null };

  const [waOptIn, emailOptIn, logs] = await Promise.all([
    db.member.count({ where: { ...live, notifyWhatsapp: true, phone: { not: null } } }),
    db.member.count({ where: { ...live, notifyEmail: true, email: { not: null } } }),
    db.notificationLog.findMany({ orderBy: { updatedAt: "desc" }, take: 30 }),
  ]);
  const members = await db.member.findMany({
    where: { id: { in: logs.map((l) => l.memberId).filter((x): x is string => !!x) } },
    select: { id: true, firstName: true, lastName: true },
  });
  const nameOf = (id: string | null) => {
    const m = members.find((x) => x.id === id);
    return m ? `${m.firstName} ${m.lastName}` : "—";
  };
  const canSend = (wa !== null && settings.whatsappEnabled) || (em !== null && settings.emailEnabled);

  return (
    <div className="space-y-4">
      <Link href="/ajustes" className="text-sm text-zinc-500">
        ← Ajustes
      </Link>
      <h1 className="text-xl font-bold">Avisos automáticos</h1>
      <p className="text-sm text-zinc-600">
        Se avisa {settings.expiringSoonDays} días antes del vencimiento (cámbialo en Ajustes) y hasta 3 días después de
        vencida, una vez por canal y membresía, solo a socios que aceptaron.
      </p>

      <section className="grid gap-3 sm:grid-cols-2">
        <div className="card space-y-2 text-sm">
          <h2 className="font-semibold">WhatsApp</h2>
          <ul className="space-y-1">
            <Check ok={wa !== null}>
              Credenciales{" "}
              <span className="text-zinc-500">
                {wa ? `(número …${wa.phoneNumberId.slice(-4)}, API ${wa.apiVersion})` : "— faltan WHATSAPP_TOKEN y WHATSAPP_PHONE_NUMBER_ID"}
              </span>
            </Check>
            <Check ok={settings.whatsappEnabled}>Envío automático {settings.whatsappEnabled ? "activado" : "desactivado"}</Check>
            <Check ok={waOptIn > 0}>
              {waOptIn} {waOptIn === 1 ? "socio aceptó" : "socios aceptaron"}
            </Check>
          </ul>
          {wa && (
            <p className="text-xs text-zinc-500">
              Plantillas <code>{wa.templates.EXPIRING_SOON}</code> y <code>{wa.templates.EXPIRED}</code> ({wa.language}).
            </p>
          )}
        </div>
        <div className="card space-y-2 text-sm">
          <h2 className="font-semibold">Email</h2>
          <ul className="space-y-1">
            <Check ok={em !== null}>
              Credenciales{" "}
              <span className="text-zinc-500">{em ? `(remitente ${em.from})` : "— faltan RESEND_API_KEY y EMAIL_FROM"}</span>
            </Check>
            <Check ok={settings.emailEnabled}>Envío automático {settings.emailEnabled ? "activado" : "desactivado"}</Check>
            <Check ok={emailOptIn > 0}>
              {emailOptIn} {emailOptIn === 1 ? "socio aceptó" : "socios aceptaron"}
            </Check>
          </ul>
        </div>
      </section>
      <p className="text-xs text-zinc-500">
        {process.env.CRON_SECRET ? "✓ Cron diario protegido con CRON_SECRET." : "✕ Falta CRON_SECRET: el envío diario no se ejecutará."}{" "}
        Guía: docs/whatsapp.md y docs/email.md.
      </p>

      <ActionForm action={saveNotificationSettings} className="card space-y-3">
        <h2 className="font-semibold">Configuración</h2>
        <label className="flex min-h-11 items-center gap-3 text-sm">
          <input type="checkbox" name="whatsappEnabled" defaultChecked={settings.whatsappEnabled} className="size-5" />
          Enviar avisos por WhatsApp cada día
        </label>
        <label className="flex min-h-11 items-center gap-3 text-sm">
          <input type="checkbox" name="emailEnabled" defaultChecked={settings.emailEnabled} className="size-5" />
          Enviar avisos por email cada día
        </label>
        <div className="max-w-48">
          <label className="field-label" htmlFor="countryCode">
            Código de país (WhatsApp)
          </label>
          <input id="countryCode" name="countryCode" inputMode="numeric" defaultValue={settings.countryCode} className="field-input" />
          <p className="mt-1 text-xs text-zinc-500">Para teléfonos guardados sin código de país.</p>
        </div>
        <SubmitButton>Guardar</SubmitButton>
      </ActionForm>

      <section className="card space-y-3">
        <h2 className="font-semibold">Avisos de hoy</h2>
        <NotificationsRunner canSend={canSend} />
      </section>

      <div className="grid gap-3 sm:grid-cols-2">
        <ActionForm action={sendTestWhatsappAction} className="card space-y-3">
          <h2 className="font-semibold">Probar WhatsApp</h2>
          <p className="text-xs text-zinc-500">
            Envía la plantilla estándar <code>hello_world</code>.
          </p>
          <input name="phone" type="tel" inputMode="tel" placeholder="+52 55 1234 5678" className="field-input" />
          <SubmitButton className="btn-secondary w-full" pendingText="Enviando…">
            Enviar prueba
          </SubmitButton>
        </ActionForm>
        <ActionForm action={sendTestEmailAction} className="card space-y-3">
          <h2 className="font-semibold">Probar email</h2>
          <p className="text-xs text-zinc-500">Envía un aviso de ejemplo con el diseño real.</p>
          <input name="email" type="email" placeholder="tu@correo.com" className="field-input" />
          <SubmitButton className="btn-secondary w-full" pendingText="Enviando…">
            Enviar prueba
          </SubmitButton>
        </ActionForm>
      </div>

      <section className="card text-sm">
        <h2 className="mb-2 font-semibold">Historial</h2>
        {logs.length === 0 ? (
          <p className="text-zinc-500">Todavía no se ha enviado ningún aviso.</p>
        ) : (
          <ul className="divide-y divide-zinc-100">
            {logs.map((l) => (
              <li key={l.id} className="py-2">
                <div className="flex justify-between gap-2">
                  <span className="truncate font-medium">{nameOf(l.memberId)}</span>
                  <span className={`shrink-0 text-xs font-semibold ${statusColor(l.status)}`}>
                    {statusText(l.status, l.attempts)}
                  </span>
                </div>
                <p className="text-xs text-zinc-500">
                  {l.channel === "EMAIL" ? "Email" : "WhatsApp"} · {l.type === "EXPIRING_SOON" ? "Por vencer" : "Vencida"} ·{" "}
                  {formatDateTime(l.updatedAt, settings.timezone)}
                </p>
                {l.error && <p className="text-xs text-red-700">{l.error}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
