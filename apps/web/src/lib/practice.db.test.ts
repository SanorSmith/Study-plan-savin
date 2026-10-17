// Runs against a real database, so it only runs when DATABASE_URL is set. The AI is replaced by a fixed answer.
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { getDb } from "@/db";
import { attempts, homeworkSets, kidMessages, kids, parents, questions } from "@/db/schema";

vi.mock("@/lib/practice-ai", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/practice-ai")>();
  return {
    ...real,
    generatePractice: vi.fn(async () => ({
      subject: "Practice: sums",
      questions: [
        { text: "What is 6 + 7?", type: "numeric", options: null, answerKey: "13" },
        { text: "Pick the even one", type: "multiple_choice", options: ["3", "4", "5"], answerKey: "4" },
        { text: "What is 10 - 4?", type: "numeric", options: null, answerKey: "6" },
      ],
    })),
  };
});

import { hasOpenPractice, practiceSets, runAutoPractice, sendPractice, setPracticeStatus } from "./practice-service";

describe.skipIf(!process.env.DATABASE_URL)("automatic practice", () => {
  let db: ReturnType<typeof getDb>;
  let parentId: string;
  let kidId: string;
  let offKidId: string;
  const ours = () => [kidId, offKidId]; // never touch anyone else's kids

  beforeAll(async () => {
    db = getDb();
    const [p] = await db.insert(parents).values({ authUserId: `practice-test-${Date.now()}` }).returning();
    parentId = p.id;
    const [k] = await db.insert(kids).values({ parentId, name: "Auto", grade: 3, autoPractice: "daily", autoPracticeSize: 3 }).returning();
    const [o] = await db.insert(kids).values({ parentId, name: "Manual", grade: 3 }).returning();
    kidId = k.id;
    offKidId = o.id;
  });
  afterAll(async () => {
    await db.delete(parents).where(eq(parents.id, parentId));
  });

  it("sends a practice set, tells the kid, and does not repeat while practice is open or not due", async () => {
    const first = await runAutoPractice(new Date(), 50, ours());
    expect(first.made).toBeGreaterThanOrEqual(1);

    const sets = await db.select().from(homeworkSets).where(eq(homeworkSets.kidId, kidId));
    expect(sets).toHaveLength(1);
    expect(sets[0]).toMatchObject({ kind: "practice", subject: "Practice: sums", status: "assigned" });
    expect(await db.select().from(questions).where(eq(questions.setId, sets[0].id))).toHaveLength(3);

    const messages = await db.select().from(kidMessages).where(eq(kidMessages.kidId, kidId));
    expect(messages.map((m) => m.kind)).toEqual(["practice"]);
    const [kid] = await db.select().from(kids).where(eq(kids.id, kidId));
    expect(kid.lastPracticeAt).not.toBeNull();

    // right away: not due
    await runAutoPractice(new Date(), 50, ours());
    expect(await db.select().from(homeworkSets).where(eq(homeworkSets.kidId, kidId))).toHaveLength(1);

    // a day later but the kid has not answered the practice: do not pile up
    expect(await hasOpenPractice(kidId)).toBe(true);
    await runAutoPractice(new Date(Date.now() + 25 * 60 * 60 * 1000), 50, ours());
    expect(await db.select().from(homeworkSets).where(eq(homeworkSets.kidId, kidId))).toHaveLength(1);

    // once the kid has solved it all, the next day brings new practice
    for (const q of await db.select().from(questions).where(eq(questions.setId, sets[0].id))) {
      await db.insert(attempts).values({ questionId: q.id, kidId, answer: q.answerKey, correct: true });
    }
    expect(await hasOpenPractice(kidId)).toBe(false);
    await runAutoPractice(new Date(Date.now() + 25 * 60 * 60 * 1000), 50, ours());
    expect(await db.select().from(homeworkSets).where(eq(homeworkSets.kidId, kidId))).toHaveLength(2);
  });

  it("leaves a kid whose parent has it off alone", async () => {
    expect(await db.select().from(homeworkSets).where(eq(homeworkSets.kidId, offKidId))).toHaveLength(0);
  });

  it("a parent can send a practice set by hand", async () => {
    const id = await sendPractice(offKidId, { subject: "Practice: by hand", questions: [{ text: "What is 1 + 1?", type: "numeric", options: null, answerKey: "2" }] });
    const [set] = await db.select().from(homeworkSets).where(eq(homeworkSets.id, id));
    expect(set.kind).toBe("practice");
  });

  it("a parent can pull a practice set back and send it again, and nothing is deleted", async () => {
    const id = await sendPractice(offKidId, { subject: "Practice: pull back", questions: [{ text: "What is 2 + 5?", type: "numeric", options: null, answerKey: "7" }] });
    expect(await hasOpenPractice(offKidId)).toBe(true);

    expect(await setPracticeStatus(offKidId, id, "withdrawn")).toBe(true);
    expect(await setPracticeStatus(offKidId, id, "withdrawn")).toBe(false); // already pulled back
    expect((await practiceSets(offKidId)).find((p) => p.id === id)).toMatchObject({ status: "withdrawn", total: 1, solved: 0 });
    expect(await db.select().from(questions).where(eq(questions.setId, id))).toHaveLength(1); // still there
    expect((await db.select().from(homeworkSets).where(eq(homeworkSets.id, id)))[0].status).toBe("withdrawn");

    expect(await setPracticeStatus(offKidId, id, "assigned")).toBe(true);
    expect((await practiceSets(offKidId)).find((p) => p.id === id)?.status).toBe("assigned");
  });

  it("only practice sets of the kid can be pulled back", async () => {
    const [plain] = await db.insert(homeworkSets).values({ kidId: offKidId, subject: "Ordinary", status: "assigned" }).returning();
    expect(await setPracticeStatus(offKidId, plain.id, "withdrawn")).toBe(false); // not practice
    const mine = await sendPractice(offKidId, { subject: "Practice: mine", questions: [{ text: "What is 1 + 4?", type: "numeric", options: null, answerKey: "5" }] });
    expect(await setPracticeStatus(kidId, mine, "withdrawn")).toBe(false); // another kid's set
  });
});
