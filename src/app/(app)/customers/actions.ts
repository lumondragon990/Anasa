"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireCapability } from "@/lib/auth";
import { codeAlternatives, suggestCustomerCode } from "@/lib/customer-code";
import {
  changeCodeSchema, contactSchema, customerSchema, locationSchema, newCustomerSchema, normalizeTaxId, rfcIssue,
} from "@/lib/validation/customer";
import { formToObject, zodErrorState, type ActionState } from "@/lib/validation/shared";

function dbMessage(error: { message: string; code?: string }) {
  if (/document prefix/.test(error.message)) return "ANA is the ANASA document prefix and can't be a customer code. Use another code, e.g. ART.";
  if (error.code === "23505" || /already been issued|customers_code_unique/.test(error.message)) {
    return "That customer code is already in use or was issued to another company before. Choose a different code.";
  }
  if (error.code === "42501") return "You do not have permission to do this.";
  return error.message;
}

/** Returns a free code for a company name (first suggestion, then alternatives). */
export async function suggestAvailableCode(name: string): Promise<{ code: string; available: boolean }> {
  await requireCapability("customers.write");
  const base = suggestCustomerCode(name);
  if (!base) return { code: "", available: false };
  const supabase = await createClient();
  for (const candidate of [base, ...codeAlternatives(name, base)]) {
    const { data } = await supabase.rpc("customer_code_available", { p_code: candidate });
    if (data === true) return { code: candidate, available: true };
  }
  return { code: base, available: false };
}

export async function checkCodeAvailable(code: string): Promise<boolean> {
  await requireCapability("customers.write");
  const supabase = await createClient();
  const { data } = await supabase.rpc("customer_code_available", { p_code: code });
  return data === true;
}

export async function createCustomer(_: ActionState, formData: FormData): Promise<ActionState> {
  await requireCapability("customers.write");
  const parsed = newCustomerSchema.safeParse(formToObject(formData));
  if (!parsed.success) return zodErrorState(parsed.error);
  const rfc = rfcIssue(parsed.data.tax_id, parsed.data.billing_country);
  if (rfc) return { ok: false, message: "Check the highlighted fields.", fieldErrors: { tax_id: [rfc] } };
  parsed.data.tax_id = normalizeTaxId(parsed.data.tax_id);

  const supabase = await createClient();
  const { data, error } = await supabase.from("customers").insert(parsed.data).select("id").single();
  if (error) {
    const msg = dbMessage(error);
    return { ok: false, message: msg, fieldErrors: error.code === "23505" ? { customer_code: [msg] } : undefined };
  }
  revalidatePath("/customers");
  redirect(`/customers/${data.id}`);
}

export async function updateCustomer(id: string, _: ActionState, formData: FormData): Promise<ActionState> {
  await requireCapability("customers.write");
  const parsed = customerSchema.safeParse(formToObject(formData));
  if (!parsed.success) return zodErrorState(parsed.error);
  const rfc = rfcIssue(parsed.data.tax_id, parsed.data.billing_country);
  if (rfc) return { ok: false, message: "Check the highlighted fields.", fieldErrors: { tax_id: [rfc] } };
  parsed.data.tax_id = normalizeTaxId(parsed.data.tax_id);

  const supabase = await createClient();
  const { error } = await supabase.from("customers").update(parsed.data).eq("id", id);
  if (error) return { ok: false, message: dbMessage(error) };
  revalidatePath(`/customers/${id}`);
  redirect(`/customers/${id}`);
}

export async function changeCustomerCode(id: string, _: ActionState, formData: FormData): Promise<ActionState> {
  await requireCapability("customers.changeCode");
  const parsed = changeCodeSchema.safeParse(formToObject(formData));
  if (!parsed.success) return zodErrorState(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase.rpc("change_customer_code", {
    p_customer_id: id,
    p_new_code: parsed.data.new_code,
    p_reason: parsed.data.reason,
  });
  if (error) return { ok: false, message: dbMessage(error) };
  revalidatePath(`/customers/${id}`);
  return { ok: true, message: `Code changed to ${parsed.data.new_code}. Documents already issued keep their original numbers.` };
}

export async function addContact(customerId: string, _: ActionState, formData: FormData): Promise<ActionState> {
  await requireCapability("customers.write");
  const parsed = contactSchema.safeParse(formToObject(formData));
  if (!parsed.success) return zodErrorState(parsed.error);

  const supabase = await createClient();
  if (parsed.data.is_primary) {
    await supabase.from("customer_contacts").update({ is_primary: false }).eq("customer_id", customerId).eq("is_primary", true);
  }
  const { error } = await supabase.from("customer_contacts").insert({ ...parsed.data, customer_id: customerId });
  if (error) return { ok: false, message: dbMessage(error) };
  revalidatePath(`/customers/${customerId}`);
  return { ok: true, message: "Contact added." };
}

export async function removeContact(customerId: string, contactId: string) {
  await requireCapability("customers.write");
  const supabase = await createClient();
  const { error } = await supabase.from("customer_contacts").delete().eq("id", contactId).eq("customer_id", customerId);
  if (error) throw new Error(dbMessage(error));
  revalidatePath(`/customers/${customerId}`);
}

export async function addLocation(customerId: string, _: ActionState, formData: FormData): Promise<ActionState> {
  await requireCapability("customers.write");
  const parsed = locationSchema.safeParse(formToObject(formData));
  if (!parsed.success) return zodErrorState(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase.from("customer_locations").insert({ ...parsed.data, customer_id: customerId });
  if (error) return { ok: false, message: dbMessage(error) };
  revalidatePath(`/customers/${customerId}`);
  return { ok: true, message: "Location added." };
}

export async function removeLocation(customerId: string, locationId: string) {
  await requireCapability("customers.write");
  const supabase = await createClient();
  const { error } = await supabase.from("customer_locations").delete().eq("id", locationId).eq("customer_id", customerId);
  if (error) throw new Error(dbMessage(error));
  revalidatePath(`/customers/${customerId}`);
}
