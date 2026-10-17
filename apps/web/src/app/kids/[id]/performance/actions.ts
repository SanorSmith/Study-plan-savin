"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { kids } from "@/db/schema";
import { requireParent } from "@/lib/auth";
import { statsFor, PERIODS, type Period } from "@/lib/performance";
import { AssessmentError, assessKid, saveReport } from "@/lib/performance-ai";
import { ASSESS_LIMIT, rateLimit } from "@/lib/rate-limit";

export type AssessState = { error?: string; ok?: boolean } | null;

/** "Assess performance with AI": reads the kid's numbers for the period, saves the assessment. */
export async function assessPerformance(kidId: string, period: string): Promise<AssessState> {
  const parent = await requireParent();
  if (!PERIODS.includes(period as Period)) return { error: "Choose week, month or year" };
  const [kid] = await getDb().select().from(kids).where(and(eq(kids.id, kidId), eq(kids.parentId, parent.id)));
  if (!kid) return { error: "Kid not found" };
  const limit = await rateLimit(`assess:${parent.id}`, ASSESS_LIMIT);
  if (!limit.allowed) return { error: "Too many assessments just now. Try again in a while." };

  const stats = await statsFor(kid.id, period as Period);
  if (stats.totals.attempts === 0) return { error: "There are no answers in this period yet, so there is nothing to assess." };
  try {
    await saveReport(kid.id, stats, await assessKid(kid, stats));
  } catch (e) {
    if (e instanceof AssessmentError) return { error: e.message };
    throw e;
  }
  revalidatePath(`/kids/${kidId}/performance`);
  return { ok: true };
}
