import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { homeworkSets, kids, parents } from "@/db/schema";
import { getAuthUser } from "@/lib/auth";
import { IntakeError, PAPER_LIMIT, processPaper } from "@/lib/paper-intake";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";

const SetId = z.uuid();

/** A parent photographs a finished paper. The AI reads it and the result waits for the parent's review. */
export async function POST(request: Request) {
  const user = await getAuthUser();
  if (!user) return Response.json({ error: "sign in required" }, { status: 401 });
  const limit = await rateLimit(`paper:${user.id}`, PAPER_LIMIT);
  if (!limit.allowed) return tooManyRequests(limit.retryAfterSeconds);

  const form = await request.formData();
  const setId = SetId.safeParse(form.get("setId"));
  if (!setId.success) return Response.json({ error: "setId is required" }, { status: 400 });

  // The homework set must belong to one of this parent's kids.
  const [row] = await getDb()
    .select({ kidId: kids.id })
    .from(homeworkSets)
    .innerJoin(kids, eq(kids.id, homeworkSets.kidId))
    .innerJoin(parents, eq(parents.id, kids.parentId))
    .where(and(eq(homeworkSets.id, setId.data), eq(parents.authUserId, user.id), eq(homeworkSets.status, "assigned")));
  if (!row) return Response.json({ error: "homework not found" }, { status: 404 });

  try {
    const submissionId = await processPaper({ kidId: row.kidId, setId: setId.data, form, submittedBy: "parent" });
    return Response.json({ submissionId, kidId: row.kidId });
  } catch (e) {
    if (e instanceof IntakeError) return Response.json({ error: e.message }, { status: e.status });
    throw e;
  }
}
