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

      <div className="space-y-8">
        {sets.map((set) => (
          <section key={set.id}>
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-lg font-semibold">{set.subject}</h2>
              <p className="text-sm text-slate-600">
                {set.solved}/{set.questions.length} solved · {set.earnedMinutes} min earned · {fmt.format(set.createdAt)}
              </p>
            </div>
            <details className="mb-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <summary className="cursor-pointer text-sm font-medium text-slate-900">Check a finished paper with AI</summary>
              <p className="mb-3 mt-2 text-sm text-slate-600">
                Photograph {kid.name}&apos;s handwritten answers. The AI reads them and compares them with the answer key. You review the
                result before any minutes are added.
              </p>
              <PaperUpload kidId={kid.id} setId={set.id} />
            </details>
            <ol className="space-y-3">
              {set.questions.map((q, i) => (
                <li key={q.id}>
                  <Card className="space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <p className="font-medium">
                        {i + 1}. {q.text}
                      </p>
                      <Badge tone={STATUS[q.status].tone}>{STATUS[q.status].label}</Badge>
                    </div>
                    {q.options && <p className="text-sm text-slate-600">Options: {q.options.join(" · ")}</p>}
                    <p className="text-sm">
                      Correct answer: <b>{q.answerKey}</b>
                    </p>
                    {q.attempts.length > 0 ? (
                      <ul className="space-y-1 text-sm">
                        {q.attempts.map((a, n) => (
                          <li key={n} className={a.correct ? "text-emerald-700" : "text-red-700"}>
                            Try {n + 1} of {MAX_ATTEMPTS}: “{a.answer}”, {a.correct ? "correct" : "wrong"}{" "}
                            <span className="text-slate-500">({fmt.format(a.at)})</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-slate-500">No attempts yet.</p>
                    )}
                    {q.earnedMinutes > 0 && <p className="text-sm font-medium text-emerald-700">Earned {q.earnedMinutes} min</p>}
                  </Card>
                </li>
              ))}
            </ol>
          </section>
        ))}
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
