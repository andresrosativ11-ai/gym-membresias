"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { FormState } from "@/components/action-form";
import { db } from "@/lib/db";
import { isUniqueViolation } from "@/lib/members";
import { requireAdmin } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import { benefitSchema, firstError, planSchema } from "@/lib/validation";

function parsePlan(fd: FormData) {
  const benefitIds = fd.getAll("benefitId").map(String);
  return planSchema.safeParse({
    name: fd.get("name") ?? "",
    durationUnit: fd.get("durationUnit") ?? "months",
    durationValue: fd.get("durationValue") ?? "",
    price: fd.get("price") ?? "",
    active: fd.get("active") === "on",
    benefits: benefitIds.map((benefitId) => ({
      benefitId,
      value: String(fd.get(`benefitValue_${benefitId}`) ?? ""),
    })),
  });
}

export async function createPlan(_prev: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  const parsed = parsePlan(fd);
  if (!parsed.success) return { error: firstError(parsed.error) };
  const { benefits, ...plan } = parsed.data;
  const { currency } = await getSettings();
  await db.plan.create({ data: { ...plan, currency, benefits: { create: benefits } } });
  revalidatePath("/planes");
  redirect("/planes");
}

export async function updatePlan(id: string, _prev: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  const parsed = parsePlan(fd);
  if (!parsed.success) return { error: firstError(parsed.error) };
  const { benefits, ...plan } = parsed.data;
  // Las membresías existentes guardan su propio precio: cambiar el plan no altera el historial.
  await db.$transaction([
    db.plan.update({ where: { id }, data: plan }),
    db.planBenefit.deleteMany({ where: { planId: id } }),
    db.planBenefit.createMany({ data: benefits.map((b) => ({ ...b, planId: id })) }),
  ]);
  revalidatePath("/planes");
  redirect("/planes");
}

function slugify(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function createBenefit(_prev: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  const parsed = benefitSchema.safeParse({ label: fd.get("label") ?? "" });
  if (!parsed.success) return { error: firstError(parsed.error) };
  try {
    await db.benefit.create({ data: { label: parsed.data.label, key: slugify(parsed.data.label) || "beneficio" } });
  } catch (e) {
    if (isUniqueViolation(e)) return { error: "Ese beneficio ya existe" };
    throw e;
  }
  revalidatePath("/planes");
  return { ok: `Beneficio "${parsed.data.label}" agregado` };
}
