import { gradePaper, PaperGradingError, type PaperImage } from "@/lib/paper-grading";
import { createSubmission, questionsForSet } from "@/lib/paper-service";

const MEDIA_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
const MAX_IMAGES = 3;
// Vercel rejects request bodies over 4.5 MB, so the browser shrinks photos first and this stays just under.
const MAX_TOTAL_BYTES = 4_200_000;

export class IntakeError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

/** The photos in an upload (the form field "image", up to three pages). */
export async function readImages(form: FormData): Promise<PaperImage[]> {
  const files = form.getAll("image").filter((f): f is File => f instanceof File);
  if (files.length === 0) throw new IntakeError("A photo of the paper is required", 400);
  if (files.length > MAX_IMAGES) throw new IntakeError(`At most ${MAX_IMAGES} photos`, 400);
  if (files.reduce((n, f) => n + f.size, 0) > MAX_TOTAL_BYTES) throw new IntakeError("The photos are too large", 413);

  return Promise.all(
    files.map(async (f) => {
      if (!MEDIA_TYPES.includes(f.type as (typeof MEDIA_TYPES)[number])) throw new IntakeError("Use a JPEG, PNG or WebP photo", 415);
      return { mediaType: f.type as PaperImage["mediaType"], base64: Buffer.from(await f.arrayBuffer()).toString("base64") };
    }),
  );
}

/** Reads the paper with the AI and saves the result for a parent to confirm. Returns the submission id. */
export async function processPaper(args: { kidId: string; setId: string; form: FormData; submittedBy: "kid" | "parent" }) {
  const images = await readImages(args.form);
  const questions = await questionsForSet(args.setId);
  if (questions.length === 0) throw new IntakeError("This homework has no questions", 400);
  try {
    const results = await gradePaper(images, questions);
    return await createSubmission(args.kidId, args.setId, args.submittedBy, results);
  } catch (e) {
    if (e instanceof PaperGradingError) throw new IntakeError(e.message, 502);
    throw e;
  }
}

export const PAPER_LIMIT = { limit: 10, windowSeconds: 60 * 60 };
