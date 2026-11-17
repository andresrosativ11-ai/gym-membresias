import Link from "next/link";
import { db } from "@/lib/db";
import { portalInviteMessage, portalUrl } from "@/lib/domain/portal";
import { formatDateTime, whatsappLink } from "@/lib/format";
import { requestOrigin } from "@/lib/origin";
import { requireUser } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import { InviteQueue, type InviteRow } from "./invite-queue";

export default async function EnviarAccesosPage() {
  await requireUser();
  const [settings, origin] = await Promise.all([getSettings(), requestOrigin()]);
  const members = await db.member.findMany({
    where: { deletedAt: null },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    select: {
      id: true,
      memberNumber: true,
      firstName: true,
      lastName: true,
      phone: true,
      accessCode: true,
      portalInviteSentAt: true,
    },
  });

  const rows: InviteRow[] = [];
  const noPhone: typeof members = [];
  for (const m of members) {
    const message = portalInviteMessage(m.firstName, settings.gymName, portalUrl(origin, m.accessCode));
    const href = m.phone ? whatsappLink(m.phone, message, settings.countryCode) : null;
    if (!href || !m.phone) {
      noPhone.push(m);
      continue;
    }
    rows.push({
      id: m.id,
      name: `${m.firstName} ${m.lastName}`,
      memberNumber: m.memberNumber,
      phone: m.phone,
      href,
      sentLabel: m.portalInviteSentAt ? `enviado ${formatDateTime(m.portalInviteSentAt, settings.timezone)}` : null,
    });
  }

  return (
    <div className="space-y-4">
      <Link href="/socios" className="text-sm text-zinc-500">
        ← Socios
      </Link>
      <div>
        <h1 className="text-xl font-bold">Enviar accesos al portal</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Cada socio recibe por WhatsApp su enlace personal (membresía, pagos y QR). Funciona mejor desde el celular del
          gimnasio.
        </p>
      </div>

      <InviteQueue rows={rows} />

      {noPhone.length > 0 && (
        <details>
          <summary className="cursor-pointer font-semibold">Sin teléfono válido ({noPhone.length})</summary>
          <p className="mt-1 text-xs text-zinc-500">Agrega o corrige el teléfono para poder enviarles el acceso.</p>
          <ul className="mt-2 divide-y divide-zinc-100 overflow-hidden rounded-xl border border-zinc-200 bg-white">
            {noPhone.map((m) => (
              <li key={m.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                <span className="truncate">
                  {m.firstName} {m.lastName} <span className="text-zinc-500">{m.phone ?? "sin teléfono"}</span>
                </span>
                <Link href={`/socios/${m.id}/editar`} className="shrink-0 text-zinc-500 underline">
                  Editar
                </Link>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
