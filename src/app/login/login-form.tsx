"use client";

import { useState } from "react";
import { useActionForm } from "@/lib/use-action-form";
import { Field, Input } from "@/components/ui/form";
import { FormMessage, SubmitButton } from "@/components/form-status";
import { signIn, signUp } from "./actions";
import type { ActionState } from "@/lib/validation/shared";
import { useT } from "@/lib/i18n/client";

export function LoginForm({ next }: { next?: string }) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const t = useT();
  const [signInState, signInSubmit, signInPending] = useActionForm(signIn);
  const [signUpState, signUpSubmit, signUpPending] = useActionForm(signUp);
  const state: ActionState = mode === "signin" ? signInState : signUpState;

  return (
    <form onSubmit={mode === "signin" ? signInSubmit : signUpSubmit} className="flex flex-col gap-4">
      <input type="hidden" name="next" value={next ?? "/"} />
      {mode === "signup" ? (
        <Field label={t.auth.fullName} name="full_name" error={state.fieldErrors?.full_name}>
          <Input name="full_name" autoComplete="name" required />
        </Field>
      ) : null}
      <Field label={t.auth.workEmail} name="email" error={state.fieldErrors?.email}>
        <Input name="email" type="email" autoComplete="email" required />
      </Field>
      <Field label={t.auth.password} name="password" error={state.fieldErrors?.password}>
        <Input
          name="password"
          type="password"
          autoComplete={mode === "signin" ? "current-password" : "new-password"}
          required
          minLength={8}
        />
      </Field>
      <FormMessage state={state} />
      <SubmitButton pending={mode === "signin" ? signInPending : signUpPending} pendingLabel={mode === "signin" ? t.auth.signingIn : t.auth.creatingAccount} className="h-10">
        {mode === "signin" ? t.auth.signIn : t.auth.createAccount}
      </SubmitButton>
      <button
        type="button"
        className="text-sm text-muted underline-offset-4 hover:text-fg hover:underline"
        onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
      >
        {mode === "signin" ? t.auth.toSignUp : t.auth.toSignIn}
      </button>
    </form>
  );
}
