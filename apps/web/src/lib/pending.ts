import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { homeworkSets, kids, paperSubmissions } from "@/db/schema";

/** The papers kids sent that wait for this parent. Light enough to ask every few seconds. */
export async function pendingPapersFor(parentId: string) {
  const rows = await getDb()
    .select({
      id: paperSubmissions.id,
      kidId: kids.id,
      kidName: kids.name,
      subject: homeworkSets.subject,
      createdAt: paperSubmissions.createdAt,
    })
    .from(paperSubmissions)
    .innerJoin(kids, eq(kids.id, paperSubmissions.kidId))
    .innerJoin(homeworkSets, eq(homeworkSets.id, paperSubmissions.setId))
    .where(and(eq(kids.parentId, parentId), eq(paperSubmissions.status, "pending")))
    .orderBy(desc(paperSubmissions.createdAt))
    .limit(50);
  return rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }));
}
