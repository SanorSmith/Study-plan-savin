import { z } from "zod";
import { getDevice } from "@/lib/device-auth";
import { MAX_USAGE_REPORT_MINUTES, recordUsage } from "@/lib/kid-service";

const Body = z.object({
  minutes: z.number().int().min(1).max(MAX_USAGE_REPORT_MINUTES),
  // Chosen by the phone per report; resending the same key never charges twice.
  key: z.string().min(8).max(80),
});

/** The phone reports screen time it measured; the server charges it against the kid's balance. */
export async function POST(request: Request) {
  const ctx = await getDevice();
  if (!ctx) return Response.json({ error: "device not paired" }, { status: 401 });
  const body = Body.safeParse(await request.json().catch(() => null));
  if (!body.success) return Response.json({ error: "invalid request" }, { status: 400 });

  // Charged per device so one phone's retry key can never collide with another's.
  const balanceMinutes = await recordUsage(ctx.kid.id, body.data.minutes, `${ctx.device.id}:${body.data.key}`);
  return Response.json({ balanceMinutes, serverNow: new Date().toISOString() });
}
