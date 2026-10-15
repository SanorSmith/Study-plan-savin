"use client";

import type { AgeBand } from "@/lib/age-band";
import type { Look } from "./looks";

/** A ring showing how many minutes are left (a full ring is an hour or more). */
export function TimeGauge({ minutes, look, unit, emoji }: { minutes: number; look: Look; unit: string; emoji: boolean }) {
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const filled = Math.min(1, Math.max(0, minutes / 60));
  return (
    <div className="relative mx-auto h-44 w-44" role="img" aria-label={`${minutes} ${unit} left`}>
      <svg viewBox="0 0 128 128" className="h-full w-full -rotate-90">
        <circle cx="64" cy="64" r={radius} fill="none" strokeWidth="12" className={look.gaugeTrack} />
        <circle
          cx="64"
          cy="64"
          r={radius}
          fill="none"
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - filled)}
          className={`${look.gaugeStroke} transition-[stroke-dashoffset] duration-700`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {emoji && <span className="text-3xl">🕒</span>}
        <span className="text-5xl font-black tabular-nums leading-none">{minutes}</span>
        <span className="text-sm font-semibold opacity-80">{unit}</span>
      </div>
    </div>
  );
}

/** Stars for young kids, a bar for older ones. */
export function Progress({ done, total, band, look }: { done: number; total: number; band: AgeBand; look: Look }) {
  if (total <= 0) return null;
  if (band === "little") {
    return (
      <p className="text-center text-3xl tracking-wide" aria-label={`${done} of ${total} done`}>
        {Array.from({ length: Math.min(total, 10) }, (_, i) => (i < done ? "⭐" : "☆")).join(" ")}
      </p>
    );
  }
  return (
    <div aria-label={`${done} of ${total} done`}>
      <div className="flex items-center gap-3">
        <div className="h-3 flex-1 overflow-hidden rounded-full bg-black/10">
          <div className={`h-full rounded-full ${look.progressFill} transition-[width] duration-500`} style={{ width: `${(done / total) * 100}%` }} />
        </div>
        <span className="text-sm font-semibold tabular-nums opacity-70">
          {done}/{total}
        </span>
      </div>
    </div>
  );
}

/** An on-screen number pad. Used for answers by young kids and for the PIN by everyone. */
export function Keypad({
  look,
  onKey,
  allowDecimal = false,
  disabled = false,
}: {
  look: Look;
  onKey: (key: string) => void;
  allowDecimal?: boolean;
  disabled?: boolean;
}) {
  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", allowDecimal ? "." : "", "0", "⌫"];
  return (
    <div className="mx-auto grid max-w-xs grid-cols-3 gap-3">
      {keys.map((k, i) =>
        k === "" ? (
          <span key={i} />
        ) : (
          <button key={k} type="button" disabled={disabled} onClick={() => onKey(k)} className={`${look.keypadKey} disabled:opacity-50`} aria-label={k === "⌫" ? "Delete" : k}>
            {k}
          </button>
        ),
      )}
    </div>
  );
}

/** Dots that fill up as the PIN is typed. */
export function PinDots({ length, filled, look }: { length: number; filled: number; look: Look }) {
  return (
    <div className="flex justify-center gap-4" role="img" aria-label={`${filled} of ${length} digits entered`}>
      {Array.from({ length }, (_, i) => (
        <span key={i} className={`h-5 w-5 rounded-full border-2 ${i < filled ? `${look.dot} border-transparent` : "border-current opacity-40"}`} />
      ))}
    </div>
  );
}

/** A burst of emoji when an answer is right. */
export function Celebration({ emoji, text }: { emoji: string[]; text: string }) {
  return (
    <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center" role="status">
      <div className="animate-pop rounded-[2rem] bg-white/95 px-8 py-6 text-center shadow-2xl ring-4 ring-amber-300">
        <p className="text-6xl">{emoji.join(" ")}</p>
        <p className="mt-2 text-2xl font-black text-violet-700">{text}</p>
      </div>
    </div>
  );
}
