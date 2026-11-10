"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireInternalUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { DOCUMENT_CATEGORIES, MAX_UPLOAD_BYTES, folderFor, safeFileName, type UploadTarget } from "./shared";

const target = z.enum(["quotation", "supplier_quote"]);
const category = z.enum(Object.keys(DOCUMENT_CATEGORIES) as [keyof typeof DOCUMENT_CATEGORIES, ...(keyof typeof DOCUMENT_CATEGORIES)[]]);

const ticketInput = z.object({
  target,
  id: z.uuid(),
  fileName: z.string().min(1).max(255),
  size: z.number().int().positive().max(MAX_UPLOAD_BYTES, "Files can be up to 50 MB"),
});

type Ticket = { ok: true; path: string; token: string } | { ok: false; message: string };

/** Step 1: check permission and the record, then issue a one-time signed upload URL. */
export async function createUploadTicket(input: z.input<typeof ticketInput>): Promise<Ticket> {
  const user = await requireInternalUser();
  const parsed = ticketInput.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid file" };
  const { target: t, id, fileName } = parsed.data;
  if (t === "supplier_quote" && !can(user.role, "costs.view")) return { ok: false, message: "You do not have access to supplier pricing." };

  const supabase = await createClient();
  const table = t === "quotation" ? "quotations" : "supplier_quotes";
  const { data: record } = await supabase.from(table).select("id").eq("id", id).maybeSingle();
  if (!record) return { ok: false, message: "That record was not found." };

  const path = `${folderFor(t, id)}/${crypto.randomUUID()}-${safeFileName(fileName)}`;
  const { data, error } = await supabase.storage.from("documents").createSignedUploadUrl(path);
  if (error || !data) return { ok: false, message: error?.message ?? "Upload could not start." };
  return { ok: true, path: data.path ?? path, token: data.token };
}

const registerInput = z.object({
  target,
  id: z.uuid(),
  path: z.string().min(1),
  fileName: z.string().min(1).max(255),
  size: z.number().int().nonnegative(),
  contentType: z.string().max(200).optional(),
  category,
  description: z.string().trim().max(500).optional(),
  revalidate: z.string().startsWith("/"),
});

/** Step 2: after the browser uploaded the file, confirm it exists and record it. */
export async function registerDocument(input: z.input<typeof registerInput>): Promise<{ ok: boolean; message?: string }> {
  await requireInternalUser();
  const parsed = registerInput.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Invalid upload details." };
  const d = parsed.data;
  const folder = folderFor(d.target as UploadTarget, d.id);
  if (!d.path.startsWith(`${folder}/`)) return { ok: false, message: "Upload path does not match the record." };

  const supabase = await createClient();
  const objectName = d.path.slice(folder.length + 1);
  const { data: listed } = await supabase.storage.from("documents").list(folder, { search: objectName, limit: 1 });
  if (!listed?.some((o) => o.name === objectName)) return { ok: false, message: "The file did not finish uploading. Try again." };

  let links: Record<string, string | null> = {};
  if (d.target === "quotation") {
    const { data: q } = await supabase.from("quotations").select("customer_id").eq("id", d.id).maybeSingle();
    links = { quotation_id: d.id, customer_id: q?.customer_id ?? null };
  } else {
    const { data: sq } = await supabase.from("supplier_quotes").select("supplier_id").eq("id", d.id).maybeSingle();
    links = { supplier_quote_id: d.id, supplier_id: sq?.supplier_id ?? null };
  }

  const { data: me } = await supabase.auth.getUser();
  const { error } = await supabase.from("documents").insert({
    ...links,
    storage_path: d.path,
    file_name: d.fileName,
    size_bytes: d.size,
    content_type: d.contentType ?? null,
    category: d.target === "supplier_quote" ? "supplier_quote" : d.category,
    description: d.description || null,
    cost_restricted: d.target === "supplier_quote",
    uploaded_by: me.user?.id,
  });
  if (error) return { ok: false, message: error.message };
  revalidatePath(d.revalidate);
  return { ok: true };
}

export async function deleteDocument(documentId: string, revalidate: string) {
  const user = await requireInternalUser();
  if (!["super_admin", "director"].includes(user.role)) throw new Error("Only a Super Administrator or Director can delete files.");
  const supabase = await createClient();
  const { data: doc } = await supabase.from("documents").select("id, storage_path").eq("id", documentId).maybeSingle();
  if (!doc) return;
  const { error } = await supabase.from("documents").delete().eq("id", documentId);
  if (error) throw new Error(error.message);
  await supabase.storage.from("documents").remove([doc.storage_path]);
  revalidatePath(revalidate);
}
