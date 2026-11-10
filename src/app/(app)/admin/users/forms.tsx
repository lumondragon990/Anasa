"use client";

import { useActionForm } from "@/lib/use-action-form";

import { Field, Input, Select } from "@/components/ui/form";
import { SubmitButton, FormMessage } from "@/components/form-status";
import { ROLES } from "@/lib/permissions";
import { useT, useTr } from "@/lib/i18n/client";
import type { ActionState } from "@/lib/validation/shared";

type Action = (s: ActionState, f: FormData) => Promise<ActionState>;

export function RoleForm({ action, role, active, isSelf }: { action: Action; role: string; active: boolean; isSelf: boolean }) {
  const [state, formAction, pending] = useActionForm(action);
  const t = useT();
  const tr = useTr();
  return (
    <form onSubmit={formAction} className="flex flex-wrap items-center gap-2">
      <Select name="role" defaultValue={role} className="w-56" aria-label={t.admin.role} disabled={isSelf}>
        {ROLES.filter((r) => r !== "customer_portal" && r !== "supplier_portal").map((r) => (
          <option key={r} value={r}>
            {t.roles[r]}
          </option>
        ))}
      </Select>
      <Select name="active" defaultValue={String(active)} className="w-28" aria-label={t.admin.accountStatus} disabled={isSelf}>
        <option value="true">{t.admin.active}</option>
        <option value="false">{t.admin.disabled}</option>
      </Select>
      {isSelf ? (
        <span className="text-xs text-muted">{t.admin.thisIsYou}</span>
      ) : (
        <SubmitButton pending={pending} variant="secondary">{t.common.save}</SubmitButton>
      )}
      {state.message ? <span className={state.ok ? "text-xs text-ok" : "text-xs text-danger"}>{tr(state.message)}</span> : null}
    </form>
  );
}

export function SettingsForm({ action, timezone, selfApproval }: { action: Action; timezone: string; selfApproval: boolean }) {
  const [state, formAction, pending] = useActionForm(action);
  const t = useT();
  const A = t.admin;
  return (
    <form onSubmit={formAction} className="grid gap-4 sm:grid-cols-2">
      <Field label={A.timezone} name="business_timezone" hint={A.timezoneHint}>
        <Input name="business_timezone" defaultValue={timezone} required />
      </Field>
      <Field label={A.selfApproval} name="allow_self_approval" hint={A.selfApprovalHint}>
        <Select name="allow_self_approval" defaultValue={String(selfApproval)}>
          <option value="true">{A.allowed}</option>
          <option value="false">{A.notAllowed}</option>
        </Select>
      </Field>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <SubmitButton pending={pending}>{A.saveSettings}</SubmitButton>
        <FormMessage state={state} />
      </div>
    </form>
  );
}
