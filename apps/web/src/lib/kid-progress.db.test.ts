// Runs against a real database, so it only runs when DATABASE_URL is set.
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getDb } from "@/db";
import { attempts, homeworkSets, kids, parents, questions } from "@/db/schema";
import { kidState } from "./kid-service";

describe.skipIf(!process.env.DATABASE_URL)("kid state for the app's look and progress", () => {
  // Created in beforeAll: a skipped suite still runs this callback, and getDb() throws without DATABASE_URL.
  let db: ReturnType<typeof getDb>;
  let parentId: string;

  beforeAll(async () => {
    db = getDb();
    const [p] = await db.insert(parents).values({ authUserId: `progress-test-${Date.now()}` }).returning();
    parentId = p.id;
  });
  afterAll(async () => {
    await db.delete(parents).where(eq(parents.id, parentId));
  });

  const setup = async (grade: number, uiStyle = "auto") => {
    const [kid] = await db.insert(kids).values({ parentId, name: "Progress", grade, uiStyle }).returning();
    const [set] = await db.insert(homeworkSets).values({ kidId: kid.id, subject: "Math", status: "assigned" }).returning();
    const qs = await db
      .insert(questions)
      .values([
        { setId: set.id, text: "a", type: "numeric", answerKey: "1", confirmed: true, position: 0 },
        { setId: set.id, text: "b", type: "multiple_choice", options: ["x", "y"], answerKey: "x", confirmed: true, position: 1 },
        { setId: set.id, text: "c", type: "short_text", answerKey: "z", confirmed: true, position: 2 }, // not asked in the app
      ])
      .returning();
    return { kid, qs };
  };

  it("includes the grade and the look the parent chose", async () => {
    const { kid } = await setup(2, "teen");
    const state = await kidState(kid);
    expect(state.grade).toBe(2);
    expect(state.uiStyle).toBe("teen");
  });

  it("counts progress over the questions the app can ask, not the written ones", async () => {
    const { kid, qs } = await setup(4);
    expect((await kidState(kid)).progress).toEqual({ done: 0, total: 2 });

    await db.insert(attempts).values({ questionId: qs[0].id, kidId: kid.id, answer: "1", correct: true });
    expect((await kidState(kid)).progress).toEqual({ done: 1, total: 2 });

    // Out of tries counts as done. With nothing left to ask there is no progress bar, only "all done".
    for (const answer of ["a", "b", "c"]) await db.insert(attempts).values({ questionId: qs[1].id, kidId: kid.id, answer, correct: false });
    const finished = await kidState(kid);
    expect(finished.question).toBeNull();
    expect(finished.progress).toBeNull();
  });

  it("has no progress when there is nothing left to ask, and never exposes the answer key", async () => {
    const { kid, qs } = await setup(5);
    for (const q of qs.slice(0, 2)) await db.insert(attempts).values({ questionId: q.id, kidId: kid.id, answer: "x", correct: true });
    const state = await kidState(kid);
    expect(state.question).toBeNull();
    expect(state.progress).toBeNull();

    const open = await setup(5);
    const withQuestion = await kidState(open.kid);
    expect(Object.keys(withQuestion.question ?? {}).sort()).toEqual(["id", "label", "options", "subject", "text", "type"]);
  });
});
