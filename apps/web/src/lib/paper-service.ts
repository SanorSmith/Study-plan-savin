import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "@/db";
import {
  attempts,
  creditLedger,
  homeworkSets,
  kids,
  paperAnswers,
  paperSubmissions,
  questions,
} from "@/db/schema";
import { earnedToday } from "@/lib/kid-service";
import { earnableToday, minutesForAttempt } from "@/lib/ledger";
import type { GradableQuestion, PaperResult } from "@/lib/paper-grading";

/** The confirmed questions of a set, in worksheet order. */
export async function questionsForSet(setId: string): Promise<GradableQuestion[]> {
  const rows = await getDb()
    .select()
    .from(questions)
    .where(and(eq(questions.setId, setId), eq(questions.confirmed, true)))
    .orderBy(asc(questions.position));
  return rows.map((q) => ({
    id: q.id,
    text: q.text,
    type: q.type as GradableQuestion["type"],
    options: q.options,
    answerKey: q.answerKey,
  }));
}

/** Saves what the AI read, waiting for a parent to confirm. Returns the submission id. */
export async function createSubmission(kidId: string, setId: string, submittedBy: "kid" | "parent", results: PaperResult[]) {
  const db = getDb();
  const [submission] = await db
    .insert(paperSubmissions)
    .values({ kidId, setId, submittedBy })
    .returning({ id: paperSubmissions.id });
  if (results.length > 0) {
    await db.insert(paperAnswers).values(
      results.map((r) => ({
        submissionId: submission.id,
        questionId: r.questionId,
        readAnswer: r.readAnswer,
        legible: r.legible,
        aiCorrect: r.aiCorrect,
        note: r.note,
      })),
    );
  }
  return submission.id;
}

/** Homework sets the kid still has unanswered questions in, for the "check my paper" picker. */
export async function setsAwaitingPaper(kidId: string) {
  const db = getDb();
  return db
    .select({ id: homeworkSets.id, subject: homeworkSets.subject })
    .from(homeworkSets)
    .where(
      and(
        eq(homeworkSets.kidId, kidId),
        eq(homeworkSets.status, "assigned"),
        sql`exists (
          select 1 from ${questions} q
          where q.set_id = ${homeworkSets.id} and q.confirmed = true
            and not exists (select 1 from ${attempts} a where a.question_id = q.id and a.kid_id = ${kidId}::uuid and a.correct = true)
        )`,
      ),
    )
    .orderBy(desc(homeworkSets.createdAt));
}

export async function pendingSubmissions(kidId: string) {
  return getDb()
    .select({
      id: paperSubmissions.id,
      createdAt: paperSubmissions.createdAt,
      submittedBy: paperSubmissions.submittedBy,
      subject: homeworkSets.subject,
    })
    .from(paperSubmissions)
    .innerJoin(homeworkSets, eq(homeworkSets.id, paperSubmissions.setId))
    .where(and(eq(paperSubmissions.kidId, kidId), eq(paperSubmissions.status, "pending")))
    .orderBy(desc(paperSubmissions.createdAt));
}

/** A submission with each question, the key, what was read and whether the kid had already solved it. */
export async function submissionForReview(submissionId: string, kidId: string) {
  const db = getDb();
  const [submission] = await db
    .select({
      id: paperSubmissions.id,
      status: paperSubmissions.status,
      submittedBy: paperSubmissions.submittedBy,
      createdAt: paperSubmissions.createdAt,
      subject: homeworkSets.subject,
    })
    .from(paperSubmissions)
    .innerJoin(homeworkSets, eq(homeworkSets.id, paperSubmissions.setId))
    .where(and(eq(paperSubmissions.id, submissionId), eq(paperSubmissions.kidId, kidId)));
  if (!submission) return null;

  const rows = await db
    .select({
      questionId: questions.id,
      text: questions.text,
      type: questions.type,
      options: questions.options,
      answerKey: questions.answerKey,
      position: questions.position,
      readAnswer: paperAnswers.readAnswer,
      legible: paperAnswers.legible,
      aiCorrect: paperAnswers.aiCorrect,
      finalCorrect: paperAnswers.finalCorrect,
      note: paperAnswers.note,
      alreadySolved: sql<boolean>`exists (select 1 from ${attempts} a where a.question_id = ${questions.id} and a.kid_id = ${kidId}::uuid and a.correct = true)`,
    })
    .from(paperAnswers)
    .innerJoin(questions, eq(questions.id, paperAnswers.questionId))
    .where(eq(paperAnswers.submissionId, submissionId))
    .orderBy(asc(questions.position));
  return { submission, answers: rows };
}

/**
 * Parent confirms the paper. Each question the parent marks correct earns the kid's per-question minutes
 * (half for a retry, within the daily limit), exactly like an answer given in the app. Questions the kid had
 * already solved are skipped, and approving twice pays only once.
 */
export async function approveSubmission(kid: typeof kids.$inferSelect, submissionId: string, correctIds: Set<string>) {
  const db = getDb();
  // Claiming the submission first makes a double click harmless.
  const claimed = await db
    .update(paperSubmissions)
    .set({ status: "approved", reviewedAt: new Date() })
    .where(and(eq(paperSubmissions.id, submissionId), eq(paperSubmissions.kidId, kid.id), eq(paperSubmissions.status, "pending")))
    .returning({ id: paperSubmissions.id });
  if (claimed.length === 0) return null;

  const answers = await db.select().from(paperAnswers).where(eq(paperAnswers.submissionId, submissionId));
  let awardedMinutes = 0;
  let correctCount = 0;

  for (const a of answers) {
    const prior = await db
      .select({ correct: attempts.correct })
      .from(attempts)
      .where(and(eq(attempts.questionId, a.questionId), eq(attempts.kidId, kid.id)));
    // Already solved in the app: nothing to decide here, so the decision stays empty (null).
    if (prior.some((p) => p.correct)) continue;

    const final = correctIds.has(a.questionId);
    await db.update(paperAnswers).set({ finalCorrect: final }).where(eq(paperAnswers.id, a.id));

    await db.insert(attempts).values({
      questionId: a.questionId,
      kidId: kid.id,
      answer: a.readAnswer ?? "(on paper)",
      correct: final,
    });
    if (!final) continue;
    correctCount += 1;

    const minutes = earnableToday(await earnedToday(kid.id), minutesForAttempt(kid.minutesPerQuestion, prior.length), kid.dailyCapMinutes);
    if (minutes > 0) {
      const credit = await db
        .insert(creditLedger)
        .values({ kidId: kid.id, deltaMinutes: minutes, reason: "correct_answer", questionId: a.questionId })
        .onConflictDoNothing()
        .returning({ id: creditLedger.id });
      if (credit.length === 1) awardedMinutes += minutes;
    }
  }
  return { awardedMinutes, correctCount };
}

export async function rejectSubmission(kidId: string, submissionId: string) {
  const rows = await getDb()
    .update(paperSubmissions)
    .set({ status: "rejected", reviewedAt: new Date() })
    .where(and(eq(paperSubmissions.id, submissionId), eq(paperSubmissions.kidId, kidId), eq(paperSubmissions.status, "pending")))
    .returning({ id: paperSubmissions.id });
  return rows.length === 1;
}

export async function pendingCounts(kidIds: string[]): Promise<Map<string, number>> {
  if (kidIds.length === 0) return new Map();
  const rows = await getDb()
    .select({ kidId: paperSubmissions.kidId, n: sql<number>`count(*)::int` })
    .from(paperSubmissions)
    .where(and(inArray(paperSubmissions.kidId, kidIds), eq(paperSubmissions.status, "pending")))
    .groupBy(paperSubmissions.kidId);
  return new Map(rows.map((r) => [r.kidId, r.n]));
}
