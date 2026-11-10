"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/form";
import { createBrowserSupabase } from "@/lib/supabase/client";
import { createUploadTicket, registerDocument } from "@/lib/documents/actions";
import { DOCUMENT_CATEGORIES, MAX_UPLOAD_BYTES, formatBytes, type DocumentCategory, type UploadTarget } from "@/lib/documents/shared";

/**
 * Uploads go straight from the browser to private Supabase Storage using a
 * one-time URL issued by the server, so large files never pass through Vercel.
 */
export function FileUpload({
  target,
  recordId,
  revalidate,
  defaultCategory = "other",
  showCategory = true,
  label = "Upload files",
}: {
  target: UploadTarget;
  recordId: string;
  revalidate: string;
  defaultCategory?: DocumentCategory;
  showCategory?: boolean;
  label?: string;
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [category, setCategory] = useState<DocumentCategory>(defaultCategory);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    setMessage(null);
    const supabase = createBrowserSupabase();
    let done = 0;
    for (const file of Array.from(files)) {
      if (file.size > MAX_UPLOAD_BYTES) {
        setMessage({ ok: false, text: `${file.name} is ${formatBytes(file.size)}. Files can be up to 50 MB.` });
        continue;
      }
      const ticket = await createUploadTicket({ target, id: recordId, fileName: file.name, size: file.size });
      if (!ticket.ok) {
        setMessage({ ok: false, text: ticket.message });
        continue;
      }
      const { error } = await supabase.storage
        .from("documents")
        .uploadToSignedUrl(ticket.path, ticket.token, file, { contentType: file.type || "application/octet-stream" });
      if (error) {
        setMessage({ ok: false, text: `${file.name}: ${error.message}` });
        continue;
      }
      const reg = await registerDocument({
        target,
        id: recordId,
        path: ticket.path,
        fileName: file.name,
        size: file.size,
        contentType: file.type || undefined,
        category,
        revalidate,
      });
      if (!reg.ok) setMessage({ ok: false, text: `${file.name}: ${reg.message}` });
      else done++;
    }
    if (done) setMessage((m) => m ?? { ok: true, text: done === 1 ? "File uploaded." : `${done} files uploaded.` });
    setBusy(false);
    if (input.current) input.current.value = "";
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {showCategory ? (
        <Select value={category} onChange={(e) => setCategory(e.target.value as DocumentCategory)} className="w-48" aria-label="File type" disabled={busy}>
          {Object.entries(DOCUMENT_CATEGORIES)
            .filter(([k]) => k !== "supplier_quote")
            .map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
        </Select>
      ) : null}
      <input ref={input} type="file" multiple className="sr-only" id={`upload-${recordId}`} onChange={(e) => upload(e.target.files)} disabled={busy} />
      <Button type="button" variant="secondary" size="sm" disabled={busy} onClick={() => input.current?.click()} aria-busy={busy}>
        <Upload /> {busy ? "Uploading…" : label}
      </Button>
      {message ? <span className={message.ok ? "text-xs text-ok" : "text-xs text-danger"} role="status">{message.text}</span> : null}
    </div>
  );
}
