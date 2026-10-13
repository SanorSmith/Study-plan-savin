// Runs against a real database, so it only runs when DATABASE_URL is set.
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getDb } from "@/db";
import { creditLedger, kids, parents, screenSessions } from "@/db/schema";
import { grantBonus, kidState } from "./kid-service";

describe.skipIf(!process.env.DATABASE_URL)("grantBonus", () => {
  // Created in beforeAll: a skipped suite still runs this callback, and getDb() throws without DATABASE_URL.
  let db: ReturnType<typeof getDb>;
  let parentId: string;

  const newKid = async () => {
    const [kid] = await db
      .insert(kids)
      .values({ parentId, name: "Bonus test", grade: 3, minutesPerQuestion: 10, dailyCapMinutes: 20 })
      .returning();
    return kid;
  };
  const balance = async (kidId: string) =>
    (await db.select().from(creditLedger).where(eq(creditLedger.kidId, kidId))).reduce((n, e) => n + e.deltaMinutes, 0);

  beforeAll(async () => {
    db = getDb();
    const [p] = await db.insert(parents).values({ authUserId: `bonus-test-${Date.now()}` }).returning();
    parentId = p.id;
  });
  afterAll(async () => {
    await db.delete(parents).where(eq(parents.id, parentId)); // cascades to the test kids
  });

  it("banks the minutes without starting a session", async () => {
    const kid = await newKid();
    expect(await grantBonus(kid.id, 15, false)).toEqual({ started: false });
    expect(await balance(kid.id)).toBe(15);
    expect(await db.select().from(screenSessions).where(eq(screenSessions.kidId, kid.id))).toHaveLength(0);
  });

  it("starts a session right away and leaves the bank unchanged", async () => {
    const kid = await newKid();
    expect(await grantBonus(kid.id, 10, true)).toEqual({ started: true });
    expect(await balance(kid.id)).toBe(0);
    const [session] = await db.select().from(screenSessions).where(eq(screenSessions.kidId, kid.id));
    const minutesLeft = (session.endsAt.getTime() - Date.now()) / 60_000;
    expect(minutesLeft).toBeGreaterThan(9.5);
    expect(minutesLeft).toBeLessThanOrEqual(10);
    expect((await kidState(kid)).session).not.toBeNull();
  });

  it("banks instead when a session is already running", async () => {
    const kid = await newKid();
    await grantBonus(kid.id, 10, true);
    expect(await grantBonus(kid.id, 5, true)).toEqual({ started: false });
    expect(await balance(kid.id)).toBe(5);
    expect(await db.select().from(screenSessions).where(eq(screenSessions.kidId, kid.id))).toHaveLength(1);
  });

  it("does not use up the daily earning limit", async () => {
    const kid = await newKid();
    await grantBonus(kid.id, 60, false);
    expect((await kidState(kid)).earnableTodayMinutes).toBe(10);
  });
});
