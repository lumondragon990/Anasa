"use client";

import { Download, FileText, Trash2 } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { formatBytes, type DocumentCategory } from "@/lib/documents/shared";
import { deleteDocument } from "@/lib/documents/actions";
import { formatDate } from "@/lib/utils";
import { useT } from "@/lib/i18n/client";

export type DocumentRow = {
  id: string;
  file_name: string;
  category: DocumentCategory;
  size_bytes: number | null;
  uploaded_at: string;
};

export function DocumentList({ docs, canDelete, revalidate, empty }: { docs: DocumentRow[]; canDelete: boolean; revalidate: string; empty?: string }) {
  const t = useT();
  if (!docs.length) return <p className="text-sm text-muted">{empty ?? t.files.none}</p>;
  return (
    <ul className="flex flex-col divide-y divide-line">
      {docs.map((d) => (
        <li key={d.id} className="flex items-center gap-3 py-2 text-sm">
          <FileText className="size-4 shrink-0 text-muted" />
          <a href={`/documents/${d.id}/download?view=1`} target="_blank" rel="noopener" className="min-w-0 flex-1 truncate hover:underline">
            {d.file_name}
          </a>
          <span className="hidden text-xs text-muted sm:inline">
            {t.files.category[d.category]}, {formatBytes(d.size_bytes)}, {formatDate(d.uploaded_at, t.localeTag)}
          </span>
          <a href={`/documents/${d.id}/download`} className={buttonVariants({ variant: "ghost", size: "icon" })} aria-label={t.files.download(d.file_name)}>
            <Download />
          </a>
          {canDelete ? (
            <form action={deleteDocument.bind(null, d.id, revalidate)}>
              <button type="submit" className={buttonVariants({ variant: "ghost", size: "icon" })} aria-label={t.files.delete(d.file_name)}>
                <Trash2 />
              </button>
            </form>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
