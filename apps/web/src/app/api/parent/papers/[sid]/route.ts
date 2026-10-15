import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { kids, paperSubmissions } from "@/db/schema";
import { getParentApp } from "@/lib/parent-device";
import { approveSubmission, rejectSubmission, submissionForReview } from "@/lib/paper-service";

async function ownedPaper(parentId: string, sid: string) {
  const id = z.uuid().safeParse(sid);
  if (!id.success) return null;
  const [row] = await getDb()
    .select({ kid: kids })
    .from(paperSubmissions)
    .innerJoin(kids, eq(kids.id, paperSubmissions.kidId))
    .where(and(eq(paperSubmissions.id, id.data), eq(kids.parentId, parentId)));
  return row ? { kid: row.kid, id: id.data } : null;
}

/** A paper to review: each question with the key, what was read from the paper, and the AI's suggestion. */
export async function GET(_request: Request, context: { params: Promise<{ sid: string }> }) {
  const parent = await getParentApp();
  if (!parent) return Response.json({ error: "sign in required" }, { status: 401 });
  const paper = await ownedPaper(parent.id, (await context.params).sid);
  if (!paper) return Response.json({ error: "not found" }, { status: 404 });
  const review = await submissionForReview(paper.id, paper.kid.id);
  if (!review) return Response.json({ error: "not found" }, { status: 404 });
  const { submission, answers } = review;
  return Response.json(
    {
      id: submission.id,
      kidName: paper.kid.name,
      subject: submission.subject,
      status: submission.status,
      mode: submission.mode,
      aiRead: submission.aiRead,
      autoApproved: submission.autoApproved,
      awardedMinutes: submission.awardedMinutes,
      imageCount: submission.imageCount,
      answers: answers.map((a) => ({
        questionId: a.questionId,
        text: a.text,
        answerKey: a.answerKey,
        readAnswer: a.readAnswer,
        aiCorrect: a.aiCorrect,
        legible: a.legible,
        note: a.note,
        alreadySolved: a.alreadySolved,
        finalCorrect: a.finalCorrect,
      })),
    },
    { headers: { "cache-control": "no-store" } },
  );
}

const Decision = z.object({ decision: z.enum(["approve", "reject"]), correct: z.array(z.uuid()).max(100).default([]) });

/** Approve (the ticked questions count as correct and earn minutes) or reject a paper. */
export async function POST(request: Request, context: { params: Promise<{ sid: string }> }) {
  const parent = await getParentApp();
  if (!parent) return Response.json({ error: "sign in required" }, { status: 401 });
  const paper = await ownedPaper(parent.id, (await context.params).sid);
  const body = Decision.safeParse(await request.json().catch(() => null));
  if (!paper || !body.success) return Response.json({ error: "not found" }, { status: 404 });

  if (body.data.decision === "reject") {
    const ok = await rejectSubmission(paper.kid.id, paper.id);
    return ok ? Response.json({ ok: true }) : Response.json({ error: "This paper was already decided" }, { status: 409 });
  }
  const result = await approveSubmission(paper.kid, paper.id, new Set(body.data.correct));
  if (!result) return Response.json({ error: "This paper was already decided" }, { status: 409 });
  return Response.json({ ok: true, ...result });
}
