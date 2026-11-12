import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/action-form";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { updatePlan } from "../actions";
import { PlanFields } from "../plan-fields";

export default async function EditarPlanPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const [plan, catalog] = await Promise.all([
    db.plan.findUnique({ where: { id }, include: { benefits: true } }),
    db.benefit.findMany({ orderBy: { label: "asc" } }),
  ]);
  if (!plan) notFound();

  return (
    <div className="space-y-4">
      <Link href="/planes" className="text-sm text-zinc-500">
        ← Planes
      </Link>
      <h1 className="text-xl font-bold">Editar plan</h1>
      <p className="text-sm text-zinc-500">
        Cambiar el precio no afecta las membresías ya asignadas.
      </p>
      <ActionForm action={updatePlan.bind(null, id)} className="card">
        <PlanFields
          catalog={catalog}
          submitLabel="Guardar cambios"
          defaults={{
            name: plan.name,
            durationUnit: plan.durationMonths ? "months" : "days",
            durationValue: plan.durationMonths ?? plan.durationDays ?? 1,
            price: (plan.priceCents / 100).toFixed(2),
            active: plan.active,
            benefits: Object.fromEntries(plan.benefits.map((b) => [b.benefitId, b.value])),
          }}
        />
      </ActionForm>
    </div>
  );
}
