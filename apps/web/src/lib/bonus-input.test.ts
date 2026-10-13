import { describe, expect, it } from "vitest";
import { BonusInput } from "./bonus-input";

describe("BonusInput", () => {
  it("accepts whole minutes from form strings", () => {
    expect(BonusInput.parse({ minutes: "15", startNow: false })).toEqual({ minutes: 15, startNow: false });
  });

  it("rejects zero, negative, fractional and huge values", () => {
    for (const minutes of ["0", "-5", "1.5", "241", "abc", ""]) {
      expect(BonusInput.safeParse({ minutes, startNow: false }).success, minutes).toBe(false);
    }
  });
});
