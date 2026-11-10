"use client";

import { useEffect, useRef } from "react";
import { Field, Input, Select } from "@/components/ui/form";
import { FormMessage, SubmitButton } from "@/components/form-status";
import { useActionForm } from "@/lib/use-action-form";
import { useT } from "@/lib/i18n/client";
import type { ActionState } from "@/lib/validation/shared";

type Action = (s: ActionState, f: FormData) => Promise<ActionState>;

export function PaymentForm({ action, balance, today }: { action: Action; balance: string; today: string }) {
  const t = useT();
  const O = t.orders;
  const [state, formAction, pending] = useActionForm(action);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) ref.current?.reset();
  }, [state]);
  const e = state.fieldErrors ?? {};
  return (
    <form ref={ref} onSubmit={formAction} className="grid gap-4 sm:grid-cols-4">
      <Field label={O.amount} name="amount" error={e.amount}>
        <Input name="amount" inputMode="decimal" required defaultValue={balance} />
      </Field>
      <Field label={O.paidOn} name="paid_on" error={e.paid_on}>
        <Input name="paid_on" type="date" required defaultValue={today} />
      </Field>
      <Field label={O.method} name="method">
        <Select name="method" defaultValue="transfer">
          {Object.entries(O.methods).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </Select>
      </Field>
      <Field label={O.reference} name="reference">
        <Input name="reference" placeholder={O.referencePlaceholder} />
      </Field>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-4">
        <SubmitButton pending={pending}>{O.recordPayment}</SubmitButton>
        <FormMessage state={state} />
      </div>
    </form>
  );
}

export function ReviewForm({ action, poTotal }: { action: Action; poTotal: string | null }) {
  const t = useT();
  const [state, formAction, pending] = useActionForm(action);
  return (
    <form onSubmit={formAction} className="flex flex-col gap-3">
      <Field label={t.orders.reviewNote} name="note" error={state.fieldErrors?.note}>
        <Input name="note" required />
      </Field>
      {poTotal ? (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="use_po_total" defaultChecked className="size-4 accent-[var(--accent)]" />
          {t.orders.usePoTotal(poTotal)}
        </label>
      ) : null}
      <SubmitButton pending={pending}>{t.orders.acceptDifferences}</SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}
