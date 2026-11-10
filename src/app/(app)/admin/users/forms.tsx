"use client";

import { useActionState } from "react";
import { Field, Input, Select } from "@/components/ui/form";
import { SubmitButton, FormMessage } from "@/components/form-status";
import { ROLE_LABELS, ROLES } from "@/lib/permissions";
import type { ActionState } from "@/lib/validation/shared";

type Action = (s: ActionState, f: FormData) => Promise<ActionState>;

export function RoleForm({ action, role, active, isSelf }: { action: Action; role: string; active: boolean; isSelf: boolean }) {
  const [state, formAction] = useActionState(action, {});
  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <Select name="role" defaultValue={role} className="w-56" aria-label="Role" disabled={isSelf}>
        {ROLES.filter((r) => r !== "customer_portal" && r !== "supplier_portal").map((r) => (
          <option key={r} value={r}>
            {ROLE_LABELS[r]}
          </option>
        ))}
      </Select>
      <Select name="active" defaultValue={String(active)} className="w-28" aria-label="Account status" disabled={isSelf}>
        <option value="true">Active</option>
        <option value="false">Disabled</option>
      </Select>
      {isSelf ? (
        <span className="text-xs text-muted">This is you</span>
      ) : (
        <SubmitButton variant="secondary">Save</SubmitButton>
      )}
      {state.message ? <span className={state.ok ? "text-xs text-ok" : "text-xs text-danger"}>{state.message}</span> : null}
    </form>
  );
}

export function SettingsForm({ action, timezone, selfApproval }: { action: Action; timezone: string; selfApproval: boolean }) {
  const [state, formAction] = useActionState(action, {});
  return (
    <form action={formAction} className="grid gap-4 sm:grid-cols-2">
      <Field label="Business timezone" name="business_timezone" hint="Decides which year a new document number uses, e.g. America/Chicago">
        <Input name="business_timezone" defaultValue={timezone} required />
      </Field>
      <Field label="Self-approval" name="allow_self_approval" hint="Whether the person who drafted a revision may approve it">
        <Select name="allow_self_approval" defaultValue={String(selfApproval)}>
          <option value="true">Allowed</option>
          <option value="false">Not allowed, another approver required</option>
        </Select>
      </Field>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <SubmitButton>Save settings</SubmitButton>
        <FormMessage state={state} />
      </div>
    </form>
  );
}
