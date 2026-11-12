/**
 * Cliente mínimo de WhatsApp Cloud API (Meta) para enviar plantillas aprobadas.
 * Los mensajes iniciados por el negocio REQUIEREN plantilla aprobada en Meta.
 *
 * Variables de entorno:
 *   WHATSAPP_TOKEN            token de acceso (usuario del sistema, permanente)
 *   WHATSAPP_PHONE_NUMBER_ID  ID del número emisor (no el número en sí)
 *   WHATSAPP_API_VERSION      opcional, ej. "v23.0"
 *   WHATSAPP_TEMPLATE_LANG    opcional, código de idioma de las plantillas (ej. "es")
 *   WHATSAPP_TEMPLATE_EXPIRING / WHATSAPP_TEMPLATE_EXPIRED  opcional, nombres de plantilla
 */
import type { NotificationKind, SendResult } from "./domain/notifications";

export type WhatsAppConfig = {
  token: string;
  phoneNumberId: string;
  apiVersion: string;
  language: string;
  templates: Record<NotificationKind, string>;
};

export function getWhatsAppConfig(env: Record<string, string | undefined> = process.env): WhatsAppConfig | null {
  const token = env.WHATSAPP_TOKEN?.trim();
  const phoneNumberId = env.WHATSAPP_PHONE_NUMBER_ID?.trim();
  const apiVersion = env.WHATSAPP_API_VERSION?.trim() || "v23.0";
  if (!token || !phoneNumberId) return null;
  // Evita inyectar rutas en la URL de la API.
  if (!/^\d+$/.test(phoneNumberId) || !/^v\d+\.\d+$/.test(apiVersion)) return null;
  return {
    token,
    phoneNumberId,
    apiVersion,
    language: env.WHATSAPP_TEMPLATE_LANG?.trim() || "es",
    templates: {
      EXPIRING_SOON: env.WHATSAPP_TEMPLATE_EXPIRING?.trim() || "membresia_por_vencer",
      EXPIRED: env.WHATSAPP_TEMPLATE_EXPIRED?.trim() || "membresia_vencida",
    },
  };
}

type FetchLike = (url: string, init: RequestInit) => Promise<Response>;

export async function sendTemplate(
  cfg: WhatsAppConfig,
  to: string,
  template: string,
  language: string,
  params: string[],
  fetchImpl: FetchLike = fetch,
): Promise<SendResult> {
  const body = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "template",
    template: {
      name: template,
      language: { code: language },
      ...(params.length > 0 && {
        components: [{ type: "body", parameters: params.map((text) => ({ type: "text", text })) }],
      }),
    },
  };

  let res: Response;
  try {
    res = await fetchImpl(`https://graph.facebook.com/${cfg.apiVersion}/${cfg.phoneNumberId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${cfg.token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    });
  } catch (e) {
    return { ok: false, error: `Sin conexión con WhatsApp: ${(e as Error).message}`, retryable: true };
  }

  const json = (await res.json().catch(() => null)) as {
    messages?: { id?: string }[];
    error?: { message?: string; code?: number; error_data?: { details?: string } };
  } | null;

  if (res.ok) return { ok: true, messageId: json?.messages?.[0]?.id ?? null };

  const err = json?.error;
  const detail = err?.error_data?.details ? ` — ${err.error_data.details}` : "";
  return {
    ok: false,
    error: `${err?.message ?? `HTTP ${res.status}`}${err?.code ? ` (código ${err.code})` : ""}${detail}`.slice(0, 500),
    // 429 / 5xx son transitorios; 4xx (plantilla, número, permisos) no se arreglan reintentando.
    retryable: res.status === 429 || res.status >= 500,
  };
}
