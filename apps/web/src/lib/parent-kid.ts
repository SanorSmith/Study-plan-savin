import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { devices, homeworkSets, kids, questions, scheduleRules } from "@/db/schema";
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
      createdAt: s.createdAt.toISOString(),
      solved: s.solved,
      total: s.questions.length,
      earnedMinutes: s.earnedMinutes,
      questions: s.questions.map((q) => ({
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
export async function assignHomeworkSet(kidId: string, input: z.infer<typeof HomeworkInput>) {
  const db = getDb();
  const [set] = await db.insert(homeworkSets).values({ kidId, subject: input.subject, status: "assigned" }).returning({ id: homeworkSets.id });
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
