"use client";

import { useActionForm } from "@/lib/use-action-form";
import { useMemo, useState } from "react";
import { Field, Input, Select } from "@/components/ui/form";
import { FormMessage, SubmitButton } from "@/components/form-status";
import { createQuotation } from "../actions";
import { useT } from "@/lib/i18n/client";

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
  const t = useT();
  const Q = t.quotes;
  const [state, action, pending] = useActionForm(createQuotation);
  const [customerId, setCustomerId] = useState(preselected ?? "");
  const selected = useMemo(() => customers.find((c) => c.id === customerId), [customers, customerId]);
  const e = state.fieldErrors ?? {};

  return (
    <form onSubmit={action} className="grid gap-x-6 gap-y-5 sm:grid-cols-2">
      <Field label={t.common.customer} name="customer_id" error={e.customer_id} className="sm:col-span-2">
        <Select name="customer_id" required value={customerId} onChange={(ev) => setCustomerId(ev.target.value)}>
          <option value="" disabled>
            {Q.chooseCustomer}
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
          <span>{Q.willUseManual}</span>
        ) : selected ? (
          <>
            {Q.willBeNumbered}{" "}
            <span className="font-semibold">
              ANA-{selected.customer_code}-Q-{year}-
            </span>
            <span className="text-muted">{Q.nextInSequence}</span> {Q.whenCreated}
          </>
        ) : (
          <span className="text-muted">{Q.pickCustomer}</span>
        )}
      </div>

      {canSetNumber ? (
        <div className="flex flex-col gap-4 sm:col-span-2">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={manual} onChange={(ev) => setManual(ev.target.checked)} className="size-4 accent-[var(--accent)]" />
            {Q.useSpecific}
          </label>
          {manual ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={Q.quoteNumber} name="manual_number" hint={Q.quoteNumberHint} error={e.manual_number}>
                <Input name="manual_number" required className="font-semibold uppercase" placeholder={selected ? `ANA-${selected.customer_code}-Q-${year}-0001` : ""} />
              </Field>
              <Field label={t.common.reason} name="manual_reason" hint={t.common.keptInHistory} error={e.manual_reason}>
                <Input name="manual_reason" required placeholder={Q.manualReasonPlaceholder} />
              </Field>
            </div>
          ) : null}
        </div>
      ) : null}

      <Field label={t.common.subject} name="title" hint={Q.subjectHint} error={e.title} className="sm:col-span-2">
        <Input name="title" required />
      </Field>
      <Field label={Q.customerReference} name="customer_reference" hint={Q.customerReferenceHint} error={e.customer_reference}>
        <Input name="customer_reference" />
      </Field>
      <Field label={Q.validUntil} name="valid_until" error={e.valid_until}>
        <Input name="valid_until" type="date" />
      </Field>
      <div className="flex flex-col gap-3 border-t border-line pt-5 sm:col-span-2 sm:flex-row sm:items-center">
        <SubmitButton pending={pending} pendingLabel={Q.creating}>{Q.create}</SubmitButton>
        <FormMessage state={state} />
      </div>
    </form>
  );
}
