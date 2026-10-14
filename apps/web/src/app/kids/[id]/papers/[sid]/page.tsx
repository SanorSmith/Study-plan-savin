import { Suspense } from "react";
import Link from "next/link";
import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { getDb } from "@/db";
import { kids } from "@/db/schema";
import { Badge, btn, Card, PageHeader } from "@/components/ui";
import { PageLoading, ParentShell } from "@/components/ParentShell";
import { requireParent } from "@/lib/auth";
import { submissionForReview } from "@/lib/paper-service";
import { approvePaper, rejectPaper } from "../actions";

const fmt = new Intl.DateTimeFormat("sv-SE", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: process.env.APP_TIMEZONE ?? "Europe/Stockholm",
});

async function Review({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; sid: string }>;
  searchParams: Promise<{ awarded?: string; correct?: string }>;
}) {
  const { id, sid } = await params;
  const { awarded, correct } = await searchParams;
  const parent = await requireParent();
  const [kid] = await getDb()
    .select()
    .from(kids)
    .where(and(eq(kids.id, id), eq(kids.parentId, parent.id)));
  if (!kid) notFound();
  const review = await submissionForReview(sid, kid.id).catch(() => null);
  if (!review) notFound();
  const { submission, answers } = review;
  const pending = submission.status === "pending";

  return (
    <ParentShell width="max-w-3xl">
      <PageHeader
        back={
          <Link href={`/kids/${kid.id}`} className={btn.link}>
            ← {kid.name}
          </Link>
        }
        title={`Paper check: ${submission.subject}`}
        subtitle={`Photographed ${submission.submittedBy === "kid" ? `by ${kid.name}` : "by you"} on ${fmt.format(submission.createdAt)}`}
        actions={<Badge tone={pending ? "warn" : submission.status === "approved" ? "good" : "neutral"}>{pending ? "Waiting for you" : submission.status === "approved" ? "Approved" : "Discarded"}</Badge>}
      />

      {awarded !== undefined && (
        <p role="status" className="mb-4 rounded-lg bg-emerald-50 p-4 text-sm text-emerald-900">
          Approved. {correct} {correct === "1" ? "answer" : "answers"} counted and {awarded} minutes were added to {kid.name}&apos;s bank.
        </p>
      )}
      {pending && (
        <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          The AI read these answers from the photo. Compare each one with the paper, change any mistake, then approve. Minutes are
          only added when you approve.
        </p>
      )}

      <form action={approvePaper.bind(null, kid.id, submission.id)} className="space-y-3">
        <ol className="space-y-3">
          {answers.map((a, i) => {
            // While waiting, "solved in the app" is checked live. Once decided, the stored decision is shown
            // (null means the kid had already solved it in the app before this paper was approved).
            const solvedEarlier = pending ? a.alreadySolved : a.finalCorrect === null;
            const counted = pending ? a.aiCorrect && !a.alreadySolved : a.finalCorrect === true;
            return (
              <li key={a.questionId}>
                <Card className="space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-medium">
                      {i + 1}. {a.text}
                    </p>
                    {!pending && !solvedEarlier ? (
                      counted ? (
                        <Badge tone="good">Counted</Badge>
                      ) : (
                        <Badge>Not counted</Badge>
                      )
                    ) : solvedEarlier ? (
                      <Badge>Solved in the app</Badge>
                    ) : !a.legible ? (
                      <Badge tone="warn">Not readable</Badge>
                    ) : a.aiCorrect ? (
                      <Badge tone="good">AI: correct</Badge>
                    ) : (
                      <Badge tone="bad">AI: wrong</Badge>
                    )}
                  </div>
                  <p className="text-sm">
                    Correct answer: <b>{a.answerKey}</b>
                  </p>
                  <p className="text-sm">
                    Written on the paper: {a.readAnswer ? <b>{a.readAnswer}</b> : <span className="text-slate-500">nothing readable</span>}
                  </p>
                  {a.note && <p className="text-sm text-slate-500">{a.note}</p>}
                  {solvedEarlier ? (
                    <p className="text-sm text-slate-500">Already solved in the app, so no new minutes.</p>
                  ) : !pending ? null : (
                    <label className="flex items-center gap-2 text-sm font-medium">
                      <input type="checkbox" name="correct" value={a.questionId} defaultChecked={counted} />
                      Counts as correct
                    </label>
                  )}
                </Card>
              </li>
            );
          })}
        </ol>
        {pending && <button className={btn.primary}>Approve and award minutes</button>}
      </form>

      {pending && (
        <form action={rejectPaper.bind(null, kid.id, submission.id)} className="mt-4">
          <button className={btn.danger}>Discard this paper</button>
        </form>
      )}
    </ParentShell>
  );
}

export default function PaperReviewPage(props: {
  params: Promise<{ id: string; sid: string }>;
  searchParams: Promise<{ awarded?: string; correct?: string }>;
}) {
  return (
    <Suspense fallback={<PageLoading />}>
      <Review params={props.params} searchParams={props.searchParams} />
    </Suspense>
  );
}
