import { createHash, randomBytes, randomInt } from "node:crypto";

// No 0/O/1/I so codes are easy to read and type on a child's device.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const PAIRING_CODE_LENGTH = 8;
export const PAIRING_TTL_MINUTES = 15;

export function generatePairingCode(): string {
  let code = "";
  for (let i = 0; i < PAIRING_CODE_LENGTH; i++) {
    code += ALPHABET[randomInt(ALPHABET.length)];
  }
  return code;
}

export const pairingExpiry = (now: Date) =>
  new Date(now.getTime() + PAIRING_TTL_MINUTES * 60_000);

export const isPairingValid = (expiresAt: Date | null, now: Date) =>
  expiresAt !== null && expiresAt.getTime() > now.getTime();

export function generateDeviceToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, tokenHash: hashToken(token) };
}

export const hashToken = (token: string) =>
  createHash("sha256").update(token).digest("hex");
