"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { kids } from "@/db/schema";
import { requireParent } from "@/lib/auth";
import { HomeworkInput } from "@/lib/homework-input";
import { PERIODS, statsFor, type Period } from "@/lib/performance";
import { generatePractice, PracticeError, type PracticeSet } from "@/lib/practice-ai";
import { AUTO_MODES, retryMissed, sendPractice, setPracticeStatus, type AutoMode } from "@/lib/practice-service";
import { ASSESS_LIMIT, rateLimit } from "@/lib/rate-limit";

async function ownedKid(kidId: string) {
  const parent = await requireParent();
  const [kid] = await getDb().select().from(kids).where(and(eq(kids.id, kidId), eq(kids.parentId, parent.id)));
  if (!kid) throw new Error("kid not found");
  return { parent, kid };
}

export type MadePractice = { error?: string; set?: PracticeSet } | null;

/** The AI makes practice questions from what the kid found hard. Nothing is sent yet; the parent edits first. */
export async function makePractice(kidId: string, period: string, count: number, focus: string): Promise<MadePractice> {
  const { parent, kid } = await ownedKid(kidId);
  if (!PERIODS.includes(period as Period)) return { error: "Choose week, month or year" };
  const limit = await rateLimit(`assess:${parent.id}`, ASSESS_LIMIT);
  if (!limit.allowed) return { error: "Too many requests just now. Try again in a while." };
  try {
    const stats = await statsFor(kid.id, period as Period);
    const topics = focus.split(/[,\n]/).map((t) => t.trim()).filter(Boolean);
    return { set: await generatePractice(kid, stats, { count, focus: topics }) };
  } catch (e) {
    if (e instanceof PracticeError) return { error: e.message };
    throw e;
  }
}

/** The parent sends the (edited) practice set to the kid. */
export async function sendPracticeSet(kidId: string, set: PracticeSet): Promise<{ error?: string; ok?: boolean }> {
  const { kid } = await ownedKid(kidId);
  const input = HomeworkInput.safeParse({ subject: set.subject, questions: set.questions });
  if (!input.success) return { error: input.error.issues[0].message };
  await sendPractice(kid.id, input.data);
  revalidatePath(`/kids/${kidId}`);
  return { ok: true };
}

/** Turns automatic practice on or off for a kid, and how many questions each set has. */
export async function setAutoPractice(kidId: string, form: FormData) {
  const { kid } = await ownedKid(kidId);
  const mode = String(form.get("mode") ?? "off") as AutoMode;
  const size = Math.min(10, Math.max(3, Number(form.get("size")) || 5));
  if (!AUTO_MODES.includes(mode)) return;
  await getDb().update(kids).set({ autoPractice: mode, autoPracticeSize: size }).where(eq(kids.id, kid.id));
  revalidatePath(`/kids/${kidId}/practice`);
}

/** Puts the questions the kid ran out of tries on back as a fresh set. */
export async function retryMissedQuestions(kidId: string): Promise<{ error?: string; count?: number }> {
  const { kid } = await ownedKid(kidId);
  const count = await retryMissed(kid.id);
  if (count === 0) return { error: "There are no missed questions to try again." };
  revalidatePath(`/kids/${kidId}`);
  return { count };
}

/** Pulls a practice set back from the kid (nothing is deleted), or puts it back. */
export async function changePracticeSet(kidId: string, setId: string, status: "assigned" | "withdrawn") {
  const { kid } = await ownedKid(kidId);
  await setPracticeStatus(kid.id, setId, status);
  revalidatePath(`/kids/${kidId}/practice`);
  revalidatePath(`/kids/${kidId}`);
}
