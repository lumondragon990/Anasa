"use client";

import { useActionState, useEffect, useRef } from "react";
import { Field, Input, Select } from "@/components/ui/form";
import { FormMessage, SubmitButton } from "@/components/form-status";
import type { ActionState } from "@/lib/validation/shared";

type Action = (s: ActionState, f: FormData) => Promise<ActionState>;

export function AddLineForm({ action }: { action: Action }) {
  const [state, formAction] = useActionState(action, {});
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) ref.current?.reset();
  }, [state]);
  const e = state.fieldErrors ?? {};
  return (
    <form ref={ref} action={formAction} className="grid gap-4 sm:grid-cols-6">
      <Field label="Type" name="line_type" className="sm:col-span-2">
        <Select name="line_type" defaultValue="product">
          <option value="product">Product</option>
          <option value="service">Service</option>
          <option value="other">Other</option>
        </Select>
      </Field>
      <Field label="Description" name="description" error={e.description} className="sm:col-span-4">
        <Input name="description" required />
      </Field>
      <Field label="Manufacturer" name="manufacturer" className="sm:col-span-2">
        <Input name="manufacturer" />
      </Field>
      <Field label="Part number" name="part_number" className="sm:col-span-2">
        <Input name="part_number" />
      </Field>
      <Field label="Unit" name="unit" className="sm:col-span-2">
        <Input name="unit" defaultValue="EA" required />
      </Field>
      <Field label="Quantity" name="quantity" error={e.quantity} className="sm:col-span-2">
        <Input name="quantity" inputMode="decimal" required />
      </Field>
      <Field label="Unit selling price" name="unit_price" error={e.unit_price} className="sm:col-span-2">
        <Input name="unit_price" inputMode="decimal" required />
      </Field>
      <Field label="Discount %" name="discount_pct" error={e.discount_pct} className="sm:col-span-2">
        <Input name="discount_pct" inputMode="decimal" placeholder="0" />
      </Field>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-6">
        <SubmitButton variant="secondary">Add line</SubmitButton>
        <FormMessage state={state} />
      </div>
    </form>
  );
}

export function ApproveForm({ action }: { action: Action }) {
  const [state, formAction] = useActionState(action, {});
  return (
    <form action={formAction} className="flex flex-col gap-3">
      <Field label="Approval notes" name="notes" hint="Optional. Stored with the approved revision.">
        <Input name="notes" />
      </Field>
      <SubmitButton pendingLabel="Approving…">Approve and lock revision</SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}

export function NewRevisionForm({ action }: { action: Action }) {
  const [state, formAction] = useActionState(action, {});
  return (
    <form action={formAction} className="flex flex-col gap-3">
      <Field label="Reason for revision" name="reason" error={state.fieldErrors?.reason}>
        <Input name="reason" required placeholder="e.g. Customer changed quantity" />
      </Field>
      <SubmitButton variant="secondary" pendingLabel="Creating…">
        Create next revision
      </SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}
