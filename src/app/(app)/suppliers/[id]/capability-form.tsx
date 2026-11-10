"use client";

import { useActionState, useEffect, useRef } from "react";
import { Input, Select } from "@/components/ui/form";
import { SubmitButton } from "@/components/form-status";
import type { ActionState } from "@/lib/validation/shared";

export function CapabilityForm({ action }: { action: (s: ActionState, f: FormData) => Promise<ActionState> }) {
  const [state, formAction] = useActionState(action, {});
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) ref.current?.reset();
  }, [state]);
  return (
    <form ref={ref} action={formAction} className="flex flex-wrap items-start gap-2">
      <Select name="kind" defaultValue="product" className="w-36" aria-label="Type">
        <option value="product">Product</option>
        <option value="service">Service</option>
        <option value="brand">Brand</option>
        <option value="certification">Certification</option>
      </Select>
      <Input name="value" required placeholder="e.g. Bushings, Oil processing, ABB" className="min-w-48 flex-1" aria-label="Value" />
      <SubmitButton variant="secondary">Add</SubmitButton>
      {state.ok === false ? <p className="w-full text-xs text-danger">{state.message ?? state.fieldErrors?.value?.[0]}</p> : null}
    </form>
  );
}
