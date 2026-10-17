import { z } from "zod";
import { HomeworkInput } from "@/lib/homework-input";
import { getParentApp } from "@/lib/parent-device";
import { ownedKidOf } from "@/lib/parent-kid";
import { PERIODS, statsFor } from "@/lib/performance";
import { generatePractice, PracticeError } from "@/lib/practice-ai";
import { sendPractice } from "@/lib/practice-service";
import { ASSESS_LIMIT, rateLimit, tooManyRequests } from "@/lib/rate-limit";

const Generate = z.object({
  action: z.literal("generate"),
  period: z.enum(["week", "month", "year"]).default("month"),
  count: z.number().int().min(3).max(10).default(5),
  focus: z.array(z.string().max(120)).max(5).default([]),
});
const Send = z.object({ action: z.literal("send"), subject: z.string(), questions: z.array(z.unknown()) });

async function owned(context: { params: Promise<{ id: string }> }) {
  const parent = await getParentApp();
  if (!parent) return { error: Response.json({ error: "sign in required" }, { status: 401 }) } as const;
  const id = z.uuid().safeParse((await context.params).id);
  const kid = id.success ? await ownedKidOf(parent.id, id.data) : null;
  if (!kid) return { error: Response.json({ error: "not found" }, { status: 404 }) } as const;
  return { parent, kid } as const;
}

/**
 * "generate": the AI makes practice questions like the ones the kid found hard. Nothing is sent to the kid yet.
 * "send": the parent's (edited) questions become a practice set in the kid's queue, and the kid is told.
 */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const found = await owned(context);
  if ("error" in found) return found.error;
  const raw = await request.json().catch(() => null);

  const gen = Generate.safeParse(raw);
  if (gen.success) {
    const limit = await rateLimit(`assess:${found.parent.id}`, ASSESS_LIMIT);
    if (!limit.allowed) return tooManyRequests(limit.retryAfterSeconds);
    try {
      const stats = await statsFor(found.kid.id, gen.data.period);
      return Response.json({ ok: true, ...(await generatePractice(found.kid, stats, { count: gen.data.count, focus: gen.data.focus })), periods: PERIODS });
    } catch (e) {
      if (e instanceof PracticeError) return Response.json({ error: e.message }, { status: 409 });
      throw e;
    }
  }

  const send = Send.safeParse(raw);
  if (send.success) {
    const input = HomeworkInput.safeParse({ subject: send.data.subject, questions: send.data.questions });
    if (!input.success) return Response.json({ error: input.error.issues[0].message }, { status: 400 });
    return Response.json({ ok: true, id: await sendPractice(found.kid.id, input.data) });
  }
  return Response.json({ error: "action must be generate or send" }, { status: 400 });
}
