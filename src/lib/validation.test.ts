import { describe, expect, it } from "vitest";
import { firstError, memberSchema, paymentSchema } from "./validation";

const base = {
  firstName: "Ana",
  lastName: "López",
  documentId: "",
  email: "",
  phone: "",
  birthDate: "",
  enrolledAt: "2026-11-11",
  notes: "",
  notifyWhatsapp: false,
  notifyEmail: false,
};

describe("memberSchema", () => {
  it("convierte campos vacíos en null", () => {
    const r = memberSchema.safeParse(base);
    expect(r.success && r.data).toMatchObject({ email: null, phone: null, documentId: null });
  });

  it("aceptar WhatsApp exige teléfono", () => {
    const r = memberSchema.safeParse({ ...base, notifyWhatsapp: true });
    expect(r.success).toBe(false);
    if (!r.success) expect(firstError(r.error)).toBe("Para avisos por WhatsApp hace falta el teléfono");
  });

  it("aceptar email exige email", () => {
    const r = memberSchema.safeParse({ ...base, notifyEmail: true });
    expect(r.success).toBe(false);
    if (!r.success) expect(firstError(r.error)).toBe("Para avisos por email hace falta el email");
  });

  it("con los datos de contacto, ambos consentimientos son válidos", () => {
    const r = memberSchema.safeParse({
      ...base,
      phone: "+52 55 1234 5678",
      email: "ana@example.com",
      notifyWhatsapp: true,
      notifyEmail: true,
    });
    expect(r.success).toBe(true);
  });

  it("rechaza email mal formado", () => {
    const r = memberSchema.safeParse({ ...base, email: "ana@" });
    expect(r.success).toBe(false);
  });
});

describe("paymentSchema.paidDate", () => {
  const pay = { planId: "p1", amountCents: "20", method: "CASH", reference: "" };
  it("vacío = hoy (null)", () => {
    expect(paymentSchema.parse({ ...pay, paidDate: "" }).paidDate).toBeNull();
  });
  it("acepta una fecha anterior", () => {
    expect(paymentSchema.parse({ ...pay, paidDate: "2026-11-01" }).paidDate).toBe("2026-11-01");
  });
  it("rechaza formato inválido", () => {
    expect(paymentSchema.safeParse({ ...pay, paidDate: "01/11/2026" }).success).toBe(false);
  });
});
