import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { kids, paperSubmissions } from "@/db/schema";
import { gradePaper, PaperGradingError } from "@/lib/paper-grading";
import { PAPER_LIMIT } from "@/lib/paper-intake";
import { applyAiResults, imagesOf, questionsForSet } from "@/lib/paper-service";
import { getParentApp } from "@/lib/parent-device";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";

/** The parent asks the AI to read the stored photos and suggest which answers are right. Only then are the photos sent to the AI. */
export async function POST(_request: Request, context: { params: Promise<{ sid: string }> }) {
  const parent = await getParentApp();
  if (!parent) return Response.json({ error: "sign in required" }, { status: 401 });
  const sid = z.uuid().safeParse((await context.params).sid);
  if (!sid.success) return Response.json({ error: "not found" }, { status: 404 });

  const [row] = await getDb()
    .select({ kidId: kids.id, setId: paperSubmissions.setId })
    .from(paperSubmissions)
    .innerJoin(kids, eq(kids.id, paperSubmissions.kidId))
    .where(and(eq(paperSubmissions.id, sid.data), eq(kids.parentId, parent.id), eq(paperSubmissions.status, "pending")));
  if (!row) return Response.json({ error: "This paper is not waiting for review" }, { status: 404 });

  const limit = await rateLimit(`paper:${parent.id}`, PAPER_LIMIT);
  if (!limit.allowed) return tooManyRequests(limit.retryAfterSeconds);

  const images = await imagesOf(sid.data);
  if (images.length === 0) return Response.json({ error: "The photos were deleted, so the AI cannot read them" }, { status: 409 });
  try {
    const results = await gradePaper(images, await questionsForSet(row.setId));
    await applyAiResults(sid.data, row.kidId, results);
  } catch (e) {
    if (e instanceof PaperGradingError) return Response.json({ error: e.message }, { status: 502 });
    throw e;
  }
  return Response.json({ ok: true });
}
