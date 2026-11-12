import { STATUS_LABEL, type MemberStatus } from "@/lib/domain/membership";

const STYLES: Record<MemberStatus, string> = {
  ACTIVO: "bg-green-100 text-green-800",
  POR_VENCER: "bg-amber-100 text-amber-800",
  VENCIDO: "bg-red-100 text-red-800",
  SUSPENDIDO: "bg-zinc-800 text-white",
  SIN_MEMBRESIA: "bg-zinc-100 text-zinc-600",
  BAJA: "bg-zinc-200 text-zinc-500 line-through",
};

export function StatusBadge({ status, daysLeft }: { status: MemberStatus; daysLeft?: number | null }) {
  const suffix =
    status === "POR_VENCER" && daysLeft != null ? (daysLeft === 0 ? " · hoy" : ` · ${daysLeft}d`) : "";
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${STYLES[status]}`}>
      {STATUS_LABEL[status]}
      {suffix}
    </span>
  );
}
