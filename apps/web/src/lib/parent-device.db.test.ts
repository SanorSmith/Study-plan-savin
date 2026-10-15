// Runs against a real database, so it only runs when DATABASE_URL is set.
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getDb } from "@/db";
import { kids, parentDevices, parents } from "@/db/schema";
import { grantBonus } from "./kid-service";
import { parentAppState } from "./parent-app";
import { createParentAppCode, pairParentApp, revokeParentApp } from "./parent-device";
import { hashToken } from "./pairing";

describe.skipIf(!process.env.DATABASE_URL)("parent app pairing", () => {
  let db: ReturnType<typeof getDb>;
  let parentId: string;
  let otherParentId: string;

  beforeAll(async () => {
    db = getDb();
    const [p] = await db.insert(parents).values({ authUserId: `parent-app-test-${Date.now()}` }).returning();
    const [o] = await db.insert(parents).values({ authUserId: `parent-app-other-${Date.now()}` }).returning();
    parentId = p.id;
    otherParentId = o.id;
  });
  afterAll(async () => {
    await db.delete(parents).where(eq(parents.id, parentId));
    await db.delete(parents).where(eq(parents.id, otherParentId));
  });

  it("swaps a code for a token once", async () => {
    const code = await createParentAppCode(parentId);
    const token = await pairParentApp(code, "Mom's phone");
    expect(token).toBeTruthy();
    expect(await pairParentApp(code, null)).toBeNull();
    const [row] = await db.select().from(parentDevices).where(eq(parentDevices.tokenHash, hashToken(token!)));
    expect(row.parentId).toBe(parentId);
    expect(row.name).toBe("Mom's phone");
    expect(row.pairingCode).toBeNull();
  });

  it("rejects a wrong or expired code", async () => {
    expect(await pairParentApp("ZZZZZZZZ", null)).toBeNull();
    const code = await createParentAppCode(parentId);
    await db.update(parentDevices).set({ pairingExpiresAt: new Date(Date.now() - 1000) }).where(eq(parentDevices.pairingCode, code));
    expect(await pairParentApp(code, null)).toBeNull();
  });

  it("accepts the code in lower case", async () => {
    const code = await createParentAppCode(parentId);
    expect(await pairParentApp(` ${code.toLowerCase()} `, null)).toBeTruthy();
  });

  it("only removes the caller's own phones", async () => {
    const code = await createParentAppCode(parentId);
    const token = await pairParentApp(code, "x");
    const [row] = await db.select().from(parentDevices).where(eq(parentDevices.tokenHash, hashToken(token!)));
    await revokeParentApp(otherParentId, row.id);
    expect(await db.select().from(parentDevices).where(eq(parentDevices.id, row.id))).toHaveLength(1);
    await revokeParentApp(parentId, row.id);
    expect(await db.select().from(parentDevices).where(eq(parentDevices.id, row.id))).toHaveLength(0);
  });

  it("shows only this parent's kids with their balance", async () => {
    const [mine] = await db.insert(kids).values({ parentId, name: "Mine", grade: 4 }).returning();
    await db.insert(kids).values({ parentId: otherParentId, name: "Not mine", grade: 4 });
    await grantBonus(mine.id, 25);
    const state = await parentAppState(parentId);
    expect(state.kids.map((k) => k.name)).toEqual(["Mine"]);
    expect(state.kids[0].balanceMinutes).toBe(25);
    expect(state.kids[0].aiCheckEnabled).toBe(false);
    expect(state.papers).toEqual([]);
    expect((await parentAppState(randomUuid())).kids).toEqual([]);
  });
});

const randomUuid = () => crypto.randomUUID();
