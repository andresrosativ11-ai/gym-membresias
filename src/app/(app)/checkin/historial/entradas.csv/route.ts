import { db } from "@/lib/db";
import { todayInTimeZone } from "@/lib/domain/dates";
import { checkInWhere, parseCheckInFilters } from "@/lib/checkins";
import { CHECKIN_METHOD_LABEL, CHECKIN_RESULT_LABEL, formatDateTime } from "@/lib/format";
import { getActiveUser } from "@/lib/session";
import { getSettings } from "@/lib/settings";

/** Escapa un campo CSV y neutraliza fórmulas (=, +, -, @) al abrir en Excel. */
function csvField(value: string | number | null): string {
  let s = value === null ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Tope de filas por descarga para no agotar la función en Vercel. */
const MAX_ROWS = 50_000;

export async function GET(req: Request) {
  const user = await getActiveUser();
  if (!user) return new Response("No autorizado", { status: 401 });
  if (user.role !== "ADMIN") return new Response("Solo administradores", { status: 403 });

  const url = new URL(req.url);
  const settings = await getSettings();
  const tz = settings.timezone;
  const f = parseCheckInFilters(Object.fromEntries(url.searchParams), todayInTimeZone(tz));
  const rows = await db.checkIn.findMany({
    where: checkInWhere(f, tz),
    orderBy: { at: "asc" },
    take: MAX_ROWS,
    include: {
      member: { select: { memberNumber: true, firstName: true, lastName: true } },
      staff: { select: { name: true } },
    },
  });

  const header = ["Fecha y hora", "Nº socio", "Socio", "Resultado", "Método", "Registró"];
  const lines = rows.map((c) =>
    [
      formatDateTime(c.at, tz),
      c.member?.memberNumber ?? null,
      c.member ? `${c.member.firstName} ${c.member.lastName}` : null,
      CHECKIN_RESULT_LABEL[c.result] ?? c.result,
      CHECKIN_METHOD_LABEL[c.method] ?? c.method,
      c.staff.name,
    ]
      .map(csvField)
      .join(","),
  );
  // BOM para que Excel abra bien los acentos.
  const body = "﻿" + [header.map(csvField).join(","), ...lines].join("\r\n");

  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="entradas_${f.from}_${f.to}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
