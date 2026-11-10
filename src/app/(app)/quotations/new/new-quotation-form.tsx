"use client";

import { useActionState, useMemo, useState } from "react";
import { Field, Input, Select } from "@/components/ui/form";
import { FormMessage, SubmitButton } from "@/components/form-status";
import { createQuotation } from "../actions";

type Customer = { id: string; customer_code: string; display_name: string };

export function NewQuotationForm({
  customers,
  preselected,
  year,
  canSetNumber,
}: {
  customers: Customer[];
  preselected?: string;
  year: number;
  canSetNumber: boolean;
}) {
  const [manual, setManual] = useState(false);
  const [state, action] = useActionState(createQuotation, {});
  const [customerId, setCustomerId] = useState(preselected ?? "");
  const selected = useMemo(() => customers.find((c) => c.id === customerId), [customers, customerId]);
  const e = state.fieldErrors ?? {};

  return (
    <form action={action} className="grid gap-x-6 gap-y-5 sm:grid-cols-2">
      <Field label="Customer" name="customer_id" error={e.customer_id} className="sm:col-span-2">
        <Select name="customer_id" required value={customerId} onChange={(ev) => setCustomerId(ev.target.value)}>
          <option value="" disabled>
            Choose a customer
          </option>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.customer_code}  {c.display_name}
            </option>
          ))}
        </Select>
      </Field>

      <div className="rounded-[var(--radius-panel)] border border-dashed border-line-strong px-4 py-3 text-sm sm:col-span-2" aria-live="polite">
        {manual ? (
          <span>This quotation will use the number you enter below.</span>
        ) : selected ? (
          <>
            This quotation will be numbered{" "}
            <span className="font-semibold">
              ANA-{selected.customer_code}-Q-{year}-
            </span>
            <span className="text-muted">next in sequence</span> when you create it.
          </>
        ) : (
          <span className="text-muted">Pick a customer to see how the number will look.</span>
        )}
      </div>

      {canSetNumber ? (
        <div className="flex flex-col gap-4 sm:col-span-2">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={manual} onChange={(ev) => setManual(ev.target.checked)} className="size-4 accent-[var(--accent)]" />
            Use a specific quotation number instead of the next automatic one
          </label>
          {manual ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Quotation number" name="manual_number" hint="Letters, digits and dashes. Must not already exist." error={e.manual_number}>
                <Input name="manual_number" required className="font-semibold uppercase" placeholder={selected ? `ANA-${selected.customer_code}-Q-${year}-0001` : ""} />
              </Field>
              <Field label="Reason" name="manual_reason" hint="Kept in the number history" error={e.manual_reason}>
                <Input name="manual_reason" required placeholder="e.g. Number already sent from the old system" />
              </Field>
            </div>
          ) : null}
        </div>
      ) : null}

      <Field label="Subject" name="title" hint="What is being quoted, e.g. Replacement HV bushings, T2" error={e.title} className="sm:col-span-2">
        <Input name="title" required />
      </Field>
      <Field label="Customer reference" name="customer_reference" hint="Their RFQ or request number, if any" error={e.customer_reference}>
        <Input name="customer_reference" />
      </Field>
      <Field label="Valid until" name="valid_until" error={e.valid_until}>
        <Input name="valid_until" type="date" />
      </Field>
      <div className="flex flex-col gap-3 border-t border-line pt-5 sm:col-span-2 sm:flex-row sm:items-center">
        <SubmitButton pendingLabel="Creating…">Create quotation</SubmitButton>
        <FormMessage state={state} />
      </div>
    </form>
  );
}
