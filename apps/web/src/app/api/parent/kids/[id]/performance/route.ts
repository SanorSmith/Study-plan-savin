import { z } from "zod";
import { getParentApp } from "@/lib/parent-device";
import { ownedKidOf } from "@/lib/parent-kid";
import { PERIODS, statsFor } from "@/lib/performance";
import { AssessmentError, assessKid, reportsFor, saveReport } from "@/lib/performance-ai";
import { ASSESS_LIMIT, rateLimit, tooManyRequests } from "@/lib/rate-limit";

const Period = z.enum(["week", "month", "year"]);

async function owned(context: { params: Promise<{ id: string }> }) {
  const parent = await getParentApp();
  if (!parent) return { error: Response.json({ error: "sign in required" }, { status: 401 }) } as const;
  const id = z.uuid().safeParse((await context.params).id);
  const kid = id.success ? await ownedKidOf(parent.id, id.data) : null;
  if (!kid) return { error: Response.json({ error: "not found" }, { status: 404 }) } as const;
  return { parent, kid } as const;
}

/** The numbers for a period (computed now) and the saved AI assessments. */
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const found = await owned(context);
  if ("error" in found) return found.error;
  const period = Period.safeParse(new URL(request.url).searchParams.get("period") ?? "week");
  if (!period.success) return Response.json({ error: "period must be week, month or year" }, { status: 400 });
  const [stats, reports] = await Promise.all([statsFor(found.kid.id, period.data), reportsFor(found.kid.id)]);
  return Response.json({ stats, reports, periods: PERIODS }, { headers: { "cache-control": "no-store" } });
}

/** "Assess performance with AI": reads the numbers, saves the assessment and returns it. */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const found = await owned(context);
  if ("error" in found) return found.error;
  const body = z.object({ period: Period }).safeParse(await request.json().catch(() => null));
  if (!body.success) return Response.json({ error: "period must be week, month or year" }, { status: 400 });
  const limit = await rateLimit(`assess:${found.parent.id}`, ASSESS_LIMIT);
  if (!limit.allowed) return tooManyRequests(limit.retryAfterSeconds);

  const stats = await statsFor(found.kid.id, body.data.period);
  if (stats.totals.attempts === 0) return Response.json({ error: "There are no answers in this period yet, so there is nothing to assess." }, { status: 409 });
  try {
    const assessment = await assessKid(found.kid, stats);
    const saved = await saveReport(found.kid.id, stats, assessment);
    return Response.json({ ok: true, id: saved.id, createdAt: saved.createdAt.toISOString(), stats, assessment });
  } catch (e) {
    if (e instanceof AssessmentError) return Response.json({ error: e.message }, { status: 502 });
    throw e;
  }
}
