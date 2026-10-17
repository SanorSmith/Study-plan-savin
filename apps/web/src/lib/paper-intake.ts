import { z } from "zod";
import type { kids } from "@/db/schema";
import { gradePaper, PaperGradingError, type PaperImage } from "@/lib/paper-grading";
import { approveSubmission, createSubmission, purgeOldPaperImages, questionsForSet } from "@/lib/paper-service";

const MEDIA_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"] as const;
const MAX_IMAGES = 3;
// Vercel rejects request bodies over 4.5 MB, so the app shrinks photos first and this stays just under.
const MAX_TOTAL_BYTES = 4_200_000;

export class IntakeError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

/** "ai": the AI checks it and the minutes are added at once. "parent": a parent checks it. */
export const CheckMode = z.enum(["ai", "parent"]);
export type CheckMode = z.infer<typeof CheckMode>;

/** The photos in an upload (the form field "image", up to three pages). */
export async function readImages(form: FormData): Promise<PaperImage[]> {
  const files = form.getAll("image").filter((f): f is File => f instanceof File);
  if (files.length === 0) throw new IntakeError("A photo or PDF of the paper is required", 400);
  if (files.length > MAX_IMAGES) throw new IntakeError(`At most ${MAX_IMAGES} photos`, 400);
  if (files.reduce((n, f) => n + f.size, 0) > MAX_TOTAL_BYTES) throw new IntakeError("The files are too large (4 MB in all)", 413);

  return Promise.all(
    files.map(async (f) => {
      if (!MEDIA_TYPES.includes(f.type as (typeof MEDIA_TYPES)[number])) throw new IntakeError("Use a JPEG, PNG or WebP photo, or a PDF", 415);
      return { mediaType: f.type as PaperImage["mediaType"], base64: Buffer.from(await f.arrayBuffer()).toString("base64") };
    }),
  );
}

export type PaperOutcome =
  | { kind: "ai"; submissionId: string; correct: number; total: number; minutes: number }
  | { kind: "pending"; submissionId: string };

/**
 * Takes a paper in. Three paths:
 * - mode "ai" (a kid whose parent allowed it): the AI reads it and the minutes are added straight away.
 * - mode "parent" with readWithAi (a parent photographing a paper): the AI reads it as a suggestion and the parent reviews.
 * - mode "parent" without readWithAi (a kid chose "check with parent"): the photos go to no AI; the parent marks it by hand.
 * The photos are kept for a short while so the parent can look at them.
 */
export async function processPaper(args: {
  kid: typeof kids.$inferSelect;
  setId: string;
  form: FormData;
  submittedBy: "kid" | "parent";
  mode: CheckMode;
  readWithAi: boolean;
}): Promise<PaperOutcome> {
  const images = await readImages(args.form);
  const questions = await questionsForSet(args.setId);
  if (questions.length === 0) throw new IntakeError("This homework has no questions", 400);

  try {
    const results = args.readWithAi ? await gradePaper(images, questions) : null;
    const submissionId = await createSubmission({
      kidId: args.kid.id,
      setId: args.setId,
      submittedBy: args.submittedBy,
      mode: args.mode,
      questions,
      results,
      images,
    });
    await purgeOldPaperImages().catch(() => null); // housekeeping must never fail an upload

    if (args.mode === "ai" && results) {
      const correctIds = new Set(results.filter((r) => r.aiCorrect).map((r) => r.questionId));
      const paid = await approveSubmission(args.kid, submissionId, correctIds, { auto: true });
      return {
        kind: "ai",
        submissionId,
        correct: paid?.correctCount ?? 0,
        total: paid?.total ?? questions.length,
        minutes: paid?.awardedMinutes ?? 0,
      };
    }
    return { kind: "pending", submissionId };
  } catch (e) {
    if (e instanceof PaperGradingError) throw new IntakeError(e.message, 502);
    throw e;
  }
}

export const PAPER_LIMIT = { limit: 10, windowSeconds: 60 * 60 };
