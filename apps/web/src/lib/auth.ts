import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { getDb } from "@/db";
import { parents } from "@/db/schema";
import { isEmailAllowed } from "@/lib/allowlist";
import { neonAuth } from "@/lib/neon-auth";

/**
 * Returns the signed-in Neon Auth user, or null.
 * Every parent page and action goes through requireParent() below.
 */
export async function getAuthUser(): Promise<{ id: string; email?: string } | null> {
  // An expired or revoked session (a password change signs other sessions out) makes Neon Auth try to rewrite
  // the cookie, which Next.js does not allow while a page renders. That must read as "signed out", not crash.
  const session = await neonAuth
    .getSession()
    .then((r) => r.data)
    .catch(() => null);
  const user = session?.user;
  // An account that exists but is not on the allowlist is treated as signed out everywhere.
  if (!user || !isEmailAllowed(user.email)) return null;
  return { id: user.id, email: user.email };
}

/** The parent row for the signed-in user (created on first login). */
export async function requireParent() {
  await connection(); // per-request data: never prerender
  const user = await getAuthUser();
  if (!user) redirect("/login");

  const db = getDb();
  const [existing] = await db
    .select()
    .from(parents)
    .where(eq(parents.authUserId, user.id));
  if (existing) return existing;

  const [created] = await db
    .insert(parents)
    .values({ authUserId: user.id, email: user.email ?? null })
    .onConflictDoNothing()
    .returning();
  if (created) return created;
  const [again] = await db.select().from(parents).where(eq(parents.authUserId, user.id));
  return again;
}
