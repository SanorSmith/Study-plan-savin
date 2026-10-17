import { Suspense } from "react";
import Link from "next/link";
import { eq, inArray, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { attempts, creditLedger, devices, kids } from "@/db/schema";
import { Avatar, Badge, btn, Card, PageHeader } from "@/components/ui";
import { PageLoading, ParentShell } from "@/components/ParentShell";
import { requireParent } from "@/lib/auth";
import { pendingCounts } from "@/lib/paper-service";
import { pendingPapersFor } from "@/lib/pending";

async function KidList() {
  const parent = await requireParent();
  const db = getDb();
  const list = await db.select().from(kids).where(eq(kids.parentId, parent.id));
  const ids = list.map((k) => k.id);
  const [balances, tries, phones] = ids.length
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
        db
          .select({ kidId: devices.kidId, paired: sql<number>`count(*) filter (where ${devices.tokenHash} is not null)::int` })
          .from(devices)
          .where(inArray(devices.kidId, ids))
          .groupBy(devices.kidId),
      ])
    : [[], [], []];
  const balanceOf = new Map(balances.map((b) => [b.kidId, b.minutes]));
  const triesOf = new Map(tries.map((t) => [t.kidId, t]));
  const pairedOf = new Map(phones.map((p) => [p.kidId, p.paired]));
  const papersOf = await pendingCounts(ids);
  const waiting = await pendingPapersFor(parent.id);

  return (
    <ParentShell>
      <PageHeader
        title="Your kids"
        subtitle="Homework earns screen time."
        actions={
          <Link href="/kids/new" className={btn.primary}>
            + Add kid
          </Link>
        }
      />

      {waiting.length > 0 && (
        <Link
          href={`/kids/${waiting[0].kidId}/papers/${waiting[0].id}`}
          className="mb-6 flex items-center gap-4 rounded-2xl bg-gradient-to-r from-amber-100 to-orange-100 p-4 shadow-sm ring-1 ring-amber-200 transition hover:shadow-md"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-2xl" aria-hidden="true">
            📝
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-semibold text-amber-950">
              {waiting.length === 1 ? `${waiting[0].kidName} sent a paper` : `${waiting.length} papers are waiting for you`}
            </span>
            <span className="block text-sm text-amber-900">Tap to check it and add the minutes</span>
          </span>
          <span className="text-xl text-amber-900" aria-hidden="true">
            ›
          </span>
        </Link>
      )}

      {!parent.approvalPinHash && list.length > 0 && (
        <Link href="/settings" className="mb-6 flex items-center gap-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-violet-100 transition hover:shadow-md">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-2xl" aria-hidden="true">
            🔒
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">Set a parent PIN</span>
            <span className="block text-sm text-slate-500">So only you can open Settings on a kid&apos;s phone</span>
          </span>
          <span className="text-xl text-slate-400" aria-hidden="true">
            ›
          </span>
        </Link>
      )}

      {list.length === 0 ? (
        <Card className="py-10 text-center">
          <p className="text-5xl" aria-hidden="true">
            👋
          </p>
          <h2 className="mt-3 text-xl font-semibold">Welcome! Add your first kid</h2>
          <p className="mx-auto mt-1 max-w-sm text-slate-500">Choose a name and a PIN, then pair their phone with a code.</p>
          <Link href="/kids/new" className={`${btn.primary} mt-5`}>
            Add your first kid
          </Link>
        </Card>
      ) : (
        <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((k) => {
            const t = triesOf.get(k.id);
            const paired = pairedOf.get(k.id) ?? 0;
            const papers = papersOf.get(k.id) ?? 0;
            const percent = t && t.total > 0 ? Math.round((t.right / t.total) * 100) : null;
            return (
              <li key={k.id} className="relative rounded-2xl bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.05),0_10px_30px_rgba(99,102,241,0.08)] ring-1 ring-slate-100 transition hover:-translate-y-0.5 hover:shadow-lg">
                <div className="flex items-center gap-3">
                  <Avatar name={k.name} size="lg" />
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate text-lg font-semibold">
                      {/* The link covers the whole card; the buttons below sit above it. */}
                      <Link href={`/kids/${k.id}`} className="after:absolute after:inset-0 after:rounded-2xl focus-visible:after:outline-2 focus-visible:after:outline-violet-600">
                        {k.name}
                      </Link>
                    </h2>
                    <p className="text-sm text-slate-500">Grade {k.grade}</p>
                  </div>
                  {papers > 0 && <Badge tone="warn">{papers} to check</Badge>}
                </div>

                <div className="mt-5 flex items-end justify-between gap-3">
                  <p className="text-4xl font-bold tabular-nums text-violet-700">
                    {balanceOf.get(k.id) ?? 0}
                    <span className="ml-1 text-base font-medium text-slate-400">min</span>
                  </p>
                  {percent !== null && (
                    <p className="text-right text-sm text-slate-500">
                      <span className={`font-semibold ${percent >= 80 ? "text-emerald-600" : percent >= 55 ? "text-amber-600" : "text-rose-600"}`}>{percent}%</span> right
                    </p>
                  )}
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {paired > 0 ? <Badge tone="good">📱 Phone paired</Badge> : <Badge tone="warn">No phone yet</Badge>}
                  {!k.pinHash && <Badge tone="warn">No PIN</Badge>}
                </div>

                <div className="relative z-10 mt-5 flex gap-2 border-t border-slate-100 pt-4">
                  <Link href={`/kids/${k.id}/homework/new`} className={`${btn.primary} flex-1 !px-3`}>
                    + Homework
                  </Link>
                  <Link href={`/kids/${k.id}/performance`} className={`${btn.secondary} flex-1 !px-3`}>
                    Progress
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </ParentShell>
  );
}

export default function Dashboard() {
  return (
    <Suspense fallback={<PageLoading />}>
      <KidList />
    </Suspense>
  );
}
