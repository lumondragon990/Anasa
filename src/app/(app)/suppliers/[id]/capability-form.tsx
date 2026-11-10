"use client";

import { useActionForm } from "@/lib/use-action-form";
import { useEffect, useRef } from "react";
import { Input, Select } from "@/components/ui/form";
import { SubmitButton } from "@/components/form-status";
import type { ActionState } from "@/lib/validation/shared";
import { useT, useTr } from "@/lib/i18n/client";

export function CapabilityForm({ action }: { action: (s: ActionState, f: FormData) => Promise<ActionState> }) {
  const [state, formAction, pending] = useActionForm(action);
  const ref = useRef<HTMLFormElement>(null);
  const t = useT();
  const tr = useTr();
  useEffect(() => {
    if (state.ok) ref.current?.reset();
  }, [state]);
  return (
    <form ref={ref} onSubmit={formAction} className="flex flex-wrap items-start gap-2">
      <Select name="kind" defaultValue="product" className="w-36" aria-label={t.customers.type}>
        {["product", "service", "brand", "certification"].map((k) => (
          <option key={k} value={k}>
            {t.suppliers.kind[k]}
          </option>
        ))}
      </Select>
      <Input name="value" required placeholder={t.suppliers.capabilityPlaceholder} className="min-w-48 flex-1" aria-label={t.common.value} />
      <SubmitButton pending={pending} variant="secondary">{t.common.add}</SubmitButton>
      {state.ok === false ? <p className="w-full text-xs text-danger">{tr(state.message ?? state.fieldErrors?.value?.[0])}</p> : null}
    </form>
  );
}
