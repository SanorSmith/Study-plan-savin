import { describe, expect, it } from "vitest";
import { questionTitle } from "./question-title";

describe("questionTitle", () => {
  it("uses the number from the sheet", () => {
    expect(questionTitle("3", 1)).toBe("Question 3");
    expect(questionTitle("4b", 7)).toBe("Question 4b");
  });
  it("keeps wording the sheet printed", () => {
    expect(questionTitle("Exercise 2", 1)).toBe("Exercise 2");
  });
  it("falls back to the place in the homework", () => {
    expect(questionTitle(null, 5)).toBe("Question 5");
    expect(questionTitle("  ", 2)).toBe("Question 2");
  });
});
