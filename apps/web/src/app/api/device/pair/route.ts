import { cookies } from "next/headers";
import { z } from "zod";
import { DEVICE_COOKIE } from "@/lib/device-auth";
import { pairDevice } from "@/lib/kid-service";

const Body = z.object({ code: z.string().trim().min(4).max(16) });

/** Exchanges a pairing code for a device token (returned once, and set as a cookie for web). */
export async function POST(request: Request) {
  const body = Body.safeParse(await request.json().catch(() => null));
  if (!body.success) return Response.json({ error: "code is required" }, { status: 400 });

  const token = await pairDevice(body.data.code);
  if (!token) return Response.json({ error: "invalid or expired code" }, { status: 404 });

  (await cookies()).set(DEVICE_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  return Response.json({ token });
}
