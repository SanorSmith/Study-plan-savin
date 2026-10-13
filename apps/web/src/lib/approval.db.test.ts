// Runs against a real database, so it only runs when DATABASE_URL is set.
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getDb } from "@/db";
import { kids, parents } from "@/db/schema";
import { APPROVAL_MINUTES, kidSync, parentUnlock, setApproval } from "./kid-service";
import { hashPin } from "./pin";

describe.skipIf(!process.env.DATABASE_URL)("parent approval", () => {
  // Created in beforeAll: a skipped suite still runs this callback, and getDb() throws without DATABASE_URL.
  let db: ReturnType<typeof getDb>;
  const parentIds: string[] = [];

  const newKid = async (parentPin: string | null) => {
    const [p] = await db
      .insert(parents)
      .values({ authUserId: `approval-test-${Date.now()}-${Math.random()}`, approvalPinHash: parentPin ? await hashPin(parentPin) : null })
      .returning();
    parentIds.push(p.id);
    const [kid] = await db.insert(kids).values({ parentId: p.id, name: "Approval test", grade: 3 }).returning();
    return kid;
  };

  beforeAll(() => {
    db = getDb();
  });
  afterAll(async () => {
    for (const id of parentIds) await db.delete(parents).where(eq(parents.id, id)); // cascades to kids
  });

  it("needs a parent PIN to be set first", async () => {
    const kid = await newKid(null);
    expect(await parentUnlock(kid.id, "123456")).toEqual({ ok: false, reason: "no_pin" });
  });

  it("approves for a few minutes with the right PIN", async () => {
    const kid = await newKid("123456");
    const result = await parentUnlock(kid.id, "123456");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const minutes = (result.approvedUntil.getTime() - Date.now()) / 60_000;
    expect(minutes).toBeGreaterThan(APPROVAL_MINUTES - 0.5);
    expect(minutes).toBeLessThanOrEqual(APPROVAL_MINUTES);
    expect((await kidSync(kid.id)).approvedUntil).toBe(result.approvedUntil.toISOString());
  });

  it("rejects a wrong PIN and locks the parent PIN after five tries", async () => {
    const kid = await newKid("123456");
    for (let i = 0; i < 4; i++) expect(await parentUnlock(kid.id, "000000")).toEqual({ ok: false, reason: "wrong_pin" });
    const fifth = await parentUnlock(kid.id, "000000");
    expect(fifth).toMatchObject({ ok: false, reason: "locked" });
    // Even the right PIN is refused while locked.
    expect(await parentUnlock(kid.id, "123456")).toMatchObject({ ok: false, reason: "locked" });
    expect((await kidSync(kid.id)).approvedUntil).toBeNull();
  });

  it("lets the dashboard grant and revoke approval", async () => {
    const kid = await newKid(null);
    expect((await kidSync(kid.id)).approvedUntil).toBeNull();
    const until = await setApproval(kid.id, 10);
    expect((await kidSync(kid.id)).approvedUntil).toBe(until?.toISOString());
    await setApproval(kid.id, null);
    expect((await kidSync(kid.id)).approvedUntil).toBeNull();
  });
});
