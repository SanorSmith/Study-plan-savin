import { Suspense } from "react";
import Link from "next/link";
import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { getDb } from "@/db";
import { kids } from "@/db/schema";
import { Badge, btn, Card, PageHeader } from "@/components/ui";
import { PageLoading, ParentShell } from "@/components/ParentShell";
import { requireParent } from "@/lib/auth";
import { MAX_ATTEMPTS } from "@/lib/ledger";
import type { QuestionStatus } from "@/lib/question-status";
import { homeworkResults } from "@/lib/results";
import { PaperUpload } from "./PaperUpload";

const STATUS: Record<QuestionStatus, { label: string; tone: "neutral" | "good" | "warn" | "bad" }> = {
  not_tried: { label: "Not tried", tone: "neutral" },
  in_progress: { label: "In progress", tone: "warn" },
  solved: { label: "Solved", tone: "good" },
  failed: { label: "Out of tries", tone: "bad" },
};

const fmt = new Intl.DateTimeFormat("sv-SE", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: process.env.APP_TIMEZONE ?? "Europe/Stockholm",
});

async function Results({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const parent = await requireParent();
  const [kid] = await getDb()
    .select()
    .from(kids)
    .where(and(eq(kids.id, id), eq(kids.parentId, parent.id)));
  if (!kid) notFound();
  const sets = await homeworkResults(kid.id);

  return (
    <ParentShell width="max-w-3xl">
      <PageHeader
        back={
          <Link href={`/kids/${kid.id}`} className={btn.link}>
            ← {kid.name}
          </Link>
        }
        title="Homework and results"
        subtitle={`Every question, the answer key and each try ${kid.name} made.`}
        actions={
          <Link href={`/kids/${kid.id}/homework/new`} className={btn.primary}>
            Add homework
          </Link>
        }
      />

      {sets.length === 0 && (
        <Card className="text-center text-sm text-slate-600">No homework assigned yet. Add a worksheet photo to get started.</Card>
      )}

      <div className="space-y-10">
        {sets.map((set) => {
          const percent = set.questions.length > 0 ? Math.round((set.solved / set.questions.length) * 100) : 0;
          return (
            <section key={set.id}>
              <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-lg font-semibold">
                    {set.kind === "practice" && <span aria-hidden="true">🎯 </span>}
                    {set.subject}
                  </h2>
                  <p className="text-sm text-slate-600">
                    {set.solved} of {set.questions.length} solved · {set.earnedMinutes} min earned
                  </p>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100" role="img" aria-label={`${percent} percent solved`}>
                  <div className="h-full rounded-full bg-emerald-500" style={{ width: `${percent}%` }} />
                </div>
                <p className="mt-2 text-xs text-slate-500">Added {fmt.format(set.createdAt)}</p>
                <details className="mt-3 rounded-lg border border-slate-200 p-3">
                  <summary className="cursor-pointer text-sm font-medium text-slate-900">Check a finished paper with AI</summary>
                  <p className="mb-3 mt-2 text-sm text-slate-600">
                    Photograph {kid.name}&apos;s handwritten answers. The AI reads them and compares them with the answer key. You review the result before any minutes are added.
                  </p>
                  <PaperUpload kidId={kid.id} setId={set.id} />
                </details>
              </div>

              <ol className="space-y-4">
                {set.questions.map((q, i) => (
                  <li key={q.id} className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                    <div className="flex items-start gap-3 p-4">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-900 text-sm font-semibold text-white" aria-hidden="true">
                        {i + 1}
                      </span>
                      <div className="min-w-0 flex-1 space-y-3">
                        <div className="flex items-start justify-between gap-3">
                          <p className="text-base font-semibold leading-snug">{q.text}</p>
                          <Badge tone={STATUS[q.status].tone}>{STATUS[q.status].label}</Badge>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 text-sm">
                          <span className="rounded-full bg-emerald-50 px-3 py-1 font-semibold text-emerald-900 ring-1 ring-emerald-200">Answer: {q.answerKey}</span>
                          {q.earnedMinutes > 0 && <span className="rounded-full bg-emerald-100 px-3 py-1 font-semibold text-emerald-900">+{q.earnedMinutes} min</span>}
                        </div>

                        {q.options && (
                          <div className="flex flex-wrap gap-1.5 text-xs text-slate-600">
                            {q.options.map((o) => (
                              <span key={o} className={`rounded-md px-2 py-1 ${o === q.answerKey ? "bg-emerald-100 font-semibold text-emerald-900" : "bg-slate-100"}`}>
                                {o}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="border-t border-slate-100 bg-slate-50/70 px-4 py-3 text-sm">
                      {q.attempts.length > 0 ? (
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Tries</span>
                          {q.attempts.map((a, n) => (
                            <span
                              key={n}
                              title={`Try ${n + 1} of ${MAX_ATTEMPTS}, ${fmt.format(a.at)}`}
                              className={`rounded-full px-3 py-1 font-medium ${a.correct ? "bg-emerald-100 text-emerald-900" : "bg-red-100 text-red-900"}`}
                            >
                              {a.correct ? "✓" : "✗"} {a.answer}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-slate-500">Not tried yet</span>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          );
        })}
      </div>
    </ParentShell>
  );
}

export default function ResultsPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<PageLoading />}>
      <Results params={params} />
    </Suspense>
  );
}
