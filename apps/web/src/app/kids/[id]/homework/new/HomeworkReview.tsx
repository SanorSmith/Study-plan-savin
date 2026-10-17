"use client";

import { useState } from "react";
import { btn, Card, field, labelText } from "@/components/ui";
import { shrinkImage } from "@/lib/shrink-image";
import { assignHomework } from "../actions";

type Q = {
  text: string;
  type: "multiple_choice" | "numeric" | "short_text";
  options: string[] | null;
  answerKey: string;
  label: string; // the number on the paper, empty if none
};

type Extracted = Omit<Q, "answerKey" | "label"> & { suggestedAnswer: string; number: string | null };

const TYPE_LABEL: Record<Q["type"], string> = {
  multiple_choice: "Multiple choice",
  numeric: "Number",
  short_text: "Short text (not asked to the kid)",
};

export function HomeworkReview({ kidId, grade }: { kidId: string; grade: number }) {
  const [items, setItems] = useState<Q[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File) {
    setBusy(true);
    setError(null);
    try {
      const body = new FormData();
      body.set("image", await shrinkImage(file));
      body.set("grade", String(grade));
      const res = await fetch("/api/homework/extract", { method: "POST", body });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Extraction failed");
      setItems(
        (json.questions as Extracted[]).map((q) => ({
          text: q.text,
          type: q.type,
          options: q.options,
          answerKey: q.suggestedAnswer,
          label: q.number ?? "",
        })),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Extraction failed");
    } finally {
      setBusy(false);
    }
  }

  const update = (i: number, patch: Partial<Q>) => setItems((xs) => xs.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  return (
    <div className="space-y-6">
      <Card>
        <label className={labelText}>
          Photo or PDF of the worksheet
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            capture="environment"
            disabled={busy}
            onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
            className="mt-2 block w-full text-sm text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-900 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-slate-700"
          />
        </label>
        {busy && (
          <p role="status" className="mt-3 text-sm text-slate-600">
            Reading the worksheet…
          </p>
        )}
        {error && (
          <p role="alert" className="mt-3 text-sm text-red-700">
            {error}
          </p>
        )}
      </Card>

      {items.length > 0 && (
        <form action={assignHomework.bind(null, kidId)} className="space-y-5">
          <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            These answers are suggestions. Check every answer key before assigning, because it decides how many minutes your kid earns.
          </p>
          <Card>
            <label className={labelText}>
              Subject
              <input name="subject" required placeholder="Math, Swedish, English…" className={field} />
            </label>
          </Card>
          <input type="hidden" name="questions" value={JSON.stringify(items)} />
          <ol className="space-y-5">
            {items.map((q, i) => (
              <li key={i} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="flex items-center gap-3 border-b border-slate-100 bg-slate-50 px-4 py-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-sm font-semibold text-white" aria-hidden="true">
                    {i + 1}
                  </span>
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-600 ring-1 ring-slate-200">{TYPE_LABEL[q.type]}</span>
                  <label className="flex items-center gap-2 text-xs font-medium text-slate-600">
                    On the paper
                    <input
                      value={q.label}
                      onChange={(e) => update(i, { label: e.target.value.slice(0, 20) })}
                      aria-label={`Number on the paper for question ${i + 1}`}
                      placeholder="3, 4b…"
                      className="w-20 rounded-md border border-slate-300 bg-white px-2 py-1 text-sm text-slate-900"
                    />
                  </label>
                  <button type="button" className={`${btn.danger} ml-auto`} onClick={() => setItems((xs) => xs.filter((_, j) => j !== i))}>
                    Remove
                  </button>
                </div>
                <div className="space-y-4 p-4">
                  <label className={labelText}>
                    Question
                    <textarea value={q.text} onChange={(e) => update(i, { text: e.target.value })} className={field} rows={2} />
                  </label>
                  <label className={`${labelText} block rounded-xl bg-emerald-50 p-3 ring-1 ring-emerald-200`}>
                    Correct answer
                    {q.type === "multiple_choice" && q.options ? (
                      <select value={q.answerKey} onChange={(e) => update(i, { answerKey: e.target.value })} className={field}>
                        {!q.options.includes(q.answerKey) && <option value={q.answerKey}>{q.answerKey}</option>}
                        {q.options.map((o) => (
                          <option key={o}>{o}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        value={q.answerKey}
                        onChange={(e) => update(i, { answerKey: e.target.value })}
                        inputMode={q.type === "numeric" ? "decimal" : "text"}
                        className={field}
                      />
                    )}
                  </label>
                </div>
              </li>
            ))}
          </ol>
          <button className={btn.primary}>Confirm answer key and assign</button>
        </form>
      )}
    </div>
  );
}
