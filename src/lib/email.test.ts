import { describe, expect, it, vi } from "vitest";
import { getEmailConfig, sendEmail } from "./email";

const cfg = getEmailConfig({ RESEND_API_KEY: "re_test", EMAIL_FROM: "Gym <avisos@gym.test>" })!;
const msg = { to: "ana@example.com", subject: "Asunto", html: "<p>Hola</p>", text: "Hola" };
const respond = (status: number, body: unknown) => vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status }));

describe("getEmailConfig", () => {
  it("null si faltan clave o remitente", () => {
    expect(getEmailConfig({})).toBeNull();
    expect(getEmailConfig({ RESEND_API_KEY: "re_x" })).toBeNull();
  });
  it("reply-to opcional", () => {
    expect(cfg.replyTo).toBeNull();
    expect(getEmailConfig({ RESEND_API_KEY: "k", EMAIL_FROM: "f", EMAIL_REPLY_TO: "r@x.com" })?.replyTo).toBe("r@x.com");
  });
});

describe("sendEmail", () => {
  it("envía con la forma que espera Resend e incluye la clave de idempotencia", async () => {
    const fetchMock = respond(200, { id: "abc-123" });
    const r = await sendEmail(cfg, { ...msg, idempotencyKey: "notif-1" }, fetchMock);
    expect(r).toEqual({ ok: true, messageId: "abc-123" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.resend.com/emails");
    expect(init.headers).toMatchObject({ Authorization: "Bearer re_test", "Idempotency-Key": "notif-1" });
    expect(JSON.parse(init.body)).toEqual({
      from: "Gym <avisos@gym.test>",
      to: ["ana@example.com"],
      subject: "Asunto",
      html: "<p>Hola</p>",
      text: "Hola",
    });
  });

  it("incluye reply_to cuando está configurado", async () => {
    const fetchMock = respond(200, { id: "x" });
    await sendEmail({ ...cfg, replyTo: "recepcion@gym.test" }, msg, fetchMock);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).reply_to).toBe("recepcion@gym.test");
  });

  it("error de validación: mensaje legible, no reintentable", async () => {
    const r = await sendEmail(cfg, msg, respond(422, { name: "validation_error", message: "Invalid `to` field." }));
    expect(r).toEqual({ ok: false, error: "Invalid `to` field. (validation_error)", retryable: false });
  });

  it("429/5xx y red caída son reintentables", async () => {
    expect(await sendEmail(cfg, msg, respond(429, {}))).toMatchObject({ ok: false, retryable: true });
    expect(await sendEmail(cfg, msg, respond(500, {}))).toMatchObject({ ok: false, retryable: true });
    expect(await sendEmail(cfg, msg, vi.fn().mockRejectedValue(new Error("ETIMEDOUT")))).toMatchObject({
      ok: false,
      retryable: true,
    });
  });
});
