export const DOCUMENT_CATEGORIES = {
  customer_rfq: "Customer RFQ",
  drawing: "Drawing",
  specification: "Specification",
  datasheet: "Datasheet",
  supplier_quote: "Supplier quotation",
  customer_po: "Customer PO",
  quotation: "Quotation",
  certificate: "Certificate",
  report: "Report",
  correspondence: "Correspondence",
  other: "Other",
} as const;

export type DocumentCategory = keyof typeof DOCUMENT_CATEGORIES;
export type UploadTarget = "quotation" | "supplier_quote";

export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

export function formatBytes(n: number | null | undefined) {
  if (!n && n !== 0) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

/** Storage folder for a record. Supplier pricing always lives under restricted/. */
export function folderFor(target: UploadTarget, id: string) {
  return target === "supplier_quote" ? `restricted/supplier-quotes/${id}` : `general/quotations/${id}`;
}

export function safeFileName(name: string) {
  const cleaned = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9._-]+/g, "_")
    .replace(/_+/g, "_")
    .slice(-120);
  return cleaned || "file";
}
