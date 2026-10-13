import { and, asc, eq, gte, inArray, notExists, sql } from "drizzle-orm";
import { getDb } from "@/db";
import {
  attempts,
  creditLedger,
  devices,
  homeworkSets,
  kids,
  questions,
  scheduleRules,
} from "@/db/schema";
import { checkExact } from "@/lib/check-answer";
import type { DeviceContext } from "@/lib/device-auth";
import { earnableToday, MAX_ATTEMPTS, minutesForAttempt } from "@/lib/ledger";
import { generateDeviceToken, isPairingValid } from "@/lib/pairing";
import { isLocked, nextFailureState, verifyPin } from "@/lib/pin";

export const MAX_USAGE_REPORT_MINUTES = 240;
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

async function earnedToday(kidId: string): Promise<number> {
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
      text: questions.text,
      type: questions.type,
      options: questions.options,
      subject: homeworkSets.subject,
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
  const [balance, rules] = await Promise.all([
    balanceOf(kidId),
    getDb().select().from(scheduleRules).where(eq(scheduleRules.kidId, kidId)),
  ]);
  return {
    // Lets clients keep time from the server's clock, not the phone's.
    serverNow: new Date().toISOString(),
    balanceMinutes: balance,
    schedule: {
      timezone: DAY_TZ,
      rules: rules.map((r) => ({ mode: r.mode, days: r.days, startMinute: r.startMinute, endMinute: r.endMinute })),
    },
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
    question,
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
