import { Suspense } from "react";
import Link from "next/link";
import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { getDb } from "@/db";
import { kids } from "@/db/schema";
import { requireParent } from "@/lib/auth";
import { MAX_ATTEMPTS } from "@/lib/ledger";
import type { QuestionStatus } from "@/lib/question-status";
import { homeworkResults } from "@/lib/results";

const STATUS: Record<QuestionStatus, { label: string; className: string }> = {
  not_tried: { label: "Not tried", className: "bg-gray-100 text-gray-700" },
  in_progress: { label: "In progress", className: "bg-yellow-100 text-yellow-800" },
  solved: { label: "Solved", className: "bg-green-100 text-green-800" },
  failed: { label: "Out of tries", className: "bg-red-100 text-red-800" },
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
    <main className="mx-auto max-w-2xl space-y-8 p-6">
      <div>
        <Link href={`/kids/${kid.id}`} className="text-sm text-gray-600 underline">
          ← {kid.name}
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">Homework and results</h1>
      </div>

      {sets.length === 0 && <p className="text-gray-600">No homework assigned yet.</p>}

      {sets.map((set) => (
        <section key={set.id} className="space-y-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-xl font-semibold">{set.subject}</h2>
            <p className="text-sm text-gray-600">
              {set.solved}/{set.questions.length} solved · {set.earnedMinutes} min earned ·{" "}
              {fmt.format(set.createdAt)}
            </p>
          </div>
          <ol className="space-y-3">
            {set.questions.map((q, i) => (
              <li key={q.id} className="space-y-2 rounded border p-3">
                <div className="flex items-start justify-between gap-3">
                  <p className="font-medium">
                    {i + 1}. {q.text}
                  </p>
                  <span className={`shrink-0 rounded px-2 py-0.5 text-xs ${STATUS[q.status].className}`}>
                    {STATUS[q.status].label}
                  </span>
                </div>
                {q.options && (
                  <p className="text-sm text-gray-600">Options: {q.options.join(" · ")}</p>
                )}
                <p className="text-sm">
                  Correct answer: <b>{q.answerKey}</b>
                </p>
                {q.attempts.length > 0 ? (
                  <ul className="space-y-1 text-sm">
                    {q.attempts.map((a, n) => (
                      <li key={n} className={a.correct ? "text-green-700" : "text-red-700"}>
                        Try {n + 1} of {MAX_ATTEMPTS}: “{a.answer}” — {a.correct ? "correct" : "wrong"}{" "}
                        <span className="text-gray-500">({fmt.format(a.at)})</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-gray-500">No attempts yet.</p>
                )}
                {q.earnedMinutes > 0 && (
                  <p className="text-sm text-green-700">Earned {q.earnedMinutes} min</p>
                )}
              </li>
            ))}
          </ol>
        </section>
      ))}
    </main>
  );
}

export default function ResultsPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<main className="p-6">Loading…</main>}>
      <Results params={params} />
    </Suspense>
  );
}
