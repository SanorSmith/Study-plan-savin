import { and, eq, sql } from "drizzle-orm";
import { headers } from "next/headers";
import { getDb } from "@/db";
import { parentDevices, parents } from "@/db/schema";
import { generateDeviceToken, generatePairingCode, hashToken, isPairingValid, pairingExpiry } from "@/lib/pairing";

/** Makes a one-time code a parent types into the parent app (made on the website, signed in). */
export async function createParentAppCode(parentId: string) {
  const code = generatePairingCode();
  await getDb().insert(parentDevices).values({ parentId, pairingCode: code, pairingExpiresAt: pairingExpiry(new Date()) });
  return code;
}

/** Swaps the code for a token (shown to the phone once). A code works once, even if two requests race. */
export async function pairParentApp(rawCode: string, name: string | null) {
  const code = rawCode.trim().toUpperCase();
  const db = getDb();
  const [row] = await db.select().from(parentDevices).where(eq(parentDevices.pairingCode, code));
  if (!row || row.tokenHash || !isPairingValid(row.pairingExpiresAt, new Date())) return null;
  const { token, tokenHash } = generateDeviceToken();
  const claimed = await db
    .update(parentDevices)
    .set({ tokenHash, pairingCode: null, pairingExpiresAt: null, name: name?.slice(0, 60) || null, lastSeenAt: new Date() })
    .where(and(eq(parentDevices.id, row.id), sql`${parentDevices.tokenHash} is null`))
    .returning({ id: parentDevices.id });
  return claimed.length === 1 ? token : null;
}

/** The parent making a request from the parent app (`Authorization: Bearer <token>`), or null. */
export async function getParentApp() {
  const auth = (await headers()).get("authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  const db = getDb();
  const [row] = await db
    .select({ parent: parents, deviceId: parentDevices.id })
    .from(parentDevices)
    .innerJoin(parents, eq(parents.id, parentDevices.parentId))
    .where(eq(parentDevices.tokenHash, hashToken(auth.slice(7))));
  if (!row) return null;
  await db.update(parentDevices).set({ lastSeenAt: new Date() }).where(eq(parentDevices.id, row.deviceId));
  return row.parent;
}

export async function revokeParentApp(parentId: string, deviceId: string) {
  await getDb().delete(parentDevices).where(and(eq(parentDevices.id, deviceId), eq(parentDevices.parentId, parentId)));
}
