import { vapidKeys } from "@/lib/push";

/** The public half of the Web Push key. The browser needs it to subscribe. */
export async function GET() {
  const keys = await vapidKeys();
  return Response.json({ publicKey: keys.publicKey }, { headers: { "cache-control": "public, max-age=3600" } });
}
