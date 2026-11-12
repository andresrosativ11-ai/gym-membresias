import { describe, expect, it } from "vitest";
import { decideAttempt, normalizeWhatsappNumber, notificationTypeFor } from "./notifications";

describe("normalizeWhatsappNumber", () => {
  it("antepone el código de país a números nacionales", () => {
    expect(normalizeWhatsappNumber("55 1234 5678", "52")).toBe("525512345678");
    expect(normalizeWhatsappNumber("(55) 1234-5678", "52")).toBe("525512345678");
  });
  it("respeta números internacionales con + o 00", () => {
    expect(normalizeWhatsappNumber("+52 55 1234 5678", "52")).toBe("525512345678");
    expect(normalizeWhatsappNumber("+57 300 123 4567", "52")).toBe("573001234567");
    expect(normalizeWhatsappNumber("0052 55 1234 5678", "52")).toBe("525512345678");
  });
  it("no duplica el código si ya viene incluido", () => {
    expect(normalizeWhatsappNumber("525512345678", "52")).toBe("525512345678");
  });
  it("quita el prefijo troncal 0 nacional", () => {
    expect(normalizeWhatsappNumber("011 1234 5678", "54")).toBe("541112345678");
  });
  it("acepta celulares venezolanos en sus formatos habituales", () => {
    expect(normalizeWhatsappNumber("0412 123 4567", "58")).toBe("584121234567");
    expect(normalizeWhatsappNumber("0414-1234567", "58")).toBe("584141234567");
    expect(normalizeWhatsappNumber("4241234567", "58")).toBe("584241234567");
    expect(normalizeWhatsappNumber("+58 416 123 4567", "58")).toBe("584161234567");
    expect(normalizeWhatsappNumber("584261234567", "58")).toBe("584261234567");
  });
  it("rechaza números imposibles", () => {
    expect(normalizeWhatsappNumber("123", "52")).toBeNull();
    expect(normalizeWhatsappNumber("", "52")).toBeNull();
    expect(normalizeWhatsappNumber("+1234567890123456", "52")).toBeNull();
  });
});

describe("notificationTypeFor", () => {
  const today = "2026-11-11";
  it("por vencer dentro de la ventana de aviso (incluye hoy)", () => {
    expect(notificationTypeFor("2026-11-16", today, 5)).toBe("EXPIRING_SOON");
    expect(notificationTypeFor(today, today, 5)).toBe("EXPIRING_SOON");
    expect(notificationTypeFor("2026-11-17", today, 5)).toBeNull();
  });
  it("vencida hasta 3 días después (tolera días sin cron)", () => {
    expect(notificationTypeFor("2026-11-10", today, 5)).toBe("EXPIRED");
    expect(notificationTypeFor("2026-11-08", today, 5)).toBe("EXPIRED");
    expect(notificationTypeFor("2026-11-07", today, 5)).toBeNull();
  });
});

describe("decideAttempt", () => {
  it("nuevo si no hay registro", () => {
    expect(decideAttempt(null)).toBe("new");
  });
  it("nunca reenvía lo enviado o en curso", () => {
    expect(decideAttempt({ status: "SENT", attempts: 1 })).toBe("skip");
    expect(decideAttempt({ status: "SENDING", attempts: 1 })).toBe("skip");
  });
  it("reintenta fallos hasta 3 intentos", () => {
    expect(decideAttempt({ status: "FAILED", attempts: 1 })).toBe("retry");
    expect(decideAttempt({ status: "FAILED", attempts: 2 })).toBe("retry");
    expect(decideAttempt({ status: "FAILED", attempts: 3 })).toBe("skip");
  });
});
