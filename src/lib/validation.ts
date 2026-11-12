import { z } from "zod";

const optionalText = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .nullable()
  .optional()
  .transform((v) => v ?? null);

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida");

export const memberSchema = z.object({
  firstName: z.string().trim().min(1, "Nombre requerido").max(80),
  lastName: z.string().trim().min(1, "Apellido requerido").max(80),
  documentId: optionalText,
  email: optionalText.pipe(z.string().email("Email inválido").nullable()),
  phone: optionalText.pipe(
    z
      .string()
      .regex(/^\+?[0-9\s-]{7,20}$/, "Teléfono inválido")
      .nullable(),
  ),
  birthDate: optionalText.pipe(isoDate.nullable()),
  enrolledAt: isoDate,
  notes: optionalText.pipe(z.string().max(1000).nullable()),
  notifyWhatsapp: z.boolean(),
  notifyEmail: z.boolean(),
}).superRefine((m, ctx) => {
  if (m.notifyWhatsapp && !m.phone) {
    ctx.addIssue({ code: "custom", path: ["phone"], message: "Para avisos por WhatsApp hace falta el teléfono" });
  }
  if (m.notifyEmail && !m.email) {
    ctx.addIssue({ code: "custom", path: ["email"], message: "Para avisos por email hace falta el email" });
  }
});
export type MemberInput = z.infer<typeof memberSchema>;

/** Precio escrito como "499" o "499.50" → centavos. */
const moneyToCents = z
  .string()
  .trim()
  .regex(/^\d+(\.\d{1,2})?$/, "Precio inválido")
  .transform((v) => Math.round(Number(v) * 100));

export const planSchema = z
  .object({
    name: z.string().trim().min(1, "Nombre requerido").max(60),
    durationUnit: z.enum(["months", "days"]),
    durationValue: z.coerce.number().int().min(1, "Duración mínima 1").max(730),
    price: moneyToCents,
    active: z.boolean(),
    benefits: z.array(z.object({ benefitId: z.string().min(1), value: optionalText })),
  })
  .transform(({ durationUnit, durationValue, price, ...rest }) => ({
    ...rest,
    priceCents: price,
    durationMonths: durationUnit === "months" ? durationValue : null,
    durationDays: durationUnit === "days" ? durationValue : null,
  }));
export type PlanInput = z.infer<typeof planSchema>;

export const PAYMENT_METHODS = ["CASH", "CARD", "TRANSFER", "OTHER"] as const;

/** Cobro + renovación. Monto 0 permitido (cortesía), siempre con método. */
export const paymentSchema = z.object({
  planId: z.string().min(1, "Selecciona un plan"),
  amountCents: z
    .string()
    .trim()
    .regex(/^\d+(\.\d{1,2})?$/, "Monto inválido")
    .transform((v) => Math.round(Number(v) * 100))
    .pipe(z.number().max(100_000_000, "Monto demasiado alto")),
  method: z.enum(PAYMENT_METHODS, { errorMap: () => ({ message: "Elige el método de pago" }) }),
  reference: optionalText.pipe(z.string().max(100, "Referencia demasiado larga").nullable()),
});

export const settingsSchema = z.object({
  gymName: z.string().trim().min(1, "Nombre requerido").max(60),
  timezone: z.string().refine((tz) => {
    try {
      new Intl.DateTimeFormat("en", { timeZone: tz });
      return true;
    } catch {
      return false;
    }
  }, "Zona horaria inválida"),
  currency: z.string().regex(/^[A-Z]{3}$/, "Moneda inválida (código ISO, ej. USD)"),
  expiringSoonDays: z.coerce.number().int().min(1, "Mínimo 1 día").max(30, "Máximo 30 días"),
});

export const staffSchema = z.object({
  name: z.string().trim().min(1, "Nombre requerido").max(60),
  email: z.string().trim().toLowerCase().email("Email inválido"),
  role: z.enum(["ADMIN", "RECEPTION"], { errorMap: () => ({ message: "Rol inválido" }) }),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres").max(100),
});

export const benefitSchema = z.object({
  label: z.string().trim().min(1, "Nombre requerido").max(60),
});

export const checkInSchema = z.discriminatedUnion("method", [
  z.object({ method: z.literal("QR"), accessCode: z.string().trim().min(10).max(100) }),
  z.object({ method: z.literal("CODE"), memberNumber: z.coerce.number().int().positive() }),
  z.object({ method: z.literal("MANUAL"), memberId: z.string().min(1) }),
]);
export type CheckInInput = z.infer<typeof checkInSchema>;

export function firstError(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Datos inválidos";
}
