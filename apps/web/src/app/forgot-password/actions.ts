"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { isEmailAllowed } from "@/lib/allowlist";
import { neonAuth } from "@/lib/neon-auth";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export type ResetState = { error?: string; done?: boolean } | null;

const RESET_REQUEST_LIMIT = { limit: 5, windowSeconds: 60 * 60 };

/** The address the reset link should point back to (this site). */
async function siteOrigin() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

/** Emails a reset link. The answer is the same whether or not the address has an account, so it can't be used to look accounts up. */
export async function requestReset(_prev: ResetState, form: FormData): Promise<ResetState> {
  const email = z.email().safeParse(form.get("email"));
  if (!email.success) return { error: "Enter a valid email address" };

  const limit = await rateLimit(`reset:${await clientIp()}`, RESET_REQUEST_LIMIT);
  if (!limit.allowed) return { error: "Too many requests. Try again in an hour." };

  if (isEmailAllowed(email.data)) {
    // Errors are ignored on purpose: the page must not reveal whether the account exists.
    await neonAuth.requestPasswordReset({ email: email.data, redirectTo: `${await siteOrigin()}/reset-password` }).catch(() => null);
  }
  return { done: true };
}

const NewPassword = z.object({
  token: z.string().min(10).max(200),
  password: z.string().min(8, "Password must be at least 8 characters").max(128),
  confirm: z.string(),
});

/** Sets a new password from the emailed link. */
export async function resetPassword(_prev: ResetState, form: FormData): Promise<ResetState> {
  const parsed = NewPassword.safeParse({
    token: form.get("token"),
    password: form.get("password"),
    confirm: form.get("confirm"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  if (parsed.data.password !== parsed.data.confirm) return { error: "The two passwords don't match" };

  const { error } = await neonAuth.resetPassword({ newPassword: parsed.data.password, token: parsed.data.token });
  if (error) return { error: "This link has expired or was already used. Ask for a new one." };
  redirect("/login?reset=1");
}
