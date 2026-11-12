import { getActiveUser } from "@/lib/session";
import { todayInTimeZone } from "@/lib/domain/dates";
import { resolvePeriod } from "@/lib/domain/periods";
import { PAYMENT_METHOD_LABEL } from "@/lib/format";
import { paymentsForExport } from "@/lib/reports";
import { getSettings } from "@/lib/settings";

/** Escapa un campo CSV y neutraliza fórmulas (=, +, -, @) al abrir en Excel. */
function csvField(value: string | number | null): string {
  let s = value === null ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET(req: Request) {
  const user = await getActiveUser();
  if (!user) return new Response("No autorizado", { status: 401 });
  if (user.role !== "ADMIN") return new Response("Solo administradores", { status: 403 });

  const url = new URL(req.url);
  const settings = await getSettings();
  const period = resolvePeriod(
    { from: url.searchParams.get("from") ?? undefined, to: url.searchParams.get("to") ?? undefined },
    todayInTimeZone(settings.timezone),
  );
  const rows = await paymentsForExport(period, settings.timezone);

  const header = ["Fecha", "Nº socio", "Socio", "Plan", `Monto (${settings.currency})`, "Método", "Referencia", "Recibió", "Estado"];
  const lines = rows.map((r) =>
    [
      r.paidAt,
      r.memberNumber,
      r.memberName,
      r.plan,
      (r.amountCents / 100).toFixed(2),
      PAYMENT_METHOD_LABEL[r.method] ?? r.method,
      r.reference,
      r.receivedBy,
      r.voided ? "Anulado" : "Válido",
    ]
      .map(csvField)
      .join(","),
  );
  // BOM para que Excel abra bien los acentos.
  const body = "﻿" + [header.map(csvField).join(","), ...lines].join("\r\n");

  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="pagos_${period.from}_${period.to}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
