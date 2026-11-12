import { describe, expect, it } from "vitest";
import { buildMemberSearchText, normalizeSearch } from "./search";

describe("normalizeSearch", () => {
  it("quita acentos y pasa a minúsculas", () => {
    expect(normalizeSearch("López ÑANDÚ Müller")).toBe("lopez nandu muller");
  });
  it("colapsa espacios", () => {
    expect(normalizeSearch("  Ana   María ")).toBe("ana maria");
  });
});

describe("buildMemberSearchText", () => {
  it("combina nombre, apellidos, documento y email normalizados", () => {
    expect(
      buildMemberSearchText({
        firstName: "Ana",
        lastName: "Prueba López",
        documentId: "DOC-0001",
        email: "Ana@Example.com",
      }),
    ).toBe("ana prueba lopez doc-0001 ana@example.com");
  });
  it("omite campos vacíos", () => {
    expect(buildMemberSearchText({ firstName: "José", lastName: "Pérez", documentId: null, email: null })).toBe(
      "jose perez",
    );
  });
  it("permite buscar sin acentos", () => {
    const text = buildMemberSearchText({ firstName: "Ana", lastName: "López", documentId: null, email: null });
    expect(normalizeSearch("ana lop").split(" ").every((t) => text.includes(t))).toBe(true);
  });
});
