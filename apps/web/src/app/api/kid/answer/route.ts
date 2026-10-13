import { z } from "zod";
import { getDevice, isUnlocked } from "@/lib/device-auth";
import { submitAnswer } from "@/lib/kid-service";

const Body = z.object({ questionId: z.uuid(), answer: z.string().trim().min(1).max(200) });

export async function POST(request: Request) {
  const ctx = await getDevice();
  if (!ctx) return Response.json({ error: "device not paired" }, { status: 401 });
  if (!isUnlocked(ctx, new Date())) return Response.json({ error: "PIN required" }, { status: 403 });
  const body = Body.safeParse(await request.json().catch(() => null));
  if (!body.success) return Response.json({ error: "invalid request" }, { status: 400 });

  const result = await submitAnswer(ctx.kid, body.data.questionId, body.data.answer);
  if (!result.ok) {
    return Response.json(
      { error: result.reason },
      { status: result.reason === "not_found" ? 404 : 409 },
    );
  }
  return Response.json({ correct: result.correct, earnedMinutes: result.earnedMinutes });
}
