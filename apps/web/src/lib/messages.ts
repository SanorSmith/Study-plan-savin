import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { getDb } from "@/db";
import { homeworkSets, kidMessages, paperSubmissions } from "@/db/schema";

export const MAX_NOTE = 500;

/** What a kid is told when a parent has checked a paper: the score, the minutes, and the parent's own words. */
export function resultText(a: { subject: string; correct: number; total: number; minutes: number; note?: string | null; sentBack?: boolean }): string {
  const note = a.note?.trim();
  if (a.sentBack) return `${a.subject}: your parent sent the paper back.${note ? ` ${note}` : ""}`;
  const score = `${a.subject}: ${a.correct} of ${a.total} right.`;
  const minutes = a.minutes > 0 ? ` +${a.minutes} min.` : "";
  return `${score}${minutes}${note ? ` ${note}` : ""}`;
}

export async function addKidMessage(kidId: string, kind: "result" | "note" | "practice", body: string) {
  const text = body.trim().slice(0, 1000);
  if (!text) return null;
  const [row] = await getDb().insert(kidMessages).values({ kidId, kind, body: text }).returning({ id: kidMessages.id });
  return row.id;
}

/** Tells the kid how a paper went. The subject comes from the paper's homework. */
export async function sendPaperResult(kidId: string, submissionId: string, outcome: { correct: number; total: number; minutes: number } | "sent_back", note?: string | null) {
  const [row] = await getDb()
    .select({ subject: homeworkSets.subject })
    .from(paperSubmissions)
    .innerJoin(homeworkSets, eq(homeworkSets.id, paperSubmissions.setId))
    .where(eq(paperSubmissions.id, submissionId));
  if (!row) return null;
  const text =
    outcome === "sent_back"
      ? resultText({ subject: row.subject, correct: 0, total: 0, minutes: 0, note, sentBack: true })
      : resultText({ subject: row.subject, correct: outcome.correct, total: outcome.total, minutes: outcome.minutes, note });
  return addKidMessage(kidId, "result", text);
}

/** The kid's unread messages, newest first. */
export async function unreadMessages(kidId: string, limit = 5) {
  const rows = await getDb()
    .select({ id: kidMessages.id, kind: kidMessages.kind, body: kidMessages.body, createdAt: kidMessages.createdAt })
    .from(kidMessages)
    .where(and(eq(kidMessages.kidId, kidId), isNull(kidMessages.readAt)))
    .orderBy(desc(kidMessages.createdAt))
    .limit(limit);
  return rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }));
}

/** Marks messages as read. With no ids, all of the kid's unread messages. Only the kid's own messages are touched. */
export async function markMessagesRead(kidId: string, ids?: string[]) {
  const where = [eq(kidMessages.kidId, kidId), isNull(kidMessages.readAt)];
  if (ids) {
    if (ids.length === 0) return;
    where.push(inArray(kidMessages.id, ids));
  }
  await getDb().update(kidMessages).set({ readAt: new Date() }).where(and(...where));
}
