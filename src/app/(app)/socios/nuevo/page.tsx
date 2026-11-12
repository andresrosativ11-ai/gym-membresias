import Link from "next/link";
import { ActionForm } from "@/components/action-form";
import { requireUser } from "@/lib/session";
import { gymToday } from "@/lib/settings";
import { createMember } from "../actions";
import { MemberFields } from "../member-fields";

export default async function NuevoSocioPage() {
  await requireUser();
  const today = await gymToday();
  return (
    <div className="space-y-4">
      <Link href="/socios" className="text-sm text-zinc-500">
        ← Socios
      </Link>
      <h1 className="text-xl font-bold">Nuevo socio</h1>
      <ActionForm action={createMember} className="card">
        <MemberFields defaults={{ enrolledAt: today }} submitLabel="Registrar socio" />
      </ActionForm>
    </div>
  );
}
