"use client";

import Link from "next/link";
import { useState } from "react";
import { markPortalInviteSent } from "../actions";
import { InviteButton } from "./invite-button";

export type InviteRow = {
  id: string;
  name: string;
  memberNumber: number;
  phone: string;
  href: string;
  sentLabel: string | null;
};

export function InviteQueue({ rows }: { rows: InviteRow[] }) {
  // Estado local para que la cola avance al instante, sin esperar al servidor.
  const [sent, setSent] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(rows.map((r) => [r.id, r.sentLabel !== null])),
  );
  const markLocal = (id: string, value: boolean) => setSent((s) => ({ ...s, [id]: value }));

  const pending = rows.filter((r) => !sent[r.id]);
  const done = rows.filter((r) => sent[r.id]);
  const next = pending[0];

  return (
    <div className="space-y-4">
      <section className="card space-y-3 text-center">
        <p className="text-sm text-zinc-600">
          <strong className="text-2xl text-zinc-900">{done.length}</strong> de {rows.length} enviados
        </p>
        <div className="h-2 overflow-hidden rounded-full bg-zinc-100">
          <div
            className="h-full bg-green-600 transition-all"
            style={{ width: `${rows.length ? (done.length / rows.length) * 100 : 0}%` }}
          />
        </div>
        {next ? (
          <>
            <InviteButton
              key={next.id}
              memberId={next.id}
              href={next.href}
              className="btn-primary w-full py-3 text-base"
              onSent={() => markLocal(next.id, true)}
            >
              Enviar al siguiente: {next.name}
            </InviteButton>
            <p className="text-xs text-zinc-500">
              Se abre WhatsApp con el mensaje listo: toca enviar y vuelve aquí para el siguiente.
            </p>
          </>
        ) : (
          <p className="font-medium text-green-700">¡Listo! Todos los socios con teléfono tienen su acceso.</p>
        )}
      </section>

      {pending.length > 0 && (
        <section className="space-y-2">
          <h2 className="font-semibold">Pendientes ({pending.length})</h2>
          <ul className="divide-y divide-zinc-100 overflow-hidden rounded-xl border border-zinc-200 bg-white">
            {pending.map((r) => (
              <li key={r.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                <Link href={`/socios/${r.id}`} className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{r.name}</span>
                  <span className="text-xs text-zinc-500">
                    #{r.memberNumber} · {r.phone}
                  </span>
                </Link>
                <InviteButton
                  memberId={r.id}
                  href={r.href}
                  className="btn-secondary shrink-0 px-3"
                  onSent={() => markLocal(r.id, true)}
                >
                  Enviar
                </InviteButton>
              </li>
            ))}
          </ul>
        </section>
      )}

      {done.length > 0 && (
        <details className="space-y-2">
          <summary className="cursor-pointer font-semibold">Enviados ({done.length})</summary>
          <ul className="mt-2 divide-y divide-zinc-100 overflow-hidden rounded-xl border border-zinc-200 bg-white">
            {done.map((r) => (
              <li key={r.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                <Link href={`/socios/${r.id}`} className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{r.name}</span>
                  <span className="text-xs text-zinc-500">{r.sentLabel ?? "enviado ahora"}</span>
                </Link>
                <InviteButton memberId={r.id} href={r.href} className="btn-secondary shrink-0 px-3">
                  Reenviar
                </InviteButton>
                <button
                  type="button"
                  className="shrink-0 text-xs text-zinc-500 underline"
                  onClick={() => {
                    markLocal(r.id, false);
                    void markPortalInviteSent(r.id, false);
                  }}
                >
                  No llegó
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
