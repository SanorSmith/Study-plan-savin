"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { btn, field, labelText } from "@/components/ui";
import { signIn, signUp } from "./actions";

export function LoginForm() {
  const [mode, setMode] = useState<"in" | "up">("in");
  const [state, action, pending] = useActionState(mode === "in" ? signIn : signUp, null);

  return (
    <form action={action} className="space-y-4">
      {mode === "up" && (
        <label className={labelText}>
          Your name
          <input name="name" autoComplete="name" className={field} />
        </label>
      )}
      <label className={labelText}>
        Email
        <input name="email" type="email" required autoComplete="email" className={field} />
      </label>
      <label className={labelText}>
        Password
        <input
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete={mode === "in" ? "current-password" : "new-password"}
          className={field}
        />
      </label>
      {mode === "in" && (
        <p className="text-right">
          <Link href="/forgot-password" className={btn.link}>
            Forgot password?
          </Link>
        </p>
      )}
      {state?.error && (
        <p role="alert" className="text-sm text-red-700">
          {state.error}
        </p>
      )}
      <button disabled={pending} className={`${btn.primary} w-full disabled:opacity-50`}>
        {mode === "in" ? "Sign in" : "Create account"}
      </button>
      <button type="button" onClick={() => setMode(mode === "in" ? "up" : "in")} className={`${btn.link} w-full`}>
        {mode === "in" ? "New here? Create an account" : "Have an account? Sign in"}
      </button>
    </form>
  );
}
