import { describe, expect, it } from "vitest";
import { resultText } from "./messages";

describe("resultText", () => {
  it("tells the score, the minutes and the parent's words", () => {
    expect(resultText({ subject: "Math", correct: 3, total: 4, minutes: 20, note: "Great job!" })).toBe("Math: 3 of 4 right. +20 min. Great job!");
  });

  it("leaves out the minutes when none were added", () => {
    expect(resultText({ subject: "Math", correct: 0, total: 4, minutes: 0 })).toBe("Math: 0 of 4 right.");
  });

  it("trims the note and ignores an empty one", () => {
    expect(resultText({ subject: "Science", correct: 1, total: 1, minutes: 5, note: "  " })).toBe("Science: 1 of 1 right. +5 min.");
    expect(resultText({ subject: "Science", correct: 1, total: 1, minutes: 5, note: "  Nice  " })).toBe("Science: 1 of 1 right. +5 min. Nice");
  });

  it("says when a paper was sent back", () => {
    expect(resultText({ subject: "Math", correct: 0, total: 0, minutes: 0, sentBack: true })).toBe("Math: your parent sent the paper back.");
    expect(resultText({ subject: "Math", correct: 0, total: 0, minutes: 0, sentBack: true, note: "Please redo it" })).toBe("Math: your parent sent the paper back. Please redo it");
  });
});
