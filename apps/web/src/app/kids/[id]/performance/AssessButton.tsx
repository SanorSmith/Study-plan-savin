"use client";

import { useActionState } from "react";
import { btn } from "@/components/ui";
import { assessPerformance, type AssessState } from "./actions";

export function AssessButton({ kidId, period }: { kidId: string; period: string }) {
  const [state, action, pending] = useActionState<AssessState, FormData>(() => assessPerformance(kidId, period), null);
  return (
    <form action={action} className="space-y-2">
      <button disabled={pending} className={`${btn.primary} disabled:opacity-50`}>
        {pending ? "The AI is reading the results…" : "Assess performance with AI"}
      </button>
      {state?.error && (
        <p role="alert" className="text-sm text-red-700">
          {state.error}
        </p>
      )}
      {state?.ok && (
        <p role="status" className="text-sm text-emerald-800">
          Done. The assessment is below.
        </p>
      )}
    </form>
  );
}
