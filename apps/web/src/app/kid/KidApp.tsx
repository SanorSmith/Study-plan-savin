"use client";

import { useCallback, useEffect, useState } from "react";

type Question = {
  id: string;
  text: string;
  type: "multiple_choice" | "numeric" | "short_text";
  options: string[] | null;
  subject: string;
};
type State = {
  name: string;
  balanceMinutes: number;
  minutesPerQuestion: number;
  earnableTodayMinutes: number;
  session: { endsAt: string } | null;
  question: Question | null;
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

export function KidApp() {
  const [view, setView] = useState<View>("loading");
  const [state, setState] = useState<State | null>(null);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/kid/state", { cache: "no-store" });
    if (res.status === 401) return setView("pair");
    if (res.status === 403) return setView("pin");
    setState(await res.json());
    setView("home");
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial load from the API
    void refresh();
  }, [refresh]);

  if (view === "loading") return <p className="p-6">Loading…</p>;
  if (view === "pair") return <CodeForm label="Pairing code" onDone={refresh} kind="pair" />;
  if (view === "pin") return <CodeForm label="Your PIN" onDone={refresh} kind="pin" />;
  return state && <Home state={state} refresh={refresh} />;
}

function CodeForm({ label, kind, onDone }: { label: string; kind: "pair" | "pin"; onDone: () => void }) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const r =
      kind === "pair"
        ? await post("/api/device/pair", { code: value })
        : await post("/api/kid/unlock", { pin: value });
    if (r.ok) return onDone();
    setError(r.json.error ?? "Something went wrong");
  }

  return (
    <form onSubmit={submit} className="mx-auto max-w-xs space-y-4 p-6">
      <h1 className="text-2xl font-semibold">{kind === "pair" ? "Connect this device" : "Hi!"}</h1>
      <label className="block">
        <span className="mb-1 block text-sm">{label}</span>
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          type={kind === "pin" ? "password" : "text"}
          inputMode={kind === "pin" ? "numeric" : "text"}
          autoComplete="off"
          autoCapitalize="characters"
          className="w-full rounded border p-3 text-center text-2xl tracking-widest"
        />
      </label>
      {error && <p className="text-red-600">{error}</p>}
      <button className="w-full rounded bg-black p-3 text-white">Go</button>
    </form>
  );
}

function Home({ state, refresh }: { state: State; refresh: () => Promise<void> }) {
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(q: Question, value: string) {
    setError(null);
    const r = await post("/api/kid/answer", { questionId: q.id, answer: value });
    if (!r.ok) {
      if (r.status === 403) return refresh();
      return setError("Could not save that answer");
    }
    setFeedback(
      r.json.correct
        ? r.json.earnedMinutes > 0
          ? `Correct! +${r.json.earnedMinutes} minutes`
          : "Correct! (daily limit reached, no more minutes today)"
        : "Not quite — no minutes for this one",
    );
    setAnswer("");
    await refresh();
  }

  async function spend(minutes: number) {
    setError(null);
    const r = await post("/api/kid/spend", { minutes });
    if (!r.ok) {
      if (r.status === 403) return refresh();
      return setError(r.json.error === "insufficient_balance" ? "Not enough minutes" : "Cannot start now");
    }
    await refresh();
  }

  const q = state.question;
  return (
    <main className="mx-auto max-w-md space-y-6 p-6">
      <header className="flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold">{state.name}</h1>
        <p className="text-lg">
          <b>{state.balanceMinutes}</b> min banked
        </p>
      </header>

      {state.session ? (
        <Countdown endsAt={state.session.endsAt} onDone={refresh} />
      ) : (
        state.balanceMinutes > 0 && (
          <section className="space-y-2 rounded border p-4">
            <p className="font-medium">Use your minutes</p>
            <div className="flex flex-wrap gap-2">
              {[5, 10, 15, 30, state.balanceMinutes]
                .filter((m, i, a) => m > 0 && m <= state.balanceMinutes && a.indexOf(m) === i)
                .map((m) => (
                  <button key={m} onClick={() => spend(m)} className="rounded border px-3 py-2">
                    {m} min
                  </button>
                ))}
            </div>
          </section>
        )
      )}

      {feedback && <p className="rounded bg-blue-50 p-3">{feedback}</p>}
      {error && <p className="text-red-600">{error}</p>}

      {q ? (
        <section className="space-y-3 rounded border p-4">
          <p className="text-sm text-gray-600">
            {q.subject} · worth {Math.min(state.minutesPerQuestion, state.earnableTodayMinutes)} min
          </p>
          <p className="text-lg">{q.text}</p>
          {q.type === "multiple_choice" && q.options ? (
            <div className="space-y-2">
              {q.options.map((o) => (
                <button key={o} onClick={() => submit(q, o)} className="w-full rounded border p-3 text-left">
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
                className="min-w-0 flex-1 rounded border p-3"
              />
              <button className="rounded bg-black px-4 text-white">Answer</button>
            </form>
          )}
        </section>
      ) : (
        <p className="text-gray-600">No homework waiting. Ask a parent to add some.</p>
      )}
    </main>
  );
}

function Countdown({ endsAt, onDone }: { endsAt: string; onDone: () => void }) {
  const [now, setNow] = useState(() => Date.now());
  const left = Math.max(0, Math.round((new Date(endsAt).getTime() - now) / 1000));

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (left === 0) onDone();
  }, [left, onDone]);

  const mm = String(Math.floor(left / 60)).padStart(2, "0");
  const ss = String(left % 60).padStart(2, "0");
  return (
    <section className="rounded bg-green-50 p-4 text-center">
      <p className="text-sm">Screen time left</p>
      <p className="font-mono text-4xl">
        {mm}:{ss}
      </p>
    </section>
  );
}
