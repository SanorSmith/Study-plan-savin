"use client";

import { useActionState } from "react";
import { btn, Card, CardHeader } from "@/components/ui";
import { newParentAppCode, removeParentPhone, type AppCodeState } from "./actions";

const APK = "https://github.com/SanorSmith/Study-plan-savin/releases/latest/download/StudyPlanParent.apk";

type Phone = { id: string; name: string | null; lastSeenAt: Date | null };

/** Pairs the Study Plan parent app (Android) with this account: download it, then type the one-time code. */
export function ParentAppCard({ phones }: { phones: Phone[] }) {
  const [state, action, pending] = useActionState<AppCodeState, FormData>(() => newParentAppCode(), null);

  return (
    <Card>
      <CardHeader
        icon="📱"
        title="Parent app for Android"
        description="Get a notification when a paper is waiting, check it with the photos, and give or take minutes from your phone."
      />
      <ol className="mb-4 list-decimal space-y-1 pl-5 text-sm text-slate-700">
        <li>
          Download and install{" "}
          <a href={APK} className={btn.link}>
            Study Plan Parent
          </a>
          .
        </li>
        <li>Make a code below and type it in the app.</li>
      </ol>
      <form action={action} className="flex flex-wrap items-center gap-3">
        <button disabled={pending} className={`${btn.secondary} disabled:opacity-50`}>
          {pending ? "Making a code…" : "New code"}
        </button>
        {state?.code && (
          <p role="status" className="text-sm text-slate-700">
            Code: <span className="rounded bg-slate-100 px-2 py-1 font-mono text-lg font-semibold tracking-widest text-slate-900">{state.code}</span>{" "}
            <span className="text-slate-500">works once, for 15 minutes</span>
          </p>
        )}
      </form>

      {phones.length > 0 && (
        <ul className="mt-4 divide-y divide-slate-100 border-t border-slate-100 text-sm">
          {phones.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-3 py-2">
              <span>
                {p.name ?? "Phone"}
                {p.lastSeenAt && <span className="ml-2 text-xs text-slate-500">last used {p.lastSeenAt.toISOString().slice(0, 10)}</span>}
              </span>
              <form action={removeParentPhone.bind(null, p.id)}>
                <button className={btn.danger}>Remove</button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
