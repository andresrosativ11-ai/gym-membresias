import { addDays, addMonthsClamped, daysBetween, type ISODate } from "./dates";

export const PERIOD_PRESETS = ["hoy", "7d", "30d", "mes", "mes_anterior", "anio"] as const;
export type PeriodPreset = (typeof PERIOD_PRESETS)[number];

export const PRESET_LABEL: Record<PeriodPreset, string> = {
  hoy: "Hoy",
  "7d": "7 días",
  "30d": "30 días",
  mes: "Este mes",
  mes_anterior: "Mes anterior",
  anio: "Este año",
};

export type Period = { preset: PeriodPreset | "custom"; from: ISODate; to: ISODate };

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;
/** Máximo de días (inclusive) que abarca un rango personalizado. */
const MAX_DAYS = 366;

function firstOfMonth(date: ISODate): ISODate {
  return `${date.slice(0, 7)}-01`;
}

function presetRange(preset: PeriodPreset, today: ISODate): { from: ISODate; to: ISODate } {
  switch (preset) {
    case "hoy":
      return { from: today, to: today };
    case "7d":
      return { from: addDays(today, -6), to: today };
    case "30d":
      return { from: addDays(today, -29), to: today };
    case "mes":
      return { from: firstOfMonth(today), to: today };
    case "mes_anterior":
      return { from: addMonthsClamped(firstOfMonth(today), -1), to: addDays(firstOfMonth(today), -1) };
    case "anio":
      return { from: `${today.slice(0, 4)}-01-01`, to: today };
  }
}

function isValidIso(date: string): boolean {
  return ISO_RE.test(date) && !Number.isNaN(Date.parse(`${date}T00:00:00Z`));
}

/** Interpreta ?preset= o ?from=&to= ; ante datos inválidos usa los últimos 30 días. */
export function resolvePeriod(params: { preset?: string; from?: string; to?: string }, today: ISODate): Period {
  const { from, to } = params;
  if (from && to && isValidIso(from) && isValidIso(to) && from <= to) {
    const tooLong = daysBetween(from, to) + 1 > MAX_DAYS;
    return { preset: "custom", from: tooLong ? addDays(to, -(MAX_DAYS - 1)) : from, to };
  }
  const preset = PERIOD_PRESETS.includes(params.preset as PeriodPreset) ? (params.preset as PeriodPreset) : "30d";
  return { preset, ...presetRange(preset, today) };
}

export type BucketUnit = "day" | "month";

/** Hasta ~2 meses se agrupa por día; más allá, por mes. */
export function bucketUnit(from: ISODate, to: ISODate): BucketUnit {
  return daysBetween(from, to) > 62 ? "month" : "day";
}

/** Claves de todos los cubos del rango (para rellenar huecos con cero). */
export function bucketKeys(from: ISODate, to: ISODate, unit: BucketUnit): ISODate[] {
  const keys: ISODate[] = [];
  if (unit === "day") {
    for (let d = from; d <= to; d = addDays(d, 1)) keys.push(d);
  } else {
    for (let m = firstOfMonth(from); m <= to; m = addMonthsClamped(m, 1)) keys.push(m);
  }
  return keys;
}
