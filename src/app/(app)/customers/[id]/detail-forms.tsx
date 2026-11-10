"use client";

import { useActionForm } from "@/lib/use-action-form";
import { useEffect, useRef, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { FormMessage, SubmitButton } from "@/components/form-status";
import type { ActionState } from "@/lib/validation/shared";
import { useT } from "@/lib/i18n/client";

type Action = (state: ActionState, formData: FormData) => Promise<ActionState>;

function useResetOnSuccess(state: ActionState) {
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) ref.current?.reset();
  }, [state]);
  return ref;
}

function Reveal({ label, children }: { label: string; children: (close: () => void) => React.ReactNode }) {
  const [open, setOpen] = useState(false);
  if (!open)
    return (
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        <Plus /> {label}
      </Button>
    );
  return <div className="w-full">{children(() => setOpen(false))}</div>;
}

export function AddContactForm({ action }: { action: Action }) {
  const t = useT();
  return (
    <Reveal label={t.customers.addContact}>
      {(close) => <ContactFields action={action} close={close} />}
    </Reveal>
  );
}

function ContactFields({ action, close }: { action: Action; close: () => void }) {
  const [state, formAction, pending] = useActionForm(action);
  const ref = useResetOnSuccess(state);
  const t = useT();
  const c = t.customers;
  const e = state.fieldErrors ?? {};
  return (
    <form ref={ref} onSubmit={formAction} className="grid gap-4 sm:grid-cols-2">
      <Field label={c.firstName} name="first_name" error={e.first_name}>
        <Input name="first_name" required />
      </Field>
      <Field label={c.lastName} name="last_name">
        <Input name="last_name" />
      </Field>
      <Field label={c.jobTitle} name="title">
        <Input name="title" />
      </Field>
      <Field label={t.common.email} name="email" error={e.email}>
        <Input name="email" type="email" />
      </Field>
      <Field label={t.common.phone} name="phone">
        <Input name="phone" />
      </Field>
      <label className="flex items-center gap-2 self-end pb-2 text-sm">
        <input type="checkbox" name="is_primary" className="size-4 accent-[var(--accent)]" /> {t.common.primaryContact}
      </label>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <SubmitButton pending={pending}>{c.saveContact}</SubmitButton>
        <Button type="button" variant="ghost" onClick={close}>
          {t.common.close}
        </Button>
        <FormMessage state={state} />
      </div>
    </form>
  );
}

export function AddLocationForm({ action }: { action: Action }) {
  const t = useT();
  return <Reveal label={t.customers.addLocation}>{(close) => <LocationFields action={action} close={close} />}</Reveal>;
}

function LocationFields({ action, close }: { action: Action; close: () => void }) {
  const [state, formAction, pending] = useActionForm(action);
  const ref = useResetOnSuccess(state);
  const t = useT();
  const c = t.customers;
  const e = state.fieldErrors ?? {};
  return (
    <form ref={ref} onSubmit={formAction} className="grid gap-4 sm:grid-cols-2">
      <Field label={c.type} name="kind">
        <Select name="kind" defaultValue="job_site">
          {["job_site", "shipping", "billing", "office"].map((k) => (
            <option key={k} value={k}>
              {c.kind[k]}
            </option>
          ))}
        </Select>
      </Field>
      <Field label={c.label} name="label" hint={c.labelHint} error={e.label}>
        <Input name="label" required />
      </Field>
      <Field label={c.line1} name="line1" className="sm:col-span-2">
        <Input name="line1" />
      </Field>
      <Field label={c.city} name="city">
        <Input name="city" />
      </Field>
      <Field label={c.state} name="state">
        <Input name="state" />
      </Field>
      <Field label={c.postal} name="postal_code">
        <Input name="postal_code" />
      </Field>
      <Field label={c.country} name="country">
        <Input name="country" />
      </Field>
      <Field label={c.siteNotes} name="site_notes" className="sm:col-span-2">
        <Textarea name="site_notes" className="min-h-16" />
      </Field>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <SubmitButton pending={pending}>{c.saveLocation}</SubmitButton>
        <Button type="button" variant="ghost" onClick={close}>
          {t.common.close}
        </Button>
        <FormMessage state={state} />
      </div>
    </form>
  );
}

export function ChangeCodeForm({ action, current }: { action: Action; current: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionForm(action);
  const t = useT();
  const e = state.fieldErrors ?? {};
  if (!open)
    return (
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        {t.customers.changeCode}
      </Button>
    );
  return (
    <form onSubmit={formAction} className="mt-4 grid gap-4 sm:grid-cols-[10rem_1fr]">
      <Field label={t.customers.newCode} name="new_code" error={e.new_code}>
        <Input name="new_code" required maxLength={6} defaultValue={current} className="font-semibold uppercase tracking-wider" />
      </Field>
      <Field label={t.common.reason} name="reason" hint={t.customers.changeReasonHint} error={e.reason}>
        <Input name="reason" required />
      </Field>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <SubmitButton pending={pending} variant="danger">{t.customers.changeCode}</SubmitButton>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
          {t.common.cancel}
        </Button>
        <FormMessage state={state} />
      </div>
    </form>
  );
}
