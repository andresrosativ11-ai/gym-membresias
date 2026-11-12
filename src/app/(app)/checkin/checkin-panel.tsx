"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { Avatar } from "@/components/avatar";
import { StatusBadge } from "@/components/status-badge";
import { formatDate } from "@/lib/format";
import type { MemberView } from "@/lib/members";
import { checkInAction, searchMembersAction, type CheckInResponse } from "./actions";

type Tab = "qr" | "code" | "search";
type CheckInInput =
  | { method: "QR"; accessCode: string }
  | { method: "CODE"; memberNumber: string }
  | { method: "MANUAL"; memberId: string };

const TAB_KEY = "checkin-tab";
const RESULT_MS = 4000;
/** Tras cerrar el resultado, ignora toques que "atraviesan" hacia la lista de abajo. */
const COOLDOWN_MS = 800;

export function CheckInPanel() {
  const [tab, setTab] = useState<Tab>("qr");
  const [result, setResult] = useState<CheckInResponse | null>(null);
  const [pending, startTransition] = useTransition();
  const busy = useRef(false);
  const closedAt = useRef(0);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(TAB_KEY) as Tab | null;
      if (saved === "qr" || saved === "code" || saved === "search") setTab(saved);
    } catch {
      /* almacenamiento no disponible */
    }
  }, []);

  const changeTab = (t: Tab) => {
    setTab(t);
    try {
      localStorage.setItem(TAB_KEY, t);
    } catch {
      /* ignorar */
    }
  };

  const submit = useCallback((input: CheckInInput) => {
    if (busy.current || Date.now() - closedAt.current < COOLDOWN_MS) return;
    busy.current = true;
    startTransition(async () => {
      try {
        const res = await checkInAction(input);
        setResult(res);
        if (res.kind !== "result" || !res.allowed) navigator.vibrate?.([120, 60, 120]);
        else navigator.vibrate?.(60);
      } catch {
        setResult({ kind: "error", message: "Error de conexión. Intenta de nuevo." });
      } finally {
        busy.current = false;
      }
    });
  }, []);

  const closeResult = useCallback(() => {
    closedAt.current = Date.now();
    setResult(null);
  }, []);

  // Cierra el resultado automáticamente.
  useEffect(() => {
    if (!result) return;
    const t = setTimeout(closeResult, RESULT_MS);
    return () => clearTimeout(t);
  }, [result, closeResult]);

  return (
    <div className="space-y-4">
      <div role="tablist" className="grid grid-cols-3 gap-1 rounded-xl bg-zinc-200 p-1">
        {(
          [
            ["qr", "Escanear QR"],
            ["code", "Código"],
            ["search", "Buscar"],
          ] as const
        ).map(([t, label]) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => changeTab(t)}
            className={`min-h-11 rounded-lg text-sm font-semibold ${
              tab === t ? "bg-white shadow-sm" : "text-zinc-600"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "qr" && (
        <QrTab paused={pending || result !== null} onCode={(c) => submit({ method: "QR", accessCode: c })} />
      )}
      {tab === "code" && <CodeTab pending={pending} onSubmit={(n) => submit({ method: "CODE", memberNumber: n })} />}
      {tab === "search" && <SearchTab onPick={(id) => submit({ method: "MANUAL", memberId: id })} />}

      {result && <ResultOverlay result={result} onClose={closeResult} />}
    </div>
  );
}

function QrTab({ paused, onCode }: { paused: boolean; onCode: (code: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const pausedRef = useRef(paused);
  const onCodeRef = useRef(onCode);
  const lastRef = useRef<{ code: string; at: number } | null>(null);
  pausedRef.current = paused;
  onCodeRef.current = onCode;

  useEffect(() => {
    let scanner: import("qr-scanner").default | null = null;
    let cancelled = false;
    (async () => {
      const { default: QrScanner } = await import("qr-scanner");
      if (cancelled || !videoRef.current) return;
      scanner = new QrScanner(
        videoRef.current,
        ({ data }) => {
          if (pausedRef.current || !data) return;
          const now = Date.now();
          // ignora el mismo código durante 5 s
          if (lastRef.current && lastRef.current.code === data && now - lastRef.current.at < 5000) return;
          lastRef.current = { code: data, at: now };
          onCodeRef.current(data);
        },
        { preferredCamera: "environment", highlightScanRegion: true, maxScansPerSecond: 5 },
      );
      try {
        await scanner.start();
      } catch {
        if (!cancelled)
          setError("No se pudo abrir la cámara. Revisa los permisos (requiere HTTPS) o usa Código / Buscar.");
      }
    })();
    return () => {
      cancelled = true;
      scanner?.destroy();
    };
  }, []);

  return (
    <div className="overflow-hidden rounded-xl bg-black">
      {error ? (
        <p className="bg-white p-4 text-sm text-red-700">{error}</p>
      ) : (
        <video ref={videoRef} className="aspect-square w-full object-cover" muted playsInline />
      )}
    </div>
  );
}

function CodeTab({ pending, onSubmit }: { pending: boolean; onSubmit: (n: string) => void }) {
  const [value, setValue] = useState("");
  return (
    <form
      className="card space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (value.trim()) onSubmit(value.trim());
        setValue("");
      }}
    >
      <label htmlFor="memberNumber" className="field-label">
        Número de socio
      </label>
      <input
        id="memberNumber"
        value={value}
        onChange={(e) => setValue(e.target.value.replace(/\D/g, ""))}
        inputMode="numeric"
        pattern="[0-9]*"
        autoFocus
        autoComplete="off"
        className="field-input text-center text-3xl tracking-widest"
      />
      <button className="btn-primary w-full" disabled={pending || !value}>
        Registrar entrada
      </button>
    </form>
  );
}

function SearchTab({ onPick }: { onPick: (id: string) => void }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<MemberView[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    let active = true;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const r = await searchMembersAction(q);
        if (active) setResults(r);
      } finally {
        if (active) setLoading(false);
      }
    }, 300);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [q]);

  return (
    <div className="space-y-3">
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Nombre, documento o nº de socio"
        aria-label="Buscar socio"
        autoFocus
        className="field-input"
      />
      {loading && <p className="text-sm text-zinc-500">Buscando…</p>}
      {!loading && q.trim().length >= 2 && results.length === 0 && (
        <p className="text-sm text-zinc-500">Sin resultados.</p>
      )}
      <ul className="divide-y divide-zinc-100 overflow-hidden rounded-xl border border-zinc-200 bg-white">
        {results.map((m) => (
          <li key={m.id}>
            <button
              onClick={() => onPick(m.id)}
              className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-zinc-50"
            >
              <Avatar src={m.photoUrl} name={m.fullName} size={40} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{m.fullName}</span>
                <span className="text-xs text-zinc-500">#{m.memberNumber}</span>
              </span>
              <StatusBadge status={m.status} daysLeft={m.daysLeft} />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ResultOverlay({ result, onClose }: { result: CheckInResponse; onClose: () => void }) {
  const allowed = result.kind === "result" && result.allowed;
  return (
    <button
      onClick={onClose}
      aria-live="assertive"
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 p-6 text-center text-white ${
        allowed ? "bg-green-600" : "bg-red-600"
      }`}
    >
      <span className="text-6xl font-black" aria-hidden>
        {allowed ? "✓" : "✕"}
      </span>
      {result.kind === "result" ? (
        <>
          <Avatar src={result.member.photoUrl} name={result.member.fullName} size={160} />
          <span className="text-2xl font-bold">{result.member.fullName}</span>
          <span className="text-lg">#{result.member.memberNumber}</span>
          <span className="text-xl font-semibold">{result.message}</span>
          <span className="text-sm opacity-90">Vence: {formatDate(result.member.endDate)}</span>
          {result.duplicate && <span className="text-sm opacity-90">(ya registrado hace un momento)</span>}
        </>
      ) : (
        <span className="text-2xl font-bold">{result.message}</span>
      )}
      <span className="mt-4 text-sm opacity-75">Toca para continuar</span>
    </button>
  );
}
