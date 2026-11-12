import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/action-form";
import { db } from "@/lib/db";
import { isoFromDbDate } from "@/lib/domain/dates";
import { requireUser } from "@/lib/session";
import { photoUrl } from "@/lib/storage";
import { updateMember } from "../../actions";
import { MemberFields } from "../../member-fields";

export default async function EditarSocioPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  const m = await db.member.findUnique({ where: { id } });
  if (!m) notFound();

  return (
    <div className="space-y-4">
      <Link href={`/socios/${id}`} className="text-sm text-zinc-500">
        ← {m.firstName} {m.lastName}
      </Link>
      <h1 className="text-xl font-bold">Editar socio</h1>
      <ActionForm action={updateMember.bind(null, id)} className="card">
        <MemberFields
          submitLabel="Guardar cambios"
          defaults={{
            firstName: m.firstName,
            lastName: m.lastName,
            documentId: m.documentId,
            email: m.email,
            phone: m.phone,
            birthDate: m.birthDate ? isoFromDbDate(m.birthDate) : null,
            enrolledAt: isoFromDbDate(m.enrolledAt),
            notes: m.notes,
            photoUrl: photoUrl(m.photoKey),
            notifyWhatsapp: m.notifyWhatsapp,
            notifyEmail: m.notifyEmail,
          }}
        />
      </ActionForm>
    </div>
  );
}
