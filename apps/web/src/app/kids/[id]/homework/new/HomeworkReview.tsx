"use client";

import { useState } from "react";
import { assignHomework } from "../actions";

type Q = {
  text: string;
  type: "multiple_choice" | "numeric" | "short_text";
  options: string[] | null;
  answerKey: string;
};

type Extracted = Omit<Q, "answerKey"> & { suggestedAnswer: string };

export function HomeworkReview({ kidId, grade }: { kidId: string; grade: number }) {
  const [items, setItems] = useState<Q[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File) {
    setBusy(true);
    setError(null);
    try {
      const body = new FormData();
      body.set("image", file);
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

  const update = (i: number, patch: Partial<Q>) =>
    setItems((xs) => xs.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  return (
    <div className="space-y-6">
      <label className="block">
        <span className="mb-1 block text-sm font-medium">Photo of the worksheet</span>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          capture="environment"
          disabled={busy}
          onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
        />
      </label>
      {busy && <p className="text-gray-600">Reading the worksheet…</p>}
      {error && <p className="text-red-600">{error}</p>}

      {items.length > 0 && (
        <form action={assignHomework.bind(null, kidId)} className="space-y-4">
          <p className="rounded bg-yellow-50 p-3 text-sm">
            These answers are suggestions. Check every answer key before assigning, because it
            decides how many minutes your kid earns.
          </p>
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Subject</span>
            <input name="subject" required className="w-full rounded border p-2" />
          </label>
          <input type="hidden" name="questions" value={JSON.stringify(items)} />
          <ol className="space-y-4">
            {items.map((q, i) => (
              <li key={i} className="space-y-2 rounded border p-3">
                <textarea
                  value={q.text}
                  onChange={(e) => update(i, { text: e.target.value })}
                  className="w-full rounded border p-2"
                  rows={2}
                />
                {q.type === "multiple_choice" && q.options ? (
                  <select
                    value={q.answerKey}
                    onChange={(e) => update(i, { answerKey: e.target.value })}
                    className="w-full rounded border p-2"
                  >
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
                    className="w-full rounded border p-2"
                  />
                )}
                <button
                  type="button"
                  className="text-sm text-red-600"
                  onClick={() => setItems((xs) => xs.filter((_, j) => j !== i))}
                >
                  Remove
                </button>
              </li>
            ))}
          </ol>
          <button className="rounded bg-black px-4 py-2 text-white">
            Confirm answer key and assign
          </button>
        </form>
      )}
    </div>
  );
}
