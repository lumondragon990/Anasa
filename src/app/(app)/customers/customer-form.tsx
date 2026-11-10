"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { FormMessage, SubmitButton } from "@/components/form-status";
import type { ActionState } from "@/lib/validation/shared";
import { checkCodeAvailable, suggestAvailableCode } from "./actions";

export type CustomerValues = Partial<Record<
  | "legal_name" | "display_name" | "status" | "website" | "email" | "phone" | "tax_id" | "payment_terms"
  | "currency" | "billing_line1" | "billing_line2" | "billing_city" | "billing_state" | "billing_postal_code"
  | "billing_country" | "notes", string | null>>;

export function CustomerForm({
  action,
  values = {},
  isNew,
  submitLabel,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  values?: CustomerValues;
  isNew?: boolean;
  submitLabel: string;
}) {
  const [state, formAction] = useActionState(action, {});
  const e = state.fieldErrors ?? {};
  const v = (k: keyof CustomerValues) => values[k] ?? "";

  return (
    <form action={formAction} className="flex flex-col gap-8">
      <Section title="Company">
        <CompanyFields isNew={isNew} values={values} errors={e} />
        <Field label="Status" name="status" error={e.status}>
          <Select name="status" defaultValue={v("status") || "active"}>
            <option value="prospect">Prospect</option>
            <option value="active">Active</option>
            <option value="on_hold">On hold</option>
            <option value="inactive">Inactive</option>
          </Select>
        </Field>
        <Field label="Website" name="website" error={e.website}>
          <Input name="website" defaultValue={v("website")} placeholder="https://" />
        </Field>
        <Field label="General email" name="email" error={e.email}>
          <Input name="email" type="email" defaultValue={v("email")} />
        </Field>
        <Field label="Phone" name="phone" error={e.phone}>
          <Input name="phone" defaultValue={v("phone")} />
        </Field>
      </Section>

      <Section title="Commercial">
        <Field label="Payment terms" name="payment_terms" hint="Copied onto new quotations, e.g. Net 30" error={e.payment_terms}>
          <Input name="payment_terms" defaultValue={v("payment_terms")} />
        </Field>
        <Field label="Currency" name="currency" error={e.currency}>
          <Input name="currency" defaultValue={v("currency") || "USD"} maxLength={3} className="uppercase" />
        </Field>
        <Field label="RFC" name="tax_id" hint="Mexican tax ID, e.g. ANA120101AB1. For customers outside Mexico, enter their tax ID." error={e.tax_id}>
          <Input name="tax_id" defaultValue={v("tax_id")} maxLength={20} className="uppercase" />
        </Field>
      </Section>

      <Section title="Billing address">
        <Field label="Address line 1" name="billing_line1" className="sm:col-span-2">
          <Input name="billing_line1" defaultValue={v("billing_line1")} />
        </Field>
        <Field label="Address line 2" name="billing_line2" className="sm:col-span-2">
          <Input name="billing_line2" defaultValue={v("billing_line2")} />
        </Field>
        <Field label="City" name="billing_city">
          <Input name="billing_city" defaultValue={v("billing_city")} />
        </Field>
        <Field label="State / region" name="billing_state">
          <Input name="billing_state" defaultValue={v("billing_state")} />
        </Field>
        <Field label="Postal code" name="billing_postal_code">
          <Input name="billing_postal_code" defaultValue={v("billing_postal_code")} />
        </Field>
        <Field label="Country" name="billing_country">
          <Input name="billing_country" defaultValue={v("billing_country")} />
        </Field>
      </Section>

      <Section title="Notes">
        <Field label="Internal notes" name="notes" className="sm:col-span-2" error={e.notes}>
          <Textarea name="notes" defaultValue={v("notes")} />
        </Field>
      </Section>

      <div className="flex flex-col gap-3 border-t border-line pt-6 sm:flex-row sm:items-center">
        <SubmitButton>{submitLabel}</SubmitButton>
        <FormMessage state={state} />
      </div>
    </form>
  );
}

function CompanyFields({
  isNew,
  values,
  errors,
}: {
  isNew?: boolean;
  values: CustomerValues;
  errors: Record<string, string[] | undefined>;
}) {
  const [legal, setLegal] = useState(values.legal_name ?? "");
  const [display, setDisplay] = useState(values.display_name ?? "");
  const [code, setCode] = useState("");
  const [codeNote, setCodeNote] = useState<string>("Suggested from the company name. You can change it.");
  const [, startTransition] = useTransition();
  const codeTouched = useRef(false);
  const displayTouched = useRef(!!values.display_name);

  function onLegalBlur() {
    if (!displayTouched.current && legal) setDisplay(legal.replace(/\b(LLC|Inc\.?|Corp\.?|S\.?A\.?( de C\.?V\.?)?)$/i, "").trim());
    if (!isNew || codeTouched.current || !legal.trim()) return;
    startTransition(async () => {
      const res = await suggestAvailableCode(legal);
      setCode(res.code);
      setCodeNote(res.available ? "Suggested from the company name. You can change it." : "No free suggestion found. Enter a code.");
    });
  }

  function onCodeBlur() {
    if (!code) return;
    startTransition(async () => {
      const free = await checkCodeAvailable(code);
      setCodeNote(
        code === "ANA"
          ? "ANA is the ANASA document prefix. Choose another code."
          : free
            ? `${code} is available.`
            : `${code} is already issued. Choose another code.`,
      );
    });
  }

  return (
    <>
      <Field label="Legal company name" name="legal_name" error={errors.legal_name}>
        <Input name="legal_name" required value={legal} onChange={(e) => setLegal(e.target.value)} onBlur={onLegalBlur} />
      </Field>
      <Field label="Display name" name="display_name" error={errors.display_name}>
        <Input
          name="display_name"
          required
          value={display}
          onChange={(e) => {
            displayTouched.current = true;
            setDisplay(e.target.value);
          }}
        />
      </Field>
      {isNew ? (
        <Field label="Customer code" name="customer_code" hint={codeNote} error={errors.customer_code}>
          <Input
            name="customer_code"
            required
            value={code}
            maxLength={6}
            pattern="[A-Za-z0-9]{2,6}"
            className="font-semibold uppercase tracking-wider"
            onChange={(e) => {
              codeTouched.current = true;
              setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""));
            }}
            onBlur={onCodeBlur}
          />
        </Field>
      ) : null}
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
      <legend className="mb-3 text-[15px] font-semibold">{title}</legend>
      {children}
    </fieldset>
  );
}
