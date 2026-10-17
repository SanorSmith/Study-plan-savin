"use client";

import { useState } from "react";
import { btn, Card, CardHeader, field, labelText } from "@/components/ui";
import type { PracticeQuestion, PracticeSet } from "@/lib/practice-ai";
import { makePractice, retryMissedQuestions, sendPracticeSet } from "./actions";

/** Make practice questions with the AI, change them, then send them to the kid when the time feels right. */
export function PracticeMaker({ kidId, kidName, period }: { kidId: string; kidName: string; period: string }) {
  const [count, setCount] = useState(5);
  const [focus, setFocus] = useState("");
  const [set, setSet] = useState<PracticeSet | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function make() {
    setBusy(true);
    setError(null);
    setSent(false);
    const r = await makePractice(kidId, period, count, focus);
    setBusy(false);
    if (r?.error) return setError(r.error);
    if (r?.set) setSet(r.set);
  }

  async function send() {
    if (!set) return;
    setBusy(true);
    setError(null);
    const r = await sendPracticeSet(kidId, set);
    setBusy(false);
    if (r.error) return setError(r.error);
    setSent(true);
    setSet(null);
  }

  const update = (i: number, patch: Partial<PracticeQuestion>) => setSet((s) => s && { ...s, questions: s.questions.map((q, j) => (j === i ? { ...q, ...patch } : q)) });
  const remove = (i: number) => setSet((s) => s && { ...s, questions: s.questions.filter((_, j) => j !== i) });

  const [retry, setRetry] = useState<string | null>(null);
  async function retryMissed() {
    setBusy(true);
    const r = await retryMissedQuestions(kidId);
    setBusy(false);
    setRetry(r.error ?? `Done. ${kidName} gets ${r.count} ${r.count === 1 ? "question" : "questions"} to try again, after the homework they already have.`);
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader title="Another try at missed questions" description={`Questions ${kidName} ran out of tries on (last 14 days) go back to ${kidName} as a new set. The old tries stay in the results.`} />
        <button type="button" onClick={retryMissed} disabled={busy} className={`${btn.secondary} disabled:opacity-50`}>
          Let {kidName} try the missed ones again
        </button>
        {retry && (
          <p role="status" className="mt-3 text-sm text-slate-700">
            {retry}
          </p>
        )}
      </Card>

      <Card>
        <CardHeader title="Make practice questions" description={`The AI looks at what ${kidName} found hard and makes new questions on the same skills. You check them before they go to ${kidName}.`} />
        <div className="flex flex-wrap items-end gap-3">
          <label className={labelText}>
            How many
            <select value={count} onChange={(e) => setCount(Number(e.target.value))} className={`${field} w-24`}>
              {[3, 5, 7, 10].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <label className={`${labelText} min-w-0 flex-1`}>
            Topics to practise (optional)
            <input value={focus} onChange={(e) => setFocus(e.target.value)} placeholder="fractions, subtraction with borrowing" className={field} />
          </label>
          <button type="button" onClick={make} disabled={busy} className={`${btn.primary} disabled:opacity-50`}>
            {busy && !set ? "The AI is writing…" : "Make questions"}
          </button>
        </div>
        {error && (
          <p role="alert" className="mt-3 text-sm text-red-700">
            {error}
          </p>
        )}
        {sent && (
          <p role="status" className="mt-3 text-sm text-emerald-800">
            Sent. {kidName} sees the practice in the app after the homework they already have.
          </p>
        )}
      </Card>

      {set && (
        <div className="space-y-3">
          <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            Check every answer before you send. {kidName} is marked against these answers and earns minutes for right ones.
          </p>
          <Card>
            <label className={labelText}>
              Name of the set
              <input value={set.subject} onChange={(e) => setSet({ ...set, subject: e.target.value })} className={field} />
            </label>
          </Card>
          <ol className="space-y-3">
            {set.questions.map((q, i) => (
              <li key={i}>
                <Card className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span className="font-medium">Question {i + 1}</span>
                    <button type="button" onClick={() => remove(i)} className={btn.danger}>
                      Remove
                    </button>
                  </div>
                  <textarea value={q.text} onChange={(e) => update(i, { text: e.target.value })} rows={2} className={field} aria-label={`Question ${i + 1}`} />
                  {q.type === "multiple_choice" && q.options ? (
                    <fieldset className="space-y-1">
                      <legend className="text-sm text-slate-600">Right answer</legend>
                      {q.options.map((o) => (
                        <label key={o} className="flex items-center gap-2 text-sm">
                          <input type="radio" name={`key-${i}`} checked={q.answerKey === o} onChange={() => update(i, { answerKey: o })} />
                          {o}
                        </label>
                      ))}
                    </fieldset>
                  ) : (
                    <label className={labelText}>
                      Right answer (a number)
                      <input value={q.answerKey} onChange={(e) => update(i, { answerKey: e.target.value })} className={field} />
                    </label>
                  )}
                </Card>
              </li>
            ))}
          </ol>
          <button type="button" onClick={send} disabled={busy || set.questions.length === 0} className={`${btn.primary} disabled:opacity-50`}>
            {busy ? "Sending…" : `Send ${set.questions.length} questions to ${kidName}`}
          </button>
        </div>
      )}
    </div>
  );
}
