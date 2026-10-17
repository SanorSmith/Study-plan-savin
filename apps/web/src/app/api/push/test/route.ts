import { webParent } from "@/lib/web-parent";
import { pushToParent } from "@/lib/push";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";

/** "Send me a test notification": proves notifications reach this device. */
export async function POST() {
  const parent = await webParent();
  if (!parent) return Response.json({ error: "sign in required" }, { status: 401 });
  const limit = await rateLimit(`push-test:${parent.id}`, { limit: 10, windowSeconds: 60 * 60 });
  if (!limit.allowed) return tooManyRequests(limit.retryAfterSeconds);
  const sent = await pushToParent(parent.id, { title: "Study Plan", body: "Notifications work. You will hear this when a kid sends a paper.", url: "/dashboard", tag: "test" });
  return Response.json({ ok: true, sent });
}
