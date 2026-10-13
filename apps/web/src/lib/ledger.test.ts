import { describe, expect, it } from "vitest";
import { earnableToday, MAX_ATTEMPTS, minutesForAttempt } from "./ledger";

describe("minutesForAttempt", () => {
  it("pays full minutes on the first try", () => {
    expect(minutesForAttempt(10, 0)).toBe(10);
  });

  it("pays half, rounded up, on retries", () => {
    expect(minutesForAttempt(10, 1)).toBe(5);
    expect(minutesForAttempt(7, 2)).toBe(4);
  });

  it("allows three tries", () => {
    expect(MAX_ATTEMPTS).toBe(3);
  });
});

describe("earnableToday", () => {
  it("is limited by the remaining daily cap", () => {
    expect(earnableToday(20, 10, 25)).toBe(5);
    expect(earnableToday(25, 10, 25)).toBe(0);
  });
});
