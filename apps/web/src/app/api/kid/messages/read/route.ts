import { z } from "zod";
import { getDevice, isUnlocked } from "@/lib/device-auth";
import { markMessagesRead } from "@/lib/messages";

const Body = z.object({ ids: z.array(z.uuid()).max(50).optional() });

/** The kid has read their messages (all of them, or the ones listed). */
export async function POST(request: Request) {
  const ctx = await getDevice();
  if (!ctx) return Response.json({ error: "device not paired" }, { status: 401 });
  if (!isUnlocked(ctx, new Date())) return Response.json({ error: "PIN required" }, { status: 403 });
  const body = Body.safeParse(await request.json().catch(() => ({})));
  if (!body.success) return Response.json({ error: "bad request" }, { status: 400 });
  await markMessagesRead(ctx.kid.id, body.data.ids);
  return Response.json({ ok: true });
}
