"use client";

import { useActionState } from "react";
import { btn, field, labelText } from "@/components/ui";
import { resetPassword } from "../forgot-password/actions";

export function ResetForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(resetPassword, null);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <label className={labelText}>
        New password
        <input name="password" type="password" required minLength={8} autoComplete="new-password" className={field} />
      </label>
      <label className={labelText}>
        Repeat the new password
        <input name="confirm" type="password" required minLength={8} autoComplete="new-password" className={field} />
      </label>
      {state?.error && (
        <p role="alert" className="text-sm text-red-700">
          {state.error}
        </p>
      )}
      <button disabled={pending} className={`${btn.primary} w-full disabled:opacity-50`}>
        Save new password
      </button>
    </form>
  );
}
