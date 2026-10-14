"use client";

import { useActionState } from "react";
import { btn, field, labelText } from "@/components/ui";
import { changePassword, type PasswordState } from "./actions";

export function ChangePasswordForm() {
  const [state, action, pending] = useActionState<PasswordState, FormData>(changePassword, null);

  return (
    <form action={action} className="space-y-3">
      <label className={labelText}>
        Current password
        <input name="current" type="password" required autoComplete="current-password" className={field} />
      </label>
      <label className={labelText}>
        New password
        <input name="password" type="password" required minLength={8} autoComplete="new-password" className={field} />
      </label>
      {state?.error && (
        <p role="alert" className="text-sm text-red-700">
          {state.error}
        </p>
      )}
      {state?.ok && (
        <p role="status" className="text-sm text-emerald-800">
          Password changed.
        </p>
      )}
      <button disabled={pending} className={`${btn.secondary} disabled:opacity-50`}>
        Change password
      </button>
    </form>
  );
}
