import { z } from "zod";
import { getDevice, isUnlocked } from "@/lib/device-auth";
import { MAX_SPEND_MINUTES, startScreenTime } from "@/lib/kid-service";

const Body = z.object({ minutes: z.number().int().min(1).max(MAX_SPEND_MINUTES) });

export async function POST(request: Request) {
  const ctx = await getDevice();
  if (!ctx) return Response.json({ error: "device not paired" }, { status: 401 });
  if (!isUnlocked(ctx, new Date())) return Response.json({ error: "PIN required" }, { status: 403 });
  const body = Body.safeParse(await request.json().catch(() => null));
  if (!body.success) return Response.json({ error: "invalid minutes" }, { status: 400 });

  const result = await startScreenTime(ctx, body.data.minutes);
  if (!result.ok) return Response.json({ error: result.reason }, { status: 409 });
  return Response.json({ endsAt: result.endsAt });
}
