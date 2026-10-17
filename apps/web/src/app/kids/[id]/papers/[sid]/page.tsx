import { Suspense } from "react";
import Link from "next/link";
import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { getDb } from "@/db";
import { kids } from "@/db/schema";
import { Badge, btn, Card, PageHeader } from "@/components/ui";
import { PageLoading, ParentShell } from "@/components/ParentShell";
import { requireParent } from "@/lib/auth";
import { PHOTO_RETENTION_DAYS, submissionForReview } from "@/lib/paper-service";
import { approvePaper, rejectPaper } from "../actions";
import { AskAi } from "./AskAi";

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
  const byAi = submission.autoApproved;

  const statusBadge = pending ? (
    <Badge tone="warn">Waiting for you</Badge>
  ) : byAi ? (
    <Badge tone="good">Checked by AI</Badge>
  ) : submission.status === "approved" ? (
    <Badge tone="good">Approved</Badge>
  ) : (
    <Badge>Discarded</Badge>
  );

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
        actions={statusBadge}
      />

      {awarded !== undefined && (
        <p role="status" className="mb-4 rounded-lg bg-emerald-50 p-4 text-sm text-emerald-900">
          Approved. {correct} {correct === "1" ? "answer" : "answers"} counted and {awarded} minutes were added to {kid.name}&apos;s bank.
        </p>
      )}
      {byAi && (
        <p className="mb-4 rounded-lg bg-emerald-50 p-4 text-sm text-emerald-900">
          The AI checked this paper and added {submission.awardedMinutes ?? 0} minutes to {kid.name}&apos;s bank straight away. Look at the photos
          below. If the AI got something wrong, take the minutes back with <b>Withdraw minutes</b> on {kid.name}&apos;s page.
        </p>
      )}

      <Card className="mb-4">
        <h2 className="mb-3 text-base font-semibold">Photos of the paper</h2>
        {submission.imageCount > 0 ? (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              {Array.from({ length: submission.imageCount }, (_, i) =>
                submission.imageTypes[i] === "application/pdf" ? (
                  <div key={i} className="overflow-hidden rounded-lg border border-slate-200">
                    <iframe src={`/api/papers/${submission.id}/image/${i}`} title={`PDF ${i + 1} of the paper`} className="h-72 w-full bg-slate-50" />
                    <a href={`/api/papers/${submission.id}/image/${i}`} target="_blank" rel="noreferrer" className="block p-2 text-center text-sm font-medium text-slate-700 underline">
                      Open the PDF
                    </a>
                  </div>
                ) : (
                <a key={i} href={`/api/papers/${submission.id}/image/${i}`} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-lg border border-slate-200">
                  {/* eslint-disable-next-line @next/next/no-img-element -- a private, signed-in-only photo; the image optimizer cannot fetch it */}
                  <img src={`/api/papers/${submission.id}/image/${i}`} alt={`Page ${i + 1} of the paper`} className="h-56 w-full bg-slate-50 object-contain" />
                </a>
                ),
              )}
            </div>
            <p className="mt-2 text-xs text-slate-500">Tap a photo to open it full size. Photos are kept for {PHOTO_RETENTION_DAYS} days, then deleted.</p>
          </>
        ) : (
          <p className="text-sm text-slate-600">The photos were deleted after {PHOTO_RETENTION_DAYS} days. The results below are kept.</p>
        )}
      </Card>

      {pending && submission.aiRead && (
        <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          The AI read these answers from the photos. Compare each one with the paper, change any mistake, then approve. Minutes are only added when
          you approve.
        </p>
      )}
      {pending && !submission.aiRead && (
        <div className="mb-4 space-y-3 rounded-lg border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900">
          <p>
            {kid.name} chose <b>check with parent</b>, so the photos have not been shown to any AI. Compare the photos with the correct answers and tick
            each answer that is right. Minutes are only added when you approve.
          </p>
          <AskAi kidId={kid.id} submissionId={submission.id} />
        </div>
      )}

      <form action={approvePaper.bind(null, kid.id, submission.id)} className="space-y-3">
        <ol className="space-y-3">
          {answers.map((a, i) => {
            // While waiting, "solved in the app" is checked live. Once decided, the stored decision is shown
            // (null means the kid had already solved it in the app before this paper was decided).
            const solvedEarlier = pending ? a.alreadySolved : a.finalCorrect === null;
            const counted = pending ? submission.aiRead && a.aiCorrect && !a.alreadySolved : a.finalCorrect === true;
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
                    ) : !submission.aiRead ? (
                      <Badge>You decide</Badge>
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
                  {submission.aiRead && (
                    <p className="text-sm">
                      Written on the paper: {a.readAnswer ? <b>{a.readAnswer}</b> : <span className="text-slate-500">nothing readable</span>}
                    </p>
                  )}
                  {a.note && <p className="text-sm text-slate-500">{a.note}</p>}
                  {solvedEarlier ? (
                    <p className="text-sm text-slate-500">Already solved in the app, so no new minutes.</p>
                  ) : !pending ? null : (
                    <label className="flex items-center gap-2 text-sm font-medium">
                      {/* The key restarts the box when the AI reads the paper, so its suggestion becomes the starting tick. */}
                      <input key={`${a.questionId}-${submission.aiRead}`} type="checkbox" name="correct" value={a.questionId} defaultChecked={counted} />
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
