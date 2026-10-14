"use client";

import { useCallback, useEffect, useState } from "react";
import { btn, Card, field, labelText } from "@/components/ui";
import { activeWindow, type ScheduleRule } from "@/lib/schedule";
import { shrinkImage } from "@/lib/shrink-image";

type Question = {
  id: string;
  text: string;
  type: "multiple_choice" | "numeric" | "short_text";
  options: string[] | null;
  subject: string;
};
type State = {
  serverNow: string;
  name: string;
  balanceMinutes: number;
  minutesPerQuestion: number;
  earnableTodayMinutes: number;
  question: Question | null;
  schedule: { timezone: string; rules: ScheduleRule[] };
  paperSets: { id: string; subject: string }[];
};
type View = "loading" | "pair" | "pin" | "home";
type Feedback = { text: string; tone: "good" | "info" | "bad" };

async function post(url: string, body: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return { ok: res.ok, status: res.status, json: await res.json().catch(() => ({})) };
}

const minuteLabel = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

export function KidApp() {
  const [view, setView] = useState<View>("loading");
  const [state, setState] = useState<State | null>(null);
  // Server time minus this device's clock, so the schedule follows the server even if the device clock is wrong.
  const [clockOffset, setClockOffset] = useState(0);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/kid/state", { cache: "no-store" });
    if (res.status === 401) return setView("pair");
    if (res.status === 403) return setView("pin");
    const next: State = await res.json();
    setClockOffset(Date.parse(next.serverNow) - Date.now());
    setState(next);
    setView("home");
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial load from the API
    void refresh();
  }, [refresh]);

  return (
    <main className="mx-auto min-h-screen max-w-md px-4 py-8">
      {view === "loading" && (
        <p role="status" className="text-sm text-slate-500">
          Loading…
        </p>
      )}
      {view === "pair" && <CodeForm kind="pair" onDone={refresh} />}
      {view === "pin" && <CodeForm kind="pin" onDone={refresh} />}
      {view === "home" && state && <Home state={state} clockOffset={clockOffset} refresh={refresh} />}
    </main>
  );
}

function CodeForm({ kind, onDone }: { kind: "pair" | "pin"; onDone: () => void }) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const r = kind === "pair" ? await post("/api/device/pair", { code: value }) : await post("/api/kid/unlock", { pin: value });
    setBusy(false);
    if (r.ok) return onDone();
    setError(r.json.error ?? "Something went wrong");
  }

  return (
    <Card>
      <form onSubmit={submit} className="space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight">{kind === "pair" ? "Connect this device" : "Hi! Enter your PIN"}</h1>
        {kind === "pair" && <p className="text-sm text-slate-600">Ask a parent for the pairing code.</p>}
        <label className={labelText}>
          {kind === "pair" ? "Pairing code" : "Your PIN"}
          <input
            value={value}
            onChange={(e) => setValue(kind === "pin" ? e.target.value.replace(/\D/g, "").slice(0, 4) : e.target.value.toUpperCase())}
            type={kind === "pin" ? "password" : "text"}
            inputMode={kind === "pin" ? "numeric" : "text"}
            autoComplete="off"
            autoCapitalize="characters"
            className={`${field} text-center text-2xl tracking-widest`}
          />
        </label>
        {error && (
          <p role="alert" className="text-sm text-red-700">
            {error}
          </p>
        )}
        <button disabled={busy || !value} className={`${btn.primary} w-full py-3 disabled:opacity-50`}>
          Go
        </button>
      </form>
    </Card>
  );
}

function Home({ state, clockOffset, refresh }: { state: State; clockOffset: number; refresh: () => Promise<void> }) {
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  // Keep the schedule status current without refetching.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(t);
  }, []);
  const window = activeWindow(state.schedule.rules, state.schedule.timezone, now + clockOffset);

  async function submit(q: Question, value: string) {
    setError(null);
    setBusy(true);
    const r = await post("/api/kid/answer", { questionId: q.id, answer: value });
    setBusy(false);
    if (!r.ok) {
      if (r.status === 403) return refresh();
      return setError("Could not save that answer. Try again.");
    }
    setFeedback(
      r.json.correct
        ? r.json.earnedMinutes > 0
          ? { text: `Correct! +${r.json.earnedMinutes} minutes`, tone: "good" }
          : { text: "Correct! The daily limit is reached, so no more minutes today.", tone: "info" }
        : r.json.attemptsLeft > 0
          ? { text: `Not quite. Try again (${r.json.attemptsLeft} ${r.json.attemptsLeft === 1 ? "try" : "tries"} left).`, tone: "bad" }
          : { text: "Not quite. No minutes for this one.", tone: "bad" },
    );
    setAnswer("");
    await refresh();
  }

  const q = state.question;
  const feedbackStyle = { good: "bg-emerald-50 text-emerald-900", info: "bg-slate-100 text-slate-800", bad: "bg-red-50 text-red-900" };

  return (
    <div className="space-y-5">
      <header>
        <p className="text-sm text-slate-500">Hi</p>
        <h1 className="text-3xl font-semibold tracking-tight">{state.name}</h1>
      </header>

      <Card>
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Screen time in the bank</p>
        <p className="mt-1 text-5xl font-semibold tabular-nums">
          {state.balanceMinutes}
          <span className="ml-2 text-xl font-normal text-slate-500">min</span>
        </p>
        {window?.mode === "blocked" && (
          <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-900">The phone is locked until {minuteLabel(window.endMinute)}.</p>
        )}
        {window?.mode === "free" && (
          <p className="mt-3 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900">
            Free time until {minuteLabel(window.endMinute)}. No minutes are used.
          </p>
        )}
        <p className="mt-3 text-sm text-slate-600">
          Answer homework to earn more. Minutes are used automatically while you use other apps on your phone.
        </p>
      </Card>

      <div aria-live="polite">
        {feedback && <p className={`rounded-xl p-4 text-base font-medium ${feedbackStyle[feedback.tone]}`}>{feedback.text}</p>}
        {error && (
          <p role="alert" className="rounded-xl bg-red-50 p-4 text-base text-red-900">
            {error}
          </p>
        )}
      </div>

      {q ? (
        <Card className="space-y-4">
          <p className="text-sm text-slate-500">
            {q.subject} · worth up to {Math.min(state.minutesPerQuestion, state.earnableTodayMinutes)} min
          </p>
          <p className="text-xl leading-snug">{q.text}</p>
          {q.type === "multiple_choice" && q.options ? (
            <div className="space-y-2">
              {q.options.map((o) => (
                <button key={o} disabled={busy} onClick={() => submit(q, o)} className={`${btn.secondary} w-full justify-start py-3 text-base disabled:opacity-50`}>
                  {o}
                </button>
              ))}
            </div>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (answer.trim()) void submit(q, answer);
              }}
              className="flex gap-2"
            >
              <input
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                inputMode="decimal"
                aria-label="Your answer"
                className={`${field} !mt-0 min-w-0 flex-1 py-3 text-lg`}
              />
              <button disabled={busy || !answer.trim()} className={`${btn.primary} px-5 disabled:opacity-50`}>
                Answer
              </button>
            </form>
          )}
        </Card>
      ) : (
        <Card className="text-center text-sm text-slate-600">No homework waiting. Ask a parent to add some.</Card>
      )}

      {state.paperSets.length > 0 && <PaperCard sets={state.paperSets} />}
    </div>
  );
}

/** Done the homework on paper? Photograph it. A parent checks it and the minutes arrive after. */
function PaperCard({ sets }: { sets: { id: string; subject: string }[] }) {
  const [setId, setSetId] = useState(sets[0].id);
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  async function send() {
    setBusy(true);
    setMessage(null);
    try {
      const body = new FormData();
      body.set("setId", setId);
      for (const f of files) body.append("image", await shrinkImage(f));
      const res = await fetch("/api/kid/paper", { method: "POST", body });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Could not send the paper");
      setMessage({ text: "Sent! A parent will check it, then your minutes arrive.", ok: true });
      setFiles([]);
    } catch (e) {
      setMessage({ text: e instanceof Error ? e.message : "Could not send the paper", ok: false });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="space-y-3">
      <h2 className="text-base font-semibold">Did it on paper?</h2>
      <p className="text-sm text-slate-600">Take a photo of your finished paper. A parent checks it and your minutes arrive after.</p>
      {sets.length > 1 && (
        <label className={labelText}>
          Which homework
          <select value={setId} onChange={(e) => setSetId(e.target.value)} className={field}>
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
        className="block w-full text-sm text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-900 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white"
      />
      <button type="button" onClick={send} disabled={busy || files.length === 0} className={`${btn.primary} w-full py-3 disabled:opacity-50`}>
        {busy ? "Sending…" : "Send my paper"}
      </button>
      {message && (
        <p role={message.ok ? "status" : "alert"} className={`rounded-lg p-3 text-sm ${message.ok ? "bg-emerald-50 text-emerald-900" : "bg-red-50 text-red-900"}`}>
          {message.text}
        </p>
      )}
    </Card>
  );
}
