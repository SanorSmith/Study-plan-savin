import { and, desc, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import { creditLedger, devices, homeworkSets, kids, questions, scheduleRules } from "@/db/schema";
import { balanceOf, earnedToday } from "@/lib/kid-service";
import { isPairingValid } from "@/lib/pairing";
import { homeworkResults } from "@/lib/results";
import type { z } from "zod";
import type { HomeworkInput } from "@/lib/homework-input";

/** Everything the parent app shows on a kid's page: profile, bank, schedule, phones and homework results. */
export async function kidDetail(kid: typeof kids.$inferSelect) {
  const db = getDb();
  const now = new Date();
  const [balance, earned, rules, phones, sets] = await Promise.all([
    balanceOf(kid.id),
    earnedToday(kid.id),
    db.select().from(scheduleRules).where(eq(scheduleRules.kidId, kid.id)).orderBy(scheduleRules.startMinute),
    db.select().from(devices).where(eq(devices.kidId, kid.id)).orderBy(desc(devices.createdAt)),
    homeworkResults(kid.id),
  ]);
  return {
    id: kid.id,
    name: kid.name,
    grade: kid.grade,
    minutesPerQuestion: kid.minutesPerQuestion,
    dailyCapMinutes: kid.dailyCapMinutes,
    uiStyle: kid.uiStyle,
    hasPin: kid.pinHash !== null,
    balanceMinutes: balance,
    earnedTodayMinutes: earned,
    aiCheckEnabled: kid.aiCheckEnabled,
    autoPractice: kid.autoPractice,
    autoPracticeSize: kid.autoPracticeSize,
    lastPracticeAt: kid.lastPracticeAt ? kid.lastPracticeAt.toISOString() : null,
    approvedForSettings: !!kid.settingsApprovedUntil && kid.settingsApprovedUntil.getTime() > now.getTime(),
    schedule: rules.map((r) => ({ id: r.id, mode: r.mode, days: r.days, startMinute: r.startMinute, endMinute: r.endMinute })),
    phones: phones.map((d) => ({
      id: d.id,
      platform: d.platform,
      paired: d.tokenHash !== null,
      // A code is only worth showing while it can still be used.
      code: d.tokenHash === null && isPairingValid(d.pairingExpiresAt, now) ? d.pairingCode : null,
    })),
    homework: sets.map((s) => ({
      id: s.id,
      subject: s.subject,
      kind: s.kind,
      createdAt: s.createdAt.toISOString(),
      solved: s.solved,
      total: s.questions.length,
      earnedMinutes: s.earnedMinutes,
      questions: s.questions.map((q) => ({
        id: q.id,
        type: q.type,
        options: q.options,
        text: q.text,
        answerKey: q.answerKey,
        status: q.status,
        tries: q.attempts.length,
        earnedMinutes: q.earnedMinutes,
      })),
    })),
  };
}

/** Saves a parent-confirmed answer key and assigns the set to the kid. */
export async function assignHomeworkSet(kidId: string, input: z.infer<typeof HomeworkInput>, kind: "homework" | "practice" = "homework") {
  const db = getDb();
  const [set] = await db.insert(homeworkSets).values({ kidId, subject: input.subject, status: "assigned", kind }).returning({ id: homeworkSets.id });
  await db.insert(questions).values(
    input.questions.map((q, position) => ({
      setId: set.id,
      text: q.text,
      type: q.type,
      options: q.type === "multiple_choice" ? q.options : null,
      answerKey: q.answerKey,
      confirmed: true,
      position,
    })),
  );
  return set.id;
}

export async function ownedKidOf(parentId: string, kidId: string) {
  const [kid] = await getDb().select().from(kids).where(and(eq(kids.id, kidId), eq(kids.parentId, parentId)));
  return kid ?? null;
}

/** Takes a homework set away. Minutes the kid already earned from it stay in the bank. */
export async function deleteHomeworkSet(kidId: string, setId: string) {
  const db = getDb();
  const [set] = await db.select({ id: homeworkSets.id }).from(homeworkSets).where(and(eq(homeworkSets.id, setId), eq(homeworkSets.kidId, kidId)));
  if (!set) return false;
  await releaseQuestions(db, (await db.select({ id: questions.id }).from(questions).where(eq(questions.setId, setId))).map((q) => q.id));
  await db.delete(homeworkSets).where(eq(homeworkSets.id, set.id)); // questions, attempts and paper answers go with it
  return true;
}

/** The ledger keeps earned minutes after a question is gone: it just stops pointing at the question. */
async function releaseQuestions(db: ReturnType<typeof getDb>, ids: string[]) {
  if (ids.length > 0) await db.update(creditLedger).set({ questionId: null }).where(inArray(creditLedger.questionId, ids));
}

/**
 * Replaces a set's subject and questions. Questions that come with an id of this set are edited in place (their tries stay),
 * questions without an id are added, and questions of the set that are missing from the list are removed.
 * Returns false if the set is not the kid's.
 */
export async function updateHomeworkSet(kidId: string, setId: string, input: z.infer<typeof HomeworkInput>, ids: (string | null)[]) {
  const db = getDb();
  const [set] = await db.select({ id: homeworkSets.id }).from(homeworkSets).where(and(eq(homeworkSets.id, setId), eq(homeworkSets.kidId, kidId)));
  if (!set) return false;
  const existing = new Set((await db.select({ id: questions.id }).from(questions).where(eq(questions.setId, setId))).map((q) => q.id));
  const keep = new Set(ids.filter((id): id is string => id !== null && existing.has(id)));

  const removed = [...existing].filter((id) => !keep.has(id));
  await releaseQuestions(db, removed);
  if (removed.length > 0) await db.delete(questions).where(inArray(questions.id, removed));

  await db.update(homeworkSets).set({ subject: input.subject }).where(eq(homeworkSets.id, setId));
  for (const [position, q] of input.questions.entries()) {
    const values = { text: q.text, type: q.type, options: q.type === "multiple_choice" ? q.options : null, answerKey: q.answerKey, position };
    const id = ids[position];
    if (id && keep.has(id)) await db.update(questions).set(values).where(and(eq(questions.id, id), eq(questions.setId, setId)));
    else await db.insert(questions).values({ ...values, setId, confirmed: true });
  }
  return true;
}
