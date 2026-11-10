import { cn } from "@/lib/utils";

/**
 * Renders an ANASA document number as its readable parts, e.g.
 * ANA · ABC · Q · 2026 · 0001. The customer code and document type carry
 * the meaning, so they get the emphasis; the prefix and year step back.
 * The full number stays as one copyable string for search and screen readers.
 */
const TYPE_LABEL: Record<string, string> = {
  Q: "Quotation",
  P: "Sales order",
  REQ: "Request",
  SRFQ: "Supplier RFQ",
  SPO: "Supplier PO",
  SVC: "Service job",
};

export function DocRef({ value, size = "md", className }: { value: string; size?: "sm" | "md" | "lg"; className?: string }) {
  const parts = value.split("-");
  const isCustomerDoc = parts.length === 5; // ANA-ABC-Q-2026-0001
  const [prefix, ...rest] = parts;
  const code = isCustomerDoc ? rest[0] : null;
  const type = isCustomerDoc ? rest[1] : rest[0];
  const year = isCustomerDoc ? rest[2] : rest[1];
  const seq = isCustomerDoc ? rest[3] : rest[2];

  const sizes = {
    sm: "text-[13px] gap-[3px]",
    md: "text-sm gap-1",
    lg: "text-xl gap-1.5",
  } as const;

  return (
    <span
      className={cn("inline-flex items-baseline whitespace-nowrap font-medium tabular-nums", sizes[size], className)}
      title={`${TYPE_LABEL[type] ?? "Document"} ${value}`}
    >
      <span className="sr-only">{value}</span>
      <span aria-hidden className="text-muted">{prefix}</span>
      {code ? (
        <>
          <Sep />
          <span aria-hidden className="font-semibold text-fg">{code}</span>
        </>
      ) : null}
      <Sep />
      <span
        aria-hidden
        className={cn(
          "rounded-[4px] px-1 font-semibold",
          type === "P" ? "bg-ok-soft text-ok" : "bg-accent-soft text-accent",
        )}
      >
        {type}
      </span>
      <Sep />
      <span aria-hidden className="text-muted">{year}</span>
      <Sep />
      <span aria-hidden className="font-semibold text-fg">{seq}</span>
    </span>
  );
}

function Sep() {
  return (
    <span aria-hidden className="text-line-strong">
      -
    </span>
  );
}
