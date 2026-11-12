"use server";

import { AuthError } from "next-auth";
import { headers } from "next/headers";
import { signIn } from "@/auth";

export type LoginState = { error?: string };

const DEFAULT_REDIRECT = "/checkin";

/**
 * Solo permite volver a rutas de esta misma app (evita redirecciones abiertas
 * hacia otros dominios vía ?callbackUrl=).
 */
async function safeRedirect(value: FormDataEntryValue | null): Promise<string> {
  if (typeof value !== "string" || value === "") return DEFAULT_REDIRECT;
  const host = (await headers()).get("host");
  try {
    const url = new URL(value, `http://${host}`);
    if (url.host !== host || url.pathname.startsWith("//") || url.pathname.startsWith("/login")) {
      return DEFAULT_REDIRECT;
    }
    return url.pathname + url.search;
  } catch {
    return DEFAULT_REDIRECT;
  }
}

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  try {
    await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirectTo: await safeRedirect(formData.get("callbackUrl")),
    });
    return {};
  } catch (error) {
    if (error instanceof AuthError) return { error: "Email o contraseña incorrectos" };
    throw error; // incluye el redirect de éxito
  }
}
