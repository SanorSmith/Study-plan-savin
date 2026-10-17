"use client";

import { useState } from "react";
import type { AgeBand } from "@/lib/age-band";
import { shrinkImage } from "@/lib/shrink-image";
import { LOOKS } from "./looks";

const WORDS: Record<AgeBand, { title: string; photos: string; ai: string; parent: string; toParent: string; sent: string; which: string; close: string }> = {
  little: {
    title: "📝 Did it on paper?",
    photos: "📷 Take a picture",
    ai: "🤖 Check with the computer",
    parent: "👪 Check with a grown-up",
    toParent: "👪 Send to a grown-up",
    sent: "Sent! 🎉 A grown-up will check it.",
    which: "Which homework?",
    close: "Close",
  },
  middle: {
    title: "📝 Did it on paper?",
    photos: "📷 Add photos",
    ai: "Check with AI",
    parent: "Check with parent",
    toParent: "Send to my parent",
    sent: "Sent! A parent will check it.",
    which: "Which homework?",
    close: "Close",
  },
  teen: {
    title: "Homework on paper",
    photos: "Add photos",
    ai: "Check with AI",
    parent: "Check with parent",
    toParent: "Send to parent",
    sent: "Sent. A parent will check it.",
    which: "Homework",
    close: "Close",
  },
};

/**
 * Did the homework on paper? One button at first; a tap opens the rest. The kid photographs it, then chooses who
 * checks it: the AI (minutes at once, only if a parent allowed it) or a parent.
 */
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
  const [open, setOpen] = useState(false);
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
        text: json.mode === "ai" ? `${json.correct} of ${json.total} correct${json.minutes > 0 ? `. +${json.minutes} min!` : ""}` : words.sent,
        ok: true,
      });
      setFiles([]);
      setOpen(false);
      if (json.mode === "ai") await onChanged();
    } catch (e) {
      setMessage({ text: e instanceof Error ? e.message : "Could not send the paper", ok: false });
    } finally {
      setBusy(false);
    }
  }

  const note = message && (
    <p role={message.ok ? "status" : "alert"} className={`rounded-2xl p-3 text-center text-base font-semibold ${message.ok ? "bg-emerald-100 text-emerald-900" : "bg-rose-100 text-rose-900"}`}>
      {message.text}
    </p>
  );

  if (!open) {
    return (
      <div className="space-y-3">
        {note}
        <button type="button" onClick={() => setOpen(true)} className={`${look.secondary} w-full`}>
          {words.title}
        </button>
      </div>
    );
  }

  return (
    <section className={`${look.card} space-y-3`}>
      <div className="flex items-center justify-between gap-2">
        <h2 className={band === "teen" ? "text-base font-semibold" : "text-xl font-extrabold"}>{words.title}</h2>
        <button type="button" onClick={() => setOpen(false)} aria-label={words.close} className="flex h-9 w-9 items-center justify-center rounded-full bg-black/10 text-lg font-bold">
          ×
        </button>
      </div>
      {sets.length > 1 && (
        <select aria-label={words.which} value={setId} onChange={(e) => setSetId(e.target.value)} className="w-full rounded-2xl border-2 border-slate-200 bg-white px-3 py-3 text-base text-slate-900">
          {sets.map((s) => (
            <option key={s.id} value={s.id}>
              {s.subject}
            </option>
          ))}
        </select>
      )}
      <label className={`${look.secondary} block w-full cursor-pointer text-center ${busy ? "opacity-50" : ""}`}>
        {files.length > 0 ? `${words.photos} (${files.length}/3)` : words.photos}
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          multiple
          disabled={busy}
          onChange={(e) => setFiles(Array.from(e.target.files ?? []).slice(0, 3))}
          aria-label="Photos of your paper"
          className="sr-only"
        />
      </label>
      {files.length > 0 && (
        <div className="flex flex-col gap-3">
          {aiCheckEnabled && (
            <button type="button" onClick={() => send("ai")} disabled={busy} className={look.primary}>
              {busy ? "…" : words.ai}
            </button>
          )}
          <button type="button" onClick={() => send("parent")} disabled={busy} className={aiCheckEnabled ? look.secondary : look.primary}>
            {aiCheckEnabled ? words.parent : busy ? "…" : words.toParent}
          </button>
        </div>
      )}
      {note}
    </section>
  );
}
