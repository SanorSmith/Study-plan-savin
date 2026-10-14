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
};

type Extracted = Omit<Q, "answerKey"> & { suggestedAnswer: string };

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
          Photo of the worksheet
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
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
          <ol className="space-y-3">
            {items.map((q, i) => (
              <li key={i}>
                <Card className="space-y-3">
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span className="font-medium">Question {i + 1}</span>
                    <span>{TYPE_LABEL[q.type]}</span>
                  </div>
                  <label className={labelText}>
                    Question
                    <textarea value={q.text} onChange={(e) => update(i, { text: e.target.value })} className={field} rows={2} />
                  </label>
                  <label className={labelText}>
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
                  <button type="button" className={btn.danger} onClick={() => setItems((xs) => xs.filter((_, j) => j !== i))}>
                    Remove question
                  </button>
                </Card>
              </li>
            ))}
          </ol>
          <button className={btn.primary}>Confirm answer key and assign</button>
        </form>
      )}
    </div>
  );
}
