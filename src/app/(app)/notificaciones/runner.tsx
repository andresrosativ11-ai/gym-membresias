"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import type { RunSummary } from "@/lib/notifications";
import { previewNotificationsAction, runNotificationsAction } from "./actions";

const TYPE_LABEL = { EXPIRING_SOON: "Por vencer", EXPIRED: "Vencida" } as const;
const STATUS_LABEL = { PREVIEW: "Pendiente", SENT: "Enviado", FAILED: "Falló" } as const;
const CHANNEL_LABEL = { WHATSAPP: "WhatsApp", EMAIL: "Email" } as const;

export function NotificationsRunner({ canSend }: { canSend: boolean }) {
  const [summary, setSummary] = useState<RunSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const run = (dryRun: boolean) => {
    if (!dryRun && !window.confirm("¿Enviar ahora los avisos pendientes?")) return;
    setError(null);
    startTransition(async () => {
      try {
        setSummary(await (dryRun ? previewNotificationsAction() : runNotificationsAction()));
      } catch {
        setError("No se pudo completar. Intenta de nuevo.");
      }
    });
  };

  const blocked = summary
    ? (Object.entries(summary.channels) as [keyof typeof CHANNEL_LABEL, RunSummary["channels"]["EMAIL"]][]).filter(
        ([, s]) => s.blockedReason,
      )
    : [];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <button className="btn-secondary" disabled={pending} onClick={() => run(true)}>
          {pending ? "Calculando…" : "Vista previa (no envía)"}
        </button>
        <button className="btn-primary" disabled={pending || !canSend} onClick={() => run(false)}>
          Enviar pendientes ahora
        </button>
      </div>
      {!canSend && (
        <p className="text-xs text-zinc-500">Para enviar, configura credenciales y activa al menos un canal arriba.</p>
      )}
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {summary && (
        <div className="space-y-2 text-sm">
          {summary.dryRun ? (
            <p className="text-zinc-600">
              {summary.items.length === 0
                ? "No hay avisos pendientes hoy."
                : `${summary.items.length} aviso(s) pendientes hoy:`}
            </p>
          ) : (
            <p className="rounded-lg bg-green-50 px-3 py-2 text-green-800">
              Enviados: {summary.sent} · Fallidos: {summary.failed}
            </p>
          )}
          {blocked.length > 0 && (
            <ul className="rounded-lg bg-amber-50 px-3 py-2 text-amber-800">
              {blocked.map(([ch, s]) => (
                <li key={ch}>
                  {CHANNEL_LABEL[ch]}: {s.blockedReason}
                  {summary.dryRun && " (en la vista previa se muestra igual)"}
                </li>
              ))}
            </ul>
          )}
          {summary.items.length > 0 && (
            <ul className="divide-y divide-zinc-100 overflow-hidden rounded-xl border border-zinc-200 bg-white">
              {summary.items.map((it) => (
                <li key={`${it.memberId}-${it.type}-${it.channel}`} className="flex items-start justify-between gap-2 px-3 py-2">
                  <span className="min-w-0">
                    <Link href={`/socios/${it.memberId}`} className="block truncate font-medium underline">
                      {it.name}
                    </Link>
                    <span className="block truncate text-xs text-zinc-500">
                      {CHANNEL_LABEL[it.channel]} · {TYPE_LABEL[it.type]} ·{" "}
                      {it.to ? (it.channel === "WHATSAPP" ? `+${it.to}` : it.to) : "sin dato válido"}
                    </span>
                    {it.error && <span className="block text-xs text-red-700">{it.error}</span>}
                  </span>
                  <span
                    className={`shrink-0 text-xs font-semibold ${
                      it.status === "SENT" ? "text-green-700" : it.status === "FAILED" ? "text-red-700" : "text-zinc-600"
                    }`}
                  >
                    {STATUS_LABEL[it.status]}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
