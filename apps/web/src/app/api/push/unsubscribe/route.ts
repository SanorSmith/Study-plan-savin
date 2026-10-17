import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { pushSubscriptions } from "@/db/schema";
import { webParent } from "@/lib/web-parent";

export async function POST(request: Request) {
  const parent = await webParent();
  if (!parent) return Response.json({ error: "sign in required" }, { status: 401 });
  const body = z.object({ endpoint: z.string().max(1000) }).safeParse(await request.json().catch(() => null));
  if (!body.success) return Response.json({ error: "bad request" }, { status: 400 });
  await getDb().delete(pushSubscriptions).where(and(eq(pushSubscriptions.endpoint, body.data.endpoint), eq(pushSubscriptions.parentId, parent.id)));
  return Response.json({ ok: true });
}
