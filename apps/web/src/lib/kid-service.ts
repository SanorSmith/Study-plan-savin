import { and, asc, eq, gte, inArray, notExists, sql } from "drizzle-orm";
import { getDb } from "@/db";
import {
  attempts,
  creditLedger,
  devices,
  homeworkSets,
  kids,
  parents,
  questions,
  scheduleRules,
} from "@/db/schema";
import { checkExact } from "@/lib/check-answer";
import type { DeviceContext } from "@/lib/device-auth";
import { earnableToday, MAX_ATTEMPTS, minutesForAttempt } from "@/lib/ledger";
import { generateDeviceToken, isPairingValid } from "@/lib/pairing";
import { isLocked, nextFailureState, verifyPin } from "@/lib/pin";

export const MAX_USAGE_REPORT_MINUTES = 240;
export const APPROVAL_MINUTES = 10;
export const DAY_TZ = process.env.APP_TIMEZONE ?? "Europe/Stockholm";

/** Kids are only quizzed on question types that can be graded exactly. */
const GRADABLE = ["multiple_choice", "numeric"];

/** Swaps a one-time pairing code for a device token (shown to the device once). */
export async function pairDevice(rawCode: string) {
  const code = rawCode.trim().toUpperCase();
  const db = getDb();
  const [device] = await db.select().from(devices).where(eq(devices.pairingCode, code));
  if (!device || device.tokenHash || !isPairingValid(device.pairingExpiresAt, new Date())) {
    return null;
  }
  const { token, tokenHash } = generateDeviceToken();
  // The `tokenHash is null` guard makes a code single-use even if two requests race.
  const claimed = await db
    .update(devices)
    .set({ tokenHash, pairingCode: null, pairingExpiresAt: null })
    .where(and(eq(devices.id, device.id), sql`${devices.tokenHash} is null`))
    .returning({ id: devices.id });
  return claimed.length === 1 ? token : null;
}

export type UnlockResult =
  | { ok: true; unlockedUntil: Date }
  | { ok: false; reason: "no_pin" | "locked" | "wrong_pin"; lockedUntil?: Date };

export async function unlockWithPin(ctx: DeviceContext, pin: string, unlockMinutes: number) {
  const db = getDb();
  const now = new Date();
  const { kid, device } = ctx;
  if (!kid.pinHash) return { ok: false, reason: "no_pin" } satisfies UnlockResult;
  if (isLocked(kid.pinLockedUntil, now)) {
    return { ok: false, reason: "locked", lockedUntil: kid.pinLockedUntil! } satisfies UnlockResult;
  }

  if (!(await verifyPin(pin, kid.pinHash))) {
    const next = nextFailureState(kid.pinFailedAttempts, now);
    await db
      .update(kids)
      .set({ pinFailedAttempts: next.failedAttempts, pinLockedUntil: next.lockedUntil })
      .where(eq(kids.id, kid.id));
    return next.lockedUntil
      ? ({ ok: false, reason: "locked", lockedUntil: next.lockedUntil } satisfies UnlockResult)
      : ({ ok: false, reason: "wrong_pin" } satisfies UnlockResult);
  }

  const unlockedUntil = new Date(now.getTime() + unlockMinutes * 60_000);
  await db.update(kids).set({ pinFailedAttempts: 0, pinLockedUntil: null }).where(eq(kids.id, kid.id));
  await db.update(devices).set({ unlockedUntil }).where(eq(devices.id, device.id));
  return { ok: true, unlockedUntil } satisfies UnlockResult;
}

export async function balanceOf(kidId: string): Promise<number> {
  const [row] = await getDb()
    .select({ total: sql<number>`coalesce(sum(${creditLedger.deltaMinutes}), 0)::int` })
    .from(creditLedger)
    .where(eq(creditLedger.kidId, kidId));
  return row.total;
}

export async function earnedToday(kidId: string): Promise<number> {
  const [row] = await getDb()
    .select({ total: sql<number>`coalesce(sum(${creditLedger.deltaMinutes}), 0)::int` })
    .from(creditLedger)
    .where(
      and(
        eq(creditLedger.kidId, kidId),
        eq(creditLedger.reason, "correct_answer"),
        gte(
          creditLedger.createdAt,
          sql`(date_trunc('day', now() at time zone ${DAY_TZ}) at time zone ${DAY_TZ})`,
        ),
      ),
    );
  return row.total;
}

/** Next unanswered question, without its answer key. */
async function nextQuestion(kidId: string) {
  const [q] = await getDb()
    .select({
      id: questions.id,
      label: questions.label,
      position: questions.position,
      text: questions.text,
      type: questions.type,
      options: questions.options,
      subject: homeworkSets.subject,
      setId: homeworkSets.id,
    })
    .from(questions)
    .innerJoin(homeworkSets, eq(homeworkSets.id, questions.setId))
    .where(
      and(
        eq(homeworkSets.kidId, kidId),
        eq(homeworkSets.status, "assigned"),
        eq(questions.confirmed, true),
        inArray(questions.type, GRADABLE),
        notExists(
          getDb()
            .select({ one: sql`1` })
            .from(attempts)
            .where(
              and(
                eq(attempts.questionId, questions.id),
                eq(attempts.kidId, kidId),
                eq(attempts.correct, true),
              ),
            ),
        ),
        sql`(select count(*) from attempts a where a.question_id = ${questions.id} and a.kid_id = ${kidId}::uuid) < ${MAX_ATTEMPTS}`,
      ),
    )
    .orderBy(asc(homeworkSets.createdAt), asc(questions.position))
    .limit(1);
  return q ?? null;
}

/** What the phone's lock needs to decide: the balance, the schedule and the server clock. No PIN needed. */
export async function kidSync(kidId: string) {
  const [balance, rules, [row]] = await Promise.all([
    balanceOf(kidId),
    getDb().select().from(scheduleRules).where(eq(scheduleRules.kidId, kidId)),
    getDb().select({ approvedUntil: kids.settingsApprovedUntil }).from(kids).where(eq(kids.id, kidId)),
  ]);
  const now = new Date();
  return {
    // Lets clients keep time from the server's clock, not the phone's.
    serverNow: now.toISOString(),
    balanceMinutes: balance,
    // While set, the phone lets Settings and uninstall screens open (a parent approved it).
    approvedUntil: row?.approvedUntil && row.approvedUntil > now ? row.approvedUntil.toISOString() : null,
    schedule: {
      timezone: DAY_TZ,
      rules: rules.map((r) => ({ mode: r.mode, days: r.days, startMinute: r.startMinute, endMinute: r.endMinute })),
    },
  };
}

/** How far through a homework set the kid is: questions solved or out of tries, out of all that can be asked in the app. */
async function setProgress(kidId: string, setId: string) {
  const result = await getDb().execute(sql`
    select count(*)::int as total,
           count(*) filter (where
             exists (select 1 from attempts a where a.question_id = q.id and a.kid_id = ${kidId}::uuid and a.correct)
             or (select count(*) from attempts a where a.question_id = q.id and a.kid_id = ${kidId}::uuid) >= ${MAX_ATTEMPTS}
           )::int as done
    from questions q
    where q.set_id = ${setId}::uuid and q.confirmed = true and q.type in ('multiple_choice', 'numeric')
  `);
  const row = result.rows[0] as { total: number; done: number } | undefined;
  return row ? { done: row.done, total: row.total } : null;
}

/**
 * How the last two weeks of homework went, for the "all done" screen: how many questions were solved, and the ones that
 * ran out of tries with the right answer, so the kid can learn from them. Only shown once nothing is left to answer.
 */
export async function reviewFor(kidId: string) {
  const result = await getDb().execute(sql`
    select q.text, q.answer_key,
           exists (select 1 from attempts a where a.question_id = q.id and a.kid_id = ${kidId}::uuid and a.correct) as solved
    from questions q
    join homework_sets s on s.id = q.set_id
    where s.kid_id = ${kidId}::uuid and s.status = 'assigned' and q.confirmed = true
      and q.type in ('multiple_choice', 'numeric') and s.created_at > now() - interval '14 days'
    order by s.created_at desc, q.position
  `);
  const rows = result.rows as { text: string; answer_key: string; solved: boolean }[];
  return {
    total: rows.length,
    solved: rows.filter((r) => r.solved).length,
    missed: rows.filter((r) => !r.solved).slice(0, 6).map((r) => ({ text: r.text, answer: r.answer_key })),
  };
}

export async function kidState(kid: typeof kids.$inferSelect) {
  const [sync, earned, question] = await Promise.all([
    kidSync(kid.id),
    earnedToday(kid.id),
    nextQuestion(kid.id),
  ]);
  return {
    ...sync,
    name: kid.name,
    minutesPerQuestion: kid.minutesPerQuestion,
    earnableTodayMinutes: earnableToday(earned, kid.minutesPerQuestion, kid.dailyCapMinutes),
    // The kid's grade and the look a parent chose, so the app can fit the kid's age.
    grade: kid.grade,
    uiStyle: kid.uiStyle,
    progress: question ? await setProgress(kid.id, question.setId) : null,
    review: question ? null : await reviewFor(kid.id),
    question: question ? { id: question.id, label: question.label, position: question.position + 1, text: question.text, type: question.type, options: question.options, subject: question.subject } : null,
  };
}

export type AnswerResult =
  | { ok: true; correct: boolean; earnedMinutes: number; attemptsLeft: number }
  | { ok: false; reason: "not_found" | "already_answered" };

/** Up to MAX_ATTEMPTS tries per question; a retry earns half the minutes. */
export async function submitAnswer(
  kid: typeof kids.$inferSelect,
  questionId: string,
  answer: string,
): Promise<AnswerResult> {
  const db = getDb();
  const [q] = await db
    .select({ question: questions })
    .from(questions)
    .innerJoin(homeworkSets, eq(homeworkSets.id, questions.setId))
    .where(
      and(
        eq(questions.id, questionId),
        eq(homeworkSets.kidId, kid.id),
        eq(homeworkSets.status, "assigned"),
        eq(questions.confirmed, true),
        inArray(questions.type, GRADABLE),
      ),
    );
  if (!q) return { ok: false, reason: "not_found" };
  const question = q.question;

  const prior = await db
    .select({ correct: attempts.correct })
    .from(attempts)
    .where(and(eq(attempts.questionId, question.id), eq(attempts.kidId, kid.id)));
  if (prior.some((a) => a.correct) || prior.length >= MAX_ATTEMPTS) {
    return { ok: false, reason: "already_answered" };
  }

  const correct = checkExact(question.type as "multiple_choice" | "numeric", answer, question.answerKey);
  await db.insert(attempts).values({ questionId: question.id, kidId: kid.id, answer, correct });
  const attemptsLeft = correct ? 0 : MAX_ATTEMPTS - prior.length - 1;

  let earnedMinutes = 0;
  if (correct) {
    const minutes = earnableToday(
      await earnedToday(kid.id),
      minutesForAttempt(kid.minutesPerQuestion, prior.length),
      kid.dailyCapMinutes,
    );
    if (minutes > 0) {
      // The unique ledger index means a double-submitted correct answer pays once.
      const credit = await db
        .insert(creditLedger)
        .values({ kidId: kid.id, deltaMinutes: minutes, reason: "correct_answer", questionId: question.id })
        .onConflictDoNothing()
        .returning({ id: creditLedger.id });
      if (credit.length === 1) earnedMinutes = minutes;
    }
  }
  return { ok: true, correct, earnedMinutes, attemptsLeft };
}

/**
 * Charges screen time the phone measured (whole minutes, screen on, blocked app in front).
 * The charge is capped at the current balance and `key` makes a retried report free.
 * Returns the balance after the charge.
 */
export async function recordUsage(kidId: string, minutes: number, key: string): Promise<number> {
  await getDb().execute(sql`
    insert into credit_ledger (kid_id, delta_minutes, reason, idempotency_key)
    select ${kidId}::uuid, -least(${minutes}::int, bal.b), 'usage', ${key}
    from (select coalesce(sum(delta_minutes), 0)::int as b from credit_ledger where kid_id = ${kidId}::uuid) bal
    where bal.b > 0
    on conflict (idempotency_key) do nothing
  `);
  return balanceOf(kidId);
}

/**
 * Parent-granted screen time, no homework needed. The minutes go into the kid's bank as a
 * "bonus", which does not count toward the daily earning cap.
 */
export async function grantBonus(kidId: string, minutes: number) {
  await getDb().insert(creditLedger).values({ kidId, deltaMinutes: minutes, reason: "bonus" });
}

export type ParentUnlockResult =
  | { ok: true; approvedUntil: Date }
  | { ok: false; reason: "no_pin" | "locked" | "wrong_pin"; lockedUntil?: Date };

/** Parent types their PIN on the kid's phone: opens Settings and uninstall screens for a few minutes. */
export async function parentUnlock(kidId: string, pin: string): Promise<ParentUnlockResult> {
  const db = getDb();
  const now = new Date();
  const [row] = await db
    .select({ parent: parents })
    .from(kids)
    .innerJoin(parents, eq(parents.id, kids.parentId))
    .where(eq(kids.id, kidId));
  if (!row) return { ok: false, reason: "wrong_pin" };
  const parent = row.parent;

  if (!parent.approvalPinHash) return { ok: false, reason: "no_pin" };
  if (isLocked(parent.approvalLockedUntil, now)) {
    return { ok: false, reason: "locked", lockedUntil: parent.approvalLockedUntil! };
  }
  if (!(await verifyPin(pin, parent.approvalPinHash))) {
    const next = nextFailureState(parent.approvalFailedAttempts, now);
    await db
      .update(parents)
      .set({ approvalFailedAttempts: next.failedAttempts, approvalLockedUntil: next.lockedUntil })
      .where(eq(parents.id, parent.id));
    return next.lockedUntil
      ? { ok: false, reason: "locked", lockedUntil: next.lockedUntil }
      : { ok: false, reason: "wrong_pin" };
  }

  const approvedUntil = new Date(now.getTime() + APPROVAL_MINUTES * 60_000);
  await db.update(parents).set({ approvalFailedAttempts: 0, approvalLockedUntil: null }).where(eq(parents.id, parent.id));
  await db.update(kids).set({ settingsApprovedUntil: approvedUntil }).where(eq(kids.id, kidId));
  return { ok: true, approvedUntil };
}

/** Parent grants (or, with null, revokes) approval from the dashboard. */
export async function setApproval(kidId: string, minutes: number | null): Promise<Date | null> {
  const until = minutes === null ? null : new Date(Date.now() + minutes * 60_000);
  await getDb().update(kids).set({ settingsApprovedUntil: until }).where(eq(kids.id, kidId));
  return until;
}

/**
 * Parent takes minutes out of the bank. The charge is capped at the balance, so it never goes below zero.
 * Pass null to empty the bank. Returns how many minutes were actually removed.
 */
export async function withdrawMinutes(kidId: string, minutes: number | null): Promise<number> {
  const result = await getDb().execute(sql`
    insert into credit_ledger (kid_id, delta_minutes, reason)
    select ${kidId}::uuid,
           -(case when ${minutes}::int is null then bal.b else least(${minutes}::int, bal.b) end),
           'withdrawal'
    from (select coalesce(sum(delta_minutes), 0)::int as b from credit_ledger where kid_id = ${kidId}::uuid) bal
    where bal.b > 0
    returning -delta_minutes as removed
  `);
  return (result.rows[0] as { removed: number } | undefined)?.removed ?? 0;
}
