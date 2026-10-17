"use client";

import { useCallback, useEffect, useState } from "react";
import { COPY, LOOKS } from "@/components/kid/looks";
import { KidHome, type AnswerOutcome, type KidQuestion, type KidViewState } from "@/components/kid/KidHome";
import { PaperCard } from "@/components/kid/PaperCard";
import { Keypad, PinDots } from "@/components/kid/parts";
import { ageBand, type AgeBand } from "@/lib/age-band";

type State = KidViewState & {
  serverNow: string;
  grade: number;
  uiStyle: string;
  paperSets: { id: string; subject: string }[];
  aiCheckEnabled: boolean;
};
type View = "loading" | "pair" | "pin" | "home";

async function post(url: string, body: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return { ok: res.ok, status: res.status, json: await res.json().catch(() => ({})) };
}

const BAND_KEY = "studyplan-band";

/** The band the kid's screens used last time, so the pairing and PIN screens look right before the state loads. */
function savedBand(): AgeBand {
  try {
    const v = localStorage.getItem(BAND_KEY);
    if (v === "little" || v === "middle" || v === "teen") return v;
  } catch {
    // storage can be blocked; the middle look is a fine default
  }
  return "middle";
}

export function KidApp() {
  const [view, setView] = useState<View>("loading");
  const [state, setState] = useState<State | null>(null);
  const [band, setBand] = useState<AgeBand>("middle");
  const [error, setError] = useState<string | null>(null);
  // Server time minus this device's clock, so the schedule follows the server even if the device clock is wrong.
  const [clockOffset, setClockOffset] = useState(0);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/kid/state", { cache: "no-store" });
    if (res.status === 401) return setView("pair");
    if (res.status === 403) return setView("pin");
    const next: State = await res.json();
    const nextBand = ageBand(next.grade, next.uiStyle);
    try {
      localStorage.setItem(BAND_KEY, nextBand);
    } catch {
      // not saving the look is harmless
    }
    setBand(nextBand);
    setClockOffset(Date.parse(next.serverNow) - Date.now());
    setState(next);
    setView("home");
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial load from the API
    setBand(savedBand());
    void refresh();
  }, [refresh]);

  async function answer(q: KidQuestion, value: string): Promise<AnswerOutcome | null> {
    setError(null);
    const r = await post("/api/kid/answer", { questionId: q.id, answer: value });
    if (!r.ok) {
      if (r.status === 403) {
        await refresh();
        return null;
      }
      setError("Could not save that answer. Try again.");
      return null;
    }
    const outcome: AnswerOutcome = { correct: r.json.correct, earnedMinutes: r.json.earnedMinutes, attemptsLeft: r.json.attemptsLeft };
    await refresh();
    return outcome;
  }

  async function readMessages(ids: string[]) {
    await post("/api/kid/messages/read", { ids });
    await refresh();
  }

  const look = LOOKS[band];
  if (view === "home" && state) {
    return (
      <KidHome state={state} band={band} clockOffset={clockOffset} onAnswer={answer} error={error} onReadMessages={readMessages}>
        {state.paperSets.length > 0 && <PaperCard sets={state.paperSets} aiCheckEnabled={state.aiCheckEnabled} band={band} onChanged={refresh} />}
      </KidHome>
    );
  }

  return (
    <div className={`min-h-screen ${look.page}`}>
      <main className="mx-auto max-w-md px-4 py-10">
        {view === "loading" && (
          <p role="status" className="text-center text-lg opacity-70">
            …
          </p>
        )}
        {view === "pair" && <PairScreen band={band} onDone={refresh} />}
        {view === "pin" && <PinScreen band={band} onDone={refresh} />}
      </main>
    </div>
  );
}

function PairScreen({ band, onDone }: { band: AgeBand; onDone: () => void }) {
  const look = LOOKS[band];
  const copy = COPY[band];
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const r = await post("/api/device/pair", { code: value });
    setBusy(false);
    if (r.ok) return onDone();
    setError(r.json.error ?? "Something went wrong");
  }

  return (
    <form onSubmit={submit} className={`${look.card} space-y-4`}>
      <h1 className={look.heading}>{copy.pairTitle}</h1>
      <p className="text-lg opacity-70">{copy.pairHint}</p>
      <input
        value={value}
        onChange={(e) => setValue(e.target.value.toUpperCase())}
        autoComplete="off"
        autoCapitalize="characters"
        aria-label="Pairing code"
        className="w-full rounded-2xl border-2 border-slate-300 bg-white px-4 py-4 text-center text-3xl font-bold tracking-widest text-slate-900"
      />
      {error && (
        <p role="alert" className="rounded-xl bg-rose-100 p-3 text-base text-rose-900">
          {error}
        </p>
      )}
      <button disabled={busy || !value} className={`${look.primary} w-full`}>
        Go
      </button>
    </form>
  );
}

function PinScreen({ band, onDone }: { band: AgeBand; onDone: () => void }) {
  const look = LOOKS[band];
  const copy = COPY[band];
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function press(key: string) {
    if (busy) return;
    setError(null);
    const next = key === "⌫" ? pin.slice(0, -1) : (pin + key).slice(0, 4);
    setPin(next);
    if (next.length === 4) {
      setBusy(true);
      const r = await post("/api/kid/unlock", { pin: next });
      setBusy(false);
      if (r.ok) return onDone();
      setPin("");
      setError(r.json.error ?? "Something went wrong");
    }
  }

  return (
    <div className={`${look.card} space-y-6`}>
      <h1 className={`${look.heading} text-center`}>{copy.pinTitle}</h1>
      <PinDots length={4} filled={pin.length} look={look} />
      {error && (
        <p role="alert" className="rounded-xl bg-rose-100 p-3 text-center text-base text-rose-900">
          {error}
        </p>
      )}
      <Keypad look={look} onKey={press} disabled={busy} />
    </div>
  );
}
