import { describe, expect, it } from "vitest";
import { buildStats, periodRange, type AttemptRow } from "./performance";

const day = (n: number) => new Date(Date.UTC(2026, 9, n, 12));
const range = { period: "week" as const, from: day(8), to: day(15) };

function row(q: string, subject: string, at: Date, correct: boolean, answer = correct ? "right" : "wrong"): AttemptRow {
  return { questionId: q, text: `Question ${q}`, subject, answerKey: "right", answer, correct, at };
}

describe("periodRange", () => {
  it("covers the last 7, 30 and 365 days", () => {
    const now = new Date("2026-10-15T12:00:00Z");
    expect(periodRange("week", now).from.toISOString()).toBe("2026-10-08T12:00:00.000Z");
    expect(periodRange("month", now).from.toISOString()).toBe("2026-09-15T12:00:00.000Z");
    expect(periodRange("year", now).from.toISOString()).toBe("2025-10-15T12:00:00.000Z");
  });
});

describe("buildStats", () => {
  const rows = [
    row("a", "Math", day(9), true), // solved first try
    row("b", "Math", day(10), false),
    row("b", "Math", day(10), true), // solved on the second try
    row("c", "Science", day(11), false, "oxygen"),
    row("c", "Science", day(11), false, "helium"),
    row("c", "Science", day(12), false, "oxygen"), // out of tries
    row("d", "Science", day(14), true),
  ];
  const stats = buildStats(rows, { ...range, earnedMinutes: 30, papersChecked: 2 });

  it("counts questions, solved, first tries and questions out of tries", () => {
    expect(stats.totals).toMatchObject({ questions: 4, solved: 3, firstTry: 2, failed: 1, attempts: 7, earnedMinutes: 30, papersChecked: 2 });
  });

  it("gives accuracy of attempts and the first-try rate", () => {
    expect(stats.totals.accuracy).toBe(Math.round((3 / 7) * 100));
    expect(stats.totals.firstTryRate).toBe(50);
  });

  it("splits by subject, best first", () => {
    expect(stats.subjects.map((s) => s.subject)).toEqual(["Math", "Science"]);
    expect(stats.subjects[0]).toMatchObject({ subject: "Math", questions: 2, solved: 2, firstTry: 1, accuracy: 67, firstTryRate: 50 });
    expect(stats.subjects[1]).toMatchObject({ subject: "Science", questions: 2, solved: 1, failed: 1 });
  });

  it("lists the hardest questions first: unsolved before solved, most wrong answers first", () => {
    expect(stats.hardest.map((h) => h.text)).toEqual(["Question c", "Question b"]);
    expect(stats.hardest[0]).toMatchObject({ solved: false, tries: 3, wrongAnswers: ["oxygen", "helium"] });
    expect(stats.hardest[1]).toMatchObject({ solved: true, tries: 2 });
  });

  it("makes a trend with one bucket per day for a week, and every attempt lands in one", () => {
    expect(stats.trend).toHaveLength(7);
    expect(stats.trend.reduce((n, b) => n + b.attempts, 0)).toBe(7);
  });

  it("handles a window with no attempts", () => {
    const empty = buildStats([], range);
    expect(empty.totals).toMatchObject({ questions: 0, attempts: 0, accuracy: null, firstTryRate: null });
    expect(empty.subjects).toEqual([]);
    expect(empty.hardest).toEqual([]);
    expect(empty.trend.every((b) => b.accuracy === null)).toBe(true);
  });

  it("uses more buckets for longer windows", () => {
    expect(buildStats([], { period: "month", from: day(1), to: day(30) }).trend).toHaveLength(6);
    expect(buildStats([], { period: "year", from: day(1), to: day(30) }).trend).toHaveLength(12);
  });
});
