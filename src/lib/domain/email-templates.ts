import type { ISODate } from "./dates";
import type { NotificationKind } from "./notifications";

const HTML_ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

/** Escapa texto para insertarlo en HTML (los nombres los escribe el personal). */
export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => HTML_ESCAPES[c]);
}

function displayDate(date: ISODate): string {
  const [y, m, d] = date.split("-");
  return `${d}/${m}/${y}`;
}

export type ReminderEmail = { subject: string; text: string; html: string };

/** Contenido del aviso por email (asunto, texto plano y HTML simple compatible con clientes de correo). */
export function buildReminderEmail(
  kind: NotificationKind,
  data: { firstName: string; gymName: string; endDate: ISODate },
): ReminderEmail {
  const date = displayDate(data.endDate);
  const expired = kind === "EXPIRED";
  const subject = expired
    ? `Tu membresía en ${data.gymName} venció el ${date}`
    : `Tu membresía en ${data.gymName} vence el ${date}`;
  const lines = expired
    ? [
        `Hola ${data.firstName},`,
        `Tu membresía en ${data.gymName} venció el ${date}.`,
        "¡Te esperamos en recepción para renovarla y seguir entrenando!",
      ]
    : [
        `Hola ${data.firstName},`,
        `Tu membresía en ${data.gymName} vence el ${date}.`,
        "Renuévala en recepción para no perder tu acceso.",
      ];
  const footer =
    "Recibes este aviso porque aceptaste recordatorios de tu membresía. Pide en recepción que los desactivemos si ya no los quieres.";

  const text = `${lines.join("\n\n")}\n\n— ${data.gymName}\n\n${footer}`;
  const html = `<!doctype html>
<html lang="es"><body style="margin:0;padding:24px;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;color:#18181b">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:12px">
<tr><td style="padding:24px">
<p style="margin:0 0 16px;font-size:18px;font-weight:bold">${escapeHtml(data.gymName)}</p>
${lines.map((l) => `<p style="margin:0 0 12px;font-size:15px;line-height:1.5">${escapeHtml(l)}</p>`).join("\n")}
<p style="margin:24px 0 0;font-size:12px;color:#71717a">${escapeHtml(footer)}</p>
</td></tr></table></body></html>`;

  return { subject, text, html };
}
