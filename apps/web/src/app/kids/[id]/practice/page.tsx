import { Suspense } from "react";
import Link from "next/link";
import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { getDb } from "@/db";
import { kids } from "@/db/schema";
import { btn, Card, CardHeader, field, labelText, PageHeader } from "@/components/ui";
import { PageLoading, ParentShell } from "@/components/ParentShell";
import { requireParent } from "@/lib/auth";
import { PERIODS, type Period } from "@/lib/performance";
import { ConfirmButton } from "@/components/ConfirmButton";
import { practiceSets } from "@/lib/practice-service";
import { Badge } from "@/components/ui";
import { changePracticeSet, setAutoPractice } from "./actions";
import { PracticeMaker } from "./PracticeMaker";

const MODES = [
  ["off", "Off: I send practice myself"],
  ["daily", "Every day"],
  ["every_other_day", "Every other day"],
  ["weekly", "Once a week"],
] as const;

async function Practice({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ period?: string }> }) {
  const { id } = await params;
  const { period: raw } = await searchParams;
  const period: Period = PERIODS.includes(raw as Period) ? (raw as Period) : "month";
  const parent = await requireParent();
  const [kid] = await getDb().select().from(kids).where(and(eq(kids.id, id), eq(kids.parentId, parent.id)));
  if (!kid) notFound();
  const sent = await practiceSets(kid.id);

  return (
    <ParentShell width="max-w-3xl">
      <PageHeader
        back={
          <Link href={`/kids/${kid.id}/performance?period=${period}`} className={btn.link}>
            ← How is it going?
          </Link>
        }
        title="Practice questions"
        subtitle={`Questions like the ones ${kid.name} found hard, made by the AI from the saved results (last ${period === "week" ? "7 days" : period === "month" ? "30 days" : "year"}).`}
      />

      <PracticeMaker kidId={kid.id} kidName={kid.name} period={period} />

      <Card className="mt-6">
        <CardHeader title={`Practice sent to ${kid.name}`} description={`You can pull a practice set back at any time. ${kid.name} stops seeing its questions. Nothing is deleted: the tries and minutes already earned stay, and you can send it again.`} />
        {sent.length === 0 ? (
          <p className="text-sm text-slate-600">No practice sent yet.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {sent.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="font-medium">
                    {p.subject} {p.status === "withdrawn" ? <Badge tone="warn">Pulled back</Badge> : <Badge tone="good">With {kid.name}</Badge>}
                  </p>
                  <p className="text-xs text-slate-500">
                    {p.solved} of {p.total} solved · sent {p.createdAt.slice(0, 10)}
                  </p>
                </div>
                <form action={changePracticeSet.bind(null, kid.id, p.id, p.status === "withdrawn" ? "assigned" : "withdrawn")}>
                  {p.status === "withdrawn" ? (
                    <button className={btn.secondary}>Send it again</button>
                  ) : (
                    <ConfirmButton className={btn.secondary} message={`Pull back "${p.subject}"? ${kid.name} will no longer see these questions. You can send it again later.`}>
                      Pull back
                    </ConfirmButton>
                  )}
                </form>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="mt-6">
        <CardHeader
          title="Let the AI send practice by itself"
          description={`The AI adds a short practice set between the daily homework, based on recent mistakes. It waits until ${kid.name} has finished the last practice, and you are told when one is added. Practice earns minutes like homework.`}
        />
        <form action={setAutoPractice.bind(null, kid.id)} className="flex flex-wrap items-end gap-3">
          <label className={labelText}>
            How often
            <select name="mode" defaultValue={kid.autoPractice} className={field}>
              {MODES.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className={labelText}>
            Questions in each set
            <select name="size" defaultValue={kid.autoPracticeSize} className={`${field} w-24`}>
              {[3, 5, 7, 10].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <button className={btn.secondary}>Save</button>
        </form>
        {kid.lastPracticeAt && <p className="mt-3 text-xs text-slate-500">Last practice sent: {kid.lastPracticeAt.toISOString().slice(0, 10)}</p>}
      </Card>
    </ParentShell>
  );
}

export default function PracticePage(props: { params: Promise<{ id: string }>; searchParams: Promise<{ period?: string }> }) {
  return (
    <Suspense fallback={<PageLoading />}>
      <Practice params={props.params} searchParams={props.searchParams} />
    </Suspense>
  );
}
