import { describe, expect, it } from "vitest";
import { hashPin, isLocked, nextFailureState, verifyPin } from "./pin";

describe("pin", () => {
  it("verifies the right PIN and rejects the wrong one", async () => {
    const stored = await hashPin("1234");
    expect(await verifyPin("1234", stored)).toBe(true);
    expect(await verifyPin("1235", stored)).toBe(false);
  });

  it("salts each hash", async () => {
    expect(await hashPin("1234")).not.toBe(await hashPin("1234"));
  });

  it("rejects malformed PINs and stored values", async () => {
    await expect(hashPin("12")).rejects.toThrow();
    expect(await verifyPin("1234", "garbage")).toBe(false);
  });

  it("locks after 5 failures", () => {
    const now = new Date("2026-01-01T00:00:00Z");
    expect(nextFailureState(3, now)).toEqual({ failedAttempts: 4, lockedUntil: null });
    const locked = nextFailureState(4, now);
    expect(locked.lockedUntil?.getTime()).toBe(now.getTime() + 5 * 60_000);
    expect(isLocked(locked.lockedUntil, now)).toBe(true);
    expect(isLocked(locked.lockedUntil, new Date(now.getTime() + 6 * 60_000))).toBe(false);
  });
});
