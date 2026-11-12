import "server-only";
import { cache } from "react";
import { db } from "./db";
import { todayInTimeZone } from "./domain/dates";

export const getSettings = cache(async () => {
  return db.settings.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });
});

/** "Hoy" según la zona horaria del gimnasio. */
export async function gymToday() {
  const settings = await getSettings();
  return todayInTimeZone(settings.timezone);
}
