import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

export default NextAuth(authConfig).auth;

export const config = {
  // api/cron se autentica con CRON_SECRET (no tiene sesión de usuario).
  matcher: ["/((?!api/auth|api/cron|_next/static|_next/image|favicon.ico|manifest.webmanifest|icon.svg).*)"],
};
