"use client";

import { useActionState } from "react";
import { btn, field, labelText } from "@/components/ui";
import { requestReset } from "./actions";

export function ForgotForm() {
  const [state, action, pending] = useActionState(requestReset, null);

  if (state?.done) {
    return (
      <p role="status" className="rounded-lg bg-emerald-50 p-4 text-sm text-emerald-900">
        If that email can sign in here, a reset link is on its way. It can take a few minutes, so check your spam folder too.
      </p>
    );
  }

  return (
    <form action={action} className="space-y-4">
      <label className={labelText}>
        Email
        <input name="email" type="email" required autoComplete="email" className={field} />
      </label>
      {state?.error && (
        <p role="alert" className="text-sm text-red-700">
          {state.error}
        </p>
      )}
      <button disabled={pending} className={`${btn.primary} w-full disabled:opacity-50`}>
        Send reset link
      </button>
    </form>
  );
}
