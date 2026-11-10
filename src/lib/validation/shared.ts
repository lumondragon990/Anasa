import { z } from "zod";

/** Empty form fields arrive as "" — treat them as null. */
export const optionalText = (max = 500) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional()
    .transform((v) => v ?? null);

export const requiredText = (label: string, max = 200) =>
  z.string().trim().min(1, `${label} is required`).max(max);

export const optionalEmail = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .nullable()
  .optional()
  .transform((v) => v ?? null)
  .refine((v) => v === null || z.email().safeParse(v).success, "Enter a valid email address");

export const currency = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{3}$/, "Use a 3-letter currency code, e.g. USD");

export const partyStatus = z.enum(["prospect", "active", "on_hold", "inactive"]);

export function formToObject(formData: FormData) {
  const obj: Record<string, string> = {};
  formData.forEach((value, key) => {
    if (typeof value === "string" && !key.startsWith("$")) obj[key] = value;
  });
  return obj;
}

export type ActionState = {
  ok?: boolean;
  message?: string;
  fieldErrors?: Record<string, string[] | undefined>;
};

export function zodErrorState(error: z.ZodError): ActionState {
  return { ok: false, message: "Check the highlighted fields.", fieldErrors: z.flattenError(error).fieldErrors };
}
