import { timingSafeEqual } from "node:crypto";
import { runNotifications } from "@/lib/notifications";

export const dynamic = "force-dynamic";

/**
 * Ejecutado por el cron diario (Vercel Cron envía "Authorization: Bearer $CRON_SECRET").
 * También sirve para cualquier cron externo que envíe ese mismo encabezado.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return Response.json({ error: "CRON_SECRET no configurado" }, { status: 503 });

  const received = Buffer.from(req.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }

  const summary = await runNotifications({ dryRun: false });
  // Solo totales: no se exponen datos de socios en la respuesta.
  return Response.json({
    ok: true,
    sent: summary.sent,
    failed: summary.failed,
    channels: Object.fromEntries(
      Object.entries(summary.channels).map(([ch, s]) => [ch, s.blockedReason ?? "activo"]),
    ),
  });
}
