import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { auth } from "@/auth";
import { db } from "./db";

/**
 * Usuario de la sesión, verificado contra la base de datos en cada petición:
 * un usuario desactivado (o con rol cambiado) pierde acceso de inmediato,
 * aunque su cookie de sesión siga siendo válida.
 */
export const getActiveUser = cache(async () => {
  const session = await auth();
  if (!session?.user?.id) return null;
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, name: true, email: true, role: true, active: true },
  });
  return user?.active ? user : null;
});

export async function requireUser() {
  const user = await getActiveUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "ADMIN") redirect("/checkin?error=forbidden");
  return user;
}
