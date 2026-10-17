"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb } from "@/db";
import { kids, paperSubmissions } from "@/db/schema";
import { requireParent } from "@/lib/auth";
import { MAX_NOTE, sendPaperResult } from "@/lib/messages";
import { gradePaper, PaperGradingError } from "@/lib/paper-grading";
import { applyAiResults, approveSubmission, imagesOf, questionsForSet, rejectSubmission } from "@/lib/paper-service";
import { PAPER_LIMIT } from "@/lib/paper-intake";
import { rateLimit } from "@/lib/rate-limit";

async function ownedKid(kidId: string) {
  const parent = await requireParent();
  const [kid] = await getDb()
    .select()
    .from(kids)
    .where(and(eq(kids.id, kidId), eq(kids.parentId, parent.id)));
  if (!kid) throw new Error("kid not found");
  return kid;
}

const SubmissionId = z.uuid();

/** The parent confirms the paper; every question ticked "counts as correct" earns minutes. */
export async function approvePaper(kidId: string, submissionId: string, form: FormData) {
  const kid = await ownedKid(kidId);
  const id = SubmissionId.parse(submissionId);
  const correctIds = new Set(form.getAll("correct").map(String));
  const result = await approveSubmission(kid, id, correctIds);
  if (result) await sendPaperResult(kid.id, id, { correct: result.correctCount, total: result.total, minutes: result.awardedMinutes }, String(form.get("note") ?? "").slice(0, MAX_NOTE));
  revalidatePath(`/kids/${kidId}`);
  revalidatePath("/dashboard");
  const params = new URLSearchParams(result ? { awarded: String(result.awardedMinutes), correct: String(result.correctCount) } : {});
  redirect(`/kids/${kidId}/papers/${id}?${params}`);
}

export async function rejectPaper(kidId: string, submissionId: string, form: FormData) {
  const kid = await ownedKid(kidId);
  const id = SubmissionId.parse(submissionId);
  if (await rejectSubmission(kid.id, id)) await sendPaperResult(kid.id, id, "sent_back", String(form.get("note") ?? "").slice(0, MAX_NOTE));
  revalidatePath(`/kids/${kidId}`);
  revalidatePath("/dashboard");
  redirect(`/kids/${kidId}`);
}

export type AiHelpState = { error?: string } | null;

/** The parent asks the AI to read the stored photos and suggest which answers are right. Only then are the photos sent to the AI. */
export async function readPaperWithAi(kidId: string, submissionId: string): Promise<AiHelpState> {
  const kid = await ownedKid(kidId);
  const id = SubmissionId.parse(submissionId);
  const limit = await rateLimit(`paper:${kid.parentId}`, PAPER_LIMIT);
  if (!limit.allowed) return { error: "Too many requests. Try again later." };

  const [submission] = await getDb()
    .select({ setId: paperSubmissions.setId })
    .from(paperSubmissions)
    .where(and(eq(paperSubmissions.id, id), eq(paperSubmissions.kidId, kid.id), eq(paperSubmissions.status, "pending")));
  if (!submission) return { error: "This paper is not waiting for review" };

  const images = await imagesOf(id);
  if (images.length === 0) return { error: "The photos were deleted, so the AI cannot read them" };
  try {
    const results = await gradePaper(images, await questionsForSet(submission.setId));
    await applyAiResults(id, kid.id, results);
  } catch (e) {
    if (e instanceof PaperGradingError) return { error: e.message };
    throw e;
  }
  revalidatePath(`/kids/${kidId}/papers/${id}`);
  return null;
}
