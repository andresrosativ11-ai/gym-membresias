/**
 * Cliente mínimo de Resend (https://resend.com) para enviar avisos por email.
 *
 * Variables de entorno:
 *   RESEND_API_KEY   clave de API (re_...)
 *   EMAIL_FROM       remitente con dominio verificado en Resend, ej. "Mi Gimnasio <avisos@migym.com>"
 *   EMAIL_REPLY_TO   opcional, a dónde llegan las respuestas (ej. el correo de recepción)
 */
import type { SendResult } from "./domain/notifications";

export type EmailConfig = { apiKey: string; from: string; replyTo: string | null };

export function getEmailConfig(env: Record<string, string | undefined> = process.env): EmailConfig | null {
  const apiKey = env.RESEND_API_KEY?.trim();
  const from = env.EMAIL_FROM?.trim();
  if (!apiKey || !from) return null;
  return { apiKey, from, replyTo: env.EMAIL_REPLY_TO?.trim() || null };
}

type FetchLike = (url: string, init: RequestInit) => Promise<Response>;

export async function sendEmail(
  cfg: EmailConfig,
  msg: { to: string; subject: string; html: string; text: string; idempotencyKey?: string },
  fetchImpl: FetchLike = fetch,
): Promise<SendResult> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${cfg.apiKey}`,
    "Content-Type": "application/json",
  };
  // Resend descarta envíos repetidos con la misma clave durante 24 h (protección extra contra duplicados).
  if (msg.idempotencyKey) headers["Idempotency-Key"] = msg.idempotencyKey.slice(0, 256);

  let res: Response;
  try {
    res = await fetchImpl("https://api.resend.com/emails", {
      method: "POST",
      headers,
      body: JSON.stringify({
        from: cfg.from,
        to: [msg.to],
        subject: msg.subject,
        html: msg.html,
        text: msg.text,
        ...(cfg.replyTo && { reply_to: cfg.replyTo }),
      }),
      signal: AbortSignal.timeout(15_000),
    });
  } catch (e) {
    return { ok: false, error: `Sin conexión con el servicio de email: ${(e as Error).message}`, retryable: true };
  }

  const json = (await res.json().catch(() => null)) as { id?: string; message?: string; name?: string } | null;
  if (res.ok) return { ok: true, messageId: json?.id ?? null };
  return {
    ok: false,
    error: `${json?.message ?? `HTTP ${res.status}`}${json?.name ? ` (${json.name})` : ""}`.slice(0, 500),
    retryable: res.status === 429 || res.status >= 500,
  };
}
