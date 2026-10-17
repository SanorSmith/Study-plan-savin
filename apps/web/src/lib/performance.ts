import { and, between, eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { attempts, creditLedger, homeworkSets, paperSubmissions, questions } from "@/db/schema";
import { MAX_ATTEMPTS } from "@/lib/ledger";

export type Period = "week" | "month" | "year";
export const PERIODS: Period[] = ["week", "month", "year"];

const DAY = 24 * 60 * 60 * 1000;
const DAYS: Record<Period, number> = { week: 7, month: 30, year: 365 };
const BUCKETS: Record<Period, number> = { week: 7, month: 6, year: 12 };

/** The window a report covers: the last 7, 30 or 365 days up to now. */
export function periodRange(period: Period, now: Date): { from: Date; to: Date } {
  return { from: new Date(now.getTime() - DAYS[period] * DAY), to: now };
}

export type AttemptRow = { questionId: string; text: string; subject: string; answerKey: string; answer: string; correct: boolean; at: Date };

export type SubjectStat = {
  subject: string;
  questions: number;
  solved: number;
  firstTry: number;
  failed: number;
  attempts: number;
  accuracy: number | null; // percent of attempts that were right
  firstTryRate: number | null; // percent of questions solved at the first try
};

export type HardQuestion = { text: string; subject: string; answerKey: string; tries: number; solved: boolean; wrongAnswers: string[] };

export type Stats = {
  period: Period;
  from: string;
  to: string;
  totals: Omit<SubjectStat, "subject"> & { earnedMinutes: number; papersChecked: number };
  subjects: SubjectStat[];
  trend: { label: string; attempts: number; accuracy: number | null }[];
  hardest: HardQuestion[];
};

const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 100) : null);

type Q = { subject: string; text: string; answerKey: string; tries: AttemptRow[] };

/** Turns a kid's attempts in a window into numbers a parent (and the AI) can read. Pure, so it can be tested. */
export function buildStats(rows: AttemptRow[], opts: { period: Period; from: Date; to: Date; earnedMinutes?: number; papersChecked?: number }): Stats {
  const byQuestion = new Map<string, Q>();
  for (const r of [...rows].sort((a, b) => a.at.getTime() - b.at.getTime())) {
    const q = byQuestion.get(r.questionId) ?? { subject: r.subject, text: r.text, answerKey: r.answerKey, tries: [] };
    q.tries.push(r);
    byQuestion.set(r.questionId, q);
  }

  const summarise = (list: Q[]) => {
    const solved = list.filter((q) => q.tries.some((t) => t.correct)).length;
    const firstTry = list.filter((q) => q.tries[0].correct).length;
    const failed = list.filter((q) => !q.tries.some((t) => t.correct) && q.tries.length >= MAX_ATTEMPTS).length;
    const attemptsN = list.reduce((n, q) => n + q.tries.length, 0);
    const correctN = list.reduce((n, q) => n + q.tries.filter((t) => t.correct).length, 0);
    return { questions: list.length, solved, firstTry, failed, attempts: attemptsN, accuracy: pct(correctN, attemptsN), firstTryRate: pct(firstTry, list.length) };
  };

  const all = [...byQuestion.values()];
  const subjects = [...new Set(all.map((q) => q.subject))]
    .map((subject) => ({ subject, ...summarise(all.filter((q) => q.subject === subject)) }))
    .sort((a, b) => (b.accuracy ?? -1) - (a.accuracy ?? -1));

  const span = opts.to.getTime() - opts.from.getTime();
  const n = BUCKETS[opts.period];
  const trend = Array.from({ length: n }, (_, i) => {
    const start = opts.from.getTime() + (span * i) / n;
    const end = opts.from.getTime() + (span * (i + 1)) / n;
    const inBucket = rows.filter((r) => r.at.getTime() >= start && (r.at.getTime() < end || (i === n - 1 && r.at.getTime() <= end)));
    return { label: new Date(start).toISOString().slice(5, 10), attempts: inBucket.length, accuracy: pct(inBucket.filter((r) => r.correct).length, inBucket.length) };
  });

  const hardest = all
    .map((q) => ({
      text: q.text,
      subject: q.subject,
      answerKey: q.answerKey,
      tries: q.tries.length,
      solved: q.tries.some((t) => t.correct),
      wrongAnswers: [...new Set(q.tries.filter((t) => !t.correct).map((t) => t.answer))].slice(0, 4),
      wrong: q.tries.filter((t) => !t.correct).length,
    }))
    .filter((q) => q.wrong > 0)
    .sort((a, b) => Number(a.solved) - Number(b.solved) || b.wrong - a.wrong)
    .slice(0, 15)
    .map(({ wrong: _wrong, ...q }) => q);

  return {
    period: opts.period,
    from: opts.from.toISOString(),
    to: opts.to.toISOString(),
    totals: { ...summarise(all), earnedMinutes: opts.earnedMinutes ?? 0, papersChecked: opts.papersChecked ?? 0 },
    subjects,
    trend,
    hardest,
  };
}

/** Reads the kid's attempts for the window from the database and builds the numbers. */
export async function statsFor(kidId: string, period: Period, now = new Date()): Promise<Stats> {
  const db = getDb();
  const { from, to } = periodRange(period, now);
  const [rows, earned, papers] = await Promise.all([
    db
      .select({
        questionId: attempts.questionId,
        text: questions.text,
        subject: homeworkSets.subject,
        answerKey: questions.answerKey,
        answer: attempts.answer,
        correct: attempts.correct,
        at: attempts.createdAt,
      })
      .from(attempts)
      .innerJoin(questions, eq(questions.id, attempts.questionId))
      .innerJoin(homeworkSets, eq(homeworkSets.id, questions.setId))
      .where(and(eq(attempts.kidId, kidId), between(attempts.createdAt, from, to))),
    db
      .select({ minutes: sql<number>`coalesce(sum(${creditLedger.deltaMinutes}), 0)::int` })
      .from(creditLedger)
      .where(and(eq(creditLedger.kidId, kidId), eq(creditLedger.reason, "correct_answer"), between(creditLedger.createdAt, from, to))),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(paperSubmissions)
      .where(and(eq(paperSubmissions.kidId, kidId), eq(paperSubmissions.status, "approved"), between(paperSubmissions.createdAt, from, to))),
  ]);
  return buildStats(rows, { period, from, to, earnedMinutes: earned[0]?.minutes ?? 0, papersChecked: papers[0]?.n ?? 0 });
}
