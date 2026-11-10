"use client";

import { useActionState } from "react";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { FormMessage, SubmitButton } from "@/components/form-status";
import type { ActionState } from "@/lib/validation/shared";

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
  const [state, formAction] = useActionState(action, {});
  const e = state.fieldErrors ?? {};
  const v = (k: string) => values[k] ?? "";
  const text = (name: string, label: string, opts: { hint?: string; wide?: boolean; required?: boolean; type?: string } = {}) => (
    <Field label={label} name={name} hint={opts.hint} error={e[name]} className={opts.wide ? "sm:col-span-2" : undefined}>
      <Input name={name} defaultValue={v(name)} required={opts.required} type={opts.type} />
    </Field>
  );

  return (
    <form action={formAction} className="flex flex-col gap-8">
      <fieldset className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
        <legend className="mb-3 text-[15px] font-semibold">Company</legend>
        <Field label="Supplier code" name="supplier_code" hint="2–8 letters or digits, used on supplier POs" error={e.supplier_code}>
          <Input name="supplier_code" defaultValue={v("supplier_code")} required maxLength={8} className="font-semibold uppercase tracking-wider" />
        </Field>
        <Field label="Status" name="status">
          <Select name="status" defaultValue={v("status") || "active"}>
            <option value="prospect">Prospect</option>
            <option value="active">Active</option>
            <option value="on_hold">On hold</option>
            <option value="inactive">Inactive</option>
          </Select>
        </Field>
        {text("legal_name", "Legal company name", { required: true })}
        {text("display_name", "Display name", { required: true })}
        {text("website", "Website")}
        {text("email", "General email", { type: "email" })}
        {text("phone", "Phone")}
      </fieldset>

      <fieldset className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
        <legend className="mb-3 text-[15px] font-semibold">Commercial</legend>
        {text("payment_terms", "Payment terms")}
        <Field label="Currency" name="currency" error={e.currency}>
          <Input name="currency" defaultValue={v("currency") || "USD"} maxLength={3} className="uppercase" />
        </Field>
        {text("service_territory", "Service territory", { hint: "States, regions or countries covered", wide: true })}
        <Field label="Warranty" name="warranty_info" className="sm:col-span-2">
          <Textarea name="warranty_info" defaultValue={v("warranty_info")} className="min-h-16" />
        </Field>
      </fieldset>

      <fieldset className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
        <legend className="mb-3 text-[15px] font-semibold">Address</legend>
        {text("line1", "Address line 1", { wide: true })}
        {text("line2", "Address line 2", { wide: true })}
        {text("city", "City")}
        {text("state", "State / region")}
        {text("postal_code", "Postal code")}
        {text("country", "Country")}
      </fieldset>

      <fieldset className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
        <legend className="mb-3 text-[15px] font-semibold">Notes</legend>
        <Field label="Performance notes" name="performance_notes" className="sm:col-span-2">
          <Textarea name="performance_notes" defaultValue={v("performance_notes")} />
        </Field>
        <Field label="Internal notes" name="notes" className="sm:col-span-2">
          <Textarea name="notes" defaultValue={v("notes")} />
        </Field>
      </fieldset>

      <div className="flex flex-col gap-3 border-t border-line pt-6 sm:flex-row sm:items-center">
        <SubmitButton>{submitLabel}</SubmitButton>
        <FormMessage state={state} />
      </div>
    </form>
  );
}
