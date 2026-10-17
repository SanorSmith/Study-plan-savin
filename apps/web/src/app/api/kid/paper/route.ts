import { and, eq } from "drizzle-orm";
import { after } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import { homeworkSets } from "@/db/schema";
import { getDevice, isUnlocked } from "@/lib/device-auth";
import { CheckMode, IntakeError, PAPER_LIMIT, processPaper } from "@/lib/paper-intake";
import { notifyPaper } from "@/lib/push";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";

const SetId = z.uuid();

/**
 * A kid sends a photo of their finished paper and chooses who checks it:
 * - mode "ai" (only if a parent turned AI checking on): the AI checks it and the minutes are added at once.
 * - mode "parent": a parent looks at the photos and checks it by hand. The photos are not sent to any AI.
 * The kid never sees the answer key.
 */
export async function POST(request: Request) {
  const ctx = await getDevice();
  if (!ctx) return Response.json({ error: "device not paired" }, { status: 401 });
  if (!isUnlocked(ctx, new Date())) return Response.json({ error: "PIN required" }, { status: 403 });
  const limit = await rateLimit(`paper:kid:${ctx.kid.id}`, PAPER_LIMIT);
  if (!limit.allowed) return tooManyRequests(limit.retryAfterSeconds);

  const form = await request.formData();
  const setId = SetId.safeParse(form.get("setId"));
  if (!setId.success) return Response.json({ error: "setId is required" }, { status: 400 });
  const mode = CheckMode.safeParse(form.get("mode") ?? "parent");
  if (!mode.success) return Response.json({ error: "mode must be ai or parent" }, { status: 400 });
  if (mode.data === "ai" && !ctx.kid.aiCheckEnabled) {
    return Response.json({ error: "AI checking is turned off. Choose check with parent." }, { status: 403 });
  }

  const [set] = await getDb()
    .select({ id: homeworkSets.id })
    .from(homeworkSets)
    .where(and(eq(homeworkSets.id, setId.data), eq(homeworkSets.kidId, ctx.kid.id), eq(homeworkSets.status, "assigned")));
  if (!set) return Response.json({ error: "homework not found" }, { status: 404 });

  try {
    const outcome = await processPaper({
      kid: ctx.kid,
      setId: set.id,
      form,
      submittedBy: "kid",
      mode: mode.data,
      readWithAi: mode.data === "ai",
    });
    // Tell the parent right after the kid gets the answer; a slow notification never holds the kid up.
    after(() => notifyPaper(outcome.submissionId, outcome.kind === "ai" ? { correct: outcome.correct, total: outcome.total } : undefined));
    if (outcome.kind === "ai") {
      return Response.json({ mode: "ai", correct: outcome.correct, total: outcome.total, minutes: outcome.minutes });
    }
    return Response.json({ mode: "parent", sent: true });
  } catch (e) {
    if (e instanceof IntakeError) return Response.json({ error: e.message }, { status: e.status });
    throw e;
  }
}
