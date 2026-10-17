/* eslint-disable @typescript-eslint/no-explicit-any -- loose JSON in a test script */
// End-to-end test of the kid API against a real database.
// Needs DATABASE_URL and a running server (npm run dev). It creates a throwaway
// parent, kid and homework set, and deletes them when it finishes.
//   npm run test:e2e            (E2E_BASE_URL overrides http://localhost:3000;
//                                E2E_BYPASS sends the Vercel protection-bypass header)
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
    headers: { "content-type": "application/json", "x-real-ip": ip,
      ...(process.env.E2E_BYPASS ? { "x-vercel-protection-bypass": process.env.E2E_BYPASS } : {}), ...(token ? { authorization: `Bearer ${token}` } : {}) },
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
  check("sync works before the PIN is entered", (await call("/api/kid/sync", token)).status === 200);
  check("answer needs PIN", (await call("/api/kid/answer", token, { questionId: ids[0], answer: "4" })).status === 403);
  check("wrong pin 401", (await call("/api/kid/unlock", token, { pin: "0000" })).status === 401);
  check("right pin ok", (await call("/api/kid/unlock", token, { pin: "1234" })).status === 200);

  // state hides the key and orders by position
  let st = await call("/api/kid/state", token);
  check("state ok, first question, no answerKey", st.status === 200 && st.json.question.text === "2+2?" && !JSON.stringify(st.json).includes("answerKey"), st);
  check("balance starts 0", st.json.balanceMinutes === 0);
  check("state includes serverNow and a schedule", typeof st.json.serverNow === "string" && Array.isArray(st.json.schedule?.rules), st.json);

  // paper upload (validation paths only; the AI itself is tested separately)
  const paperCall = async (tok: string | null, fields: Record<string, string | Blob>) => {
    const fd = new FormData();
    for (const [k, v] of Object.entries(fields)) fd.set(k, v);
    const r = await fetch(BASE + "/api/kid/paper", {
      method: "POST",
      headers: { "x-real-ip": RUN_IP, ...(tok ? { authorization: `Bearer ${tok}` } : {}), ...(process.env.E2E_BYPASS ? { "x-vercel-protection-bypass": process.env.E2E_BYPASS } : {}) },
      body: fd,
    });
    return r.status;
  };
  const png = new Blob([new Uint8Array([137, 80, 78, 71])], { type: "image/png" });
  const txt = new Blob(["hello"], { type: "text/plain" });
  check("paper upload needs a token", (await paperCall(null, { setId: set.id, image: png })) === 401);
  check("paper upload needs a setId", (await paperCall(token, { image: png })) === 400);
  check("paper upload refuses another kid's or unknown homework", (await paperCall(token, { setId: "00000000-0000-4000-8000-000000000000", image: png })) === 404);
  check("paper upload refuses non-image files", (await paperCall(token, { setId: set.id, image: txt })) === 415);
  check("paper upload needs a photo", (await paperCall(token, { setId: set.id })) === 400);
  check("state lists the homework a paper can be sent for", Array.isArray(st.json.paperSets) && st.json.paperSets.some((x: { id: string }) => x.id === set.id), st.json.paperSets);
  check("state says AI checking is off by default", st.json.aiCheckEnabled === false, st.json.aiCheckEnabled);
  check("paper upload refuses an unknown mode", (await paperCall(token, { setId: set.id, image: png, mode: "robot" })) === 400);
  check("choosing AI is refused while a parent has it off", (await paperCall(token, { setId: set.id, image: png, mode: "ai" })) === 403);
  check("choosing a parent check works without any AI", (await paperCall(token, { setId: set.id, image: png, mode: "parent" })) === 200);
  const queued = await sql`select count(*)::int as n, bool_or(ai_read) as ai_read from paper_submissions where kid_id = ${kid.id}`;
  const photos = await sql`select count(*)::int as n from paper_images pi join paper_submissions ps on ps.id = pi.submission_id where ps.kid_id = ${kid.id}`;
  check("that paper waits for the parent, unread by the AI, with its photo kept", queued[0].n === 1 && queued[0].ai_read === false && photos[0].n === 1, { queued, photos });

  const pdf = new Blob(["%PDF-1.4 fake"], { type: "application/pdf" });
  check("a PDF is accepted for a parent check", (await paperCall(token, { setId: set.id, image: pdf, mode: "parent" })) === 200);
  const pdfs = await sql`select count(*)::int as n from paper_images pi join paper_submissions ps on ps.id = pi.submission_id where ps.kid_id = ${kid.id} and pi.content_type = 'application/pdf'`;
  check("the PDF is stored as a PDF", pdfs[0].n === 1, pdfs);

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

  // usage: the phone reports screen time it measured; no sessions, no choosing minutes
  const key = `e2e-${Date.now()}`;
  check("usage needs a token", (await call("/api/kid/usage", null, { minutes: 5, key })).status === 401);
  check("usage rejects bad input", (await call("/api/kid/usage", token, { minutes: 0, key })).status === 400);
  let u = await call("/api/kid/usage", token, { minutes: 10, key });
  check("usage 10 min -> balance 15", u.status === 200 && u.json.balanceMinutes === 15, u);
  u = await call("/api/kid/usage", token, { minutes: 10, key });
  check("same key is not charged twice", u.json.balanceMinutes === 15, u);
  u = await call("/api/kid/usage", token, { minutes: 100, key: key + "-big" });
  check("usage never goes below zero", u.json.balanceMinutes === 0, u);
  const sync = await call("/api/kid/sync", token);
  check(
    "sync works and has balance, schedule and server clock",
    sync.status === 200 && sync.json.balanceMinutes === 0 && Array.isArray(sync.json.schedule?.rules) && typeof sync.json.schedule?.timezone === "string" && !Number.isNaN(Date.parse(sync.json.serverNow)),
    sync,
  );
  check("sync needs a token", (await call("/api/kid/sync", null)).status === 401);
  check("sync has no approval by default", sync.json.approvedUntil === null, sync.json);
  check("parent-unlock needs a token", (await call("/api/kid/parent-unlock", null, { pin: "123456" })).status === 401);
  check("parent-unlock rejects a bad PIN format", (await call("/api/kid/parent-unlock", token, { pin: "12" })).status === 400);
  check("parent-unlock says no PIN is set yet", (await call("/api/kid/parent-unlock", token, { pin: "123456" })).status === 403);
  check("spend endpoint is gone", (await call("/api/kid/spend", token, { minutes: 5 })).status === 404);

  // PIN lockout
  for (let i = 0; i < 5; i++) await call("/api/kid/unlock", token, { pin: "9999" });
  const locked = await call("/api/kid/unlock", token, { pin: "1234" });
  check("locked after 5 wrong tries", locked.status === 429, locked);


  // parent app (Android): pair with a code made on the website, then manage kids and papers
  const appCode = generatePairingCode();
  await sql`insert into parent_devices (parent_id, pairing_code, pairing_expires_at) values (${parent.id}, ${appCode}, ${pairingExpiry(new Date()).toISOString()})`;
  const [other] = await sql`insert into parents (auth_user_id) values (${"e2e-other-" + Date.now()}) returning id`;
  try {
    check("parent state needs a token", (await call("/api/parent/state", null)).status === 401);
    check("a kid token is not a parent token", (await call("/api/parent/state", token)).status === 401);
    check("parent pair rejects a wrong code", (await call("/api/parent/pair", null, { code: "ZZZZZZZZ" }, `${RUN_IP}-pp`)).status === 404);
    const pp = await call("/api/parent/pair", null, { code: appCode, name: "E2E phone" }, `${RUN_IP}-pp`);
    check("parent pair ok", pp.status === 200 && !!pp.json.token, pp);
    check("parent code is single-use", (await call("/api/parent/pair", null, { code: appCode }, `${RUN_IP}-pp`)).status === 404);
    const ptoken = pp.json.token;

    let ps = await call("/api/parent/state", ptoken);
    check("parent state lists the kid", ps.status === 200 && ps.json.kids.length === 1 && ps.json.kids[0].name === "E2E", ps);
    const kidId = ps.json.kids[0].id;
    check("kid starts with ai off", ps.json.kids[0].aiCheckEnabled === false);

    const act = (id: string, body: unknown, tok = ptoken) => call(`/api/parent/kids/${id}`, tok, body);
    const bonus = await act(kidId, { action: "bonus", minutes: 15 });
    check("bonus adds minutes", bonus.status === 200 && bonus.json.balanceMinutes === 15 && bonus.json.changedMinutes === 15, bonus);
    check("bonus rejects 0", (await act(kidId, { action: "bonus", minutes: 0 })).status === 400);
    check("bonus rejects 1000", (await act(kidId, { action: "bonus", minutes: 1000 })).status === 400);
    const wd = await act(kidId, { action: "withdraw", minutes: 5 });
    check("withdraw takes minutes", wd.status === 200 && wd.json.balanceMinutes === 10 && wd.json.changedMinutes === 5, wd);
    const reset = await act(kidId, { action: "reset" });
    check("reset empties the bank", reset.json.balanceMinutes === 0 && reset.json.changedMinutes === 10, reset);
    check("ai can be turned on", (await act(kidId, { action: "ai", enabled: true })).status === 200);
    ps = await call("/api/parent/state", ptoken);
    check("state shows ai on", ps.json.kids[0].aiCheckEnabled === true);
    check("allow settings", (await act(kidId, { action: "allow_settings" })).status === 200);
    ps = await call("/api/parent/state", ptoken);
    check("state shows settings approved", ps.json.kids[0].approvedForSettings === true);
    await act(kidId, { action: "block_settings" });
    check("unknown action rejected", (await act(kidId, { action: "nope" })).status === 400);

    // kid management from the app: create, edit, schedule, phones, homework
    const made = await call("/api/parent/kids", ptoken, { profile: { name: "App kid", grade: 2, minutesPerQuestion: 5, dailyCapMinutes: 60, uiStyle: "little" }, pin: "4321" });
    check("create a kid", made.status === 200 && !!made.json.id, made);
    check("create rejects a bad grade", (await call("/api/parent/kids", ptoken, { profile: { name: "x", grade: 20, minutesPerQuestion: 5, dailyCapMinutes: 60 } })).status === 400);
    check("create rejects a bad PIN", (await call("/api/parent/kids", ptoken, { profile: { name: "x", grade: 3, minutesPerQuestion: 5, dailyCapMinutes: 60 }, pin: "12" })).status === 400);
    const newId = made.json.id;
    let detail = await call(`/api/parent/kids/${newId}`, ptoken);
    check("detail shows the profile and a PIN", detail.status === 200 && detail.json.name === "App kid" && detail.json.hasPin === true && detail.json.uiStyle === "little", detail);
    check("update changes the profile", (await act(newId, { action: "update", profile: { name: "Renamed", grade: 5, minutesPerQuestion: 8, dailyCapMinutes: 90, uiStyle: "auto" } })).status === 200);
    detail = await call(`/api/parent/kids/${newId}`, ptoken);
    check("detail has the new profile", detail.json.name === "Renamed" && detail.json.grade === 5 && detail.json.minutesPerQuestion === 8 && detail.json.hasPin === true, detail.json);
    check("update rejects bad input", (await act(newId, { action: "update", profile: { name: "", grade: 5, minutesPerQuestion: 8, dailyCapMinutes: 90 } })).status === 400);
    check("rule: bad time rejected", (await act(newId, { action: "add_rule", mode: "blocked", days: 31, start: "25:00", end: "07:00" })).status === 400);
    check("rule: no days rejected", (await act(newId, { action: "add_rule", mode: "blocked", days: 0, start: "21:00", end: "07:00" })).status === 400);
    check("rule added", (await act(newId, { action: "add_rule", mode: "blocked", days: 31, start: "21:00", end: "07:00" })).status === 200);
    detail = await call(`/api/parent/kids/${newId}`, ptoken);
    check("detail lists the rule", detail.json.schedule.length === 1 && detail.json.schedule[0].startMinute === 1260 && detail.json.schedule[0].endMinute === 420, detail.json.schedule);
    check("rule deleted", (await act(newId, { action: "delete_rule", ruleId: detail.json.schedule[0].id })).status === 200);
    detail = await call(`/api/parent/kids/${newId}`, ptoken);
    check("detail has no rules left", detail.json.schedule.length === 0);
    const phone = await act(newId, { action: "pair_phone" });
    check("a pairing code for the kid's phone", phone.status === 200 && /^[A-Z2-9]{8}$/.test(phone.json.code), phone);
    const kidPair = await call("/api/device/pair", null, { code: phone.json.code }, `${RUN_IP}-kp`);
    check("the kid's phone can pair with it", kidPair.status === 200 && !!kidPair.json.token, kidPair);
    check("no homework yet", (await call(`/api/parent/kids/${newId}`, ptoken)).json.homework.length === 0);
    check("homework needs a subject and questions", (await call(`/api/parent/kids/${newId}/homework`, ptoken, { subject: "", questions: [] })).status === 400);
    check("homework key must match an option", (await call(`/api/parent/kids/${newId}/homework`, ptoken, { subject: "Math", questions: [{ text: "Pick", type: "multiple_choice", options: ["a", "b"], answerKey: "c" }] })).status === 400);
    const hw = await call(`/api/parent/kids/${newId}/homework`, ptoken, { subject: "Math", questions: [{ text: "1+1?", type: "numeric", options: null, answerKey: "2" }, { text: "Pick b", type: "multiple_choice", options: ["a", "b"], answerKey: "b" }] });
    check("homework assigned", hw.status === 200 && !!hw.json.id, hw);
    detail = await call(`/api/parent/kids/${newId}`, ptoken);
    check("results list the set", detail.json.homework.length === 1 && detail.json.homework[0].total === 2 && detail.json.homework[0].questions[0].answerKey === "2", detail.json.homework);
    check("extract needs a token", (await call("/api/parent/homework/extract", null, { x: 1 })).status === 401);
    check("extract needs an image", (await call("/api/parent/homework/extract", ptoken, { x: 1 })).status === 400);
    const kidToken = kidPair.json.token;
    check("kid with a PIN set can unlock", (await call("/api/kid/unlock", kidToken, { pin: "4321" })).status === 200);
    const kst = await call("/api/kid/state", kidToken);
    check("kid sees the assigned question", kst.status === 200 && kst.json.question?.text === "1+1?", kst.json);


    // edit and remove homework: earned minutes must survive both
    const setId = hw.json.id;
    const q0 = detail.json.homework[0].questions[0];
    const q1 = detail.json.homework[0].questions[1];
    const ans = await call("/api/kid/answer", kidToken, { questionId: q0.id, answer: "2" });
    check("kid answers the first question", ans.status === 200 && ans.json.correct === true && ans.json.earnedMinutes > 0, ans);
    const earnedMin = ans.json.earnedMinutes;
    const bal = async () => (await call("/api/parent/state", ptoken)).json.kids.find((k: any) => k.id === newId).balanceMinutes;
    check("bank holds the earned minutes", (await bal()) === earnedMin);
    const edit = (body: unknown, sid = setId, tok = ptoken) => fetch(`${BASE}/api/parent/kids/${newId}/homework/${sid}`, {
      method: "PUT", headers: { "content-type": "application/json", authorization: `Bearer ${tok}`, ...(process.env.E2E_BYPASS ? { "x-vercel-protection-bypass": process.env.E2E_BYPASS } : {}) }, body: JSON.stringify(body) });
    check("edit needs a token", (await edit({ subject: "x", questions: [] }, setId, "nope")).status === 401);
    check("edit rejects an empty set", (await edit({ subject: "Math", questions: [] })).status === 400);
    check("edit rejects a bad key", (await edit({ subject: "Math", questions: [{ id: q1.id, text: "Pick b", type: "multiple_choice", options: ["a", "b"], answerKey: "z" }] })).status === 400);
    check("edit rejects an unknown set", (await edit({ subject: "Math", questions: [{ text: "x", type: "numeric", options: null, answerKey: "1" }] }, crypto.randomUUID())).status === 404);
    const edited = await edit({ subject: "Maths", questions: [
      { id: q1.id, text: "Pick the letter b", type: "multiple_choice", options: ["a", "b", "c"], answerKey: "c" },
      { text: "5-2?", type: "numeric", options: null, answerKey: "3" },
    ] });
    check("edit ok (one changed, one added, one removed)", edited.status === 200);
    detail = await call(`/api/parent/kids/${newId}`, ptoken);
    const h0 = detail.json.homework[0];
    check("set has the new subject and two questions", h0.subject === "Maths" && h0.total === 2, h0);
    check("the changed question kept its id and got the new key", h0.questions[0].id === q1.id && h0.questions[0].answerKey === "c" && h0.questions[0].options.length === 3, h0.questions);
    check("the added question is last", h0.questions[1].text === "5-2?" && h0.questions[1].answerKey === "3");
    check("the removed question is gone", !h0.questions.some((q: any) => q.id === q0.id));
    check("earned minutes survive removing the question", (await bal()) === earnedMin);
    check("another set id of another kid is not editable", (await fetch(`${BASE}/api/parent/kids/${kidId}/homework/${setId}`, { method: "DELETE", headers: { authorization: `Bearer ${ptoken}` } })).status === 404);
    const del = await fetch(`${BASE}/api/parent/kids/${newId}/homework/${setId}`, { method: "DELETE", headers: { authorization: `Bearer ${ptoken}`, ...(process.env.E2E_BYPASS ? { "x-vercel-protection-bypass": process.env.E2E_BYPASS } : {}) } });
    check("delete ok", del.status === 200);
    check("delete twice is 404", (await fetch(`${BASE}/api/parent/kids/${newId}/homework/${setId}`, { method: "DELETE", headers: { authorization: `Bearer ${ptoken}` } })).status === 404);
    check("earned minutes survive deleting the set", (await bal()) === earnedMin);
    check("the set is gone from the results", (await call(`/api/parent/kids/${newId}`, ptoken)).json.homework.length === 0);
    check("the kid has no question left", (await call("/api/kid/state", kidToken)).json.question === null);

    // messages to the kid: a note, and the result of a checked paper
    check("a message needs text", (await act(newId, { action: "message", text: "  " })).status === 400);
    check("a parent sends a note", (await act(newId, { action: "message", text: "Well done this week!" })).status === 200);
    let mst = await call("/api/kid/state", kidToken);
    check("the kid sees the note, unread", mst.json.messages.length === 1 && mst.json.messages[0].body === "Well done this week!" && mst.json.messages[0].kind === "note", mst.json.messages);
    const [mset] = await sql`insert into homework_sets (kid_id, subject, status) values (${newId}, 'Science', 'assigned') returning id`;
    const mq = [];
    for (const [i, t] of ["Q1", "Q2"].entries()) {
      const [r] = await sql`insert into questions (set_id, text, type, options, answer_key, confirmed, position) values (${mset.id}, ${t}, 'numeric', null, ${String(i + 1)}, true, ${i}) returning id`;
      mq.push(r.id);
    }
    const [msub] = await sql`insert into paper_submissions (kid_id, set_id, submitted_by, mode, ai_read) values (${newId}, ${mset.id}, 'kid', 'parent', false) returning id`;
    for (const qid of mq) await sql`insert into paper_answers (submission_id, question_id, legible, ai_correct) values (${msub.id}, ${qid}, false, false)`;
    const decided = await call(`/api/parent/papers/${msub.id}`, ptoken, { decision: "approve", correct: [mq[0]], note: "Check question 2 again" });
    check("the paper is approved with a note", decided.status === 200 && decided.json.correctCount === 1, decided);
    mst = await call("/api/kid/state", kidToken);
    const resultMsg = mst.json.messages.find((m: any) => m.kind === "result");
    check("the kid is told the result and the note", !!resultMsg && resultMsg.body.startsWith("Science: 1 of 2 right.") && resultMsg.body.endsWith("Check question 2 again"), mst.json.messages);
    check("newest message comes first", mst.json.messages[0].kind === "result");
    check("marking one message read", (await call("/api/kid/messages/read", kidToken, { ids: [resultMsg.id] })).status === 200);
    mst = await call("/api/kid/state", kidToken);
    check("only the other message is left", mst.json.messages.length === 1 && mst.json.messages[0].kind === "note", mst.json.messages);
    check("marking all read", (await call("/api/kid/messages/read", kidToken, {})).status === 200);
    check("no unread messages", (await call("/api/kid/state", kidToken)).json.messages.length === 0);
    check("messages need a token", (await call("/api/kid/messages/read", null, {})).status === 401);
    const [msub2] = await sql`insert into paper_submissions (kid_id, set_id, submitted_by, mode, ai_read) values (${newId}, ${mset.id}, 'kid', 'parent', false) returning id`;
    check("a paper sent back tells the kid", (await call(`/api/parent/papers/${msub2.id}`, ptoken, { decision: "reject", note: "Please redo it" })).status === 200);
    mst = await call("/api/kid/state", kidToken);
    check("the kid is told it was sent back", mst.json.messages[0]?.body === "Science: your parent sent the paper back. Please redo it", mst.json.messages);
    await call("/api/kid/messages/read", kidToken, {});

    // notifications: the lists the website and the app ask, and the Web Push endpoints
    const pend = await call("/api/parent/pending", ptoken);
    check("the app can ask what is waiting", pend.status === 200 && Array.isArray(pend.json.papers) && pend.json.papers.length >= 1, pend.json);
    check("pending needs a token", (await call("/api/parent/pending", null)).status === 401);
    check("the website list needs a sign-in", (await call("/api/web/pending", null)).status === 401);
    check("subscribing needs a sign-in", (await call("/api/push/subscribe", null, { endpoint: "https://example.com/x", keys: { p256dh: "x".repeat(20), auth: "y".repeat(20) } })).status === 401);
    check("the test notification needs a sign-in", (await call("/api/push/test", null, {})).status === 401);
    const key1 = await call("/api/push/key", null);
    const key2 = await call("/api/push/key", null);
    check("the public push key is served and stable", key1.status === 200 && key1.json.publicKey.length > 60 && key1.json.publicKey === key2.json.publicKey, key1.json);
    check("the service worker is served", (await fetch(`${BASE}/sw.js`)).status === 200);

    // performance: numbers for a period, and the AI assessment
    const perf = await call(`/api/parent/kids/${kidId}/performance?period=week`, ptoken);
    check("performance numbers come back", perf.status === 200 && perf.json.stats.totals.attempts >= 5 && perf.json.stats.subjects[0].subject === "Math", perf.json?.stats?.totals);
    check("the trend has seven days", perf.json.stats.trend.length === 7);
    check("the hardest questions are listed", perf.json.stats.hardest.length >= 1 && typeof perf.json.stats.hardest[0].answerKey === "string");
    check("month and year work too", (await call(`/api/parent/kids/${kidId}/performance?period=month`, ptoken)).json.stats.trend.length === 6 && (await call(`/api/parent/kids/${kidId}/performance?period=year`, ptoken)).json.stats.trend.length === 12);
    check("a bad period is refused", (await call(`/api/parent/kids/${kidId}/performance?period=decade`, ptoken)).status === 400);
    check("performance needs a token", (await call(`/api/parent/kids/${kidId}/performance?period=week`, null)).status === 401);
    check("assessing needs a valid period", (await call(`/api/parent/kids/${kidId}/performance`, ptoken, { period: "decade" })).status === 400);
    const blank = await call("/api/parent/kids", ptoken, { profile: { name: "Blank", grade: 3, minutesPerQuestion: 5, dailyCapMinutes: 60 } });
    check("nothing to assess for a kid without answers", (await call(`/api/parent/kids/${blank.json.id}/performance`, ptoken, { period: "week" })).status === 409);
    if (process.env.E2E_ASSESS) {
      const assessed = await call(`/api/parent/kids/${kidId}/performance`, ptoken, { period: "week" });
      check("the AI assessment is made and saved", assessed.status === 200 && assessed.json.assessment.summary.length > 20 && Array.isArray(assessed.json.assessment.weaknesses), assessed.json);
      const again = await call(`/api/parent/kids/${kidId}/performance?period=week`, ptoken);
      check("the saved assessment is listed", again.json.reports.length >= 1 && again.json.reports[0].period === "week");
    }

    // practice: the parent sends a set, the kid gets it; automatic practice settings; the cron route is closed to strangers
    const practiceUrl = `/api/parent/kids/${newId}/practice`;
    check("practice needs a token", (await call(practiceUrl, null, { action: "send", subject: "x", questions: [] })).status === 401);
    check("practice refuses an unknown action", (await call(practiceUrl, ptoken, { action: "dance" })).status === 400);
    check("a practice set needs questions", (await call(practiceUrl, ptoken, { action: "send", subject: "Practice: sums", questions: [] })).status === 400);
    check("a practice key must fit the question", (await call(practiceUrl, ptoken, { action: "send", subject: "Practice", questions: [{ text: "x", type: "numeric", options: null, answerKey: "many" }] })).status === 400);
    const sentSet = await call(practiceUrl, ptoken, { action: "send", subject: "Practice: sums", questions: [{ text: "What is 6 + 7?", type: "numeric", options: null, answerKey: "13" }, { text: "Pick the even one", type: "multiple_choice", options: ["3", "4", "5"], answerKey: "4" }] });
    check("a practice set is sent", sentSet.status === 200 && !!sentSet.json.id, sentSet);
    const pst = await call("/api/kid/state", kidToken);
    check("the practice waits behind the homework the kid already has, and a message tells them", pst.json.question?.subject === "Science" && pst.json.paperSets.some((x: any) => x.subject === "Practice: sums") && pst.json.messages.some((m: any) => m.kind === "practice" && m.body.includes("Practice: sums")), pst.json);
    const pd = await call(`/api/parent/kids/${newId}`, ptoken);
    check("the set is marked as practice in the results", pd.json.homework.some((h: any) => h.kind === "practice" && h.subject === "Practice: sums"), pd.json.homework);
    await call("/api/kid/messages/read", kidToken, {});
    check("automatic practice can be switched on", (await act(newId, { action: "auto_practice", mode: "daily", size: 4 })).status === 200);
    const ad = await call(`/api/parent/kids/${newId}`, ptoken);
    check("detail shows the automatic practice setting", ad.json.autoPractice === "daily" && ad.json.autoPracticeSize === 4, ad.json);
    check("an unknown automatic mode is refused", (await act(newId, { action: "auto_practice", mode: "hourly", size: 4 })).status === 400);
    check("a bad size is refused", (await act(newId, { action: "auto_practice", mode: "daily", size: 50 })).status === 400);
    await act(newId, { action: "auto_practice", mode: "off", size: 5 });
    check("the cron route is closed to strangers", (await fetch(`${BASE}/api/cron/practice`, { headers: { "user-agent": "curl/8" } })).status === 401);
    if (process.env.E2E_ASSESS) {
      const made = await call(`/api/parent/kids/${kidId}/practice`, ptoken, { action: "generate", period: "week", count: 3 });
      check("the AI makes practice questions", made.status === 200 && made.json.questions.length >= 1 && typeof made.json.subject === "string", made.json);
    }

    // a pending paper: review it and approve two of the questions
    const [sub] = await sql`insert into paper_submissions (kid_id, set_id, submitted_by, mode, ai_read) values (${kid.id}, ${set.id}, 'kid', 'parent', false) returning id`;
    for (const qid of ids) await sql`insert into paper_answers (submission_id, question_id, legible, ai_correct) values (${sub.id}, ${qid}, false, false)`;
    ps = await call("/api/parent/state", ptoken);
    check("state lists the pending paper", ps.json.papers.some((p: any) => p.id === sub.id) && ps.json.kids[0].papersToReview >= 1, ps.json);
    const paper = await call(`/api/parent/papers/${sub.id}`, ptoken);
    check("paper has the questions with keys", paper.status === 200 && paper.json.answers.length === 4 && paper.json.answers[0].answerKey === "4", paper);
    check("paper unknown to others is 404", (await call(`/api/parent/papers/${crypto.randomUUID()}`, ptoken)).status === 404);
    check("paper needs a token", (await call(`/api/parent/papers/${sub.id}`, null)).status === 401);
    const [pdfSub] = await sql`select ps.id from paper_submissions ps join paper_images pi on pi.submission_id = ps.id where ps.kid_id = ${kid.id} and pi.content_type = 'application/pdf' limit 1`;
    const pdfPaper = await call(`/api/parent/papers/${pdfSub.id}`, ptoken);
    check("the parent app sees that the page is a PDF", pdfPaper.status === 200 && pdfPaper.json.imageTypes[0] === "application/pdf" && pdfPaper.json.imageCount === 1, pdfPaper.json);
    const pdfRes = await fetch(`${BASE}/api/parent/papers/${pdfSub.id}/image/0`, { headers: { authorization: `Bearer ${ptoken}`, ...(process.env.E2E_BYPASS ? { "x-vercel-protection-bypass": process.env.E2E_BYPASS } : {}) } });
    check("the PDF comes back as a PDF", pdfRes.status === 200 && pdfRes.headers.get("content-type") === "application/pdf" && (await pdfRes.text()).startsWith("%PDF"));
    check("paper photo is 404 when none stored", (await call(`/api/parent/papers/${sub.id}/image/0`, ptoken)).status === 404);
    const tick = paper.json.answers.filter((a: any) => !a.alreadySolved).slice(0, 2).map((a: any) => a.questionId);
    check("some questions are still unsolved", tick.length > 0, paper.json.answers);
    const before = (await call("/api/parent/state", ptoken)).json.kids[0].balanceMinutes;
    const approved = await call(`/api/parent/papers/${sub.id}`, ptoken, { decision: "approve", correct: tick });
    check("approve pays for the ticked answers", approved.status === 200 && approved.json.correctCount === tick.length && approved.json.awardedMinutes >= 0, approved);
    const after = (await call("/api/parent/state", ptoken)).json.kids[0].balanceMinutes;
    check("balance grew by the award", after - before === approved.json.awardedMinutes, { before, after });
    check("approving twice is refused", (await call(`/api/parent/papers/${sub.id}`, ptoken, { decision: "approve", correct: ids })).status === 409);
    check("rejecting a decided paper is refused", (await call(`/api/parent/papers/${sub.id}`, ptoken, { decision: "reject" })).status === 409);

    // a second parent's token must see nothing of this family
    const otherToken = "e2e-other-token-" + Date.now();
    const { hashToken } = await import("../src/lib/pairing.ts");
    await sql`insert into parent_devices (parent_id, token_hash) values (${other.id}, ${hashToken(otherToken)})`;
    const os = await call("/api/parent/state", otherToken);
    check("another parent sees no kids", os.status === 200 && os.json.kids.length === 0, os);
    check("another parent cannot act on the kid", (await call(`/api/parent/kids/${kidId}`, otherToken, { action: "bonus", minutes: 5 })).status === 404);
    check("another parent cannot read the paper", (await call(`/api/parent/papers/${sub.id}`, otherToken)).status === 404);
    check("another parent cannot decide the paper", (await call(`/api/parent/papers/${sub.id}`, otherToken, { decision: "reject" })).status === 404);
    check("another parent cannot make practice", (await call(`/api/parent/kids/${kidId}/practice`, otherToken, { action: "generate", period: "week", count: 3 })).status === 404);
    check("another parent cannot send practice", (await call(`/api/parent/kids/${kidId}/practice`, otherToken, { action: "send", subject: "x", questions: [] })).status === 404);
    check("another parent cannot see the performance", (await call(`/api/parent/kids/${kidId}/performance?period=week`, otherToken)).status === 404);
    check("another parent cannot assess", (await call(`/api/parent/kids/${kidId}/performance`, otherToken, { period: "week" })).status === 404);
    check("another parent cannot read a kid", (await call(`/api/parent/kids/${kidId}`, otherToken)).status === 404);
    check("another parent cannot add homework", (await call(`/api/parent/kids/${kidId}/homework`, otherToken, { subject: "x", questions: [{ text: "q", type: "numeric", options: null, answerKey: "1" }] })).status === 404);
    check("another parent cannot pair a phone", (await call(`/api/parent/kids/${kidId}`, otherToken, { action: "pair_phone" })).status === 404);
    check("another parent cannot ask the AI", (await call(`/api/parent/papers/${sub.id}/ai`, otherToken, {})).status === 404);
  } finally {
    await sql`delete from parents where id = ${other.id}`;
    await sql`delete from rate_limits where key like ${"parent-pair:" + RUN_IP + "%"}`;
  }

  // rate limit: 10 pairing attempts per IP per 15 minutes. On a deployed server the platform sets the
  // real client IP (a spoofed header is ignored), so the exact count and per-IP isolation are only
  // checked locally; remotely we only require that the limit kicks in.
  const remote = !!process.env.E2E_BASE_URL;
  const noisyIp = `${RUN_IP}-noisy`;
  const codes: number[] = [];
  for (let i = 0; i < 12; i++) codes.push((await call("/api/device/pair", null, { code: "ZZZZZZZZ" }, noisyIp)).status);
  if (remote) {
    check("pairing is rate limited (429 within 12 attempts)", codes.includes(429), codes);
  } else {
    check("10 pair attempts allowed, 11th is 429", codes.slice(0, 10).every((c) => c === 404) && codes[10] === 429, codes);
    check("other IPs unaffected", (await call("/api/device/pair", null, { code: "ZZZZZZZZ" }, `${RUN_IP}-other`)).status === 404);
  }
} finally {
  await sql`delete from rate_limits where key like ${"pair:" + RUN_IP + "%"}`;
  await sql`delete from parents where id = ${parent.id}`;
  console.log("cleaned up");
}
process.exit(failed ? 1 : 0);
