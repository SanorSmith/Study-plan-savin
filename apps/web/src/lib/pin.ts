import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: Buffer,
  keylen: number,
) => Promise<Buffer>;

const KEY_LEN = 32;
export const MAX_PIN_ATTEMPTS = 5;
export const LOCKOUT_MINUTES = 5;

export const isValidPin = (pin: string) => /^\d{4}$/.test(pin);

/** Returns "salt:hash" (hex). */
export async function hashPin(pin: string): Promise<string> {
  if (!isValidPin(pin)) throw new Error("PIN must be 4 digits");
  const salt = randomBytes(16);
  const hash = await scryptAsync(pin, salt, KEY_LEN);
  return `${salt.toString("hex")}:${hash.toString("hex")}`;
}

export async function verifyPin(pin: string, stored: string): Promise<boolean> {
  const [saltHex, hashHex] = stored.split(":");
  if (!saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, "hex");
  const actual = await scryptAsync(pin, Buffer.from(saltHex, "hex"), expected.length);
  return timingSafeEqual(actual, expected);
}

/** Lockout state after a failed attempt. */
export function nextFailureState(failedAttempts: number, now: Date) {
  const attempts = failedAttempts + 1;
  if (attempts >= MAX_PIN_ATTEMPTS) {
    return {
      failedAttempts: 0,
      lockedUntil: new Date(now.getTime() + LOCKOUT_MINUTES * 60_000),
    };
  }
  return { failedAttempts: attempts, lockedUntil: null };
}

export const isLocked = (lockedUntil: Date | null, now: Date) =>
  lockedUntil !== null && lockedUntil.getTime() > now.getTime();
