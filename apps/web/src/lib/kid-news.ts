import { and, desc, eq, gt, isNull } from "drizzle-orm";
import { getDb } from "@/db";
import { homeworkSets, kidMessages } from "@/db/schema";

export type KidNews = { id: string; title: string; text: string };

const RECENT_DAYS = 14;

/**
 * What is new for a kid: unread messages from a parent and homework or practice they have not finished with.
 * The kid's phone remembers the ids it has already rung for, so only an id it has not seen makes a sound.
 */
export async function kidNews(kidId: string): Promise<KidNews[]> {
  const db = getDb();
  const since = new Date(Date.now() - RECENT_DAYS * 24 * 60 * 60 * 1000);
  const [messages, sets] = await Promise.all([
    db
      .select({ id: kidMessages.id, kind: kidMessages.kind, body: kidMessages.body })
      .from(kidMessages)
      .where(and(eq(kidMessages.kidId, kidId), isNull(kidMessages.readAt)))
      .orderBy(desc(kidMessages.createdAt))
      .limit(10),
    db
      .select({ id: homeworkSets.id, subject: homeworkSets.subject, kind: homeworkSets.kind })
      .from(homeworkSets)
      .where(and(eq(homeworkSets.kidId, kidId), eq(homeworkSets.status, "assigned"), gt(homeworkSets.createdAt, since)))
      .orderBy(desc(homeworkSets.createdAt))
      .limit(10),
  ]);
  return [
    ...sets.map((s) => ({
      id: `set-${s.id}`,
      title: s.kind === "practice" ? "New practice" : "New homework",
      text: s.subject,
    })),
    ...messages.map((m) => ({
      id: `msg-${m.id}`,
      title: m.kind === "result" ? "Your paper was checked" : m.kind === "practice" ? "New practice" : "Message from your parent",
      text: m.body.slice(0, 120),
    })),
  ];
}
