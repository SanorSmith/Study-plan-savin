"use client";

import { useActionState, useState } from "react";
import { signIn, signUp } from "./actions";

export function LoginForm() {
  const [mode, setMode] = useState<"in" | "up">("in");
  const [state, action, pending] = useActionState(mode === "in" ? signIn : signUp, null);

  return (
    <form action={action} className="space-y-4">
      {mode === "up" && (
        <label className="block">
          <span className="mb-1 block text-sm">Your name</span>
          <input name="name" autoComplete="name" className="w-full rounded border p-2" />
        </label>
      )}
      <label className="block">
        <span className="mb-1 block text-sm">Email</span>
        <input name="email" type="email" required autoComplete="email" className="w-full rounded border p-2" />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm">Password</span>
        <input
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete={mode === "in" ? "current-password" : "new-password"}
          className="w-full rounded border p-2"
        />
      </label>
      {state?.error && <p className="text-red-600">{state.error}</p>}
      <button disabled={pending} className="w-full rounded bg-black p-2 text-white disabled:opacity-50">
        {mode === "in" ? "Sign in" : "Create account"}
      </button>
      <button
        type="button"
        onClick={() => setMode(mode === "in" ? "up" : "in")}
        className="w-full text-sm text-gray-600 underline"
      >
        {mode === "in" ? "New here? Create an account" : "Have an account? Sign in"}
      </button>
    </form>
  );
}
