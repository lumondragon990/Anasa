"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { FormMessage, SubmitButton } from "@/components/form-status";
import type { ActionState } from "@/lib/validation/shared";

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
  return (
    <Reveal label="Add contact">
      {(close) => <ContactFields action={action} close={close} />}
    </Reveal>
  );
}

function ContactFields({ action, close }: { action: Action; close: () => void }) {
  const [state, formAction] = useActionState(action, {});
  const ref = useResetOnSuccess(state);
  const e = state.fieldErrors ?? {};
  return (
    <form ref={ref} action={formAction} className="grid gap-4 sm:grid-cols-2">
      <Field label="First name" name="first_name" error={e.first_name}>
        <Input name="first_name" required />
      </Field>
      <Field label="Last name" name="last_name">
        <Input name="last_name" />
      </Field>
      <Field label="Title" name="title">
        <Input name="title" />
      </Field>
      <Field label="Email" name="email" error={e.email}>
        <Input name="email" type="email" />
      </Field>
      <Field label="Phone" name="phone">
        <Input name="phone" />
      </Field>
      <label className="flex items-center gap-2 self-end pb-2 text-sm">
        <input type="checkbox" name="is_primary" className="size-4 accent-[var(--accent)]" /> Primary contact
      </label>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <SubmitButton>Save contact</SubmitButton>
        <Button type="button" variant="ghost" onClick={close}>
          Close
        </Button>
        <FormMessage state={state} />
      </div>
    </form>
  );
}

export function AddLocationForm({ action }: { action: Action }) {
  return <Reveal label="Add location">{(close) => <LocationFields action={action} close={close} />}</Reveal>;
}

function LocationFields({ action, close }: { action: Action; close: () => void }) {
  const [state, formAction] = useActionState(action, {});
  const ref = useResetOnSuccess(state);
  const e = state.fieldErrors ?? {};
  return (
    <form ref={ref} action={formAction} className="grid gap-4 sm:grid-cols-2">
      <Field label="Type" name="kind">
        <Select name="kind" defaultValue="job_site">
          <option value="job_site">Job site</option>
          <option value="shipping">Shipping</option>
          <option value="billing">Billing</option>
          <option value="office">Office</option>
        </Select>
      </Field>
      <Field label="Label" name="label" hint="e.g. Solway Substation" error={e.label}>
        <Input name="label" required />
      </Field>
      <Field label="Address line 1" name="line1" className="sm:col-span-2">
        <Input name="line1" />
      </Field>
      <Field label="City" name="city">
        <Input name="city" />
      </Field>
      <Field label="State / region" name="state">
        <Input name="state" />
      </Field>
      <Field label="Postal code" name="postal_code">
        <Input name="postal_code" />
      </Field>
      <Field label="Country" name="country">
        <Input name="country" />
      </Field>
      <Field label="Site access notes" name="site_notes" className="sm:col-span-2">
        <Textarea name="site_notes" className="min-h-16" />
      </Field>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <SubmitButton>Save location</SubmitButton>
        <Button type="button" variant="ghost" onClick={close}>
          Close
        </Button>
        <FormMessage state={state} />
      </div>
    </form>
  );
}

export function ChangeCodeForm({ action, current }: { action: Action; current: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(action, {});
  const e = state.fieldErrors ?? {};
  if (!open)
    return (
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        Change code
      </Button>
    );
  return (
    <form action={formAction} className="mt-4 grid gap-4 sm:grid-cols-[10rem_1fr]">
      <Field label="New code" name="new_code" error={e.new_code}>
        <Input name="new_code" required maxLength={6} defaultValue={current} className="font-semibold uppercase tracking-wider" />
      </Field>
      <Field label="Reason" name="reason" hint="Recorded in the code history." error={e.reason}>
        <Input name="reason" required />
      </Field>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <SubmitButton variant="danger">Change code</SubmitButton>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
        <FormMessage state={state} />
      </div>
    </form>
  );
}
