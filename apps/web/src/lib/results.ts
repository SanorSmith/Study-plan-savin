import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { attempts, creditLedger, homeworkSets, questions } from "@/db/schema";
import { questionStatus, type QuestionStatus } from "@/lib/question-status";

export type QuestionResult = {
  id: string;
  text: string;
  type: string;
  options: string[] | null;
  answerKey: string;
  attempts: { answer: string; correct: boolean; at: Date }[];
  earnedMinutes: number;
  status: QuestionStatus;
};

export type SetResult = {
  id: string;
  subject: string;
  createdAt: Date;
  questions: QuestionResult[];
  solved: number;
  earnedMinutes: number;
};

/** All homework sets for a kid with every question, its key and the kid's attempts. */
export async function homeworkResults(kidId: string): Promise<SetResult[]> {
  const db = getDb();
  const sets = await db
    .select()
    .from(homeworkSets)
    .where(and(eq(homeworkSets.kidId, kidId), eq(homeworkSets.status, "assigned")))
    .orderBy(desc(homeworkSets.createdAt));
  if (sets.length === 0) return [];

  const qs = await db
    .select()
    .from(questions)
    .where(inArray(questions.setId, sets.map((s) => s.id)))
    .orderBy(asc(questions.position));
  if (qs.length === 0) return sets.map((s) => ({ ...s, questions: [], solved: 0, earnedMinutes: 0 }));

  const qIds = qs.map((q) => q.id);
  const [tries, earned] = await Promise.all([
    db
      .select()
      .from(attempts)
      .where(and(eq(attempts.kidId, kidId), inArray(attempts.questionId, qIds)))
      .orderBy(asc(attempts.createdAt)),
    db
      .select({
        questionId: creditLedger.questionId,
        minutes: sql<number>`sum(${creditLedger.deltaMinutes})::int`,
      })
      .from(creditLedger)
      .where(
        and(
          eq(creditLedger.kidId, kidId),
          eq(creditLedger.reason, "correct_answer"),
          inArray(creditLedger.questionId, qIds),
        ),
      )
      .groupBy(creditLedger.questionId),
  ]);

  const earnedBy = new Map(earned.map((e) => [e.questionId, e.minutes]));
  return sets.map((set) => {
    const results: QuestionResult[] = qs
      .filter((q) => q.setId === set.id)
      .map((q) => {
        const list = tries
          .filter((t) => t.questionId === q.id)
          .map((t) => ({ answer: t.answer, correct: t.correct, at: t.createdAt }));
        return {
          id: q.id,
          text: q.text,
          type: q.type,
          options: q.options,
          answerKey: q.answerKey,
          attempts: list,
          earnedMinutes: earnedBy.get(q.id) ?? 0,
          status: questionStatus(list),
        };
      });
    return {
      id: set.id,
      subject: set.subject,
      createdAt: set.createdAt,
      questions: results,
      solved: results.filter((r) => r.status === "solved").length,
      earnedMinutes: results.reduce((sum, r) => sum + r.earnedMinutes, 0),
    };
  });
}

export type ActivityEntry = { id: string; deltaMinutes: number; reason: string; createdAt: Date };

/** The kid's latest time-bank movements: earned, bonus and spent minutes. */
export async function recentActivity(kidId: string, limit = 10): Promise<ActivityEntry[]> {
  return getDb()
    .select({
      id: creditLedger.id,
      deltaMinutes: creditLedger.deltaMinutes,
      reason: creditLedger.reason,
      createdAt: creditLedger.createdAt,
    })
    .from(creditLedger)
    .where(eq(creditLedger.kidId, kidId))
    .orderBy(desc(creditLedger.createdAt))
    .limit(limit);
}
