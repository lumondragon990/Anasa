"use client";

import { useActionForm } from "@/lib/use-action-form";

import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { FormMessage, SubmitButton } from "@/components/form-status";
import type { ActionState } from "@/lib/validation/shared";
import { useT } from "@/lib/i18n/client";

type Values = Record<string, string | null | undefined>;

export function SupplierForm({
  action,
  values = {},
  submitLabel,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  values?: Values;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionForm(action);
  const t = useT();
  const S = t.suppliers;
  const C = t.customers;
  const e = state.fieldErrors ?? {};
  const v = (k: string) => values[k] ?? "";
  const text = (name: string, label: string, opts: { hint?: string; wide?: boolean; required?: boolean; type?: string } = {}) => (
    <Field label={label} name={name} hint={opts.hint} error={e[name]} className={opts.wide ? "sm:col-span-2" : undefined}>
      <Input name={name} defaultValue={v(name)} required={opts.required} type={opts.type} />
    </Field>
  );

  return (
    <form onSubmit={formAction} className="flex flex-col gap-8">
      <fieldset className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
        <legend className="mb-3 text-[15px] font-semibold">{C.sectionCompany}</legend>
        <Field label={S.supplierCode} name="supplier_code" hint={S.supplierCodeHint} error={e.supplier_code}>
          <Input name="supplier_code" defaultValue={v("supplier_code")} required maxLength={8} className="font-semibold uppercase tracking-wider" />
        </Field>
        <Field label={t.common.status} name="status">
          <Select name="status" defaultValue={v("status") || "active"}>
            {["prospect", "active", "on_hold", "inactive"].map((st) => (
              <option key={st} value={st}>
                {t.status[st]}
              </option>
            ))}
          </Select>
        </Field>
        {text("legal_name", C.legalName, { required: true })}
        {text("display_name", C.displayName, { required: true })}
        {text("website", t.common.website)}
        {text("email", C.generalEmail, { type: "email" })}
        {text("phone", t.common.phone)}
      </fieldset>

      <fieldset className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
        <legend className="mb-3 text-[15px] font-semibold">{C.sectionCommercial}</legend>
        {text("payment_terms", C.paymentTerms)}
        <Field label={t.common.currency} name="currency" error={e.currency}>
          <Input name="currency" defaultValue={v("currency") || "USD"} maxLength={3} className="uppercase" />
        </Field>
        {text("service_territory", S.serviceTerritory, { hint: S.serviceTerritoryHint, wide: true })}
        <Field label={S.warranty} name="warranty_info" className="sm:col-span-2">
          <Textarea name="warranty_info" defaultValue={v("warranty_info")} className="min-h-16" />
        </Field>
      </fieldset>

      <fieldset className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
        <legend className="mb-3 text-[15px] font-semibold">{S.address}</legend>
        {text("line1", C.line1, { wide: true })}
        {text("line2", C.line2, { wide: true })}
        {text("city", C.city)}
        {text("state", C.state)}
        {text("postal_code", C.postal)}
        {text("country", C.country)}
      </fieldset>

      <fieldset className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
        <legend className="mb-3 text-[15px] font-semibold">{C.sectionNotes}</legend>
        <Field label={S.performanceNotes} name="performance_notes" className="sm:col-span-2">
          <Textarea name="performance_notes" defaultValue={v("performance_notes")} />
        </Field>
        <Field label={C.internalNotes} name="notes" className="sm:col-span-2">
          <Textarea name="notes" defaultValue={v("notes")} />
        </Field>
      </fieldset>

      <div className="flex flex-col gap-3 border-t border-line pt-6 sm:flex-row sm:items-center">
        <SubmitButton pending={pending}>{submitLabel}</SubmitButton>
        <FormMessage state={state} />
      </div>
    </form>
  );
}
