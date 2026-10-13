import { describe, expect, it } from "vitest";
import { QuestionInput } from "./homework-input";

describe("QuestionInput", () => {
  it("accepts a multiple choice answer that is one of the options", () => {
    const r = QuestionInput.safeParse({ text: "q", type: "multiple_choice", options: ["a", "b"], answerKey: "b" });
    expect(r.success).toBe(true);
  });

  it("rejects a multiple choice key outside the options", () => {
    const r = QuestionInput.safeParse({ text: "q", type: "multiple_choice", options: ["a", "b"], answerKey: "c" });
    expect(r.success).toBe(false);
  });

  it("rejects a non-numeric key for numeric questions", () => {
    const r = QuestionInput.safeParse({ text: "q", type: "numeric", options: null, answerKey: "abc" });
    expect(r.success).toBe(false);
  });

  it("accepts a decimal comma for numeric questions", () => {
    const r = QuestionInput.safeParse({ text: "q", type: "numeric", options: null, answerKey: "3,5" });
    expect(r.success).toBe(true);
  });
});
