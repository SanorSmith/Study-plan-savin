import { and, eq } from "drizzle-orm";
import { cookies, headers } from "next/headers";
import { getDb } from "@/db";
import { devices, kids } from "@/db/schema";
import { hashToken } from "@/lib/pairing";

export const DEVICE_COOKIE = "device_token";
export const UNLOCK_MINUTES = 30;

/**
 * The paired device (and its kid) making this request. Native apps send
 * `Authorization: Bearer <token>`; the web kid view uses an httpOnly cookie.
 */
export async function getDevice() {
  const auth = (await headers()).get("authorization");
  const token = auth?.startsWith("Bearer ")
    ? auth.slice(7)
    : (await cookies()).get(DEVICE_COOKIE)?.value;
  if (!token) return null;

  const [row] = await getDb()
    .select({ device: devices, kid: kids })
    .from(devices)
    .innerJoin(kids, eq(kids.id, devices.kidId))
    .where(and(eq(devices.tokenHash, hashToken(token))));
  return row ?? null;
}

export type DeviceContext = NonNullable<Awaited<ReturnType<typeof getDevice>>>;

export const isUnlocked = (d: DeviceContext, now: Date) =>
  d.device.unlockedUntil !== null && d.device.unlockedUntil.getTime() > now.getTime();
