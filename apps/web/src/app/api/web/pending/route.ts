import { pendingPapersFor } from "@/lib/pending";
import { webParent } from "@/lib/web-parent";

/** The website asks this every few seconds to ring when a kid sends a paper. */
export async function GET() {
  const parent = await webParent();
  if (!parent) return Response.json({ error: "sign in required" }, { status: 401 });
  return Response.json({ papers: await pendingPapersFor(parent.id) }, { headers: { "cache-control": "no-store" } });
}
