import { getParentApp } from "@/lib/parent-device";
import { pendingPapersFor } from "@/lib/pending";

/** The parent app asks this every half minute while "instant alerts" are on. */
export async function GET() {
  const parent = await getParentApp();
  if (!parent) return Response.json({ error: "sign in required" }, { status: 401 });
  return Response.json({ papers: await pendingPapersFor(parent.id) }, { headers: { "cache-control": "no-store" } });
}
