/** Minúsculas, sin acentos/diacríticos y con espacios colapsados. */
export function normalizeSearch(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Texto de búsqueda que se guarda en Member.searchText. */
export function buildMemberSearchText(m: {
  firstName: string;
  lastName: string;
  documentId: string | null;
  email: string | null;
}): string {
  return normalizeSearch([m.firstName, m.lastName, m.documentId, m.email].filter(Boolean).join(" "));
}
