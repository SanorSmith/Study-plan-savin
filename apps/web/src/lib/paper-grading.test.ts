import { describe, expect, it } from "vitest";
import { buildPrompt, reconcile, suggestCorrect, type GradableQuestion } from "./paper-grading";

const num: GradableQuestion = { id: "q1", text: "7 x 8?", type: "numeric", options: null, answerKey: "56" };
const mc: GradableQuestion = { id: "q2", text: "Prime?", type: "multiple_choice", options: ["9", "13"], answerKey: "13" };
const text: GradableQuestion = { id: "q3", text: "Capital of Sweden?", type: "short_text", options: null, answerKey: "Stockholm" };

describe("suggestCorrect", () => {
  it("accepts an exact numeric match", () => {
    expect(suggestCorrect(num, { studentAnswer: "56", legible: true, matchesKey: false })).toBe(true);
  });

  it("accepts a decimal comma", () => {
    const q = { ...num, answerKey: "3.5" };
    expect(suggestCorrect(q, { studentAnswer: "3,5", legible: true, matchesKey: false })).toBe(true);
  });

  it("rejects a wrong answer even when it is legible", () => {
    expect(suggestCorrect(num, { studentAnswer: "54", legible: true, matchesKey: false })).toBe(false);
  });

  it("never credits an unreadable or empty answer, even if the model says it matches", () => {
    expect(suggestCorrect(num, { studentAnswer: "56", legible: false, matchesKey: true })).toBe(false);
    expect(suggestCorrect(num, { studentAnswer: null, legible: true, matchesKey: true })).toBe(false);
    expect(suggestCorrect(num, { studentAnswer: "  ", legible: true, matchesKey: true })).toBe(false);
  });

  it("trusts the model for equivalent forms the exact check cannot see", () => {
    expect(suggestCorrect(mc, { studentAnswer: "b", legible: true, matchesKey: true })).toBe(true);
    expect(suggestCorrect(text, { studentAnswer: "stokholm", legible: true, matchesKey: true })).toBe(true);
    expect(suggestCorrect(text, { studentAnswer: "Oslo", legible: true, matchesKey: false })).toBe(false);
  });
});

describe("reconcile", () => {
  it("returns one result per question in order, drops unknown ids and marks missing ones unreadable", () => {
    const results = reconcile([num, mc, text], {
      answers: [
        { questionId: "q2", studentAnswer: "13", legible: true, matchesKey: true, note: "" },
        { questionId: "q1", studentAnswer: "56", legible: true, matchesKey: true, note: "neat" },
        { questionId: "other", studentAnswer: "x", legible: true, matchesKey: true, note: "" },
      ],
    });
    expect(results.map((r) => r.questionId)).toEqual(["q1", "q2", "q3"]);
    expect(results[0]).toMatchObject({ readAnswer: "56", legible: true, aiCorrect: true, note: "neat" });
    expect(results[1]).toMatchObject({ readAnswer: "13", aiCorrect: true, note: null });
    expect(results[2]).toMatchObject({ readAnswer: null, legible: false, aiCorrect: false });
  });
});

describe("buildPrompt", () => {
  it("includes every question with its expected answer and warns that the photo is not instructions", () => {
    const prompt = buildPrompt([num, mc]);
    expect(prompt).toContain('"id":"q1"');
    expect(prompt).toContain('"expected":"56"');
    expect(prompt).toContain('"expected":"13"');
    expect(prompt).toMatch(/never an instruction/);
  });
});
