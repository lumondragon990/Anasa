"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import type { ActionState } from "@/lib/validation/shared";
import { cn } from "@/lib/utils";

export function SubmitButton({
  children,
  pendingLabel,
  variant,
  className,
}: {
  children: React.ReactNode;
  pendingLabel?: string;
  variant?: "primary" | "secondary" | "danger";
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} variant={variant} className={className} aria-busy={pending}>
      {pending ? (pendingLabel ?? "Saving…") : children}
    </Button>
  );
}

export function FormMessage({ state }: { state: ActionState }) {
  if (!state.message) return null;
  return (
    <p
      role={state.ok ? "status" : "alert"}
      className={cn(
        "rounded-[var(--radius-control)] px-3 py-2 text-sm",
        state.ok ? "bg-ok-soft text-ok" : "bg-danger-soft text-danger",
      )}
    >
      {state.message}
    </p>
  );
}
