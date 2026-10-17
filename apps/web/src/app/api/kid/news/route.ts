import { getDevice } from "@/lib/device-auth";
import { kidNews } from "@/lib/kid-news";

/** New homework and messages for the phone to ring about. Needs the paired device only, so it works behind the lock. */
export async function GET() {
  const ctx = await getDevice();
  if (!ctx) return Response.json({ error: "device not paired" }, { status: 401 });
  return Response.json({ items: await kidNews(ctx.kid.id) }, { headers: { "cache-control": "no-store" } });
}
