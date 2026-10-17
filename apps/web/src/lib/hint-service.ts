import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { homeworkSets, kids, questions } from "@/db/schema";
import { makeHint } from "@/lib/hint-ai";

/**
 * The hint for one of the kid's own questions. Written by the AI the first time and kept, so asking again is free.
 * Null when the question is not this kid's.
 */
export async function hintFor(kid: typeof kids.$inferSelect, questionId: string): Promise<string | null> {
  const db = getDb();
  const [q] = await db
    .select({ id: questions.id, text: questions.text, type: questions.type, options: questions.options, hint: questions.hint, subject: homeworkSets.subject })
    .from(questions)
    .innerJoin(homeworkSets, eq(homeworkSets.id, questions.setId))
    .where(and(eq(questions.id, questionId), eq(homeworkSets.kidId, kid.id), eq(questions.confirmed, true)));
  if (!q) return null;
  if (q.hint) return q.hint;
  const hint = await makeHint(q, kid.grade);
  await db.update(questions).set({ hint }).where(eq(questions.id, q.id));
  return hint;
}
