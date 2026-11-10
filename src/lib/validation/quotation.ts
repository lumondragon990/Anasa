import { z } from "zod";
import { optionalText, requiredText } from "./shared";

export const newQuotationSchema = z.object({
  customer_id: z.uuid("Choose a customer"),
  title: requiredText("Subject", 200),
  customer_reference: optionalText(120),
  valid_until: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v : null))
    .refine((v) => v === null || /^\d{4}-\d{2}-\d{2}$/.test(v), "Use a valid date"),
});
