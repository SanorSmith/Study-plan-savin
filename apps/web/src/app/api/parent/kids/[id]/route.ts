import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { devices, kids, scheduleRules } from "@/db/schema";
import { BonusInput } from "@/lib/bonus-input";
import { KidInput, PinInput } from "@/lib/kid-input";
import { APPROVAL_MINUTES, balanceOf, grantBonus, setApproval, withdrawMinutes } from "@/lib/kid-service";
import { generatePairingCode, pairingExpiry } from "@/lib/pairing";
import { getParentApp } from "@/lib/parent-device";
import { kidDetail, ownedKidOf } from "@/lib/parent-kid";
import { hashPin } from "@/lib/pin";
import { ScheduleInput } from "@/lib/schedule-input";
import { WithdrawInput } from "@/lib/withdraw-input";

const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("bonus"), minutes: z.unknown() }),
  z.object({ action: z.literal("withdraw"), minutes: z.unknown() }),
  z.object({ action: z.literal("reset") }),
  z.object({ action: z.literal("ai"), enabled: z.boolean() }),
  z.object({ action: z.literal("allow_settings") }),
  z.object({ action: z.literal("block_settings") }),
  z.object({ action: z.literal("update"), profile: z.unknown(), pin: z.string().optional() }),
  z.object({ action: z.literal("add_rule"), mode: z.unknown(), days: z.unknown(), start: z.unknown(), end: z.unknown() }),
  z.object({ action: z.literal("delete_rule"), ruleId: z.uuid() }),
  z.object({ action: z.literal("pair_phone") }),
]);

const bad = (message: string) => Response.json({ error: message }, { status: 400 });

/** A kid's page in the parent app: profile, bank, schedule, phones and homework results. */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const parent = await getParentApp();
  if (!parent) return Response.json({ error: "sign in required" }, { status: 401 });
  const id = z.uuid().safeParse((await context.params).id);
  const kid = id.success ? await ownedKidOf(parent.id, id.data) : null;
  if (!kid) return Response.json({ error: "not found" }, { status: 404 });
  return Response.json(await kidDetail(kid), { headers: { "cache-control": "no-store" } });
}

/** What a parent can do to a kid from the app: bonus, withdraw, bank, AI checking, Settings approval, profile, schedule, phones. */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const parent = await getParentApp();
  if (!parent) return Response.json({ error: "sign in required" }, { status: 401 });
  const id = z.uuid().safeParse((await context.params).id);
  const body = Body.safeParse(await request.json().catch(() => null));
  if (!id.success || !body.success) return bad("bad request");

  const [kid] = await getDb().select({ id: kids.id }).from(kids).where(and(eq(kids.id, id.data), eq(kids.parentId, parent.id)));
  if (!kid) return Response.json({ error: "not found" }, { status: 404 });

  const db = getDb();
  const b = body.data;
  let changed = 0;
  let code: string | undefined;
  if (b.action === "bonus") {
    const input = BonusInput.safeParse({ minutes: b.minutes });
    if (!input.success) return bad(input.error.issues[0].message);
    await grantBonus(kid.id, input.data.minutes);
    changed = input.data.minutes;
  } else if (b.action === "withdraw") {
    const input = WithdrawInput.safeParse({ minutes: b.minutes });
    if (!input.success) return bad(input.error.issues[0].message);
    changed = await withdrawMinutes(kid.id, input.data.minutes);
  } else if (b.action === "reset") {
    changed = await withdrawMinutes(kid.id, null);
  } else if (b.action === "ai") {
    await db.update(kids).set({ aiCheckEnabled: b.enabled }).where(eq(kids.id, kid.id));
  } else if (b.action === "allow_settings") {
    await setApproval(kid.id, APPROVAL_MINUTES);
  } else if (b.action === "block_settings") {
    await setApproval(kid.id, null);
  } else if (b.action === "update") {
    const profile = KidInput.safeParse(b.profile);
    if (!profile.success) return bad(profile.error.issues[0].message);
    let pinHash: string | undefined;
    if (b.pin) {
      const pin = PinInput.safeParse(b.pin);
      if (!pin.success) return bad(pin.error.issues[0].message);
      pinHash = await hashPin(pin.data);
    }
    await db
      .update(kids)
      .set({ ...profile.data, ...(pinHash ? { pinHash, pinFailedAttempts: 0, pinLockedUntil: null } : {}) })
      .where(eq(kids.id, kid.id));
  } else if (b.action === "add_rule") {
    const rule = ScheduleInput.safeParse({ mode: b.mode, days: b.days, start: b.start, end: b.end });
    if (!rule.success) return bad(rule.error.issues[0].message);
    await db.insert(scheduleRules).values({ kidId: kid.id, ...rule.data });
  } else if (b.action === "delete_rule") {
    await db.delete(scheduleRules).where(and(eq(scheduleRules.id, b.ruleId), eq(scheduleRules.kidId, kid.id)));
  } else {
    code = generatePairingCode();
    await db.insert(devices).values({ kidId: kid.id, platform: "android", pairingCode: code, pairingExpiresAt: pairingExpiry(new Date()) });
  }
  return Response.json({ ok: true, changedMinutes: changed, balanceMinutes: await balanceOf(kid.id), code });
}
