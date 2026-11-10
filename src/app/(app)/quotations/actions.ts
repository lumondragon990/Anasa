"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireCapability } from "@/lib/auth";
import { newQuotationSchema, quoteNumberSchema, supplierQuoteSchema } from "@/lib/validation/quotation";
import { formToObject, optionalText, requiredText, zodErrorState, type ActionState } from "@/lib/validation/shared";

function dbMessage(error: { message: string; code?: string }) {
  if (error.code === "42501") return "You do not have permission to do this.";
  if (error.code === "23505") return error.message.includes("already in use") ? error.message : "That number is already in use.";
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
    p_manual_number: parsed.data.manual_number,
    p_manual_reason: parsed.data.manual_reason,
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

// ---------------------------------------------------------------------------
// Quote numbers set or changed by hand
// ---------------------------------------------------------------------------
export async function renumberQuotation(quotationId: string, _: ActionState, formData: FormData): Promise<ActionState> {
  await requireCapability("quotes.approve");
  const parsed = z
    .object({ new_number: quoteNumberSchema, reason: requiredText("Reason", 500) })
    .safeParse(formToObject(formData));
  if (!parsed.success) return zodErrorState(parsed.error);
  const supabase = await createClient();
  const { error } = await supabase.rpc("renumber_quotation", {
    p_quotation_id: quotationId,
    p_new_number: parsed.data.new_number,
    p_reason: parsed.data.reason,
  });
  if (error) return { ok: false, message: dbMessage(error) };
  revalidatePath(`/quotations/${quotationId}`);
  revalidatePath("/quotations");
  return { ok: true, message: `Number changed to ${parsed.data.new_number}.` };
}

// ---------------------------------------------------------------------------
// Supplier quotations (cost-restricted)
// ---------------------------------------------------------------------------
export async function addSupplierQuote(quotationId: string, _: ActionState, formData: FormData): Promise<ActionState> {
  await requireCapability("costs.view");
  const parsed = supplierQuoteSchema.safeParse(formToObject(formData));
  if (!parsed.success) return zodErrorState(parsed.error);
  const supabase = await createClient();
  const { error } = await supabase.from("supplier_quotes").insert({ ...parsed.data, quotation_id: quotationId });
  if (error) {
    if (error.code === "23505") return { ok: false, fieldErrors: { supplier_quote_number: ["This supplier quote number is already recorded for that supplier."] } };
    return { ok: false, message: dbMessage(error) };
  }
  revalidatePath(`/quotations/${quotationId}`);
  return { ok: true, message: "Supplier quotation recorded. Use Attach supplier PDF to add their file." };
}

const SQ_STATUSES = ["received", "selected", "not_selected", "expired", "withdrawn"] as const;

export async function setSupplierQuoteStatus(quotationId: string, supplierQuoteId: string, status: (typeof SQ_STATUSES)[number]) {
  await requireCapability("costs.view");
  if (!SQ_STATUSES.includes(status)) throw new Error("Invalid status");
  const supabase = await createClient();
  const { error } = await supabase.from("supplier_quotes").update({ status }).eq("id", supplierQuoteId);
  if (error) throw new Error(dbMessage(error));
  revalidatePath(`/quotations/${quotationId}`);
}

// ---------------------------------------------------------------------------
// Customer PO received → sales order approved for sale
// ---------------------------------------------------------------------------
const poSchema = z.object({
  po_number: requiredText("PO number", 80),
  po_date: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v : null))
    .refine((v) => v === null || /^\d{4}-\d{2}-\d{2}$/.test(v), "Use a valid date"),
  po_total: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v.replace(/[,$\s]/g, "") : ""))
    .pipe(z.union([z.literal(""), z.string().regex(/^\d+(\.\d{1,2})?$/, "PO total must be an amount")]))
    .transform((v) => (v === "" ? null : v)),
  notes: optionalText(2000),
  idempotency_key: z.string().uuid(),
});

export async function recordCustomerPo(quotationId: string, _: ActionState, formData: FormData): Promise<ActionState> {
  await requireCapability("orders.convert");
  const parsed = poSchema.safeParse(formToObject(formData));
  if (!parsed.success) return zodErrorState(parsed.error);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("record_customer_po", {
    p_quotation_id: quotationId,
    p_po_number: parsed.data.po_number,
    p_po_date: parsed.data.po_date,
    p_po_total: parsed.data.po_total,
    p_notes: parsed.data.notes,
    p_idempotency_key: parsed.data.idempotency_key,
  });
  if (error) {
    if (/already recorded/.test(error.message)) return { ok: false, fieldErrors: { po_number: [error.message] } };
    return { ok: false, message: dbMessage(error) };
  }
  revalidatePath(`/quotations/${quotationId}`);
  revalidatePath("/sales-orders");
  revalidatePath("/");
  redirect(`/sales-orders/${(data as { id: string }).id}`);
}
