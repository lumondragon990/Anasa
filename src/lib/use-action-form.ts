"use client";

import { startTransition, useActionState, type FormEvent } from "react";
import type { ActionState } from "@/lib/validation/shared";

/**
 * Like useActionState, but submits from onSubmit so React does not clear
 * the form when the server returns a validation error. People keep what
 * they typed and only fix the highlighted field.
 */
export function useActionForm(action: (state: ActionState, formData: FormData) => Promise<ActionState>) {
  const [state, dispatch, pending] = useActionState(action, {} as ActionState);
  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => dispatch(formData));
  }
  return [state, onSubmit, pending] as const;
}
