import { describe, expect, it } from "vitest";
import { computeNewPeriod, computeStatus } from "./membership";

const TODAY = "2026-11-11";

describe("computeStatus", () => {
  const base = { suspendedAt: null, deletedAt: null, currentEndDate: null };

  it("sin membresía", () => {
    expect(computeStatus(base, TODAY, 5)).toEqual({ status: "SIN_MEMBRESIA", daysLeft: null });
  });
  it("activo con más de N días", () => {
    expect(computeStatus({ ...base, currentEndDate: "2026-12-01" }, TODAY, 5)).toEqual({
      status: "ACTIVO",
      daysLeft: 20,
    });
  });
  it("por vencer dentro de la ventana (inclusive)", () => {
    expect(computeStatus({ ...base, currentEndDate: "2026-11-16" }, TODAY, 5).status).toBe("POR_VENCER");
    expect(computeStatus({ ...base, currentEndDate: "2026-11-17" }, TODAY, 5).status).toBe("ACTIVO");
  });
  it("vence hoy sigue vigente (por vencer, 0 días)", () => {
    expect(computeStatus({ ...base, currentEndDate: TODAY }, TODAY, 5)).toEqual({
      status: "POR_VENCER",
      daysLeft: 0,
    });
  });
  it("vencido desde ayer", () => {
    expect(computeStatus({ ...base, currentEndDate: "2026-11-10" }, TODAY, 5)).toEqual({
      status: "VENCIDO",
      daysLeft: -1,
    });
  });
  it("suspendido tiene prioridad sobre activo", () => {
    expect(
      computeStatus({ ...base, currentEndDate: "2026-12-31", suspendedAt: new Date() }, TODAY, 5).status,
    ).toBe("SUSPENDIDO");
  });
  it("dado de baja tiene prioridad sobre todo", () => {
    expect(
      computeStatus({ ...base, currentEndDate: "2026-12-31", suspendedAt: new Date(), deletedAt: new Date() }, TODAY, 5)
        .status,
    ).toBe("BAJA");
  });
});

describe("computeNewPeriod", () => {
  const monthly = { durationMonths: 1 };

  it("primera membresía inicia hoy", () => {
    expect(computeNewPeriod(null, TODAY, monthly)).toEqual({ startDate: TODAY, endDate: "2026-12-10" });
  });
  it("renovación anticipada no pierde días", () => {
    expect(computeNewPeriod("2026-11-14", TODAY, monthly)).toEqual({
      startDate: "2026-11-15",
      endDate: "2026-12-14",
    });
  });
  it("renovación el mismo día del vencimiento continúa al día siguiente", () => {
    expect(computeNewPeriod(TODAY, TODAY, monthly).startDate).toBe("2026-11-12");
  });
  it("renovación ya vencido inicia hoy", () => {
    expect(computeNewPeriod("2026-10-01", TODAY, monthly)).toEqual({ startDate: TODAY, endDate: "2026-12-10" });
  });
  it("cadena de renovaciones a fin de mes es contigua", () => {
    const first = computeNewPeriod(null, "2026-01-31", monthly);
    expect(first.endDate).toBe("2026-02-28");
    const second = computeNewPeriod(first.endDate, "2026-02-20", monthly);
    expect(second).toEqual({ startDate: "2026-03-01", endDate: "2026-03-31" });
  });
});

describe("computeNewPeriod con fecha de pago anterior", () => {
  it("socio que pagó el 1 sin membresía previa vence según esa fecha", () => {
    expect(computeNewPeriod(null, "2026-11-01", { durationMonths: 1 })).toEqual({
      startDate: "2026-11-01",
      endDate: "2026-11-30",
    });
  });
});
