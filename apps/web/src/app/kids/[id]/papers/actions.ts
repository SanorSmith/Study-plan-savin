"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb } from "@/db";
import { kids } from "@/db/schema";
import { requireParent } from "@/lib/auth";
import { approveSubmission, rejectSubmission } from "@/lib/paper-service";

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
  revalidatePath(`/kids/${kidId}`);
  revalidatePath("/dashboard");
  const params = new URLSearchParams(result ? { awarded: String(result.awardedMinutes), correct: String(result.correctCount) } : {});
  redirect(`/kids/${kidId}/papers/${id}?${params}`);
}

export async function rejectPaper(kidId: string, submissionId: string) {
  const kid = await ownedKid(kidId);
  await rejectSubmission(kid.id, SubmissionId.parse(submissionId));
  revalidatePath(`/kids/${kidId}`);
  revalidatePath("/dashboard");
  redirect(`/kids/${kidId}`);
}
