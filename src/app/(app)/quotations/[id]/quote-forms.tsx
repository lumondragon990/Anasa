"use client";

import { useActionState, useEffect, useRef, useState } from "react";
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

export function RenumberForm({ action, current }: { action: Action; current: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(action, {});
  const e = state.fieldErrors ?? {};
  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)} className="text-sm text-accent hover:underline">
        Edit quotation number
      </button>
    );
  return (
    <form action={formAction} className="flex flex-col gap-3">
      <Field label="New number" name="new_number" error={e.new_number}>
        <Input name="new_number" required defaultValue={current} className="font-semibold uppercase" />
      </Field>
      <Field label="Reason" name="reason" hint="Kept in the number history" error={e.reason}>
        <Input name="reason" required />
      </Field>
      <div className="flex flex-wrap items-center gap-2">
        <SubmitButton variant="secondary">Change number</SubmitButton>
        <button type="button" onClick={() => setOpen(false)} className="text-sm text-muted hover:text-fg">
          Cancel
        </button>
      </div>
      <FormMessage state={state} />
    </form>
  );
}

type SupplierOption = { id: string; supplier_code: string; display_name: string; currency: string };

export function SupplierQuoteForm({ action, suppliers, currency }: { action: Action; suppliers: SupplierOption[]; currency: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(action, {});
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) {
      ref.current?.reset();
      setOpen(false);
    }
  }, [state]);
  const e = state.fieldErrors ?? {};
  if (!open)
    return (
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => setOpen(true)} className="inline-flex h-8 items-center gap-2 rounded-[var(--radius-control)] border border-line-strong bg-surface px-3 text-sm font-medium hover:bg-surface-2">
          Record a supplier quotation
        </button>
        <FormMessage state={state} />
      </div>
    );
  if (!suppliers.length)
    return <p className="text-sm text-muted">Add the supplier under Suppliers first, then record their quotation here.</p>;
  return (
    <form ref={ref} action={formAction} className="grid gap-4 sm:grid-cols-6">
      <Field label="Supplier" name="supplier_id" error={e.supplier_id} className="sm:col-span-3">
        <Select name="supplier_id" required defaultValue="">
          <option value="" disabled>
            Choose a supplier
          </option>
          {suppliers.map((s) => (
            <option key={s.id} value={s.id}>
              {s.supplier_code}  {s.display_name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Supplier’s quote number" name="supplier_quote_number" error={e.supplier_quote_number} className="sm:col-span-3">
        <Input name="supplier_quote_number" required />
      </Field>
      <Field label="Quote date" name="quote_date" error={e.quote_date} className="sm:col-span-2">
        <Input name="quote_date" type="date" />
      </Field>
      <Field label="Valid until" name="valid_until" error={e.valid_until} className="sm:col-span-2">
        <Input name="valid_until" type="date" />
      </Field>
      <Field label="Lead time" name="lead_time" className="sm:col-span-2">
        <Input name="lead_time" placeholder="e.g. 6–8 weeks" />
      </Field>
      <Field label="Currency" name="currency" error={e.currency} className="sm:col-span-2">
        <Input name="currency" defaultValue={currency} maxLength={3} required className="uppercase" />
      </Field>
      <Field label="Total quoted" name="total_amount" error={e.total_amount} className="sm:col-span-2">
        <Input name="total_amount" inputMode="decimal" required />
      </Field>
      <Field label="Freight" name="freight" error={e.freight} className="sm:col-span-2">
        <Input name="freight" inputMode="decimal" placeholder="0" />
      </Field>
      <Field label="Scope or notes" name="notes" className="sm:col-span-6">
        <Input name="notes" />
      </Field>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-6">
        <SubmitButton>Save supplier quotation</SubmitButton>
        <button type="button" onClick={() => setOpen(false)} className="text-sm text-muted hover:text-fg">
          Cancel
        </button>
        <FormMessage state={state} />
      </div>
    </form>
  );
}
