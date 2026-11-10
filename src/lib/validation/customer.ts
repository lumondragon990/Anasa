import { z } from "zod";
import { currency, optionalEmail, optionalText, partyStatus, requiredText } from "./shared";

export const customerCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9]{2,6}$/, "Use 2–6 letters or digits, e.g. ABC");

export const customerSchema = z.object({
  legal_name: requiredText("Legal name"),
  display_name: requiredText("Display name"),
  status: partyStatus.default("active"),
  website: optionalText(300),
  email: optionalEmail,
  phone: optionalText(50),
  tax_id: optionalText(60),
  payment_terms: optionalText(120),
  currency: currency.default("USD"),
  billing_line1: optionalText(200),
  billing_line2: optionalText(200),
  billing_city: optionalText(100),
  billing_state: optionalText(100),
  billing_postal_code: optionalText(30),
  billing_country: optionalText(100),
  notes: optionalText(5000),
});

export const newCustomerSchema = customerSchema.extend({ customer_code: customerCodeSchema });

export const contactSchema = z.object({
  first_name: requiredText("First name", 100),
  last_name: optionalText(100),
  title: optionalText(120),
  email: optionalEmail,
  phone: optionalText(50),
  is_primary: z
    .string()
    .optional()
    .transform((v) => v === "on"),
});

export const locationSchema = z.object({
  kind: z.enum(["billing", "shipping", "job_site", "office"]),
  label: requiredText("Label", 120),
  line1: optionalText(200),
  line2: optionalText(200),
  city: optionalText(100),
  state: optionalText(100),
  postal_code: optionalText(30),
  country: optionalText(100),
  site_notes: optionalText(2000),
});

export const changeCodeSchema = z.object({
  new_code: customerCodeSchema,
  reason: requiredText("Reason", 500),
});
