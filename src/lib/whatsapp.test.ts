import { describe, expect, it, vi } from "vitest";
import { getWhatsAppConfig, sendTemplate } from "./whatsapp";

const env = { WHATSAPP_TOKEN: "tok", WHATSAPP_PHONE_NUMBER_ID: "123456" };
const cfg = getWhatsAppConfig(env)!;

function fakeResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

describe("getWhatsAppConfig", () => {
  it("null si faltan credenciales", () => {
    expect(getWhatsAppConfig({})).toBeNull();
    expect(getWhatsAppConfig({ WHATSAPP_TOKEN: "x" })).toBeNull();
  });
  it("valores por defecto", () => {
    expect(cfg).toMatchObject({
      apiVersion: "v23.0",
      language: "es",
      templates: { EXPIRING_SOON: "membresia_por_vencer", EXPIRED: "membresia_vencida" },
    });
  });
  it("rechaza IDs o versiones que alterarían la URL", () => {
    expect(getWhatsAppConfig({ ...env, WHATSAPP_PHONE_NUMBER_ID: "123/../me" })).toBeNull();
    expect(getWhatsAppConfig({ ...env, WHATSAPP_API_VERSION: "latest" })).toBeNull();
  });
});

describe("sendTemplate", () => {
  it("envía la plantilla con parámetros posicionales", async () => {
    const fetchMock = vi.fn().mockResolvedValue(fakeResponse(200, { messages: [{ id: "wamid.ABC" }] }));
    const r = await sendTemplate(cfg, "525512345678", "membresia_por_vencer", "es_MX", ["Ana", "Gym", "13/11/2026"], fetchMock);

    expect(r).toEqual({ ok: true, messageId: "wamid.ABC" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://graph.facebook.com/v23.0/123456/messages");
    expect(init.headers.Authorization).toBe("Bearer tok");
    expect(JSON.parse(init.body)).toEqual({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: "525512345678",
      type: "template",
      template: {
        name: "membresia_por_vencer",
        language: { code: "es_MX" },
        components: [
          {
            type: "body",
            parameters: [
              { type: "text", text: "Ana" },
              { type: "text", text: "Gym" },
              { type: "text", text: "13/11/2026" },
            ],
          },
        ],
      },
    });
  });

  it("sin parámetros no envía components (ej. hello_world)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(fakeResponse(200, { messages: [{ id: "x" }] }));
    await sendTemplate(cfg, "525512345678", "hello_world", "en_US", [], fetchMock);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).template.components).toBeUndefined();
  });

  it("error 4xx de Meta: mensaje legible y no reintentable", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      fakeResponse(400, {
        error: { message: "Template name does not exist", code: 132001, error_data: { details: "template x" } },
      }),
    );
    const r = await sendTemplate(cfg, "52", "x", "es_MX", [], fetchMock);
    expect(r).toEqual({
      ok: false,
      error: "Template name does not exist (código 132001) — template x",
      retryable: false,
    });
  });

  it("429 y 5xx son reintentables", async () => {
    for (const status of [429, 503]) {
      const r = await sendTemplate(cfg, "52", "x", "es_MX", [], vi.fn().mockResolvedValue(fakeResponse(status, {})));
      expect(r).toMatchObject({ ok: false, retryable: true });
    }
  });

  it("falla de red es reintentable", async () => {
    const r = await sendTemplate(cfg, "52", "x", "es_MX", [], vi.fn().mockRejectedValue(new Error("ECONNRESET")));
    expect(r).toMatchObject({ ok: false, retryable: true });
  });
});
