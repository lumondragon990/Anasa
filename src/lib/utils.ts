import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(value: string | null | undefined, localeTag = "en-US") {
  if (!value) return "—";
  // Plain dates (YYYY-MM-DD) are calendar days, not instants: format them in UTC so they never shift a day.
  const isPlainDate = /^\d{4}-\d{2}-\d{2}$/.test(value);
  return new Intl.DateTimeFormat(localeTag, { dateStyle: "medium", timeZone: isPlainDate ? "UTC" : undefined }).format(new Date(value));
}

export function formatMoney(value: number | string | null | undefined, currency = "USD", localeTag = "en-US") {
  if (value === null || value === undefined || value === "") return "—";
  return new Intl.NumberFormat(localeTag, { style: "currency", currency }).format(Number(value));
}

/** Revision numbers are shown as Rev 00, Rev 01, … */
export function formatRevision(n: number) {
  return `Rev ${String(n).padStart(2, "0")}`;
}

/** "USD 30,000.00 + MXN 120,000.00": totals per currency, never added across currencies. */
export function formatTotalsByCurrency(rows: { currency: string; amount: number | string | null }[], localeTag = "en-US") {
  const sums = new Map<string, number>();
  for (const r of rows) sums.set(r.currency, (sums.get(r.currency) ?? 0) + Math.round(Number(r.amount ?? 0) * 100));
  if (!sums.size) return formatMoney(0, "USD", localeTag);
  return [...sums.entries()].map(([cur, cents]) => formatMoney((cents / 100).toFixed(2), cur, localeTag)).join(" + ");
}
