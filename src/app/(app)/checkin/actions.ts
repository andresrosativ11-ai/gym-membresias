"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { isoFromDbDate, todayInTimeZone } from "@/lib/domain/dates";
import { evaluateAccess, isDuplicateCheckIn } from "@/lib/domain/checkin";
import { memberView, memberWhere, type MemberView } from "@/lib/members";
import { requireUser } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import { checkInSchema } from "@/lib/validation";

export type CheckInResponse =
  | {
      kind: "result";
      allowed: boolean;
      message: string;
      duplicate: boolean;
      member: MemberView;
    }
  | { kind: "error"; message: string };

export async function checkInAction(input: unknown): Promise<CheckInResponse> {
  const user = await requireUser();
  const parsed = checkInSchema.safeParse(input);
  if (!parsed.success) return { kind: "error", message: "Código no válido" };
  const data = parsed.data;

  const member = await db.member.findUnique({
    where:
      data.method === "QR"
        ? { accessCode: data.accessCode }
        : data.method === "CODE"
          ? { memberNumber: data.memberNumber }
          : { id: data.memberId },
  });
  if (!member) return { kind: "error", message: "Socio no encontrado" };

  const settings = await getSettings();
  const today = todayInTimeZone(settings.timezone);
  const decision = evaluateAccess(
    {
      suspendedAt: member.suspendedAt,
      deletedAt: member.deletedAt,
      currentEndDate: member.currentEndDate ? isoFromDbDate(member.currentEndDate) : null,
    },
    today,
    settings.expiringSoonDays,
  );

  // Evita registrar dos veces el mismo QR escaneado seguido.
  let duplicate = false;
  if (decision.allowed) {
    const last = await db.checkIn.findFirst({
      where: { memberId: member.id, result: "ALLOWED" },
      orderBy: { at: "desc" },
      select: { at: true },
    });
    duplicate = isDuplicateCheckIn(last?.at ?? null, new Date());
  }
  if (!duplicate) {
    await db.checkIn.create({
      data: { memberId: member.id, method: data.method, result: decision.result, staffId: user.id },
    });
    revalidatePath("/checkin");
  }

  return {
    kind: "result",
    allowed: decision.allowed,
    message: decision.message,
    duplicate,
    member: memberView(member, today, settings.expiringSoonDays),
  };
}

export async function searchMembersAction(q: string): Promise<MemberView[]> {
  await requireUser();
  if (q.trim().length < 2) return [];
  const settings = await getSettings();
  const today = todayInTimeZone(settings.timezone);
  const rows = await db.member.findMany({
    where: memberWhere("todos", q, today, settings.expiringSoonDays),
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    take: 10,
  });
  return rows.map((m) => memberView(m, today, settings.expiringSoonDays));
}
