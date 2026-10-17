"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { devices, kids, scheduleRules } from "@/db/schema";
import { requireParent } from "@/lib/auth";
import { BonusInput } from "@/lib/bonus-input";
import { addKidMessage, MAX_NOTE } from "@/lib/messages";
import { KidInput, PinInput } from "@/lib/kid-input";
import { APPROVAL_MINUTES, grantBonus, setApproval, withdrawMinutes } from "@/lib/kid-service";
import { generatePairingCode, pairingExpiry } from "@/lib/pairing";
import { hashPin } from "@/lib/pin";
import { daysMask, ScheduleInput } from "@/lib/schedule-input";
import { WithdrawInput } from "@/lib/withdraw-input";

const fields = (form: FormData) => ({
  name: form.get("name"),
  grade: form.get("grade"),
  minutesPerQuestion: form.get("minutesPerQuestion"),
  dailyCapMinutes: form.get("dailyCapMinutes"),
  uiStyle: form.get("uiStyle") ?? "auto",
});

async function pinHashFrom(form: FormData): Promise<string | undefined> {
  const raw = String(form.get("pin") ?? "");
  if (raw === "") return undefined;
  return hashPin(PinInput.parse(raw));
}

export async function createKid(form: FormData) {
  const parent = await requireParent();
  const input = KidInput.parse(fields(form));
  const pinHash = await pinHashFrom(form);
  const [kid] = await getDb()
    .insert(kids)
    .values({ ...input, parentId: parent.id, pinHash })
    .returning({ id: kids.id });
  redirect(`/kids/${kid.id}`);
}

export async function updateKid(kidId: string, form: FormData) {
  const parent = await requireParent();
  const input = KidInput.parse(fields(form));
  const pinHash = await pinHashFrom(form);
  await getDb()
    .update(kids)
    .set({
      ...input,
      ...(pinHash ? { pinHash, pinFailedAttempts: 0, pinLockedUntil: null } : {}),
    })
    .where(and(eq(kids.id, kidId), eq(kids.parentId, parent.id)));
  revalidatePath(`/kids/${kidId}`);
  revalidatePath("/dashboard");
}

export async function createPairingCode(kidId: string, form: FormData) {
  const parent = await requireParent();
  const platform = String(form.get("platform") ?? "android");
  if (!["android", "ios", "web"].includes(platform)) throw new Error("bad platform");

  const db = getDb();
  const [kid] = await db
    .select({ id: kids.id })
    .from(kids)
    .where(and(eq(kids.id, kidId), eq(kids.parentId, parent.id)));
  if (!kid) throw new Error("kid not found");

  await db.insert(devices).values({
    kidId: kid.id,
    platform,
    pairingCode: generatePairingCode(),
    pairingExpiresAt: pairingExpiry(new Date()),
  });
  revalidatePath(`/kids/${kidId}`);
}

/** Parent gives bonus screen time without any homework. */
export async function giveBonus(kidId: string, form: FormData) {
  const parent = await requireParent();
  const input = BonusInput.parse({ minutes: form.get("minutes") });

  const [kid] = await getDb()
    .select({ id: kids.id })
    .from(kids)
    .where(and(eq(kids.id, kidId), eq(kids.parentId, parent.id)));
  if (!kid) throw new Error("kid not found");

  await grantBonus(kid.id, input.minutes);
  revalidatePath(`/kids/${kidId}`);
  revalidatePath("/dashboard");
}

async function ownedKid(kidId: string) {
  const parent = await requireParent();
  const [kid] = await getDb()
    .select({ id: kids.id })
    .from(kids)
    .where(and(eq(kids.id, kidId), eq(kids.parentId, parent.id)));
  if (!kid) throw new Error("kid not found");
  return kid;
}

/** Adds a locked ("blocked") or free time window for a kid. */
export async function addScheduleRule(kidId: string, form: FormData) {
  const kid = await ownedKid(kidId);
  const input = ScheduleInput.parse({
    mode: form.get("mode"),
    days: daysMask(form.getAll("day").map(String)),
    start: form.get("start"),
    end: form.get("end"),
  });
  await getDb().insert(scheduleRules).values({ kidId: kid.id, ...input });
  revalidatePath(`/kids/${kidId}`);
}

export async function deleteScheduleRule(kidId: string, ruleId: string) {
  const kid = await ownedKid(kidId);
  await getDb()
    .delete(scheduleRules)
    .where(and(eq(scheduleRules.id, ruleId), eq(scheduleRules.kidId, kid.id)));
  revalidatePath(`/kids/${kidId}`);
}

/** Parent lets the kid's phone open Settings and uninstall screens for a few minutes. */
export async function grantApproval(kidId: string) {
  const kid = await ownedKid(kidId);
  await setApproval(kid.id, APPROVAL_MINUTES);
  revalidatePath(`/kids/${kidId}`);
}

export async function revokeApproval(kidId: string) {
  const kid = await ownedKid(kidId);
  await setApproval(kid.id, null);
  revalidatePath(`/kids/${kidId}`);
}

/** Parent takes a number of minutes out of the bank (never below zero). */
export async function withdrawFromBank(kidId: string, form: FormData) {
  const kid = await ownedKid(kidId);
  const input = WithdrawInput.parse({ minutes: form.get("minutes") });
  await withdrawMinutes(kid.id, input.minutes);
  revalidatePath(`/kids/${kidId}`);
  revalidatePath("/dashboard");
}

/** Parent empties the bank. */
export async function resetBank(kidId: string) {
  const kid = await ownedKid(kidId);
  await withdrawMinutes(kid.id, null);
  revalidatePath(`/kids/${kidId}`);
  revalidatePath("/dashboard");
}

/** Parent turns AI paper checking on or off for a kid. Off means every paper is checked by a parent. */
export async function setAiCheck(kidId: string, enabled: boolean) {
  const kid = await ownedKid(kidId);
  await getDb().update(kids).set({ aiCheckEnabled: enabled }).where(eq(kids.id, kid.id));
  revalidatePath(`/kids/${kidId}`);
}

/** Parent sends the kid a short message; the kid sees it in their app. */
export async function sendKidMessage(kidId: string, form: FormData) {
  const kid = await ownedKid(kidId);
  const text = String(form.get("text") ?? "").slice(0, MAX_NOTE);
  await addKidMessage(kid.id, "note", text);
  revalidatePath(`/kids/${kidId}`);
}
