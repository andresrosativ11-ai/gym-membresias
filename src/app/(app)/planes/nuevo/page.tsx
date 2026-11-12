import Link from "next/link";
import { ActionForm } from "@/components/action-form";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { createPlan } from "../actions";
import { PlanFields } from "../plan-fields";

export default async function NuevoPlanPage() {
  await requireAdmin();
  const catalog = await db.benefit.findMany({ orderBy: { label: "asc" } });
  return (
    <div className="space-y-4">
      <Link href="/planes" className="text-sm text-zinc-500">
        ← Planes
      </Link>
      <h1 className="text-xl font-bold">Nuevo plan</h1>
      <ActionForm action={createPlan} className="card">
        <PlanFields defaults={{}} catalog={catalog} submitLabel="Crear plan" />
      </ActionForm>
    </div>
  );
}
