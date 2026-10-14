import { describe, expect, it } from "vitest";
import { WithdrawInput } from "./withdraw-input";

describe("WithdrawInput", () => {
  it("accepts whole minutes from form strings", () => {
    expect(WithdrawInput.parse({ minutes: "20" })).toEqual({ minutes: 20 });
  });

  it("rejects zero, negative, fractional and non-numeric values", () => {
    for (const minutes of ["0", "-5", "1.5", "abc", ""]) {
      expect(WithdrawInput.safeParse({ minutes }).success, minutes).toBe(false);
    }
  });
});
