// Runs against a real database, so it only runs when DATABASE_URL is set.
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getDb } from "@/db";
import { homeworkSets, kids, paperSubmissions, parents, pushSubscriptions } from "@/db/schema";
import { pendingPapersFor } from "./pending";
import { pushToParent, vapidKeys } from "./push";

describe.skipIf(!process.env.DATABASE_URL)("push and pending papers", () => {
  let db: ReturnType<typeof getDb>;
  let parentId: string;
  let otherId: string;
  let kidId: string;

  beforeAll(async () => {
    db = getDb();
    const [p] = await db.insert(parents).values({ authUserId: `push-test-${Date.now()}` }).returning();
    const [o] = await db.insert(parents).values({ authUserId: `push-other-${Date.now()}` }).returning();
    parentId = p.id;
    otherId = o.id;
    const [k] = await db.insert(kids).values({ parentId, name: "Pushy", grade: 4 }).returning();
    kidId = k.id;
  });
  afterAll(async () => {
    await db.delete(parents).where(eq(parents.id, parentId));
    await db.delete(parents).where(eq(parents.id, otherId));
  });

  it("makes the signing keys once and keeps them", async () => {
    const a = await vapidKeys();
    const b = await vapidKeys();
    expect(a.publicKey).toBe(b.publicKey);
    expect(a.publicKey.length).toBeGreaterThan(60);
    expect(a.privateKey.length).toBeGreaterThan(30);
  });

  it("sends nothing when the parent has no devices", async () => {
    expect(await pushToParent(otherId, { title: "x", body: "y", url: "/dashboard" })).toBe(0);
  });

  it("survives a device that cannot be reached, and keeps it", async () => {
    await db.insert(pushSubscriptions).values({ parentId, endpoint: `https://localhost:9/push/${Date.now()}`, p256dh: "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM", auth: "tBHItJI5svbpez7KI4CCXg" });
    expect(await pushToParent(parentId, { title: "x", body: "y", url: "/dashboard" })).toBe(0);
    expect((await db.select().from(pushSubscriptions).where(eq(pushSubscriptions.parentId, parentId))).length).toBe(1);
  });

  it("lists only this parent's waiting papers, newest first", async () => {
    const [set] = await db.insert(homeworkSets).values({ kidId, subject: "Math", status: "assigned" }).returning();
    const [first] = await db.insert(paperSubmissions).values({ kidId, setId: set.id, submittedBy: "kid", mode: "parent" }).returning();
    await new Promise((r) => setTimeout(r, 20));
    const [second] = await db.insert(paperSubmissions).values({ kidId, setId: set.id, submittedBy: "kid", mode: "parent" }).returning();
    await db.update(paperSubmissions).set({ status: "approved" }).where(eq(paperSubmissions.id, first.id));
    const mine = await pendingPapersFor(parentId);
    expect(mine.map((p) => p.id)).toEqual([second.id]);
    expect(mine[0]).toMatchObject({ kidName: "Pushy", subject: "Math" });
    expect(await pendingPapersFor(otherId)).toEqual([]);
  });
});
