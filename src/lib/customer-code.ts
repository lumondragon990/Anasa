/**
 * Suggests a readable customer code from a company name.
 *
 *   ABC Industrial  → ABC   (leading acronym is kept)
 *   XYZ Energy      → XYZ
 *   Global Power    → GLP   (two words: 2 letters + 1 letter)
 *   Brownsville Public Utilities Board → BPU (3+ words: initials)
 *   Siemens         → SIE   (one word: first 3 letters)
 *
 * Legal suffixes and filler words are ignored. The database has the final
 * say on uniqueness (customer_code_registry); callers should check
 * availability and use `codeAlternatives` when the suggestion is taken.
 */
const IGNORED = new Set([
  "LLC", "INC", "CORP", "CORPORATION", "CO", "COMPANY", "LTD", "LIMITED", "SA", "SAS", "SRL", "SL",
  "DE", "DEL", "CV", "SAB", "GMBH", "AG", "PLC", "LP", "LLP", "THE", "AND", "OF", "Y", "EL", "LA", "LOS", "LAS",
]);

export const CODE_PATTERN = /^[A-Z0-9]{2,6}$/;

function words(name: string) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " ")
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .filter((w) => !IGNORED.has(w.toUpperCase()));
}

export function suggestCustomerCode(name: string): string {
  const parts = words(name);
  if (parts.length === 0) return "";
  const first = parts[0];
  if (/^[A-Z0-9]{2,4}$/.test(first)) return first;
  const up = parts.map((p) => p.toUpperCase());
  if (up.length === 1) return up[0].slice(0, 3).padEnd(2, "X");
  if (up.length === 2) return (up[0].slice(0, 2) + up[1].slice(0, 1)).padEnd(3, "X");
  return up.slice(0, 3).map((p) => p[0]).join("");
}

/** Further candidates to try when the first suggestion is already reserved. */
export function codeAlternatives(name: string, base = suggestCustomerCode(name)): string[] {
  const up = words(name).map((p) => p.toUpperCase());
  const joined = up.join("");
  const out = new Set<string>();
  if (up.length >= 2) out.add((up[0][0] + up[1].slice(0, 2)).slice(0, 3));
  if (up.length >= 2) out.add((up[0].slice(0, 2) + up[1].slice(0, 2)).slice(0, 4));
  if (joined.length >= 4) out.add(joined.slice(0, 4));
  for (let i = 2; i <= 9; i++) out.add(`${base.slice(0, 5)}${i}`);
  out.delete(base);
  return [...out].filter((c) => CODE_PATTERN.test(c));
}

export function normalizeCode(value: string) {
  return value.trim().toUpperCase();
}
