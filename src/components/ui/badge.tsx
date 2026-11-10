"use client";

import { useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

type Tone = "neutral" | "accent" | "ok" | "warn" | "danger";

const tones: Record<Tone, string> = {
  neutral: "bg-surface-2 text-muted border-line",
  accent: "bg-accent-soft text-accent border-transparent",
  ok: "bg-ok-soft text-ok border-transparent",
  warn: "bg-warn-soft text-warn border-transparent",
  danger: "bg-danger-soft text-danger border-transparent",
};

export function Badge({ tone = "neutral", className, children }: { tone?: Tone; className?: string; children: React.ReactNode }) {
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium", tones[tone], className)}>
      {children}
    </span>
  );
}

const STATUS_TONE: Record<string, Tone> = {
  active: "ok",
  prospect: "accent",
  on_hold: "warn",
  inactive: "neutral",
  draft: "neutral",
  under_review: "warn",
  approved: "accent",
  sent: "accent",
  customer_reviewing: "accent",
  accepted: "ok",
  converted: "ok",
  rejected: "danger",
  expired: "neutral",
  cancelled: "neutral",
  superseded: "neutral",
  open: "accent",
  po_mismatch_review: "danger",
  received: "accent",
  unpaid: "warn",
  partially_paid: "accent",
  paid: "ok",
  selected: "ok",
  not_selected: "neutral",
  withdrawn: "neutral",
};

export function StatusBadge({ status }: { status: string }) {
  const t = useT();
  return <Badge tone={STATUS_TONE[status] ?? "neutral"}>{t.status[status] ?? status.replace(/_/g, " ")}</Badge>;
}
