import { describe, expect, it } from "vitest";
import { questionStatus } from "./question-status";

describe("questionStatus", () => {
  it("is not_tried with no attempts", () => {
    expect(questionStatus([])).toBe("not_tried");
  });

  it("is in_progress after a wrong answer with tries left", () => {
    expect(questionStatus([{ correct: false }])).toBe("in_progress");
  });

  it("is solved once any attempt is correct", () => {
    expect(questionStatus([{ correct: false }, { correct: true }])).toBe("solved");
  });

  it("is failed after three wrong answers", () => {
    expect(questionStatus([{ correct: false }, { correct: false }, { correct: false }])).toBe("failed");
  });
});
