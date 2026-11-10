"use client";

import { useActionForm } from "@/lib/use-action-form";
import { useEffect, useRef, useState } from "react";
import { Field, Input, Select } from "@/components/ui/form";
import { FormMessage, SubmitButton } from "@/components/form-status";
import type { ActionState } from "@/lib/validation/shared";
import { useT } from "@/lib/i18n/client";

type Action = (s: ActionState, f: FormData) => Promise<ActionState>;

export function AddLineForm({ action }: { action: Action }) {
  const t = useT();
  const Q = t.quotes;
  const [state, formAction, pending] = useActionForm(action);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) ref.current?.reset();
  }, [state]);
  const e = state.fieldErrors ?? {};
  return (
    <form ref={ref} onSubmit={formAction} className="grid gap-4 sm:grid-cols-6">
      <Field label={t.customers.type} name="line_type" className="sm:col-span-2">
        <Select name="line_type" defaultValue="product">
          <option value="product">{Q.lineType.product}</option>
          <option value="service">{Q.lineType.service}</option>
          <option value="other">{Q.lineType.other}</option>
        </Select>
      </Field>
      <Field label={Q.description_} name="description" error={e.description} className="sm:col-span-4">
        <Input name="description" required />
      </Field>
      <Field label={Q.manufacturer} name="manufacturer" className="sm:col-span-2">
        <Input name="manufacturer" />
      </Field>
      <Field label={Q.partNumber} name="part_number" className="sm:col-span-2">
        <Input name="part_number" />
      </Field>
      <Field label={Q.unit} name="unit" className="sm:col-span-2">
        <Input name="unit" defaultValue="EA" required />
      </Field>
      <Field label={Q.quantity} name="quantity" error={e.quantity} className="sm:col-span-2">
        <Input name="quantity" inputMode="decimal" required />
      </Field>
      <Field label={Q.unitSellingPrice} name="unit_price" error={e.unit_price} className="sm:col-span-2">
        <Input name="unit_price" inputMode="decimal" required />
      </Field>
      <Field label={Q.discountPct} name="discount_pct" error={e.discount_pct} className="sm:col-span-2">
        <Input name="discount_pct" inputMode="decimal" placeholder="0" />
      </Field>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-6">
        <SubmitButton pending={pending} variant="secondary">{Q.addLine}</SubmitButton>
        <FormMessage state={state} />
      </div>
    </form>
  );
}

export function ApproveForm({ action }: { action: Action }) {
  const t = useT();
  const Q = t.quotes;
  const [state, formAction, pending] = useActionForm(action);
  return (
    <form onSubmit={formAction} className="flex flex-col gap-3">
      <Field label={Q.approvalNotes} name="notes" hint={Q.approvalNotesHint}>
        <Input name="notes" />
      </Field>
      <SubmitButton pending={pending} pendingLabel={Q.approving}>{Q.approve}</SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}

export function NewRevisionForm({ action }: { action: Action }) {
  const t = useT();
  const Q = t.quotes;
  const [state, formAction, pending] = useActionForm(action);
  return (
    <form onSubmit={formAction} className="flex flex-col gap-3">
      <Field label={Q.revisionReasonLabel} name="reason" error={state.fieldErrors?.reason}>
        <Input name="reason" required placeholder={Q.revisionReasonPlaceholder} />
      </Field>
      <SubmitButton pending={pending} variant="secondary" pendingLabel={Q.creating}>
        {Q.createRevision}
      </SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}

export function RenumberForm({ action, current }: { action: Action; current: string }) {
  const t = useT();
  const Q = t.quotes;
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionForm(action);
  const e = state.fieldErrors ?? {};
  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)} className="text-sm text-accent hover:underline">
        {Q.editNumber}
      </button>
    );
  return (
    <form onSubmit={formAction} className="flex flex-col gap-3">
      <Field label={Q.newNumber} name="new_number" error={e.new_number}>
        <Input name="new_number" required defaultValue={current} className="font-semibold uppercase" />
      </Field>
      <Field label={t.common.reason} name="reason" hint={t.common.keptInHistory} error={e.reason}>
        <Input name="reason" required />
      </Field>
      <div className="flex flex-wrap items-center gap-2">
        <SubmitButton pending={pending} variant="secondary">{Q.changeNumber}</SubmitButton>
        <button type="button" onClick={() => setOpen(false)} className="text-sm text-muted hover:text-fg">
          {t.common.cancel}
        </button>
      </div>
      <FormMessage state={state} />
    </form>
  );
}

type SupplierOption = { id: string; supplier_code: string; display_name: string; currency: string };

export function SupplierQuoteForm({ action, suppliers, currency }: { action: Action; suppliers: SupplierOption[]; currency: string }) {
  const t = useT();
  const Q = t.quotes;
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionForm(action);
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
          {Q.recordSupplierQuote}
        </button>
        <FormMessage state={state} />
      </div>
    );
  if (!suppliers.length)
    return <p className="text-sm text-muted">{Q.addSupplierFirst}</p>;
  return (
    <form ref={ref} onSubmit={formAction} className="grid gap-4 sm:grid-cols-6">
      <Field label={t.common.supplier} name="supplier_id" error={e.supplier_id} className="sm:col-span-3">
        <Select name="supplier_id" required defaultValue="">
          <option value="" disabled>
            {Q.chooseSupplier}
          </option>
          {suppliers.map((s) => (
            <option key={s.id} value={s.id}>
              {s.supplier_code}  {s.display_name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label={Q.supplierQuoteNumber} name="supplier_quote_number" error={e.supplier_quote_number} className="sm:col-span-3">
        <Input name="supplier_quote_number" required />
      </Field>
      <Field label={Q.quoteDate} name="quote_date" error={e.quote_date} className="sm:col-span-2">
        <Input name="quote_date" type="date" />
      </Field>
      <Field label={Q.validUntil} name="valid_until" error={e.valid_until} className="sm:col-span-2">
        <Input name="valid_until" type="date" />
      </Field>
      <Field label={Q.leadTime} name="lead_time" className="sm:col-span-2">
        <Input name="lead_time" placeholder={Q.leadTimePlaceholder} />
      </Field>
      <Field label={t.common.currency} name="currency" error={e.currency} className="sm:col-span-2">
        <Input name="currency" defaultValue={currency} maxLength={3} required className="uppercase" />
      </Field>
      <Field label={Q.totalQuoted} name="total_amount" error={e.total_amount} className="sm:col-span-2">
        <Input name="total_amount" inputMode="decimal" required />
      </Field>
      <Field label={Q.freight} name="freight" error={e.freight} className="sm:col-span-2">
        <Input name="freight" inputMode="decimal" placeholder="0" />
      </Field>
      <Field label={Q.scopeOrNotes} name="notes" className="sm:col-span-6">
        <Input name="notes" />
      </Field>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-6">
        <SubmitButton pending={pending}>{Q.saveSupplierQuote}</SubmitButton>
        <button type="button" onClick={() => setOpen(false)} className="text-sm text-muted hover:text-fg">
          {t.common.cancel}
        </button>
        <FormMessage state={state} />
      </div>
    </form>
  );
}

export function CustomerPoForm({ action, quoteTotal }: { action: Action; quoteTotal: string }) {
  const t = useT();
  const Q = t.quotes;
  const [state, formAction, pending] = useActionForm(action);
  // One key per form: a double click or retry returns the same sales order.
  const [key] = useState(() => crypto.randomUUID());
  const e = state.fieldErrors ?? {};
  return (
    <form onSubmit={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="idempotency_key" value={key} />
      <Field label={Q.poNumber} name="po_number" error={e.po_number}>
        <Input name="po_number" required autoComplete="off" />
      </Field>
      <Field label={Q.poDate} name="po_date" error={e.po_date}>
        <Input name="po_date" type="date" />
      </Field>
      <Field label={Q.poTotal} name="po_total" hint={Q.poTotalHint(quoteTotal)} error={e.po_total}>
        <Input name="po_total" inputMode="decimal" />
      </Field>
      <Field label={Q.poNotes} name="notes">
        <Input name="notes" />
      </Field>
      <SubmitButton pending={pending} pendingLabel={Q.recording}>
        {Q.recordPo}
      </SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}
