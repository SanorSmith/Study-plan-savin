import { Suspense } from "react";
import Link from "next/link";
import { eq, inArray, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { attempts, creditLedger, kids } from "@/db/schema";
import { requireParent } from "@/lib/auth";
import { signOut } from "../login/actions";

async function KidList() {
  const parent = await requireParent();
  const db = getDb();
  const list = await db.select().from(kids).where(eq(kids.parentId, parent.id));
  const ids = list.map((k) => k.id);
  const [balances, tries] = ids.length
    ? await Promise.all([
        db
          .select({ kidId: creditLedger.kidId, minutes: sql<number>`sum(${creditLedger.deltaMinutes})::int` })
          .from(creditLedger)
          .where(inArray(creditLedger.kidId, ids))
          .groupBy(creditLedger.kidId),
        db
          .select({
            kidId: attempts.kidId,
            total: sql<number>`count(*)::int`,
            right: sql<number>`count(*) filter (where ${attempts.correct})::int`,
          })
          .from(attempts)
          .where(inArray(attempts.kidId, ids))
          .groupBy(attempts.kidId),
      ])
    : [[], []];
  const balanceOf = new Map(balances.map((b) => [b.kidId, b.minutes]));
  const triesOf = new Map(tries.map((t) => [t.kidId, t]));

  return (
    <main className="mx-auto max-w-2xl p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Your kids</h1>
        <Link href="/kids/new" className="rounded bg-black px-3 py-2 text-white">
          Add kid
        </Link>
      </div>
      <ul className="mt-6 divide-y rounded border">
        {list.length === 0 && <li className="p-4 text-gray-600">No kids yet.</li>}
        {list.map((k) => (
          <li key={k.id}>
            <Link href={`/kids/${k.id}`} className="flex justify-between p-4 hover:bg-gray-50">
              <span>{k.name}</span>
              <span className="text-right text-sm text-gray-600">
                Grade {k.grade} · {balanceOf.get(k.id) ?? 0} min banked
                <br />
                {triesOf.get(k.id)
                  ? `${triesOf.get(k.id)!.right} of ${triesOf.get(k.id)!.total} answers correct`
                  : "No answers yet"}
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <form action={signOut} className="mt-6">
        <button className="text-sm text-gray-600 underline">Sign out</button>
      </form>
    </main>
  );
}

export default function Dashboard() {
  return (
    <Suspense fallback={<main className="p-6">Loading…</main>}>
      <KidList />
    </Suspense>
  );
}
