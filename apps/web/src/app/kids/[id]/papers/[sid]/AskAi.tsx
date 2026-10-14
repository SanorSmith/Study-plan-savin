"use client";

import { useActionState } from "react";
import { btn } from "@/components/ui";
import { readPaperWithAi, type AiHelpState } from "../actions";

/** Only when a parent asks are the photos of a paper that was sent "to the parent" shown to the AI. */
export function AskAi({ kidId, submissionId }: { kidId: string; submissionId: string }) {
  const [state, action, pending] = useActionState<AiHelpState, FormData>(() => readPaperWithAi(kidId, submissionId), null);

  return (
    <form action={action} className="space-y-2">
      <button disabled={pending} className={`${btn.secondary} disabled:opacity-50`}>
        {pending ? "The AI is reading the paper…" : "Ask the AI for suggestions"}
      </button>
      {state?.error && (
        <p role="alert" className="text-sm text-red-700">
          {state.error}
        </p>
      )}
    </form>
  );
}
