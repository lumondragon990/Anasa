import { z } from "zod";
import { currency, optionalEmail, optionalText, partyStatus, requiredText } from "./shared";

export const supplierSchema = z.object({
  supplier_code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{2,8}$/, "Use 2–8 letters or digits"),
  legal_name: requiredText("Legal name"),
  display_name: requiredText("Display name"),
  status: partyStatus.default("active"),
  website: optionalText(300),
  email: optionalEmail,
  phone: optionalText(50),
  line1: optionalText(200),
  line2: optionalText(200),
  city: optionalText(100),
  state: optionalText(100),
  postal_code: optionalText(30),
  country: optionalText(100),
  service_territory: optionalText(500),
  payment_terms: optionalText(120),
  currency: currency.default("USD"),
  warranty_info: optionalText(2000),
  performance_notes: optionalText(5000),
  notes: optionalText(5000),
});

export const capabilitySchema = z.object({
  kind: z.enum(["product", "service", "brand", "certification"]),
  value: requiredText("Value", 200),
});
