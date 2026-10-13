import { isEmailAllowed, NOT_INVITED } from "@/lib/allowlist";
import { neonAuth } from "@/lib/neon-auth";

const handlers = neonAuth.handler();

export const GET = handlers.GET;

/** Refuses sign-up and sign-in for emails that are not on the allowlist before they reach Neon Auth. */
export async function POST(request: Request, context: Parameters<typeof handlers.POST>[1]) {
  if (/\/api\/auth\/(sign-up|sign-in)\//.test(new URL(request.url).pathname)) {
    const body = await request.clone().json().catch(() => null);
    const email = typeof body?.email === "string" ? body.email : null;
    if (email !== null && !isEmailAllowed(email)) {
      return Response.json({ message: NOT_INVITED, code: "NOT_INVITED" }, { status: 403 });
    }
  }
  return handlers.POST(request, context);
}
