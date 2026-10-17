import { Suspense } from "react";
import Link from "next/link";
import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { getDb } from "@/db";
import { kids } from "@/db/schema";
import { Badge, btn, Card, CardHeader, PageHeader, Stat } from "@/components/ui";
import { PageLoading, ParentShell } from "@/components/ParentShell";
import { requireParent } from "@/lib/auth";
import { PERIODS, statsFor, type Period, type Stats } from "@/lib/performance";
import { reportsFor, type Assessment } from "@/lib/performance-ai";
import { AssessButton } from "./AssessButton";

const LABEL: Record<Period, string> = { week: "Last 7 days", month: "Last 30 days", year: "Last year" };

const fmt = new Intl.DateTimeFormat("sv-SE", { dateStyle: "short", timeStyle: "short", timeZone: process.env.APP_TIMEZONE ?? "Europe/Stockholm" });

function Bar({ value, tone }: { value: number | null; tone: string }) {
  return (
    <div className="h-3 w-full overflow-hidden rounded-full bg-slate-100" role="img" aria-label={value === null ? "no data" : `${value} percent`}>
      <div className={`h-full rounded-full ${tone}`} style={{ width: `${value ?? 0}%` }} />
    </div>
  );
}

const tone = (v: number | null) => (v === null ? "bg-slate-300" : v >= 80 ? "bg-emerald-500" : v >= 55 ? "bg-amber-400" : "bg-rose-500");

function Numbers({ stats }: { stats: Stats }) {
  const t = stats.totals;
  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Questions" value={t.questions} hint={`${t.attempts} tries`} />
        <Stat label="Solved" value={t.solved} hint={`${t.failed} out of tries`} />
        <Stat label="Right first time" value={t.firstTryRate === null ? "-" : `${t.firstTryRate}%`} />
        <Stat label="Minutes earned" value={t.earnedMinutes} hint={`${t.papersChecked} papers checked`} />
      </div>

      {stats.subjects.length > 0 && (
        <Card className="mt-4">
          <CardHeader title="By subject" description="The share of tries that were right." />
          <ul className="space-y-3">
            {stats.subjects.map((s) => (
              <li key={s.subject}>
                <div className="mb-1 flex justify-between text-sm">
                  <span className="font-medium">{s.subject}</span>
                  <span className="tabular-nums text-slate-600">
                    {s.accuracy === null ? "-" : `${s.accuracy}%`} · {s.solved} of {s.questions} solved
                  </span>
                </div>
                <Bar value={s.accuracy} tone={tone(s.accuracy)} />
              </li>
            ))}
          </ul>
        </Card>
      )}

      {stats.trend.some((b) => b.attempts > 0) && (
        <Card className="mt-4">
          <CardHeader title="Over time" description="Accuracy in each part of the period. A gap means no answers then." />
          <div className="flex h-28 items-end gap-1">
            {stats.trend.map((b) => (
              <div key={b.label} className="flex flex-1 flex-col items-center justify-end gap-1" title={`${b.label}: ${b.accuracy ?? "no answers"}`}>
                <div className={`w-full rounded-t ${tone(b.accuracy)}`} style={{ height: `${Math.max(b.accuracy ?? 0, b.attempts > 0 ? 6 : 0)}%` }} />
                <span className="text-[10px] text-slate-500">{b.label}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {stats.hardest.length > 0 && (
        <Card className="mt-4">
          <CardHeader title="Hardest questions" description="Questions that took the most tries, with the wrong answers given." />
          <ul className="space-y-3 text-sm">
            {stats.hardest.slice(0, 8).map((h, i) => (
              <li key={i} className="border-b border-slate-100 pb-3 last:border-0">
                <p className="font-medium">{h.text}</p>
                <p className="text-slate-600">
                  {h.subject} · answer: <b>{h.answerKey}</b> · {h.tries} {h.tries === 1 ? "try" : "tries"} {h.solved ? <Badge tone="good">solved</Badge> : <Badge tone="bad">not solved</Badge>}
                </p>
                {h.wrongAnswers.length > 0 && <p className="text-slate-500">Wrote: {h.wrongAnswers.join(", ")}</p>}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}

export function AssessmentView({ a }: { a: Assessment }) {
  return (
    <div className="space-y-4 text-sm">
      <p className="text-base leading-relaxed">{a.summary}</p>
      {a.strengths.length > 0 && (
        <div>
          <h3 className="mb-1 font-semibold text-emerald-800">Strengths</h3>
          <ul className="space-y-1">
            {a.strengths.map((s, i) => (
              <li key={i}>
                <b>{s.topic}.</b> {s.evidence}
              </li>
            ))}
          </ul>
        </div>
      )}
      {a.weaknesses.length > 0 && (
        <div>
          <h3 className="mb-1 font-semibold text-rose-800">Needs practice</h3>
          <ul className="space-y-1">
            {a.weaknesses.map((s, i) => (
              <li key={i}>
                <b>{s.topic}.</b> {s.evidence}
              </li>
            ))}
          </ul>
        </div>
      )}
      {a.recommendations.length > 0 && (
        <div>
          <h3 className="mb-1 font-semibold">What you can do</h3>
          <ul className="list-disc space-y-1 pl-5">
            {a.recommendations.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </div>
      )}
      {a.encouragement && <p className="rounded-lg bg-amber-50 p-3 text-amber-950">You could say: &ldquo;{a.encouragement}&rdquo;</p>}
    </div>
  );
}

async function Performance({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ period?: string }> }) {
  const { id } = await params;
  const { period: raw } = await searchParams;
  const period: Period = PERIODS.includes(raw as Period) ? (raw as Period) : "week";
  const parent = await requireParent();
  const [kid] = await getDb().select().from(kids).where(and(eq(kids.id, id), eq(kids.parentId, parent.id)));
  if (!kid) notFound();
  const [stats, reports] = await Promise.all([statsFor(kid.id, period), reportsFor(kid.id)]);
  const forPeriod = reports.filter((r) => r.period === period);
  const latest = forPeriod[0];

  return (
    <ParentShell width="max-w-3xl">
      <PageHeader
        back={
          <Link href={`/kids/${kid.id}`} className={btn.link}>
            ← {kid.name}
          </Link>
        }
        title="How is it going?"
        subtitle={`${kid.name}'s results, where they are strong and where they need practice.`}
        actions={
          <Link href={`/kids/${kid.id}/practice?period=${period}`} className={btn.secondary}>
            Practice questions
          </Link>
        }
      />

      <nav className="mb-4 flex gap-2" aria-label="Period">
        {PERIODS.map((p) => (
          <Link key={p} href={`/kids/${kid.id}/performance?period=${p}`} className={p === period ? btn.primary : btn.secondary} aria-current={p === period ? "page" : undefined}>
            {LABEL[p]}
          </Link>
        ))}
      </nav>

      {stats.totals.attempts === 0 ? (
        <Card className="text-center text-sm text-slate-600">No answers in this period yet. When {kid.name} answers homework, the numbers show up here.</Card>
      ) : (
        <>
          <Numbers stats={stats} />
          <Card className="mt-4">
            <CardHeader title="AI assessment" description="The AI reads these results and every question and answer from the period, then tells you the strengths and weaknesses." />
            <AssessButton kidId={kid.id} period={period} />
            {latest?.assessment && (
              <div className="mt-5 border-t border-slate-100 pt-4">
                <p className="mb-3 text-xs text-slate-500">
                  {LABEL[period]}, made {fmt.format(new Date(latest.createdAt))}
                </p>
                <AssessmentView a={latest.assessment} />
              </div>
            )}
          </Card>
        </>
      )}

      {reports.length > (latest ? 1 : 0) && (
        <Card className="mt-4">
          <CardHeader title="Earlier assessments" description="Saved so you can see how it changes." />
          <ul className="space-y-2">
            {reports
              .filter((r) => r !== latest)
              .map((r) => (
                <li key={r.id}>
                  <details className="rounded-lg border border-slate-200 p-3">
                    <summary className="cursor-pointer text-sm font-medium">
                      {LABEL[r.period as Period]} · {fmt.format(new Date(r.createdAt))} · {r.stats.totals.accuracy ?? "-"}% right
                    </summary>
                    {r.assessment && (
                      <div className="mt-3">
                        <AssessmentView a={r.assessment} />
                      </div>
                    )}
                  </details>
                </li>
              ))}
          </ul>
        </Card>
      )}
    </ParentShell>
  );
}

export default function PerformancePage(props: { params: Promise<{ id: string }>; searchParams: Promise<{ period?: string }> }) {
  return (
    <Suspense fallback={<PageLoading />}>
      <Performance params={props.params} searchParams={props.searchParams} />
    </Suspense>
  );
}
