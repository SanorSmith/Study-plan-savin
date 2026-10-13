import { getDevice } from "@/lib/device-auth";
import { kidSync } from "@/lib/kid-service";

/** Balance and schedule for the phone's lock. Works without the PIN so the lock can refresh in the background. */
export async function GET() {
  const ctx = await getDevice();
  if (!ctx) return Response.json({ error: "device not paired" }, { status: 401 });
  return Response.json(await kidSync(ctx.kid.id));
}
