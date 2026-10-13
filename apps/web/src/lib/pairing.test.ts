import { describe, expect, it } from "vitest";
import {
  generateDeviceToken,
  generatePairingCode,
  hashToken,
  isPairingValid,
  pairingExpiry,
} from "./pairing";

describe("pairing", () => {
  it("makes 8-char codes without ambiguous characters", () => {
    for (let i = 0; i < 200; i++) {
      expect(generatePairingCode()).toMatch(/^[A-HJ-NP-Z2-9]{8}$/);
    }
  });

  it("expires after the TTL", () => {
    const now = new Date("2026-01-01T00:00:00Z");
    const exp = pairingExpiry(now);
    expect(isPairingValid(exp, now)).toBe(true);
    expect(isPairingValid(exp, new Date(exp.getTime() + 1))).toBe(false);
    expect(isPairingValid(null, now)).toBe(false);
  });

  it("stores only a hash of the device token", () => {
    const { token, tokenHash } = generateDeviceToken();
    expect(tokenHash).toBe(hashToken(token));
    expect(tokenHash).not.toContain(token);
  });
});
