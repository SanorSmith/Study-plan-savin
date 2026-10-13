import { describe, expect, it } from "vitest";
import { BonusInput } from "./bonus-input";

describe("BonusInput", () => {
  it("accepts whole minutes from form strings", () => {
    expect(BonusInput.parse({ minutes: "15" })).toEqual({ minutes: 15 });
  });

  it("rejects zero, negative, fractional and huge values", () => {
    for (const minutes of ["0", "-5", "1.5", "241", "abc", ""]) {
      expect(BonusInput.safeParse({ minutes }).success, minutes).toBe(false);
    }
  });
});
