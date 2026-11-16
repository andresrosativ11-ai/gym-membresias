import { describe, expect, it } from "vitest";
import { canFreeze, daysSinceVisit, frozenDays, shiftPeriod } from "./freeze";
import { computeStatus } from "./membership";
import { evaluateAccess } from "./checkin";

const base = { suspendedAt: null, deletedAt: null, currentEndDate: "2026-12-10", frozenSince: null };

describe("estado congelado", () => {
  it("congelado conserva los días que tenía al congelar", () => {
    const r = computeStatus({ ...base, frozenSince: "2026-11-01" }, "2026-11-20", 5);
    expect(r).toEqual({ status: "CONGELADO", daysLeft: 39 });
  });
  it("congelado no pasa a vencido aunque la fecha ya haya pasado", () => {
    expect(computeStatus({ ...base, frozenSince: "2026-11-01" }, "2027-01-15", 5).status).toBe("CONGELADO");
  });
  it("suspendido tiene prioridad sobre congelado", () => {
    expect(
      computeStatus({ ...base, frozenSince: "2026-11-01", suspendedAt: new Date() }, "2026-11-20", 5).status,
    ).toBe("SUSPENDIDO");
  });
  it("niega el acceso mientras está congelado", () => {
    const d = evaluateAccess({ ...base, frozenSince: "2026-11-01" }, "2026-11-20", 5);
    expect(d).toMatchObject({ allowed: false, result: "DENIED_FROZEN" });
  });
});

describe("canFreeze", () => {
  it("solo membresías vigentes", () => {
    expect(canFreeze("ACTIVO")).toBe(true);
    expect(canFreeze("POR_VENCER")).toBe(true);
    expect(canFreeze("VENCIDO")).toBe(false);
    expect(canFreeze("CONGELADO")).toBe(false);
    expect(canFreeze("SUSPENDIDO")).toBe(false);
    expect(canFreeze("SIN_MEMBRESIA")).toBe(false);
  });
});

describe("frozenDays", () => {
  it("cuenta los días sin usar", () => {
    expect(frozenDays("2026-11-01", "2026-11-15")).toBe(14);
  });
  it("descongelar el mismo día no corre nada", () => {
    expect(frozenDays("2026-11-16", "2026-11-16")).toBe(0);
  });
  it("nunca negativo", () => {
    expect(frozenDays("2026-11-20", "2026-11-16")).toBe(0);
  });
});

describe("shiftPeriod", () => {
  it("corre el vencimiento de la membresía en curso, no su inicio", () => {
    expect(shiftPeriod({ startDate: "2026-10-15", endDate: "2026-11-14" }, "2026-11-01", 10)).toEqual({
      startDate: "2026-10-15",
      endDate: "2026-11-24",
    });
  });
  it("corre inicio y fin de una renovación adelantada", () => {
    expect(shiftPeriod({ startDate: "2026-11-15", endDate: "2026-12-14" }, "2026-11-01", 10)).toEqual({
      startDate: "2026-11-25",
      endDate: "2026-12-24",
    });
  });
  it("no toca membresías que terminaron antes de congelar", () => {
    const p = { startDate: "2026-09-01", endDate: "2026-09-30" };
    expect(shiftPeriod(p, "2026-11-01", 10)).toBe(p);
  });
  it("cruza fin de mes y año", () => {
    expect(shiftPeriod({ startDate: "2026-12-01", endDate: "2026-12-31" }, "2026-12-20", 5).endDate).toBe("2027-01-05");
  });
});

describe("daysSinceVisit", () => {
  it("días desde la última visita", () => {
    expect(daysSinceVisit("2026-11-01", "2026-11-16")).toBe(15);
  });
  it("null si nunca vino", () => {
    expect(daysSinceVisit(null, "2026-11-16")).toBeNull();
  });
});
