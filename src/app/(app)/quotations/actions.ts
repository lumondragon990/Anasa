"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireCapability } from "@/lib/auth";
import { newQuotationSchema } from "@/lib/validation/quotation";
import { formToObject, optionalText, requiredText, zodErrorState, type ActionState } from "@/lib/validation/shared";

function dbMessage(error: { message: string; code?: string }) {
  if (error.code === "42501") return "You do not have permission to do this.";
  return error.message;
}

export async function createQuotation(_: ActionState, formData: FormData): Promise<ActionState> {
  await requireCapability("quotes.create");
  const parsed = newQuotationSchema.safeParse(formToObject(formData));
  if (!parsed.success) return zodErrorState(parsed.error);

  const supabase = await createClient();
  // The number is generated inside the database, atomically, per customer and year.
  const { data, error } = await supabase.rpc("create_quotation", {
    p_customer_id: parsed.data.customer_id,
    p_title: parsed.data.title,
    p_customer_reference: parsed.data.customer_reference,
    p_valid_until: parsed.data.valid_until,
  });
  if (error) return { ok: false, message: dbMessage(error) };
  revalidatePath("/quotations");
  redirect(`/quotations/${(data as { id: string }).id}`);
}

const decimalString = (label: string, opts: { positive?: boolean; max?: number } = {}) =>
  z
    .string()
    .trim()
    .regex(/^\d+(\.\d{1,4})?$/, `${label} must be a number with up to 4 decimals`)
    .refine((v) => (opts.positive ? Number(v) > 0 : true), `${label} must be more than zero`)
    .refine((v) => (opts.max !== undefined ? Number(v) < opts.max : true), `${label} must be below ${opts.max}`);

const lineSchema = z.object({
  line_type: z.enum(["product", "service", "other"]),
  description: requiredText("Description", 2000),
  manufacturer: optionalText(120),
  part_number: optionalText(120),
  quantity: decimalString("Quantity", { positive: true }),
  unit: z.string().trim().min(1).max(20).default("EA"),
  unit_price: decimalString("Unit price"),
  discount_pct: z
    .string()
    .trim()
    .transform((v) => (v === "" ? "0" : v))
    .pipe(decimalString("Discount", { max: 100 })),
});

export async function addLine(quotationId: string, revisionId: string, _: ActionState, formData: FormData): Promise<ActionState> {
  await requireCapability("quotes.create");
  const parsed = lineSchema.safeParse(formToObject(formData));
  if (!parsed.success) return zodErrorState(parsed.error);
  const supabase = await createClient();

  const { data: last } = await supabase
    .from("quotation_line_items")
    .select("line_no")
    .eq("revision_id", revisionId)
    .order("line_no", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Numeric strings go to Postgres NUMERIC untouched: no floating-point rounding on the way.
  const { error } = await supabase
    .from("quotation_line_items")
    .insert({ ...parsed.data, revision_id: revisionId, line_no: (last?.line_no ?? 0) + 1 });
  if (error) return { ok: false, message: dbMessage(error) };
  revalidatePath(`/quotations/${quotationId}`);
  return { ok: true, message: "Line added." };
}

export async function removeLine(quotationId: string, lineId: string) {
  await requireCapability("quotes.create");
  const supabase = await createClient();
  const { error } = await supabase.from("quotation_line_items").delete().eq("id", lineId);
  if (error) throw new Error(dbMessage(error));
  revalidatePath(`/quotations/${quotationId}`);
}

export async function approveRevision(quotationId: string, revisionId: string, _: ActionState, formData: FormData): Promise<ActionState> {
  await requireCapability("quotes.approve");
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const supabase = await createClient();
  const { error } = await supabase.rpc("approve_quotation_revision", { p_revision_id: revisionId, p_notes: notes });
  if (error) return { ok: false, message: dbMessage(error) };
  revalidatePath(`/quotations/${quotationId}`);
  return { ok: true, message: "Revision approved and locked." };
}

export async function newRevision(quotationId: string, _: ActionState, formData: FormData): Promise<ActionState> {
  await requireCapability("quotes.create");
  const reason = String(formData.get("reason") ?? "").trim();
  if (!reason) return { ok: false, fieldErrors: { reason: ["Say why the quotation is being revised"] } };
  const supabase = await createClient();
  const { error } = await supabase.rpc("create_quotation_revision", { p_quotation_id: quotationId, p_reason: reason });
  if (error) return { ok: false, message: dbMessage(error) };
  revalidatePath(`/quotations/${quotationId}`);
  return { ok: true, message: "New revision created from the approved one." };
}
