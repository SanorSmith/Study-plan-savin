/* eslint-disable @typescript-eslint/no-explicit-any -- loose JSON in a test script */
// End-to-end test of the kid API against a real database.
// Needs DATABASE_URL and a running server (npm run dev). It creates a throwaway
// parent, kid and homework set, and deletes them when it finishes.
//   npm run test:e2e            (E2E_BASE_URL overrides http://localhost:3000)
import { neon } from "@neondatabase/serverless";
import { hashPin } from "../src/lib/pin.ts";
import { generatePairingCode, pairingExpiry } from "../src/lib/pairing.ts";

const sql = neon(process.env.DATABASE_URL!);
const RUN_IP = `e2e-${Date.now()}`; // fresh client IP per run so rate-limit state never carries over
const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";
let failed = 0;
const check = (name: string, ok: boolean, extra?: unknown) => {
  console.log(`${ok ? "PASS" : "FAIL"} ${name}`, ok ? "" : JSON.stringify(extra));
  if (!ok) failed++;
};
const call = async (path: string, token: string | null, body?: unknown, ip = RUN_IP) => {
  const res = await fetch(BASE + path, {
    method: body ? "POST" : "GET",
    headers: { "content-type": "application/json", "x-real-ip": ip, ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, json: (await res.json().catch(() => ({}))) as any };
};

const [parent] = await sql`insert into parents (auth_user_id) values ${"e2e-" + Date.now()} returning id`.catch(async () =>
  await sql`insert into parents (auth_user_id) values (${"e2e-" + Date.now()}) returning id`);
try {
  const pinHash = await hashPin("1234");
  const [kid] = await sql`insert into kids (parent_id, name, grade, minutes_per_question, daily_cap_minutes, pin_hash)
    values (${parent.id}, 'E2E', 4, 10, 25, ${pinHash}) returning id`;
  const [set] = await sql`insert into homework_sets (kid_id, subject, status) values (${kid.id}, 'Math', 'assigned') returning id`;
  const qs = [
    ["2+2?", "numeric", null, "4"],
    ["Pick b", "multiple_choice", ["a", "b", "c"], "b"],
    ["3+3?", "numeric", null, "6"],
    ["4+4?", "numeric", null, "8"],
  ];
  const ids: string[] = [];
  for (const [i, q] of qs.entries()) {
    const [r] = await sql`insert into questions (set_id, text, type, options, answer_key, confirmed, position)
      values (${set.id}, ${q[0]}, ${q[1]}, ${q[2]}, ${q[3]}, true, ${i}) returning id`;
    ids.push(r.id);
  }
  const code = generatePairingCode();
  await sql`insert into devices (kid_id, platform, pairing_code, pairing_expires_at)
    values (${kid.id}, 'android', ${code}, ${pairingExpiry(new Date()).toISOString()})`;

  // pairing
  check("bad code rejected", (await call("/api/device/pair", null, { code: "ZZZZZZZZ" })).status === 404);
  const paired = await call("/api/device/pair", null, { code });
  check("pair ok", paired.status === 200 && !!paired.json.token, paired);
  const token = paired.json.token;
  check("code is single-use", (await call("/api/device/pair", null, { code })).status === 404);

  // auth + PIN
  check("state needs token", (await call("/api/kid/state", null)).status === 401);
  check("state needs PIN", (await call("/api/kid/state", token)).status === 403);
  check("answer needs PIN", (await call("/api/kid/answer", token, { questionId: ids[0], answer: "4" })).status === 403);
  check("wrong pin 401", (await call("/api/kid/unlock", token, { pin: "0000" })).status === 401);
  check("right pin ok", (await call("/api/kid/unlock", token, { pin: "1234" })).status === 200);

  // state hides the key and orders by position
  let st = await call("/api/kid/state", token);
  check("state ok, first question, no answerKey", st.status === 200 && st.json.question.text === "2+2?" && !JSON.stringify(st.json).includes("answerKey"), st);
  check("balance starts 0", st.json.balanceMinutes === 0);

  // answers: 3 tries per question, retry earns half
  let a = await call("/api/kid/answer", token, { questionId: ids[0], answer: "5" });
  check("wrong -> 2 tries left, 0 earned", a.json.correct === false && a.json.attemptsLeft === 2 && a.json.earnedMinutes === 0, a);
  st = await call("/api/kid/state", token);
  check("same question still offered", st.json.question.id === ids[0], st.json);
  a = await call("/api/kid/answer", token, { questionId: ids[0], answer: "4" });
  check("retry correct earns half (5)", a.json.correct === true && a.json.earnedMinutes === 5, a);
  a = await call("/api/kid/answer", token, { questionId: ids[0], answer: "4" });
  check("solved question is closed", a.status === 409, a);
  for (const [i, ans] of ["a", "c", "a"].entries()) {
    a = await call("/api/kid/answer", token, { questionId: ids[1], answer: ans });
    check(`mc wrong #${i + 1}`, a.json.correct === false && a.json.attemptsLeft === 2 - i, a);
  }
  a = await call("/api/kid/answer", token, { questionId: ids[1], answer: "b" });
  check("no 4th try even if right", a.status === 409, a);
  st = await call("/api/kid/state", token);
  check("moved on to next question", st.json.question.id === ids[2], st.json);
  a = await call("/api/kid/answer", token, { questionId: ids[2], answer: "6" });
  check("first-try correct earns 10 (15 total)", a.json.earnedMinutes === 10, a);
  a = await call("/api/kid/answer", token, { questionId: ids[3], answer: "8" });
  check("daily cap 25 -> only 10 more", a.json.correct === true && a.json.earnedMinutes === 10, a);
  st = await call("/api/kid/state", token);
  check("balance 25, no more questions", st.json.balanceMinutes === 25 && st.json.question === null, st.json);

  // spend
  check("cannot overspend", (await call("/api/kid/spend", token, { minutes: 30 })).status === 409);
  const sp = await call("/api/kid/spend", token, { minutes: 10 });
  check("spend 10 ok", sp.status === 200 && !!sp.json.endsAt, sp);
  check("no second session", (await call("/api/kid/spend", token, { minutes: 5 })).status === 409);
  st = await call("/api/kid/state", token);
  check("balance 15 + active session", st.json.balanceMinutes === 15 && !!st.json.session, st.json);

  // PIN lockout
  for (let i = 0; i < 5; i++) await call("/api/kid/unlock", token, { pin: "9999" });
  const locked = await call("/api/kid/unlock", token, { pin: "1234" });
  check("locked after 5 wrong tries", locked.status === 429, locked);

  // rate limit: 10 pairing attempts per IP per 15 minutes
  const noisyIp = `${RUN_IP}-noisy`;
  const codes: number[] = [];
  for (let i = 0; i < 11; i++) codes.push((await call("/api/device/pair", null, { code: "ZZZZZZZZ" }, noisyIp)).status);
  check("10 pair attempts allowed, 11th is 429", codes.slice(0, 10).every((c) => c === 404) && codes[10] === 429, codes);
  check("other IPs unaffected", (await call("/api/device/pair", null, { code: "ZZZZZZZZ" }, `${RUN_IP}-other`)).status === 404);
} finally {
  await sql`delete from rate_limits where key like ${"pair:" + RUN_IP + "%"}`;
  await sql`delete from parents where id = ${parent.id}`;
  console.log("cleaned up");
}
process.exit(failed ? 1 : 0);
