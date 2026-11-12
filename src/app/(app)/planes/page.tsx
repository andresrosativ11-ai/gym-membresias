import Link from "next/link";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { db } from "@/lib/db";
import { formatMoney, planDurationLabel } from "@/lib/format";
import { requireAdmin } from "@/lib/session";
import { createBenefit } from "./actions";

export default async function PlanesPage() {
  await requireAdmin();
  const [plans, benefits] = await Promise.all([
    db.plan.findMany({
      orderBy: [{ active: "desc" }, { priceCents: "asc" }],
      include: { benefits: { include: { benefit: true } }, _count: { select: { memberships: true } } },
    }),
    db.benefit.findMany({ orderBy: { label: "asc" } }),
  ]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Planes</h1>
        <Link href="/planes/nuevo" className="btn-primary">
          + Nuevo plan
        </Link>
      </div>

      <ul className="space-y-3">
        {plans.map((p) => (
          <li key={p.id}>
            <Link href={`/planes/${p.id}`} className={`card block ${p.active ? "" : "opacity-60"}`}>
              <div className="flex items-baseline justify-between">
                <span className="font-semibold">
                  {p.name} {!p.active && <span className="text-xs font-normal">(inactivo)</span>}
                </span>
                <span className="font-semibold">{formatMoney(p.priceCents, p.currency)}</span>
              </div>
              <p className="text-sm text-zinc-500">
                {planDurationLabel(p)} · {p._count.memberships} membresías emitidas
              </p>
              {p.benefits.length > 0 && (
                <ul className="mt-2 flex flex-wrap gap-1">
                  {p.benefits.map((pb) => (
                    <li key={pb.benefitId} className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-700">
                      {pb.benefit.label}
                      {pb.value && ` · ${pb.value}`}
                    </li>
                  ))}
                </ul>
              )}
            </Link>
          </li>
        ))}
      </ul>

      <section className="card">
        <h2 className="mb-2 font-semibold">Catálogo de beneficios</h2>
        <ul className="mb-3 flex flex-wrap gap-1">
          {benefits.map((b) => (
            <li key={b.id} className="rounded-full bg-zinc-100 px-2 py-0.5 text-sm">
              {b.label}
            </li>
          ))}
        </ul>
        <ActionForm action={createBenefit} resetOnSuccess className="flex gap-2">
          <input name="label" required placeholder="Nuevo beneficio (ej. Sauna)" className="field-input" />
          <SubmitButton className="btn-secondary shrink-0" pendingText="…">
            Agregar
          </SubmitButton>
        </ActionForm>
      </section>
    </div>
  );
}
