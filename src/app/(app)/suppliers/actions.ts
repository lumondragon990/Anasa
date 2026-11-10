"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireCapability } from "@/lib/auth";
import { contactSchema } from "@/lib/validation/customer";
import { capabilitySchema, supplierSchema } from "@/lib/validation/supplier";
import { formToObject, zodErrorState, type ActionState } from "@/lib/validation/shared";

function dbMessage(error: { message: string; code?: string }) {
  if (error.code === "23505") return "That supplier code or entry already exists.";
  if (error.code === "42501") return "You do not have permission to do this.";
  return error.message;
}

export async function createSupplier(_: ActionState, formData: FormData): Promise<ActionState> {
  await requireCapability("suppliers.write");
  const parsed = supplierSchema.safeParse(formToObject(formData));
  if (!parsed.success) return zodErrorState(parsed.error);
  const supabase = await createClient();
  const { data, error } = await supabase.from("suppliers").insert(parsed.data).select("id").single();
  if (error) return { ok: false, message: dbMessage(error), fieldErrors: error.code === "23505" ? { supplier_code: [dbMessage(error)] } : undefined };
  revalidatePath("/suppliers");
  redirect(`/suppliers/${data.id}`);
}

export async function updateSupplier(id: string, _: ActionState, formData: FormData): Promise<ActionState> {
  await requireCapability("suppliers.write");
  const parsed = supplierSchema.safeParse(formToObject(formData));
  if (!parsed.success) return zodErrorState(parsed.error);
  const supabase = await createClient();
  const { error } = await supabase.from("suppliers").update(parsed.data).eq("id", id);
  if (error) return { ok: false, message: dbMessage(error) };
  revalidatePath(`/suppliers/${id}`);
  redirect(`/suppliers/${id}`);
}

export async function addSupplierContact(supplierId: string, _: ActionState, formData: FormData): Promise<ActionState> {
  await requireCapability("suppliers.write");
  const parsed = contactSchema.safeParse(formToObject(formData));
  if (!parsed.success) return zodErrorState(parsed.error);
  const supabase = await createClient();
  if (parsed.data.is_primary) {
    await supabase.from("supplier_contacts").update({ is_primary: false }).eq("supplier_id", supplierId).eq("is_primary", true);
  }
  const { error } = await supabase.from("supplier_contacts").insert({ ...parsed.data, supplier_id: supplierId });
  if (error) return { ok: false, message: dbMessage(error) };
  revalidatePath(`/suppliers/${supplierId}`);
  return { ok: true, message: "Contact added." };
}

export async function removeSupplierContact(supplierId: string, contactId: string) {
  await requireCapability("suppliers.write");
  const supabase = await createClient();
  const { error } = await supabase.from("supplier_contacts").delete().eq("id", contactId).eq("supplier_id", supplierId);
  if (error) throw new Error(dbMessage(error));
  revalidatePath(`/suppliers/${supplierId}`);
}

export async function addCapability(supplierId: string, _: ActionState, formData: FormData): Promise<ActionState> {
  await requireCapability("suppliers.write");
  const parsed = capabilitySchema.safeParse(formToObject(formData));
  if (!parsed.success) return zodErrorState(parsed.error);
  const supabase = await createClient();
  const { error } = await supabase.from("supplier_capabilities").insert({ ...parsed.data, supplier_id: supplierId });
  if (error) return { ok: false, message: dbMessage(error) };
  revalidatePath(`/suppliers/${supplierId}`);
  return { ok: true, message: "Added." };
}

export async function removeCapability(supplierId: string, capabilityId: string) {
  await requireCapability("suppliers.write");
  const supabase = await createClient();
  const { error } = await supabase.from("supplier_capabilities").delete().eq("id", capabilityId).eq("supplier_id", supplierId);
  if (error) throw new Error(dbMessage(error));
  revalidatePath(`/suppliers/${supplierId}`);
}
