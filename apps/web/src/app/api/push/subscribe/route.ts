import { z } from "zod";
import { getDb } from "@/db";
import { pushSubscriptions } from "@/db/schema";
import { webParent } from "@/lib/web-parent";

const Body = z.object({
  endpoint: z.url().max(1000).startsWith("https://"),
  keys: z.object({ p256dh: z.string().min(10).max(200), auth: z.string().min(10).max(100) }),
});

/** This browser or installed web app wants notifications for the signed-in parent. */
export async function POST(request: Request) {
  const parent = await webParent();
  if (!parent) return Response.json({ error: "sign in required" }, { status: 401 });
  const body = Body.safeParse(await request.json().catch(() => null));
  if (!body.success) return Response.json({ error: "bad subscription" }, { status: 400 });
  // The same browser may be subscribed again (a new sign-in): take it over instead of failing on the unique endpoint.
  await getDb()
    .insert(pushSubscriptions)
    .values({ parentId: parent.id, endpoint: body.data.endpoint, p256dh: body.data.keys.p256dh, auth: body.data.keys.auth })
    .onConflictDoUpdate({ target: pushSubscriptions.endpoint, set: { parentId: parent.id, p256dh: body.data.keys.p256dh, auth: body.data.keys.auth } });
  return Response.json({ ok: true });
}
