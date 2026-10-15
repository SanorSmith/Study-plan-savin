"use client";

import { useState } from "react";
import type { AgeBand } from "@/lib/age-band";
import { shrinkImage } from "@/lib/shrink-image";
import { LOOKS } from "./looks";

const WORDS: Record<AgeBand, { title: string; intro: (ai: boolean) => string; ai: string; parent: string; toParent: string; sent: string; which: string }> = {
  little: {
    title: "Did it on paper? 📝",
    intro: (ai) => (ai ? "Take a picture of your paper! Pick who checks it." : "Take a picture of your paper. A grown-up will check it."),
    ai: "Check with the computer 🤖",
    parent: "Check with a grown-up 👪",
    toParent: "Send to a grown-up 👪",
    sent: "Sent! A grown-up will check it, then your minutes come. 🎉",
    which: "Which homework?",
  },
  middle: {
    title: "Did it on paper?",
    intro: (ai) => (ai ? "Take a photo of your finished paper, then choose who checks it." : "Take a photo of your finished paper. A parent checks it."),
    ai: "Check with AI",
    parent: "Check with parent",
    toParent: "Send to my parent",
    sent: "Sent! A parent will check it, then your minutes arrive.",
    which: "Which homework?",
  },
  teen: {
    title: "Homework on paper",
    intro: (ai) => (ai ? "Photograph your paper. The AI can check it now, or a parent can." : "Photograph your paper. A parent checks it."),
    ai: "Check with AI",
    parent: "Check with parent",
    toParent: "Send to parent",
    sent: "Sent. A parent will check it, then the minutes arrive.",
    which: "Homework",
  },
};

/** Did the homework on paper? Photograph it, then choose who checks it: the AI (minutes at once) or a parent. */
export function PaperCard({
  sets,
  aiCheckEnabled,
  band,
  onChanged,
}: {
  sets: { id: string; subject: string }[];
  aiCheckEnabled: boolean;
  band: AgeBand;
  onChanged: () => Promise<void>;
}) {
  const look = LOOKS[band];
  const words = WORDS[band];
  const [setId, setSetId] = useState(sets[0].id);
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  async function send(mode: "ai" | "parent") {
    setBusy(true);
    setMessage(null);
    try {
      const body = new FormData();
      body.set("setId", setId);
      body.set("mode", mode);
      for (const f of files) body.append("image", await shrinkImage(f));
      const res = await fetch("/api/kid/paper", { method: "POST", body });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Could not send the paper");
      setMessage({
        text:
          json.mode === "ai"
            ? `The AI checked your paper: ${json.correct} of ${json.total} correct. ${json.minutes > 0 ? `+${json.minutes} minutes!` : "No new minutes this time."}`
            : words.sent,
        ok: true,
      });
      setFiles([]);
      if (json.mode === "ai") await onChanged();
    } catch (e) {
      setMessage({ text: e instanceof Error ? e.message : "Could not send the paper", ok: false });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={`${look.card} space-y-3`}>
      <h2 className={band === "teen" ? "text-base font-semibold" : "text-xl font-extrabold"}>{words.title}</h2>
      <p className="text-sm opacity-80">{words.intro(aiCheckEnabled)}</p>
      {sets.length > 1 && (
        <label className="block text-sm font-medium">
          {words.which}
          <select value={setId} onChange={(e) => setSetId(e.target.value)} className="mt-1 w-full rounded-xl border-2 border-slate-300 bg-white px-3 py-2 text-slate-900">
            {sets.map((s) => (
              <option key={s.id} value={s.id}>
                {s.subject}
              </option>
            ))}
          </select>
        </label>
      )}
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        disabled={busy}
        onChange={(e) => setFiles(Array.from(e.target.files ?? []).slice(0, 3))}
        aria-label="Photos of your paper"
        className="block w-full text-sm file:mr-3 file:rounded-xl file:border-0 file:bg-violet-600 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white"
      />
      <div className="flex flex-col gap-3">
        {aiCheckEnabled && (
          <button type="button" onClick={() => send("ai")} disabled={busy || files.length === 0} className={look.primary}>
            {busy ? "…" : words.ai}
          </button>
        )}
        <button type="button" onClick={() => send("parent")} disabled={busy || files.length === 0} className={aiCheckEnabled ? look.secondary : look.primary}>
          {aiCheckEnabled ? words.parent : busy ? "…" : words.toParent}
        </button>
      </div>
      {message && (
        <p role={message.ok ? "status" : "alert"} className={`rounded-xl p-3 text-sm font-medium ${message.ok ? "bg-emerald-100 text-emerald-900" : "bg-rose-100 text-rose-900"}`}>
          {message.text}
        </p>
      )}
    </section>
  );
}
