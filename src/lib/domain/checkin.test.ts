import { describe, expect, it } from "vitest";
import { evaluateAccess, isDuplicateCheckIn } from "./checkin";

const TODAY = "2026-11-11";
const base = { suspendedAt: null, deletedAt: null, currentEndDate: "2026-12-01" };

describe("evaluateAccess", () => {
  it("permite socio activo", () => {
    expect(evaluateAccess(base, TODAY, 5)).toMatchObject({ allowed: true, result: "ALLOWED" });
  });
  it("permite socio por vencer y avisa cuántos días quedan", () => {
    const r = evaluateAccess({ ...base, currentEndDate: "2026-11-13" }, TODAY, 5);
    expect(r).toMatchObject({ allowed: true, result: "ALLOWED" });
    expect(r.message).toContain("2 días");
  });
  it("permite el último día", () => {
    const r = evaluateAccess({ ...base, currentEndDate: TODAY }, TODAY, 5);
    expect(r.allowed).toBe(true);
    expect(r.message).toContain("hoy");
  });
  it("bloquea vencido", () => {
    expect(evaluateAccess({ ...base, currentEndDate: "2026-11-10" }, TODAY, 5)).toMatchObject({
      allowed: false,
      result: "DENIED_EXPIRED",
    });
  });
  it("bloquea sin membresía", () => {
    expect(evaluateAccess({ ...base, currentEndDate: null }, TODAY, 5).result).toBe("DENIED_NO_MEMBERSHIP");
  });
  it("bloquea suspendido aunque esté al día", () => {
    expect(evaluateAccess({ ...base, suspendedAt: new Date() }, TODAY, 5).result).toBe("DENIED_SUSPENDED");
  });
  it("bloquea baja", () => {
    expect(evaluateAccess({ ...base, deletedAt: new Date() }, TODAY, 5).result).toBe("DENIED_INACTIVE");
  });
});

describe("isDuplicateCheckIn", () => {
  const now = new Date("2026-11-11T15:00:00Z");
  it("detecta un escaneo repetido dentro de la ventana", () => {
    expect(isDuplicateCheckIn(new Date("2026-11-11T14:59:30Z"), now)).toBe(true);
  });
  it("no considera duplicado fuera de la ventana", () => {
    expect(isDuplicateCheckIn(new Date("2026-11-11T14:58:00Z"), now)).toBe(false);
    expect(isDuplicateCheckIn(null, now)).toBe(false);
  });
});
