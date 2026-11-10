"use client";

import { useActionState, useMemo, useState } from "react";
import { Field, Input, Select } from "@/components/ui/form";
import { FormMessage, SubmitButton } from "@/components/form-status";
import { createQuotation } from "../actions";

type Customer = { id: string; customer_code: string; display_name: string };

export function NewQuotationForm({ customers, preselected, year }: { customers: Customer[]; preselected?: string; year: number }) {
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
        {selected ? (
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
