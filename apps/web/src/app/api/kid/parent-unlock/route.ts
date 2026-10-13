import { z } from "zod";
import { getDevice } from "@/lib/device-auth";
import { parentUnlock } from "@/lib/kid-service";

const Body = z.object({ pin: z.string().regex(/^\d{4,6}$/) });

/** A parent types their PIN on the kid's phone to open Settings and uninstall screens for a few minutes. */
export async function POST(request: Request) {
  const ctx = await getDevice();
  if (!ctx) return Response.json({ error: "device not paired" }, { status: 401 });
  const body = Body.safeParse(await request.json().catch(() => null));
  if (!body.success) return Response.json({ error: "PIN must be 4 to 6 digits" }, { status: 400 });

  const result = await parentUnlock(ctx.kid.id, body.data.pin);
  if (result.ok) {
    return Response.json({ approvedUntil: result.approvedUntil, serverNow: new Date().toISOString() });
  }
  if (result.reason === "no_pin") {
    return Response.json({ error: "A parent has not set a parent PIN yet" }, { status: 403 });
  }
  if (result.reason === "locked") {
    return Response.json({ error: "Too many tries", lockedUntil: result.lockedUntil }, { status: 429 });
  }
  return Response.json({ error: "Wrong PIN" }, { status: 401 });
}
