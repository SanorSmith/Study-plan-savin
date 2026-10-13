import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { getDb } from "@/db";
import { parents } from "@/db/schema";

/**
 * Returns the signed-in Neon Auth user, or null.
 * Wire this to the Neon Auth session once the project has Neon Auth enabled;
 * every parent page and action goes through requireParent() below.
 */
export async function getAuthUser(): Promise<{ id: string; email?: string } | null> {
  // Until Neon Auth is connected nobody is signed in, so protected pages redirect to /login.
  return null;
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
