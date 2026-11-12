import Link from "next/link";
import { ActionForm, ConfirmButton, SubmitButton } from "@/components/action-form";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import { createStaff, setStaffActive, updateSettings } from "./actions";

const TIMEZONES = [
  "America/Caracas",
  "America/Mexico_City",
  "America/Monterrey",
  "America/Cancun",
  "America/Tijuana",
  "America/Hermosillo",
  "America/Bogota",
  "America/Lima",
  "America/Guayaquil",
  "America/Santiago",
  "America/Argentina/Buenos_Aires",
  "America/Montevideo",
  "America/Asuncion",
  "America/La_Paz",
  "America/Guatemala",
  "America/Costa_Rica",
  "America/Panama",
  "America/Santo_Domingo",
  "America/New_York",
  "America/Los_Angeles",
  "Europe/Madrid",
];

const CURRENCIES = ["USD", "VES", "MXN", "COP", "PEN", "CLP", "ARS", "UYU", "PYG", "BOB", "GTQ", "CRC", "PAB", "DOP", "EUR"];

export default async function AjustesPage() {
  const me = await requireAdmin();
  const s = await getSettings();
  const staff = await db.user.findMany({ orderBy: [{ active: "desc" }, { name: "asc" }] });
  const timezones = TIMEZONES.includes(s.timezone) ? TIMEZONES : [s.timezone, ...TIMEZONES];
  const currencies = CURRENCIES.includes(s.currency) ? CURRENCIES : [s.currency, ...CURRENCIES];

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Ajustes</h1>
      <Link href="/notificaciones" className="card flex items-center justify-between">
        <span>
          <span className="block font-semibold">Avisos automáticos (WhatsApp y email)</span>
          <span className="text-sm text-zinc-500">
            WhatsApp {s.whatsappEnabled ? "activado" : "desactivado"} · Email {s.emailEnabled ? "activado" : "desactivado"}
          </span>
        </span>
        <span aria-hidden>→</span>
      </Link>
      <ActionForm action={updateSettings} className="card space-y-4">
        <div>
          <label className="field-label" htmlFor="gymName">
            Nombre del gimnasio
          </label>
          <input id="gymName" name="gymName" required defaultValue={s.gymName} className="field-input" />
        </div>
        <div>
          <label className="field-label" htmlFor="timezone">
            Zona horaria
          </label>
          <select id="timezone" name="timezone" defaultValue={s.timezone} className="field-input">
            {timezones.map((tz) => (
              <option key={tz} value={tz}>
                {tz.replace(/_/g, " ")}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-zinc-500">Define qué es &quot;hoy&quot; para vencimientos y reportes.</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="field-label" htmlFor="currency">
              Moneda
            </label>
            <select id="currency" name="currency" defaultValue={s.currency} className="field-input">
              {currencies.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="field-label" htmlFor="expiringSoonDays">
              Aviso &quot;por vencer&quot;
            </label>
            <input
              id="expiringSoonDays"
              name="expiringSoonDays"
              type="number"
              min={1}
              max={30}
              inputMode="numeric"
              required
              defaultValue={s.expiringSoonDays}
              className="field-input"
            />
            <p className="mt-1 text-xs text-zinc-500">días antes del vencimiento</p>
          </div>
        </div>
        <p className="text-xs text-zinc-500">
          Cambiar la moneda solo cambia el símbolo mostrado; no convierte precios ni pagos ya registrados.
        </p>
        <SubmitButton>Guardar ajustes</SubmitButton>
      </ActionForm>

      <h2 className="pt-2 text-lg font-bold">Personal</h2>
      <ul className="divide-y divide-zinc-100 overflow-hidden rounded-xl border border-zinc-200 bg-white">
        {staff.map((u) => (
          <li key={u.id} className={`flex items-center gap-3 px-4 py-3 ${u.active ? "" : "opacity-50"}`}>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">
                {u.name} {u.id === me.id && <span className="text-xs font-normal text-zinc-500">(tú)</span>}
              </span>
              <span className="block truncate text-xs text-zinc-500">
                {u.email} · {u.role === "ADMIN" ? "Administrador" : "Recepción"}
                {!u.active && " · desactivado"}
              </span>
            </span>
            {u.id !== me.id && (
              <form action={setStaffActive.bind(null, u.id, !u.active)}>
                {u.active ? (
                  <ConfirmButton message={`¿Desactivar a ${u.name}? No podrá iniciar sesión.`} className="btn-secondary px-3">
                    Desactivar
                  </ConfirmButton>
                ) : (
                  <button className="btn-secondary px-3">Reactivar</button>
                )}
              </form>
            )}
          </li>
        ))}
      </ul>

      <ActionForm action={createStaff} resetOnSuccess className="card space-y-3">
        <h3 className="font-semibold">Nuevo usuario</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="field-label" htmlFor="staff-name">
              Nombre
            </label>
            <input id="staff-name" name="name" required autoComplete="off" className="field-input" />
          </div>
          <div>
            <label className="field-label" htmlFor="staff-email">
              Email
            </label>
            <input id="staff-email" name="email" type="email" required autoComplete="off" className="field-input" />
          </div>
          <div>
            <label className="field-label" htmlFor="staff-role">
              Rol
            </label>
            <select id="staff-role" name="role" defaultValue="RECEPTION" className="field-input">
              <option value="RECEPTION">Recepción</option>
              <option value="ADMIN">Administrador</option>
            </select>
          </div>
          <div>
            <label className="field-label" htmlFor="staff-password">
              Contraseña inicial
            </label>
            <input
              id="staff-password"
              name="password"
              type="password"
              minLength={8}
              required
              autoComplete="new-password"
              className="field-input"
            />
          </div>
        </div>
        <p className="text-xs text-zinc-500">
          Recepción puede registrar socios, cobrar renovaciones y hacer check-in. No ve planes, reportes ni ajustes.
        </p>
        <SubmitButton pendingText="Creando…">Crear usuario</SubmitButton>
      </ActionForm>
    </div>
  );
}
