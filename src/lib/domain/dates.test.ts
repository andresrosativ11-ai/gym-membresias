import { describe, expect, it } from "vitest";
import {
  addDays,
  addMonthsClamped,
  daysBetween,
  isoFromDbDate,
  periodEnd,
  todayInTimeZone,
} from "./dates";

describe("addDays", () => {
  it("cruza meses y años", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(addDays("2028-03-01", -1)).toBe("2028-02-29");
  });
});

describe("addMonthsClamped", () => {
  it("ajusta al último día cuando el día no existe", () => {
    expect(addMonthsClamped("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonthsClamped("2028-01-31", 1)).toBe("2028-02-29");
    expect(addMonthsClamped("2026-03-31", 1)).toBe("2026-04-30");
  });
  it("cruza años", () => {
    expect(addMonthsClamped("2026-11-15", 3)).toBe("2027-02-15");
    expect(addMonthsClamped("2026-01-15", 12)).toBe("2027-01-15");
  });
});

describe("periodEnd", () => {
  it("mensual: hasta el día anterior del mes siguiente", () => {
    expect(periodEnd("2026-01-15", { durationMonths: 1 })).toBe("2026-02-14");
    expect(periodEnd("2026-11-01", { durationMonths: 1 })).toBe("2026-11-30");
  });
  it("si el día no existe en el mes destino, termina a fin de mes", () => {
    expect(periodEnd("2026-01-31", { durationMonths: 1 })).toBe("2026-02-28");
    expect(periodEnd("2026-01-29", { durationMonths: 1 })).toBe("2026-02-28");
    expect(periodEnd("2028-01-30", { durationMonths: 1 })).toBe("2028-02-29");
  });
  it("trimestral y anual", () => {
    expect(periodEnd("2026-11-11", { durationMonths: 3 })).toBe("2027-02-10");
    expect(periodEnd("2026-11-11", { durationMonths: 12 })).toBe("2027-11-10");
    expect(periodEnd("2028-02-29", { durationMonths: 12 })).toBe("2029-02-28");
  });
  it("planes por días", () => {
    expect(periodEnd("2026-11-11", { durationDays: 7 })).toBe("2026-11-17");
    expect(periodEnd("2026-11-11", { durationDays: 1 })).toBe("2026-11-11");
  });
  it("rechaza planes sin duración válida", () => {
    expect(() => periodEnd("2026-11-11", {})).toThrow();
    expect(() => periodEnd("2026-11-11", { durationDays: 0 })).toThrow();
  });
});

describe("daysBetween", () => {
  it("cuenta días calendario", () => {
    expect(daysBetween("2026-11-11", "2026-11-16")).toBe(5);
    expect(daysBetween("2026-11-16", "2026-11-11")).toBe(-5);
    expect(daysBetween("2026-02-28", "2026-03-01")).toBe(1);
  });
});

describe("todayInTimeZone", () => {
  it("usa la zona horaria del gimnasio, no UTC", () => {
    // 2026-11-12 03:00 UTC = 2026-11-11 21:00 en Ciudad de México
    const instant = new Date("2026-11-12T03:00:00Z");
    expect(todayInTimeZone("America/Mexico_City", instant)).toBe("2026-11-11");
    expect(todayInTimeZone("UTC", instant)).toBe("2026-11-12");
  });
});

describe("isoFromDbDate", () => {
  it("convierte columnas @db.Date (medianoche UTC) a ISO", () => {
    expect(isoFromDbDate(new Date("2026-11-11T00:00:00Z"))).toBe("2026-11-11");
  });
});
