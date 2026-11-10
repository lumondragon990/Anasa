import { z } from "zod";
import { optionalText, requiredText } from "./shared";

export const quoteNumberSchema = z
  .string()
  .trim()
  .toUpperCase()
  .transform((v) => v.replace(/\s+/g, "-"))
  .pipe(z.string().regex(/^[A-Z0-9][A-Z0-9-]{2,39}$/, "Use 3–40 letters, digits and dashes, e.g. ANA-ART-Q-2026-0001"));

export const newQuotationSchema = z
  .object({
    customer_id: z.uuid("Choose a customer"),
    title: requiredText("Subject", 200),
    customer_reference: optionalText(120),
    valid_until: z
      .string()
      .trim()
      .optional()
      .transform((v) => (v ? v : null))
      .refine((v) => v === null || /^\d{4}-\d{2}-\d{2}$/.test(v), "Use a valid date"),
    manual_number: optionalText(40),
    manual_reason: optionalText(500),
  })
  .superRefine((v, ctx) => {
    if (!v.manual_number) return;
    const n = quoteNumberSchema.safeParse(v.manual_number);
    if (!n.success) ctx.addIssue({ code: "custom", path: ["manual_number"], message: n.error.issues[0].message });
    if (!v.manual_reason) ctx.addIssue({ code: "custom", path: ["manual_reason"], message: "Say why this number is set by hand" });
  });

const money = (label: string) =>
  z
    .string()
    .trim()
    .transform((v) => v.replace(/[,$\s]/g, ""))
    .pipe(z.string().regex(/^\d+(\.\d{1,2})?$/, `${label} must be an amount, e.g. 12400.00`));

const optionalMoney = (label: string) =>
  z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v.replace(/[,$\s]/g, "") : ""))
    .pipe(z.union([z.literal(""), z.string().regex(/^\d+(\.\d{1,2})?$/, `${label} must be an amount`)]))
    .transform((v) => (v === "" ? null : v));

const optionalDate = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v : null))
  .refine((v) => v === null || /^\d{4}-\d{2}-\d{2}$/.test(v), "Use a valid date");

export const supplierQuoteSchema = z.object({
  supplier_id: z.uuid("Choose a supplier"),
  supplier_quote_number: requiredText("Supplier’s quote number", 80),
  quote_date: optionalDate,
  valid_until: optionalDate,
  currency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/, "3-letter code, e.g. USD"),
  total_amount: money("Total"),
  freight: optionalMoney("Freight").transform((v) => v ?? "0"),
  lead_time: optionalText(120),
  scope_summary: optionalText(2000),
  exclusions: optionalText(2000),
  notes: optionalText(2000),
});
