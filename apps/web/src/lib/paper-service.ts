import { and, asc, desc, eq, inArray, lt, sql } from "drizzle-orm";
import { getDb } from "@/db";
import {
  attempts,
  creditLedger,
  homeworkSets,
  kids,
  paperAnswers,
  paperImages,
  paperSubmissions,
  questions,
} from "@/db/schema";
import { earnedToday } from "@/lib/kid-service";
import { earnableToday, minutesForAttempt } from "@/lib/ledger";
import type { GradableQuestion, PaperImage, PaperResult } from "@/lib/paper-grading";

/** How long the photos of a paper are kept so a parent can look at them. */
export const PHOTO_RETENTION_DAYS = 14;

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

/**
 * Saves a paper and its photos. With AI results they are stored as the suggestion; without them (a parent will
 * check by hand) every question starts as "not read" so the parent can mark each one.
 */
export async function createSubmission(a: {
  kidId: string;
  setId: string;
  submittedBy: "kid" | "parent";
  mode: "ai" | "parent";
  questions: GradableQuestion[];
  results: PaperResult[] | null;
  images: PaperImage[];
}) {
  const db = getDb();
  const [submission] = await db
    .insert(paperSubmissions)
    .values({ kidId: a.kidId, setId: a.setId, submittedBy: a.submittedBy, mode: a.mode, aiRead: a.results !== null })
    .returning({ id: paperSubmissions.id });

  const results: PaperResult[] =
    a.results ?? a.questions.map((q) => ({ questionId: q.id, readAnswer: null, legible: false, aiCorrect: false, note: null }));
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
  if (a.images.length > 0) {
    await db.insert(paperImages).values(
      a.images.map((img, position) => ({
        submissionId: submission.id,
        position,
        contentType: img.mediaType,
        dataBase64: img.base64,
      })),
    );
  }
  return submission.id;
}

/** Deletes photos older than the retention period. The AI's reading and the results stay. */
export async function purgeOldPaperImages() {
  const cutoff = new Date(Date.now() - PHOTO_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  await getDb().delete(paperImages).where(lt(paperImages.createdAt, cutoff));
}

/** One photo of a paper, if it belongs to the kid and has not been deleted yet. */
export async function imageFor(submissionId: string, kidId: string, position: number) {
  const [row] = await getDb()
    .select({ contentType: paperImages.contentType, dataBase64: paperImages.dataBase64 })
    .from(paperImages)
    .innerJoin(paperSubmissions, eq(paperSubmissions.id, paperImages.submissionId))
    .where(and(eq(paperImages.submissionId, submissionId), eq(paperImages.position, position), eq(paperSubmissions.kidId, kidId)));
  return row ?? null;
}

/** The stored photos of a paper, for asking the AI to read them later. */
export async function imagesOf(submissionId: string): Promise<PaperImage[]> {
  const rows = await getDb()
    .select({ contentType: paperImages.contentType, dataBase64: paperImages.dataBase64 })
    .from(paperImages)
    .where(eq(paperImages.submissionId, submissionId))
    .orderBy(asc(paperImages.position));
  return rows.map((r) => ({ mediaType: r.contentType as PaperImage["mediaType"], base64: r.dataBase64 }));
}

/** Stores the AI's reading on a paper a parent is checking (the parent asked for AI help). */
export async function applyAiResults(submissionId: string, kidId: string, results: PaperResult[]) {
  const db = getDb();
  const [submission] = await db
    .select({ id: paperSubmissions.id })
    .from(paperSubmissions)
    .where(and(eq(paperSubmissions.id, submissionId), eq(paperSubmissions.kidId, kidId), eq(paperSubmissions.status, "pending")));
  if (!submission) return false;
  for (const r of results) {
    await db
      .update(paperAnswers)
      .set({ readAnswer: r.readAnswer, legible: r.legible, aiCorrect: r.aiCorrect, note: r.note })
      .where(and(eq(paperAnswers.submissionId, submissionId), eq(paperAnswers.questionId, r.questionId)));
  }
  await db.update(paperSubmissions).set({ aiRead: true }).where(eq(paperSubmissions.id, submissionId));
  return true;
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

/** The latest papers that are already decided, including the ones the AI checked and credited. */
export async function recentSubmissions(kidId: string, limit = 5) {
  return getDb()
    .select({
      id: paperSubmissions.id,
      createdAt: paperSubmissions.createdAt,
      status: paperSubmissions.status,
      autoApproved: paperSubmissions.autoApproved,
      awardedMinutes: paperSubmissions.awardedMinutes,
      subject: homeworkSets.subject,
    })
    .from(paperSubmissions)
    .innerJoin(homeworkSets, eq(homeworkSets.id, paperSubmissions.setId))
    .where(and(eq(paperSubmissions.kidId, kidId), inArray(paperSubmissions.status, ["approved", "rejected"])))
    .orderBy(desc(paperSubmissions.createdAt))
    .limit(limit);
}

/** A submission with each question, the key, what was read and whether the kid had already solved it. */
export async function submissionForReview(submissionId: string, kidId: string) {
  const db = getDb();
  const [submission] = await db
    .select({
      id: paperSubmissions.id,
      status: paperSubmissions.status,
      submittedBy: paperSubmissions.submittedBy,
      mode: paperSubmissions.mode,
      aiRead: paperSubmissions.aiRead,
      autoApproved: paperSubmissions.autoApproved,
      awardedMinutes: paperSubmissions.awardedMinutes,
      createdAt: paperSubmissions.createdAt,
      subject: homeworkSets.subject,
      imageCount: sql<number>`(select count(*)::int from ${paperImages} pi where pi.submission_id = ${paperSubmissions.id})`,
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
 * Confirms the paper and pays for the answers counted as correct, exactly like an answer given in the app
 * (half for a retry, within the daily limit). Questions the kid had already solved are skipped, and approving
 * twice pays only once. `auto` marks a paper the AI checked and credited without a parent.
 */
export async function approveSubmission(
  kid: typeof kids.$inferSelect,
  submissionId: string,
  correctIds: Set<string>,
  opts: { auto?: boolean } = {},
) {
  const db = getDb();
  // Claiming the submission first makes a double click harmless.
  const claimed = await db
    .update(paperSubmissions)
    .set({ status: "approved", reviewedAt: new Date(), autoApproved: opts.auto ?? false })
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
  await db.update(paperSubmissions).set({ awardedMinutes }).where(eq(paperSubmissions.id, submissionId));
  return { awardedMinutes, correctCount, total: answers.length };
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
