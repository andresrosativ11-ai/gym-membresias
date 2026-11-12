/**
 * Portal del socio: cada socio entra con un enlace personal /socio/<accessCode>.
 * Es el mismo código secreto de su QR, así que "Regenerar QR" también anula el enlace.
 */

/** Formato de newAccessCode(): 18 bytes en base64url = 24 caracteres. */
const CODE_RE = /^[A-Za-z0-9_-]{24}$/;

export function isPortalCode(code: string): boolean {
  return CODE_RE.test(code);
}

export function portalUrl(origin: string, accessCode: string): string {
  return `${origin.replace(/\/+$/, "")}/socio/${accessCode}`;
}

export function portalInviteMessage(firstName: string, gymName: string, url: string): string {
  return (
    `Hola ${firstName}, este es tu acceso personal a ${gymName}. ` +
    `Ahí ves tu membresía, tu fecha de vencimiento, tus pagos y tu código QR para entrar:\n${url}\n` +
    `No compartas este enlace.`
  );
}
