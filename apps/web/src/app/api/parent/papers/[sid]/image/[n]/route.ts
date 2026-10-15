import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { kids, paperSubmissions } from "@/db/schema";
import { getParentApp } from "@/lib/parent-device";
import { imageFor } from "@/lib/paper-service";

const Params = z.object({ sid: z.uuid(), n: z.coerce.number().int().min(0).max(2) });

/** One photo of a paper for the parent app. Never cached. */
export async function GET(_request: Request, context: { params: Promise<{ sid: string; n: string }> }) {
  const parent = await getParentApp();
  if (!parent) return Response.json({ error: "sign in required" }, { status: 401 });
  const params = Params.safeParse(await context.params);
  if (!params.success) return Response.json({ error: "not found" }, { status: 404 });
  const [owner] = await getDb()
    .select({ kidId: paperSubmissions.kidId })
    .from(paperSubmissions)
    .innerJoin(kids, eq(kids.id, paperSubmissions.kidId))
    .where(and(eq(paperSubmissions.id, params.data.sid), eq(kids.parentId, parent.id)));
  if (!owner) return Response.json({ error: "not found" }, { status: 404 });
  const image = await imageFor(params.data.sid, owner.kidId, params.data.n);
  if (!image) return Response.json({ error: "The photo was deleted or does not exist" }, { status: 404 });
  return new Response(Buffer.from(image.dataBase64, "base64"), { headers: { "content-type": image.contentType, "cache-control": "private, no-store" } });
}
