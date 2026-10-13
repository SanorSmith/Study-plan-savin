// Runs against a real database, so it only runs when DATABASE_URL is set.
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getDb } from "@/db";
import { creditLedger, kids, parents, scheduleRules } from "@/db/schema";
import { grantBonus, kidState, kidSync, recordUsage } from "./kid-service";

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

  it("banks the minutes", async () => {
    const kid = await newKid();
    await grantBonus(kid.id, 15);
    expect(await balance(kid.id)).toBe(15);
  });

  it("does not use up the daily earning limit", async () => {
    const kid = await newKid();
    await grantBonus(kid.id, 60);
    expect((await kidState(kid)).earnableTodayMinutes).toBe(10);
  });

  it("charges usage against the balance and never below zero", async () => {
    const kid = await newKid();
    await grantBonus(kid.id, 5);
    expect(await recordUsage(kid.id, 2, `t-${kid.id}-1`)).toBe(3);
    expect(await recordUsage(kid.id, 10, `t-${kid.id}-2`)).toBe(0);
    expect(await recordUsage(kid.id, 3, `t-${kid.id}-3`)).toBe(0);
    expect(await balance(kid.id)).toBe(0);
  });

  it("charges a retried usage report only once", async () => {
    const kid = await newKid();
    await grantBonus(kid.id, 10);
    expect(await recordUsage(kid.id, 4, `retry-${kid.id}`)).toBe(6);
    expect(await recordUsage(kid.id, 4, `retry-${kid.id}`)).toBe(6);
  });

  it("returns the schedule with the balance for the phone", async () => {
    const kid = await newKid();
    await db.insert(scheduleRules).values({ kidId: kid.id, mode: "blocked", days: 127, startMinute: 1260, endMinute: 420 });
    const sync = await kidSync(kid.id);
    expect(sync.schedule.rules).toEqual([{ mode: "blocked", days: 127, startMinute: 1260, endMinute: 420 }]);
    expect(typeof sync.schedule.timezone).toBe("string");
    expect(Number.isNaN(Date.parse(sync.serverNow))).toBe(false);
  });
});
