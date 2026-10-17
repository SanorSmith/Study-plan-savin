import { and, eq, inArray, isNull, lt, ne, or, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { attempts, homeworkSets, kids, questions } from "@/db/schema";
import { addKidMessage } from "@/lib/messages";
import { assignHomeworkSet } from "@/lib/parent-kid";
import { statsFor, type Period } from "@/lib/performance";
import { generatePractice, PracticeError, type PracticeSet } from "@/lib/practice-ai";
import { pushToParent } from "@/lib/push";

export const AUTO_MODES = ["off", "daily", "every_other_day", "weekly"] as const;
export type AutoMode = (typeof AUTO_MODES)[number];

const HOUR = 60 * 60 * 1000;

/** How long to wait between automatic practice sets. A little under a whole number of days, so a daily run is never skipped by minutes. */
export function intervalMs(mode: AutoMode): number | null {
  switch (mode) {
    case "daily":
      return 20 * HOUR;
    case "every_other_day":
      return 44 * HOUR;
    case "weekly":
      return 6.5 * 24 * HOUR;
    default:
      return null;
  }
}

/** Is it time for this kid's next automatic practice set? */
export function isDue(mode: AutoMode, lastAt: Date | null, now: Date): boolean {
  const wait = intervalMs(mode);
  if (wait === null) return false;
  return lastAt === null || now.getTime() - lastAt.getTime() >= wait;
}

/** Puts a practice set in the kid's queue (after the homework they already have) and tells them. */
export async function sendPractice(kidId: string, set: PracticeSet) {
  const setId = await assignHomeworkSet(kidId, { subject: set.subject, questions: set.questions }, "practice");
  await addKidMessage(kidId, "practice", `New practice: ${set.subject} (${set.questions.length} questions)`);
  await getDb().update(kids).set({ lastPracticeAt: new Date() }).where(eq(kids.id, kidId));
  return setId;
}

/** True while the kid still has practice questions they have not answered, so new practice does not pile up. */
export async function hasOpenPractice(kidId: string): Promise<boolean> {
  const rows = await getDb()
    .select({ id: questions.id })
    .from(questions)
    .innerJoin(homeworkSets, eq(homeworkSets.id, questions.setId))
    .where(
      and(
        eq(homeworkSets.kidId, kidId),
        eq(homeworkSets.kind, "practice"),
        sql`not exists (select 1 from ${attempts} a where a.question_id = ${questions.id} and a.kid_id = ${kidId}::uuid and a.correct)`,
        sql`(select count(*) from ${attempts} a where a.question_id = ${questions.id} and a.kid_id = ${kidId}::uuid) < 3`,
      ),
    )
    .limit(1);
  return rows.length > 0;
}

/** One automatic practice run: for every kid whose parent turned it on and whose turn has come (`only` limits it to some kids, for tests). Never throws for one kid's failure. */
export async function runAutoPractice(now = new Date(), maxKids = 20, only?: string[]) {
  const db = getDb();
  const due = await db
    .select()
    .from(kids)
    .where(and(ne(kids.autoPractice, "off"), or(isNull(kids.lastPracticeAt), lt(kids.lastPracticeAt, new Date(now.getTime() - 20 * HOUR))), only ? inArray(kids.id, only) : undefined))
    .limit(maxKids * 3);
  const result = { checked: due.length, made: 0, skipped: 0, failed: 0 };
  for (const kid of due) {
    if (result.made >= maxKids) break;
    if (!isDue(kid.autoPractice as AutoMode, kid.lastPracticeAt, now)) {
      result.skipped += 1;
      continue;
    }
    try {
      if (await hasOpenPractice(kid.id)) {
        result.skipped += 1;
        continue;
      }
      const stats = await statsFor(kid.id, "month" as Period, now);
      const set = await generatePractice(kid, stats, { count: kid.autoPracticeSize });
      await sendPractice(kid.id, set);
      await pushToParent(kid.parentId, { title: `Practice added for ${kid.name}`, body: `${set.subject}: ${set.questions.length} questions from what was hard`, url: `/kids/${kid.id}/practice`, tag: `practice-${kid.id}` });
      result.made += 1;
    } catch (e) {
      // Not enough results yet is normal; try again next run. Move the clock a little so the same kid is not retried every run.
      if (e instanceof PracticeError) result.skipped += 1;
      else result.failed += 1;
    }
  }
  return result;
}


/**
 * Gives the kid another go at the questions they ran out of tries on (last 14 days): the same questions, as a fresh set
 * after the homework they already have. The old tries stay, so the results and reports keep the history.
 * Returns how many questions were put back, or 0 if nothing was missed.
 */
export async function retryMissed(kidId: string): Promise<number> {
  const result = await getDb().execute(sql`
    select q.text, q.type, q.options, q.answer_key
    from questions q
    join homework_sets s on s.id = q.set_id
    where s.kid_id = ${kidId}::uuid and s.status = 'assigned' and q.confirmed = true
      and q.type in ('multiple_choice', 'numeric') and s.created_at > now() - interval '14 days'
      and not exists (select 1 from attempts a where a.question_id = q.id and a.kid_id = ${kidId}::uuid and a.correct)
      and (select count(*) from attempts a where a.question_id = q.id and a.kid_id = ${kidId}::uuid) >= 3
    order by s.created_at desc, q.position
    limit 20
  `);
  const rows = result.rows as { text: string; type: "multiple_choice" | "numeric"; options: string[] | null; answer_key: string }[];
  if (rows.length === 0) return 0;
  await assignHomeworkSet(
    kidId,
    { subject: "Try again", questions: rows.map((r) => ({ text: r.text, type: r.type, options: r.type === "multiple_choice" ? r.options : null, answerKey: r.answer_key })) },
    "practice",
  );
  await addKidMessage(kidId, "practice", `Another try at ${rows.length} ${rows.length === 1 ? "question" : "questions"} you missed`);
  return rows.length;
}
