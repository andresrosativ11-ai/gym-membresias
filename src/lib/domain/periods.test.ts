import { describe, expect, it } from "vitest";
import { bucketKeys, bucketUnit, resolvePeriod } from "./periods";

const TODAY = "2026-11-11";

describe("resolvePeriod", () => {
  it("por defecto: últimos 30 días incluyendo hoy", () => {
    expect(resolvePeriod({}, TODAY)).toEqual({ preset: "30d", from: "2026-10-13", to: TODAY });
  });
  it("presets", () => {
    expect(resolvePeriod({ preset: "hoy" }, TODAY)).toMatchObject({ from: TODAY, to: TODAY });
    expect(resolvePeriod({ preset: "7d" }, TODAY)).toMatchObject({ from: "2026-11-05", to: TODAY });
    expect(resolvePeriod({ preset: "mes" }, TODAY)).toMatchObject({ from: "2026-11-01", to: TODAY });
    expect(resolvePeriod({ preset: "anio" }, TODAY)).toMatchObject({ from: "2026-01-01", to: TODAY });
  });
  it("mes anterior completo, también cruzando año", () => {
    expect(resolvePeriod({ preset: "mes_anterior" }, TODAY)).toMatchObject({ from: "2026-10-01", to: "2026-10-31" });
    expect(resolvePeriod({ preset: "mes_anterior" }, "2026-01-15")).toMatchObject({
      from: "2025-12-01",
      to: "2025-12-31",
    });
    expect(resolvePeriod({ preset: "mes_anterior" }, "2028-03-05")).toMatchObject({
      from: "2028-02-01",
      to: "2028-02-29",
    });
  });
  it("rango personalizado válido", () => {
    expect(resolvePeriod({ from: "2026-09-01", to: "2026-09-30" }, TODAY)).toEqual({
      preset: "custom",
      from: "2026-09-01",
      to: "2026-09-30",
    });
  });
  it("rango personalizado invertido o inválido cae al default", () => {
    expect(resolvePeriod({ from: "2026-09-30", to: "2026-09-01" }, TODAY).preset).toBe("30d");
    expect(resolvePeriod({ from: "ayer", to: "hoy" }, TODAY).preset).toBe("30d");
  });
  it("limita rangos a 366 días", () => {
    expect(resolvePeriod({ from: "2020-01-01", to: "2026-11-11" }, TODAY)).toEqual({
      preset: "custom",
      from: "2025-11-11",
      to: "2026-11-11",
    });
  });
});

describe("bucketUnit / bucketKeys", () => {
  it("días hasta 62, meses después", () => {
    expect(bucketUnit("2026-10-01", "2026-11-30")).toBe("day");
    expect(bucketUnit("2026-01-01", "2026-11-11")).toBe("month");
  });
  it("genera todos los días del rango", () => {
    expect(bucketKeys("2026-10-30", "2026-11-02", "day")).toEqual([
      "2026-10-30",
      "2026-10-31",
      "2026-11-01",
      "2026-11-02",
    ]);
  });
  it("genera inicios de mes cruzando año", () => {
    expect(bucketKeys("2025-11-20", "2026-02-03", "month")).toEqual([
      "2025-11-01",
      "2025-12-01",
      "2026-01-01",
      "2026-02-01",
    ]);
  });
});
