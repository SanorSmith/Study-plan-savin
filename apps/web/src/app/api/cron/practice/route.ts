import { runAutoPractice } from "@/lib/practice-service";

/**
 * Runs once a day from Vercel Cron: sends AI practice questions to the kids whose parent turned that on and whose turn has come.
 * A kid is only served once per interval and never while practice is still open, so an early or repeated call changes nothing.
 */
export async function GET(request: Request) {
  const agent = request.headers.get("user-agent") ?? "";
  const secret = process.env.CRON_SECRET;
  const ok = secret ? request.headers.get("authorization") === `Bearer ${secret}` : agent.startsWith("vercel-cron");
  if (!ok) return Response.json({ error: "not allowed" }, { status: 401 });
  return Response.json(await runAutoPractice(), { headers: { "cache-control": "no-store" } });
}
