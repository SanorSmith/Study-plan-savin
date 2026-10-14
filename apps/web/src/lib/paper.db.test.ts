// Runs against a real database, so it only runs when DATABASE_URL is set.
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getDb } from "@/db";
import { attempts, creditLedger, homeworkSets, kids, paperImages, parents, questions } from "@/db/schema";
import {
  applyAiResults,
  approveSubmission,
  createSubmission,
  imageFor,
  imagesOf,
  pendingSubmissions,
  purgeOldPaperImages,
  recentSubmissions,
  rejectSubmission,
  setsAwaitingPaper,
  submissionForReview,
} from "./paper-service";
import type { PaperResult } from "./paper-grading";

describe.skipIf(!process.env.DATABASE_URL)("paper review", () => {
  // Created in beforeAll: a skipped suite still runs this callback, and getDb() throws without DATABASE_URL.
  let db: ReturnType<typeof getDb>;
  let parentId: string;

  const setup = async (cap = 120) => {
    const [kid] = await db
      .insert(kids)
      .values({ parentId, name: "Paper test", grade: 4, minutesPerQuestion: 10, dailyCapMinutes: cap })
      .returning();
    const [set] = await db.insert(homeworkSets).values({ kidId: kid.id, subject: "Math", status: "assigned" }).returning();
    const qs = await db
      .insert(questions)
      .values(
        ["1+1", "2+2", "3+3"].map((text, position) => ({
          setId: set.id,
          text,
          type: "numeric",
          answerKey: String((position + 1) * 2),
          confirmed: true,
          position,
        })),
      )
      .returning();
    const results: PaperResult[] = qs.map((q) => ({
      questionId: q.id,
      readAnswer: q.answerKey,
      legible: true,
      aiCorrect: true,
      note: null,
    }));
    const gradable = qs.map((q) => ({ id: q.id, text: q.text, type: "numeric" as const, options: null, answerKey: q.answerKey }));
    const photo = { mediaType: "image/jpeg" as const, base64: Buffer.from("fake-jpeg-bytes").toString("base64") };
    const submissionId = await createSubmission({ kidId: kid.id, setId: set.id, submittedBy: "kid", mode: "parent", questions: gradable, results, images: [photo] });
    return { kid, set, qs, gradable, photo, results, submissionId };
  };
  const balance = async (kidId: string) =>
    (await db.select().from(creditLedger).where(eq(creditLedger.kidId, kidId))).reduce((n, e) => n + e.deltaMinutes, 0);

  beforeAll(async () => {
    db = getDb();
    const [p] = await db.insert(parents).values({ authUserId: `paper-test-${Date.now()}` }).returning();
    parentId = p.id;
  });
  afterAll(async () => {
    await db.delete(parents).where(eq(parents.id, parentId)); // cascades to kids, sets, submissions
  });

  it("lists a pending submission and the homework awaiting a paper", async () => {
    const { kid, set, submissionId } = await setup();
    expect((await pendingSubmissions(kid.id)).map((s) => s.id)).toEqual([submissionId]);
    expect((await setsAwaitingPaper(kid.id)).map((s) => s.id)).toEqual([set.id]);
    const review = await submissionForReview(submissionId, kid.id);
    expect(review?.answers).toHaveLength(3);
    expect(review?.answers.every((a) => a.aiCorrect && !a.alreadySolved)).toBe(true);
  });

  it("awards minutes only for the answers the parent marks correct", async () => {
    const { kid, qs, submissionId } = await setup();
    const result = await approveSubmission(kid, submissionId, new Set([qs[0].id, qs[1].id]));
    expect(result).toEqual({ awardedMinutes: 20, correctCount: 2, total: 3 });
    expect(await balance(kid.id)).toBe(20);
    const rows = await db.select().from(attempts).where(eq(attempts.kidId, kid.id));
    expect(rows).toHaveLength(3);
    expect(rows.filter((r) => r.correct)).toHaveLength(2);
  });

  it("pays only once when approved twice", async () => {
    const { kid, qs, submissionId } = await setup();
    await approveSubmission(kid, submissionId, new Set(qs.map((q) => q.id)));
    expect(await approveSubmission(kid, submissionId, new Set(qs.map((q) => q.id)))).toBeNull();
    expect(await balance(kid.id)).toBe(30);
  });

  it("respects the daily earning limit", async () => {
    const { kid, qs, submissionId } = await setup(25);
    const result = await approveSubmission(kid, submissionId, new Set(qs.map((q) => q.id)));
    expect(result?.awardedMinutes).toBe(25); // 10 + 10 + 5
    expect(await balance(kid.id)).toBe(25);
  });

  it("skips questions the kid already solved in the app", async () => {
    const { kid, qs, submissionId } = await setup();
    await db.insert(attempts).values({ questionId: qs[0].id, kidId: kid.id, answer: "2", correct: true });
    await db.insert(creditLedger).values({ kidId: kid.id, deltaMinutes: 10, reason: "correct_answer", questionId: qs[0].id });
    const result = await approveSubmission(kid, submissionId, new Set(qs.map((q) => q.id)));
    expect(result?.awardedMinutes).toBe(20); // only the other two
    expect(await balance(kid.id)).toBe(30);
    const review = await submissionForReview(submissionId, kid.id);
    expect(review?.answers.find((a) => a.questionId === qs[0].id)?.finalCorrect).toBeNull(); // not decided here
    expect(review?.answers.find((a) => a.questionId === qs[1].id)?.finalCorrect).toBe(true);
  });

  it("pays half when the kid had already tried the question wrong", async () => {
    const { kid, qs, submissionId } = await setup();
    await db.insert(attempts).values({ questionId: qs[0].id, kidId: kid.id, answer: "9", correct: false });
    const result = await approveSubmission(kid, submissionId, new Set([qs[0].id]));
    expect(result?.awardedMinutes).toBe(5);
  });

  it("a rejected paper awards nothing and cannot be approved afterwards", async () => {
    const { kid, qs, submissionId } = await setup();
    expect(await rejectSubmission(kid.id, submissionId)).toBe(true);
    expect(await approveSubmission(kid, submissionId, new Set(qs.map((q) => q.id)))).toBeNull();
    expect(await balance(kid.id)).toBe(0);
    expect(await pendingSubmissions(kid.id)).toHaveLength(0);
  });

  it("pays at once for a paper the AI checked, and records it as automatic", async () => {
    const { kid, qs, results, gradable, photo } = await setup();
    const aiId = await createSubmission({ kidId: kid.id, setId: (await db.select().from(homeworkSets).where(eq(homeworkSets.kidId, kid.id)))[0].id, submittedBy: "kid", mode: "ai", questions: gradable, results, images: [photo] });
    const paid = await approveSubmission(kid, aiId, new Set([qs[0].id, qs[2].id]), { auto: true });
    expect(paid).toEqual({ awardedMinutes: 20, correctCount: 2, total: 3 });
    const review = await submissionForReview(aiId, kid.id);
    expect(review?.submission).toMatchObject({ status: "approved", mode: "ai", autoApproved: true, awardedMinutes: 20, aiRead: true });
    expect((await recentSubmissions(kid.id)).some((r) => r.id === aiId && r.autoApproved && r.awardedMinutes === 20)).toBe(true);
  });

  it("starts a paper that no AI has read with every answer unread, for the parent to mark by hand", async () => {
    const { kid, set, gradable, photo } = await setup();
    const id = await createSubmission({ kidId: kid.id, setId: set.id, submittedBy: "kid", mode: "parent", questions: gradable, results: null, images: [photo] });
    const review = await submissionForReview(id, kid.id);
    expect(review?.submission.aiRead).toBe(false);
    expect(review?.answers).toHaveLength(3);
    expect(review?.answers.every((a) => !a.legible && !a.aiCorrect && a.readAnswer === null)).toBe(true);
  });

  it("keeps the AI's reading when a parent asks for help afterwards", async () => {
    const { kid, set, gradable, photo, results } = await setup();
    const id = await createSubmission({ kidId: kid.id, setId: set.id, submittedBy: "kid", mode: "parent", questions: gradable, results: null, images: [photo] });
    expect(await applyAiResults(id, kid.id, results)).toBe(true);
    const review = await submissionForReview(id, kid.id);
    expect(review?.submission.aiRead).toBe(true);
    expect(review?.answers.every((a) => a.aiCorrect)).toBe(true);
    await rejectSubmission(kid.id, id);
    expect(await applyAiResults(id, kid.id, results)).toBe(false); // only while it is waiting
  });

  it("stores the photos for the owner and counts them", async () => {
    const { kid, submissionId, photo } = await setup();
    expect((await submissionForReview(submissionId, kid.id))?.submission.imageCount).toBe(1);
    const image = await imageFor(submissionId, kid.id, 0);
    expect(image?.contentType).toBe("image/jpeg");
    expect(Buffer.from(image!.dataBase64, "base64").toString()).toBe("fake-jpeg-bytes");
    expect((await imagesOf(submissionId))[0]).toEqual(photo);
    expect(await imageFor(submissionId, kid.id, 1)).toBeNull(); // no second page
  });

  it("does not hand a photo to another kid", async () => {
    const { submissionId } = await setup();
    const other = await setup();
    expect(await imageFor(submissionId, other.kid.id, 0)).toBeNull();
  });

  it("deletes photos older than the retention period but keeps newer ones", async () => {
    const { submissionId } = await setup();
    await db.update(paperImages).set({ createdAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000) }).where(eq(paperImages.submissionId, submissionId));
    const fresh = await setup();
    await purgeOldPaperImages();
    expect(await imagesOf(submissionId)).toHaveLength(0);
    expect(await imagesOf(fresh.submissionId)).toHaveLength(1);
  });

  it("has AI checking off for a new kid", async () => {
    const { kid } = await setup();
    expect(kid.aiCheckEnabled).toBe(false);
  });
});
