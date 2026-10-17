import { describe, expect, it } from "vitest";
import { intervalMs, isDue } from "./practice-service";

const HOUR = 60 * 60 * 1000;
const now = new Date("2026-10-15T14:00:00Z");

describe("automatic practice timing", () => {
  it("off never runs", () => {
    expect(intervalMs("off")).toBeNull();
    expect(isDue("off", null, now)).toBe(false);
  });

  it("runs for a kid who never had practice", () => {
    expect(isDue("daily", null, now)).toBe(true);
  });

  it("daily waits at least 20 hours, so a daily run is never skipped by minutes", () => {
    expect(isDue("daily", new Date(now.getTime() - 23 * HOUR), now)).toBe(true);
    expect(isDue("daily", new Date(now.getTime() - 19 * HOUR), now)).toBe(false);
  });

  it("every other day and weekly wait longer", () => {
    expect(isDue("every_other_day", new Date(now.getTime() - 24 * HOUR), now)).toBe(false);
    expect(isDue("every_other_day", new Date(now.getTime() - 47 * HOUR), now)).toBe(true);
    expect(isDue("weekly", new Date(now.getTime() - 5 * 24 * HOUR), now)).toBe(false);
    expect(isDue("weekly", new Date(now.getTime() - 7 * 24 * HOUR), now)).toBe(true);
  });
});
