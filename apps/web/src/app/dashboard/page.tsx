import { Suspense } from "react";
import Link from "next/link";
import { eq, inArray, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { attempts, creditLedger, devices, kids } from "@/db/schema";
import { Avatar, Badge, btn, Card, CardHeader, field, PageHeader } from "@/components/ui";
import { PageLoading, ParentShell } from "@/components/ParentShell";
import { requireParent } from "@/lib/auth";
import { ChangePasswordForm } from "./ChangePasswordForm";
import { setParentPin } from "./actions";

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

  return (
    <ParentShell>
      <PageHeader
        title="Your kids"
        subtitle="Homework earns screen time. Open a kid to add homework, set a schedule or give a bonus."
        actions={
          <Link href="/kids/new" className={btn.primary}>
            Add kid
          </Link>
        }
      />

      {list.length === 0 ? (
        <Card className="text-center">
          <h2 className="text-lg font-semibold">No kids yet</h2>
          <p className="mx-auto mt-1 max-w-sm text-sm text-slate-600">
            Add a kid, set their PIN, then pair their phone with a code.
          </p>
          <Link href="/kids/new" className={`${btn.primary} mt-4`}>
            Add your first kid
          </Link>
        </Card>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((k) => {
            const t = triesOf.get(k.id);
            const paired = pairedOf.get(k.id) ?? 0;
            return (
              <li key={k.id} className="relative rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
                <div className="flex items-center gap-3">
                  <Avatar name={k.name} />
                  <div className="min-w-0">
                    <h2 className="truncate text-base font-semibold">
                      {/* The link covers the whole card; the buttons below sit above it. */}
                      <Link href={`/kids/${k.id}`} className="after:absolute after:inset-0 after:rounded-xl focus-visible:after:outline-2 focus-visible:after:outline-slate-900">
                        {k.name}
                      </Link>
                    </h2>
                    <p className="text-xs text-slate-500">Grade {k.grade}</p>
                  </div>
                </div>

                <p className="mt-4 text-3xl font-semibold tabular-nums">
                  {balanceOf.get(k.id) ?? 0}
                  <span className="ml-1 text-base font-normal text-slate-500">min in the bank</span>
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  {t ? `${t.right} of ${t.total} answers correct` : "No answers yet"}
                </p>

                <div className="mt-3 flex flex-wrap gap-2">
                  {paired > 0 ? (
                    <Badge tone="good">{paired === 1 ? "1 phone paired" : `${paired} phones paired`}</Badge>
                  ) : (
                    <Badge tone="warn">No phone paired</Badge>
                  )}
                  {!k.pinHash && <Badge tone="warn">No PIN set</Badge>}
                </div>

                <div className="relative z-10 mt-4 flex gap-4 border-t border-slate-100 pt-3">
                  <Link href={`/kids/${k.id}/homework/new`} className={btn.link}>
                    Add homework
                  </Link>
                  <Link href={`/kids/${k.id}/homework`} className={btn.link}>
                    Results
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Card className="mt-8 max-w-xl">
        <CardHeader
          title="Parent PIN"
          description={
            <>
              A 6-digit PIN you type on a kid&apos;s phone to open Settings or uninstall the app.{" "}
              {parent.approvalPinHash ? "A PIN is set. Enter a new one to change it." : "No PIN is set yet."}
            </>
          }
        />
        <form action={setParentPin} className="flex flex-wrap items-center gap-2">
          <input
            name="pin"
            inputMode="numeric"
            pattern="\d{6}"
            maxLength={6}
            required
            placeholder="6 digits"
            autoComplete="off"
            aria-label="New parent PIN"
            className={`${field} !mt-0 w-36`}
          />
          <button className={btn.secondary}>{parent.approvalPinHash ? "Change PIN" : "Set PIN"}</button>
        </form>
      </Card>

      <Card className="mt-6 max-w-xl">
        <CardHeader
          title="Account"
          description={parent.email ? `Signed in as ${parent.email}.` : "Change the password you use to sign in."}
        />
        <ChangePasswordForm />
      </Card>
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
