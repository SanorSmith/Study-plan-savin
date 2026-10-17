import { z } from "zod";
import { getDevice, isUnlocked } from "@/lib/device-auth";
import { hintFor } from "@/lib/hint-service";

const Query = z.object({ questionId: z.uuid() });

/** A hint on the method for one question. The answer is never in it. */
export async function GET(request: Request) {
  const ctx = await getDevice();
  if (!ctx) return Response.json({ error: "device not paired" }, { status: 401 });
  if (!isUnlocked(ctx, new Date())) return Response.json({ error: "PIN required" }, { status: 403 });
  const query = Query.safeParse({ questionId: new URL(request.url).searchParams.get("questionId") });
  if (!query.success) return Response.json({ error: "invalid request" }, { status: 400 });
  try {
    const hint = await hintFor(ctx.kid, query.data.questionId);
    if (!hint) return Response.json({ error: "not_found" }, { status: 404 });
    return Response.json({ hint });
  } catch {
    return Response.json({ error: "No hint right now. Try again in a moment." }, { status: 502 });
  }
}
