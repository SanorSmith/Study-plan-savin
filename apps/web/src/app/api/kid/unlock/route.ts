import { z } from "zod";
import { getDevice, UNLOCK_MINUTES } from "@/lib/device-auth";
import { unlockWithPin } from "@/lib/kid-service";

const Body = z.object({ pin: z.string().regex(/^\d{4}$/) });

export async function POST(request: Request) {
  const ctx = await getDevice();
  if (!ctx) return Response.json({ error: "device not paired" }, { status: 401 });
  const body = Body.safeParse(await request.json().catch(() => null));
  if (!body.success) return Response.json({ error: "PIN must be 4 digits" }, { status: 400 });

  const result = await unlockWithPin(ctx, body.data.pin, UNLOCK_MINUTES);
  if (result.ok) return Response.json({ unlockedUntil: result.unlockedUntil });
  if (result.reason === "no_pin") {
    return Response.json({ error: "Ask a parent to set a PIN first" }, { status: 403 });
  }
  if (result.reason === "locked") {
    return Response.json({ error: "Too many tries", lockedUntil: result.lockedUntil }, { status: 429 });
  }
  return Response.json({ error: "Wrong PIN" }, { status: 401 });
}
