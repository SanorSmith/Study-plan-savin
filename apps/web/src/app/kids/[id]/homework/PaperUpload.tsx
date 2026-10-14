"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { btn, labelText } from "@/components/ui";
import { shrinkImage } from "@/lib/shrink-image";

/** A parent photographs a finished paper; the AI reads it and the result opens for review. */
export function PaperUpload({ kidId, setId }: { kidId: string; setId: string }) {
  const router = useRouter();
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    setBusy(true);
    setError(null);
    try {
      const body = new FormData();
      body.set("setId", setId);
      for (const f of files) body.append("image", await shrinkImage(f));
      const res = await fetch("/api/homework/paper", { method: "POST", body });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Could not read the paper");
      router.push(`/kids/${kidId}/papers/${json.submissionId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not read the paper");
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <label className={labelText}>
        Photos of the finished paper (up to 3 pages)
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          disabled={busy}
          onChange={(e) => setFiles(Array.from(e.target.files ?? []).slice(0, 3))}
          className="mt-2 block w-full text-sm text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-900 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-slate-700"
        />
      </label>
      <button type="button" onClick={send} disabled={busy || files.length === 0} className={`${btn.primary} disabled:opacity-50`}>
        {busy ? "Reading the paper…" : "Read the paper"}
      </button>
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
