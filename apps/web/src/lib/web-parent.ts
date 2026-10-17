import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { parents } from "@/db/schema";
import { getAuthUser } from "@/lib/auth";

/** The signed-in parent (website cookie) without redirecting, for API routes. */
export async function webParent() {
  const user = await getAuthUser();
  if (!user) return null;
  const [row] = await getDb().select().from(parents).where(eq(parents.authUserId, user.id));
  return row ?? null;
}
