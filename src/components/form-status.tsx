"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import type { ActionState } from "@/lib/validation/shared";
import { cn } from "@/lib/utils";
import { useT, useTr } from "@/lib/i18n/client";

export function SubmitButton({
  children,
  pendingLabel,
  variant,
  className,
  pending: pendingProp,
}: {
  children: React.ReactNode;
  /** Pass when the form submits through useActionForm (onSubmit). */
  pending?: boolean;
  pendingLabel?: string;
  variant?: "primary" | "secondary" | "danger";
  className?: string;
}) {
  const status = useFormStatus();
  const pending = pendingProp ?? status.pending;
  const t = useT();
  return (
    <Button type="submit" disabled={pending} variant={variant} className={className} aria-busy={pending}>
      {pending ? (pendingLabel ?? t.common.saving) : children}
    </Button>
  );
}

export function FormMessage({ state }: { state: ActionState }) {
  const tr = useTr();
  if (!state.message) return null;
  return (
    <p
      role={state.ok ? "status" : "alert"}
      className={cn(
        "rounded-[var(--radius-control)] px-3 py-2 text-sm",
        state.ok ? "bg-ok-soft text-ok" : "bg-danger-soft text-danger",
      )}
    >
      {tr(state.message)}
    </p>
  );
}
