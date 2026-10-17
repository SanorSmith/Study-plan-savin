"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

type Pending = { id: string; kidId: string; kidName: string; subject: string; createdAt: string };

const SEEN = "sp_seen_papers";
const SOUND = "sp_sound";

function load(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function save(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // private mode: alerts still work for this visit
  }
}

/** Two short rising tones, made with the Web Audio API so no sound file is needed. */
export function playDing(ctx: AudioContext) {
  const tone = (freq: number, start: number) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime + start);
    gain.gain.exponentialRampToValueAtTime(0.35, ctx.currentTime + start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + 0.5);
    osc.connect(gain).connect(ctx.destination);
    osc.start(ctx.currentTime + start);
    osc.stop(ctx.currentTime + start + 0.55);
  };
  tone(880, 0);
  tone(1320, 0.18);
}

/**
 * Rings while the website is open: every 20 seconds it asks whether a kid sent a paper. A new one plays a sound,
 * shows a banner and, when allowed, a system notification. Closed websites are covered by push notifications.
 */
export function LiveAlerts() {
  const [fresh, setFresh] = useState<Pending[]>([]);
  const [muted, setMuted] = useState(false);
  const audio = useRef<AudioContext | null>(null);
  const mutedRef = useRef(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reads the saved choice once, after load
    setMuted(load(SOUND) === "off");
    mutedRef.current = load(SOUND) === "off";
  }, []);

  // Browsers only allow sound after the person has touched the page, so the first touch prepares the audio.
  useEffect(() => {
    const unlock = () => {
      if (!audio.current) {
        const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (Ctx) audio.current = new Ctx();
      }
      void audio.current?.resume();
    };
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  const check = useCallback(async () => {
    try {
      const res = await fetch("/api/web/pending", { cache: "no-store" });
      if (!res.ok) return;
      const { papers } = (await res.json()) as { papers: Pending[] };
      const stored = load(SEEN);
      const seen = new Set<string>(stored ? (JSON.parse(stored) as string[]) : []);
      const newOnes = stored === null ? [] : papers.filter((p) => !seen.has(p.id)); // the first visit only sets the baseline
      save(SEEN, JSON.stringify(papers.map((p) => p.id)));
      document.title = papers.length > 0 ? `(${papers.length}) Study Plan` : "Study Plan";
      if (newOnes.length === 0) return;
      setFresh(newOnes);
      if (!mutedRef.current && audio.current) playDing(audio.current);
      if (document.hidden && "Notification" in window && Notification.permission === "granted") {
        const first = newOnes[0];
        new Notification(`${first.kidName} sent a paper`, { body: `${first.subject}: open it to check`, icon: "/icons/icon-192.png", tag: `paper-${first.id}` });
      }
    } catch {
      // offline for a moment: try again next time
    }
  }, []);

  useEffect(() => {
    const first = setTimeout(() => void check(), 0);
    const timer = setInterval(() => void check(), 20_000);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [check]);

  if (fresh.length === 0) return null;
  const first = fresh[0];
  return (
    <div role="alert" className="fixed inset-x-3 top-3 z-50 mx-auto max-w-md rounded-2xl border border-amber-300 bg-amber-50 p-4 shadow-lg">
      <p className="font-semibold text-amber-950">
        {fresh.length === 1 ? `${first.kidName} sent a paper` : `${fresh.length} papers to check`}
      </p>
      <p className="text-sm text-amber-900">{fresh.length === 1 ? first.subject : fresh.map((p) => p.kidName).filter((n, i, a) => a.indexOf(n) === i).join(", ")}</p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Link
          href={`/kids/${first.kidId}/papers/${first.id}`}
          onClick={() => setFresh([])}
          className="inline-flex items-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white"
        >
          Check it
        </Link>
        <button type="button" onClick={() => setFresh([])} className="text-sm font-medium text-slate-700 underline">
          Later
        </button>
        <button
          type="button"
          onClick={() => {
            const next = !mutedRef.current;
            mutedRef.current = next;
            setMuted(next);
            save(SOUND, next ? "off" : "on");
          }}
          className="ml-auto text-xs text-slate-600 underline"
        >
          {muted ? "Sound is off" : "Mute sound"}
        </button>
      </div>
    </div>
  );
}
