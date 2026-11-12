import { describe, expect, it } from "vitest";
import { formatMoney, whatsappLink } from "./format";

describe("formatMoney", () => {
  it("muestra dólares con formato venezolano", () => {
    expect(formatMoney(125050, "USD")).toBe("$1.250,50");
  });
});

describe("whatsappLink", () => {
  it("convierte un celular local venezolano al formato de wa.me", () => {
    expect(whatsappLink("0412 123 4567", "Hola", "58")).toBe("https://wa.me/584121234567?text=Hola");
  });
  it("devuelve null si el número no es válido", () => {
    expect(whatsappLink("123", "Hola", "58")).toBeNull();
  });
});
