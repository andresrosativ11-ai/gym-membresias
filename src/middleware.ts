import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

export default NextAuth(authConfig).auth;

export const config = {
  // api/cron se autentica con CRON_SECRET; socio/<código> es el portal del socio (el enlace secreto es la credencial).
  matcher: ["/((?!api/auth|api/cron|socio/|_next/static|_next/image|favicon.ico|manifest.webmanifest|icon.svg).*)"],
};
