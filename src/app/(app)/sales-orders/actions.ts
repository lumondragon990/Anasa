"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireCapability } from "@/lib/auth";
import { formToObject, optionalText, requiredText, zodErrorState, type ActionState } from "@/lib/validation/shared";

function dbMessage(error: { message: string; code?: string }) {
  if (error.code === "42501" || /row-level security/.test(error.message)) return "You do not have permission to do this.";
  return error.message;
}

const paymentSchema = z.object({
  amount: z
    .string()
    .trim()
    .transform((v) => v.replace(/[,$\s]/g, ""))
    .pipe(z.string().regex(/^\d+(\.\d{1,2})?$/, "Amount must be an amount, e.g. 12400.00"))
    .refine((v) => Number(v) > 0, "Enter an amount greater than zero"),
  paid_on: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid date"),
  method: z.enum(["transfer", "check", "card", "cash", "other"]),
  reference: optionalText(120),
  notes: optionalText(1000),
});

function revalidateOrder(orderId: string) {
  revalidatePath(`/sales-orders/${orderId}`);
  revalidatePath("/sales-orders");
  revalidatePath("/");
}

export async function recordPayment(orderId: string, currency: string, _: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireCapability("payments.record");
  const parsed = paymentSchema.safeParse(formToObject(formData));
  if (!parsed.success) return zodErrorState(parsed.error);
  const supabase = await createClient();
  const { error } = await supabase
    .from("payments")
    .insert({ ...parsed.data, sales_order_id: orderId, currency, recorded_by: user.id });
  if (error) {
    if (/balance due|currency must match/.test(error.message)) return { ok: false, fieldErrors: { amount: [error.message] } };
    return { ok: false, message: dbMessage(error) };
  }
  revalidateOrder(orderId);
  return { ok: true, message: "Payment recorded." };
}

export async function deletePayment(orderId: string, paymentId: string) {
  await requireCapability("payments.delete");
  const supabase = await createClient();
  const { error } = await supabase.from("payments").delete().eq("id", paymentId).eq("sales_order_id", orderId);
  if (error) throw new Error(dbMessage(error));
  revalidateOrder(orderId);
}

export async function resolvePoMismatch(orderId: string, _: ActionState, formData: FormData): Promise<ActionState> {
  await requireCapability("orders.convert");
  const parsed = z.object({ note: requiredText("Note", 1000) }).safeParse(formToObject(formData));
  if (!parsed.success) return zodErrorState(parsed.error);
  const supabase = await createClient();
  const { error } = await supabase.rpc("resolve_po_mismatch", {
    p_sales_order_id: orderId,
    p_note: parsed.data.note,
    p_use_po_total: formData.get("use_po_total") === "on",
  });
  if (error) return { ok: false, message: dbMessage(error) };
  revalidateOrder(orderId);
  return { ok: true };
}
