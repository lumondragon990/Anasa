import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(new Date(value));
}

export function formatMoney(value: number | string | null | undefined, currency = "USD") {
  if (value === null || value === undefined || value === "") return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(Number(value));
}

/** Revision numbers are shown as Rev 00, Rev 01, … */
export function formatRevision(n: number) {
  return `Rev ${String(n).padStart(2, "0")}`;
}
