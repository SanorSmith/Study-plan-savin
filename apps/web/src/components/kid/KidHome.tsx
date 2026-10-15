"use client";

import { useEffect, useState, type ReactNode } from "react";
import type { AgeBand } from "@/lib/age-band";
import { activeWindow, type ScheduleRule } from "@/lib/schedule";
import { COPY, LOOKS } from "./looks";
import { Celebration, Keypad, Progress, TimeGauge } from "./parts";

export type KidQuestion = {
  id: string;
  text: string;
  type: "multiple_choice" | "numeric" | "short_text";
  options: string[] | null;
  subject: string;
};

export type KidViewState = {
  name: string;
  balanceMinutes: number;
  minutesPerQuestion: number;
  earnableTodayMinutes: number;
  question: KidQuestion | null;
  progress: { done: number; total: number } | null;
  schedule: { timezone: string; rules: ScheduleRule[] };
};

export type AnswerOutcome = { correct: boolean; earnedMinutes: number; attemptsLeft: number };

const minuteLabel = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

/** The kid's home screen. The look and the words follow the age band; nothing here talks to the server. */
export function KidHome({
  state,
  band,
  clockOffset = 0,
  onAnswer,
  error,
  children,
}: {
  state: KidViewState;
  band: AgeBand;
  clockOffset?: number;
  onAnswer: (question: KidQuestion, value: string) => Promise<AnswerOutcome | null>;
  error?: string | null;
  children?: ReactNode; // the "did it on paper?" card
}) {
  const look = LOOKS[band];
  const copy = COPY[band];
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ text: string; tone: "good" | "info" | "bad" } | null>(null);
  const [celebrate, setCelebrate] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [answeredAny, setAnsweredAny] = useState(false);
  const [showInfo, setShowInfo] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(t);
  }, []);
  const window = activeWindow(state.schedule.rules, state.schedule.timezone, now + clockOffset);

  async function submit(q: KidQuestion, value: string) {
    if (!value.trim()) return;
    setBusy(true);
    const outcome = await onAnswer(q, value.trim());
    setBusy(false);
    if (!outcome) return;
    setAnsweredAny(true);
    setAnswer("");
    if (outcome.correct) {
      setFeedback({ text: outcome.earnedMinutes > 0 ? copy.correct(outcome.earnedMinutes) : copy.correctNoMinutes, tone: outcome.earnedMinutes > 0 ? "good" : "info" });
      if (look.emoji) {
        setCelebrate(band === "little" ? "🎉 ⭐ 🎈" : "⭐");
        setTimeout(() => setCelebrate(null), 1700);
      }
    } else {
      setFeedback({ text: outcome.attemptsLeft > 0 ? copy.tryAgain(outcome.attemptsLeft) : copy.wrongFinal, tone: "bad" });
    }
  }

  const tone = {
    good: "bg-emerald-100 text-emerald-900",
    info: "bg-sky-100 text-sky-900",
    bad: "bg-rose-100 text-rose-900",
  };
  const q = state.question;
  const decimalKeys = q?.type === "numeric";

  return (
    <div className={`min-h-screen ${look.page}`}>
      {celebrate && <Celebration emoji={celebrate.split(" ")} text={feedback?.text ?? ""} />}
      <main className="mx-auto max-w-md space-y-5 px-4 py-6">
        <h1 className={look.heading}>{copy.hi(state.name)}</h1>

        <section className={`${look.hero} space-y-3 text-center`}>
          <TimeGauge minutes={state.balanceMinutes} look={look} unit={copy.minutes} emoji={band === "little"} />
          {window?.mode === "blocked" && <p className="rounded-full bg-black/25 px-4 py-2 text-base font-bold">{copy.locked(minuteLabel(window.endMinute))}</p>}
          {window?.mode === "free" && <p className="rounded-full bg-white/25 px-4 py-2 text-base font-bold">{copy.free(minuteLabel(window.endMinute))}</p>}
          <button type="button" onClick={() => setShowInfo((v) => !v)} aria-expanded={showInfo} aria-label="What is this?" className="mx-auto flex h-8 w-8 items-center justify-center rounded-full bg-white/25 text-base font-bold">
            {showInfo ? "×" : "?"}
          </button>
          {showInfo && <p className="text-sm font-medium opacity-95">{copy.info}</p>}
        </section>

        <div aria-live="polite" className="space-y-2">
          {feedback && !celebrate && <p className={`rounded-2xl p-4 text-lg font-semibold ${tone[feedback.tone]}`}>{feedback.text}</p>}
          {error && (
            <p role="alert" className="rounded-2xl bg-rose-100 p-4 text-lg text-rose-900">
              {error}
            </p>
          )}
        </div>

        {q ? (
          <section className={`${look.card} space-y-4`}>
            {state.progress && <Progress done={state.progress.done} total={state.progress.total} band={band} look={look} />}
            <div className="flex flex-wrap gap-2">
              <span className={look.pill}>{q.subject}</span>
              <span className={look.pill}>+{Math.min(state.minutesPerQuestion, state.earnableTodayMinutes)} {copy.minutes}</span>
            </div>
            <p className={look.question}>{q.text}</p>

            {q.type === "multiple_choice" && q.options ? (
              <div className="space-y-3">
                {q.options.map((o, i) => (
                  <button key={o} disabled={busy} onClick={() => submit(q, o)} className={look.option(i)}>
                    {o}
                  </button>
                ))}
              </div>
            ) : look.bigKeypad && q.type === "numeric" ? (
              <div className="space-y-4">
                <p className="min-h-16 rounded-2xl bg-violet-50 px-4 py-3 text-center text-5xl font-black tabular-nums text-violet-800" aria-live="polite">
                  {answer || <span className="opacity-30">?</span>}
                </p>
                <Keypad look={look} allowDecimal={decimalKeys} disabled={busy} onKey={(k) => setAnswer((a) => (k === "⌫" ? a.slice(0, -1) : a.length < 8 ? a + k : a))} />
                <button disabled={busy || !answer} onClick={() => submit(q, answer)} className={`${look.primary} w-full`}>
                  {copy.answer}
                </button>
              </div>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void submit(q, answer);
                }}
                className="flex gap-2"
              >
                <input
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  inputMode={q.type === "numeric" ? "decimal" : "text"}
                  aria-label="Your answer"
                  className="min-w-0 flex-1 rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 text-xl text-slate-900 focus:border-violet-400 focus:outline-none"
                />
                <button disabled={busy || !answer.trim()} className={look.primary}>
                  {copy.answer}
                </button>
              </form>
            )}
          </section>
        ) : (
          <section className={`${look.card} text-center text-lg`}>{answeredAny ? copy.allDone : copy.noHomework}</section>
        )}

        {children}
      </main>
    </div>
  );
}
