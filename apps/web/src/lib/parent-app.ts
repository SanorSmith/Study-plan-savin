import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { creditLedger, devices, homeworkSets, kids, paperSubmissions } from "@/db/schema";

/** Everything the parent app shows on its home screen: each kid and the papers waiting for review. */
export async function parentAppState(parentId: string) {
  const db = getDb();
  const kidRows = await db.select().from(kids).where(eq(kids.parentId, parentId)).orderBy(kids.createdAt);
  const ids = kidRows.map((k) => k.id);
  if (ids.length === 0) return { kids: [], papers: [] };

  const [balances, phones, papers] = await Promise.all([
    db
      .select({ kidId: creditLedger.kidId, minutes: sql<number>`sum(${creditLedger.deltaMinutes})::int` })
      .from(creditLedger)
      .where(inArray(creditLedger.kidId, ids))
      .groupBy(creditLedger.kidId),
    db
      .select({ kidId: devices.kidId, paired: sql<number>`count(*) filter (where ${devices.tokenHash} is not null)::int` })
      .from(devices)
      .where(inArray(devices.kidId, ids))
      .groupBy(devices.kidId),
    db
      .select({ id: paperSubmissions.id, kidId: paperSubmissions.kidId, createdAt: paperSubmissions.createdAt, subject: homeworkSets.subject })
      .from(paperSubmissions)
      .innerJoin(homeworkSets, eq(homeworkSets.id, paperSubmissions.setId))
      .where(and(inArray(paperSubmissions.kidId, ids), eq(paperSubmissions.status, "pending")))
      .orderBy(desc(paperSubmissions.createdAt)),
  ]);
  const balanceOf = new Map(balances.map((b) => [b.kidId, b.minutes]));
  const phonesOf = new Map(phones.map((p) => [p.kidId, p.paired]));
  const now = Date.now();
  const nameOf = new Map(kidRows.map((k) => [k.id, k.name]));

  return {
    kids: kidRows.map((k) => ({
      id: k.id,
      name: k.name,
      grade: k.grade,
      balanceMinutes: balanceOf.get(k.id) ?? 0,
      pairedPhones: phonesOf.get(k.id) ?? 0,
      aiCheckEnabled: k.aiCheckEnabled,
      approvedForSettings: !!k.settingsApprovedUntil && k.settingsApprovedUntil.getTime() > now,
      papersToReview: papers.filter((p) => p.kidId === k.id).length,
    })),
    papers: papers.map((p) => ({ id: p.id, kidId: p.kidId, kidName: nameOf.get(p.kidId) ?? "", subject: p.subject, createdAt: p.createdAt.toISOString() })),
  };
}
