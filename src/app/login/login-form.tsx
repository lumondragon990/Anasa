"use client";

import { useActionState, useState } from "react";
import { Field, Input } from "@/components/ui/form";
import { FormMessage, SubmitButton } from "@/components/form-status";
import { signIn, signUp } from "./actions";
import type { ActionState } from "@/lib/validation/shared";

export function LoginForm({ next }: { next?: string }) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [signInState, signInAction] = useActionState(signIn, {} as ActionState);
  const [signUpState, signUpAction] = useActionState(signUp, {} as ActionState);
  const state = mode === "signin" ? signInState : signUpState;

  return (
    <form action={mode === "signin" ? signInAction : signUpAction} className="flex flex-col gap-4">
      <input type="hidden" name="next" value={next ?? "/"} />
      {mode === "signup" ? (
        <Field label="Full name" name="full_name" error={state.fieldErrors?.full_name}>
          <Input name="full_name" autoComplete="name" required />
        </Field>
      ) : null}
      <Field label="Work email" name="email" error={state.fieldErrors?.email}>
        <Input name="email" type="email" autoComplete="email" required />
      </Field>
      <Field label="Password" name="password" error={state.fieldErrors?.password}>
        <Input
          name="password"
          type="password"
          autoComplete={mode === "signin" ? "current-password" : "new-password"}
          required
          minLength={8}
        />
      </Field>
      <FormMessage state={state} />
      <SubmitButton pendingLabel={mode === "signin" ? "Signing in…" : "Creating account…"} className="h-10">
        {mode === "signin" ? "Sign in" : "Create account"}
      </SubmitButton>
      <button
        type="button"
        className="text-sm text-muted underline-offset-4 hover:text-fg hover:underline"
        onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
      >
        {mode === "signin" ? "New to ANASA? Create an account" : "Already have an account? Sign in"}
      </button>
    </form>
  );
}
