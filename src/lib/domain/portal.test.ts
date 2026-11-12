import { describe, expect, it } from "vitest";
import { isPortalCode, portalInviteMessage, portalUrl } from "./portal";

describe("isPortalCode", () => {
  it("acepta el formato de los códigos de acceso (24 caracteres base64url)", () => {
    expect(isPortalCode("AbCdEfGhIjKlMnOpQrStUv-_")).toBe(true);
  });
  it("rechaza basura antes de consultar la base", () => {
    expect(isPortalCode("")).toBe(false);
    expect(isPortalCode("corto")).toBe(false);
    expect(isPortalCode("AbCdEfGhIjKlMnOpQrStUv/=")).toBe(false);
    expect(isPortalCode("a".repeat(200))).toBe(false);
  });
});

describe("portalUrl", () => {
  it("arma la dirección pública del portal", () => {
    expect(portalUrl("https://gym-membresias.vercel.app", "abc123")).toBe(
      "https://gym-membresias.vercel.app/socio/abc123",
    );
  });
  it("tolera una barra final en el origen", () => {
    expect(portalUrl("http://localhost:3000/", "abc")).toBe("http://localhost:3000/socio/abc");
  });
});

describe("portalInviteMessage", () => {
  it("saluda al socio por su nombre e incluye el enlace", () => {
    const msg = portalInviteMessage("Ana", "Mi Gym", "https://x.app/socio/abc");
    expect(msg).toContain("Hola Ana");
    expect(msg).toContain("Mi Gym");
    expect(msg).toContain("https://x.app/socio/abc");
  });
});
