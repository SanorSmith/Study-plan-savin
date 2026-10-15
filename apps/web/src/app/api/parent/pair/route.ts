import { z } from "zod";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { pairParentApp } from "@/lib/parent-device";

const Body = z.object({ code: z.string().min(4).max(16), name: z.string().max(80).optional() });

/** The parent app swaps the code from the website for a token. Limited per IP so codes cannot be guessed. */
export async function POST(request: Request) {
  const limit = await rateLimit(`parent-pair:${await clientIp()}`, { limit: 10, windowSeconds: 15 * 60 });
  if (!limit.allowed) return Response.json({ error: "Too many tries. Wait a few minutes." }, { status: 429, headers: { "retry-after": String(limit.retryAfterSeconds) } });
  const body = Body.safeParse(await request.json().catch(() => null));
  if (!body.success) return Response.json({ error: "Enter the code from the website" }, { status: 400 });
  const token = await pairParentApp(body.data.code, body.data.name ?? null);
  if (!token) return Response.json({ error: "That code is wrong or has expired. Make a new one on the website." }, { status: 404 });
  return Response.json({ token });
}
