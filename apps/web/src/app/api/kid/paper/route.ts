import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { homeworkSets } from "@/db/schema";
import { getDevice, isUnlocked } from "@/lib/device-auth";
import { IntakeError, PAPER_LIMIT, processPaper } from "@/lib/paper-intake";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";

const SetId = z.uuid();

/**
 * A kid photographs their finished paper. The AI reads it and a parent confirms before any minutes are
 * awarded. The kid only hears that it was sent, never what the AI read or the answer key.
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

  const [set] = await getDb()
    .select({ id: homeworkSets.id })
    .from(homeworkSets)
    .where(and(eq(homeworkSets.id, setId.data), eq(homeworkSets.kidId, ctx.kid.id), eq(homeworkSets.status, "assigned")));
  if (!set) return Response.json({ error: "homework not found" }, { status: 404 });

  try {
    await processPaper({ kidId: ctx.kid.id, setId: set.id, form, submittedBy: "kid" });
    return Response.json({ sent: true });
  } catch (e) {
    if (e instanceof IntakeError) return Response.json({ error: e.message }, { status: e.status });
    throw e;
  }
}
