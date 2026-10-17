import { describe, expect, it } from "vitest";
import { cleanPractice, practicePrompt } from "./practice-ai";
import type { Stats } from "./performance";

const stats = {
  period: "month",
  from: "2026-09-15T00:00:00.000Z",
  to: "2026-10-15T00:00:00.000Z",
  totals: { questions: 2, solved: 1, firstTry: 0, failed: 1, attempts: 5, accuracy: 20, firstTryRate: 0, earnedMinutes: 5, papersChecked: 0 },
  subjects: [{ subject: "Math", questions: 2, solved: 1, firstTry: 0, failed: 1, attempts: 5, accuracy: 20, firstTryRate: 0 }],
  trend: [],
  hardest: [{ text: "What is 3/4 + 1/4?", subject: "Math", answerKey: "1", tries: 3, solved: false, wrongAnswers: ["4/8"] }],
} as Stats;

const num = (text: string, key: string) => ({ text, type: "numeric", options: null, answerKey: key });

describe("cleanPractice", () => {
  it("keeps valid questions and drops invalid ones", () => {
    const set = cleanPractice(
      { subject: "Practice: fractions", questions: [num("What is 1/2 + 1/2?", "1"), num("Bad key", "abc"), { text: "Pick", type: "multiple_choice", options: ["a", "b"], answerKey: "z" }, { text: "Pick one", type: "multiple_choice", options: ["a", "b"], answerKey: "b" }] },
      [],
      5,
    );
    expect(set.questions.map((q) => q.text)).toEqual(["What is 1/2 + 1/2?", "Pick one"]);
    expect(set.subject).toBe("Practice: fractions");
  });

  it("drops copies of questions the kid already had, and repeats", () => {
    const set = cleanPractice({ subject: "P", questions: [num("what is 3/4 + 1/4?", "1"), num("What is 2/4 + 2/4?", "1"), num("What is 2/4 + 2/4?", "1")] }, ["What is 3/4 + 1/4?"], 5);
    expect(set.questions.map((q) => q.text)).toEqual(["What is 2/4 + 2/4?"]);
  });

  it("stops at the number asked for", () => {
    const many = Array.from({ length: 8 }, (_, i) => num(`Q${i}`, String(i)));
    expect(cleanPractice({ subject: "P", questions: many }, [], 3).questions).toHaveLength(3);
  });

  it("fails when nothing usable is left", () => {
    expect(() => cleanPractice({ subject: "P", questions: [num("x", "nope")] }, [], 5)).toThrow();
  });

  it("falls back to a plain subject name", () => {
    expect(cleanPractice({ subject: "  ", questions: [num("Q", "1")] }, [], 3).subject).toBe("Practice");
  });
});

describe("practicePrompt", () => {
  it("includes the hard question, the wrong answer, the grade and the parent's focus", () => {
    const p = practicePrompt({ name: "Mia", grade: 4 }, stats, 5, ["adding fractions with different denominators"]);
    expect(p).toContain("3/4 + 1/4");
    expect(p).toContain("4/8");
    expect(p).toContain("grade 4");
    expect(p).toContain("adding fractions with different denominators");
    expect(p).toContain("Make 5 NEW");
  });
});
