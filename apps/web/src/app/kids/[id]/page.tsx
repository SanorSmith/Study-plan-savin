import { Suspense } from "react";
import Link from "next/link";
import { and, desc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { getDb } from "@/db";
import { devices, kids, scheduleRules } from "@/db/schema";
import { Avatar, Badge, btn, Card, CardHeader, field, labelText, PageHeader, Stat } from "@/components/ui";
import { ConfirmButton } from "@/components/ConfirmButton";
import { PageLoading, ParentShell } from "@/components/ParentShell";
import { requireParent } from "@/lib/auth";
import { APPROVAL_MINUTES } from "@/lib/kid-service";
import { isPairingValid } from "@/lib/pairing";
import { pendingSubmissions, PHOTO_RETENTION_DAYS, recentSubmissions } from "@/lib/paper-service";
import { kidOverview, recentActivity } from "@/lib/results";
import { DAY_LABELS, daysLabel, formatMinute } from "@/lib/schedule-input";
import { KidFields } from "../KidFields";
import {
  addScheduleRule,
  createPairingCode,
  deleteScheduleRule,
  giveBonus,
  grantApproval,
  revokeApproval,
  resetBank,
  setAiCheck,
  updateKid,
  withdrawFromBank,
} from "../actions";

const TZ = process.env.APP_TIMEZONE ?? "Europe/Stockholm";
const fmtTime = new Intl.DateTimeFormat("sv-SE", { timeStyle: "short", timeZone: TZ });
const fmtWhen = new Intl.DateTimeFormat("sv-SE", { dateStyle: "short", timeStyle: "short", timeZone: TZ });

const ACTIVITY_LABEL: Record<string, string> = {
  bonus: "Bonus from parent",
  correct_answer: "Earned from homework",
  usage: "Used as screen time",
  withdrawal: "Withdrawn by parent",
  spend: "Used as screen time",
};

async function KidDetails({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const parent = await requireParent();
  const db = getDb();
  const [kid] = await db
    .select()
    .from(kids)
    .where(and(eq(kids.id, id), eq(kids.parentId, parent.id)));
  if (!kid) notFound();

  const [list, activity, rules, overview, papers, recentPapers] = await Promise.all([
    db.select().from(devices).where(eq(devices.kidId, kid.id)).orderBy(desc(devices.createdAt)),
    recentActivity(kid.id),
    db.select().from(scheduleRules).where(eq(scheduleRules.kidId, kid.id)).orderBy(scheduleRules.startMinute),
    kidOverview(kid.id),
    pendingSubmissions(kid.id),
    recentSubmissions(kid.id),
  ]);
  const now = new Date();
  const paired = list.filter((d) => d.tokenHash).length;
  const approved = kid.settingsApprovedUntil && kid.settingsApprovedUntil > now ? kid.settingsApprovedUntil : null;

  return (
    <ParentShell>
      <PageHeader
        back={
          <Link href="/dashboard" className={btn.link}>
            ← All kids
          </Link>
        }
        title={
          <span className="flex items-center gap-3">
            <Avatar name={kid.name} size="lg" />
            {kid.name}
          </span>
        }
        subtitle={`Grade ${kid.grade}`}
        actions={
          <>
            <Link href={`/kids/${kid.id}/homework/new`} className={btn.primary}>
              Add homework from a photo
            </Link>
            <Link href={`/kids/${kid.id}/homework`} className={btn.secondary}>
              Homework and results
            </Link>
          </>
        }
      />

      {papers.length > 0 && (
        <Card className="mb-6 border-amber-300 bg-amber-50">
          <CardHeader
            title={papers.length === 1 ? "1 paper is waiting for your review" : `${papers.length} papers are waiting for your review`}
            description="The AI has read the handwritten answers. Check them and approve to add the minutes."
          />
          <ul className="space-y-2">
            {papers.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 text-sm">
                <span>
                  {p.subject} · {p.submittedBy === "kid" ? `from ${kid.name}` : "from you"} · {fmtWhen.format(p.createdAt)}
                </span>
                <Link href={`/kids/${kid.id}/papers/${p.id}`} className={btn.primary}>
                  Review
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="In the bank" value={`${overview.balanceMinutes} min`} hint="Used while the phone is in use" />
        <Stat
          label="Answers correct"
          value={overview.attemptsTotal ? `${overview.attemptsCorrect} / ${overview.attemptsTotal}` : "None yet"}
          hint={`${overview.setCount} homework ${overview.setCount === 1 ? "set" : "sets"}`}
        />
        <Stat label="Phones" value={paired} hint={paired === 0 ? "None paired yet" : "Paired and locked"} />
        <Stat label="Earning limit" value={`${kid.dailyCapMinutes} min`} hint={`${kid.minutesPerQuestion} min per answer`} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader
              title="Screen schedule"
              description={
                <>
                  <b>Locked</b> times block the phone even if {kid.name} has minutes (bedtime, school). <b>Free</b> times allow any
                  app without using minutes. At other times, minutes are used only while the screen is on and an app is open.
                </>
              }
            />
            {rules.length > 0 ? (
              <ul className="mb-5 space-y-2">
                {rules.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 p-3 text-sm">
                    <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <Badge tone={r.mode === "blocked" ? "bad" : "good"}>{r.mode === "blocked" ? "Locked" : "Free"}</Badge>
                      <span>{daysLabel(r.days)}</span>
                      <span className="tabular-nums text-slate-600">
                        {formatMinute(r.startMinute)} to {formatMinute(r.endMinute)}
                        {r.endMinute < r.startMinute && " (next day)"}
                      </span>
                    </span>
                    <form action={deleteScheduleRule.bind(null, kid.id, r.id)}>
                      <button className={btn.danger}>Remove</button>
                    </form>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mb-5 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
                No time windows yet. Minutes are used whenever {kid.name} uses the phone.
              </p>
            )}
            <form action={addScheduleRule.bind(null, kid.id)} className="space-y-4 rounded-lg border border-dashed border-slate-300 p-4">
              <p className="text-sm font-medium">Add a time window</p>
              <label className={labelText}>
                Type
                <select name="mode" className={field}>
                  <option value="blocked">Locked (phone off)</option>
                  <option value="free">Free (no minutes used)</option>
                </select>
              </label>
              <fieldset>
                <legend className={labelText}>Days</legend>
                <div className="mt-2 flex flex-wrap gap-2">
                  {DAY_LABELS.map((d, i) => (
                    <label key={d} className="cursor-pointer">
                      <input type="checkbox" name="day" value={i} defaultChecked className="peer sr-only" />
                      <span className="inline-flex min-w-12 justify-center rounded-full border border-slate-300 px-3 py-1 text-sm peer-checked:border-slate-900 peer-checked:bg-slate-900 peer-checked:text-white peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-slate-900">
                        {d}
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <div className="flex flex-wrap items-end gap-3">
                <label className={labelText}>
                  From
                  <input name="start" type="time" required defaultValue="21:00" className={`${field} w-32`} />
                </label>
                <label className={labelText}>
                  To
                  <input name="end" type="time" required defaultValue="07:00" className={`${field} w-32`} />
                </label>
                <button className={btn.secondary}>Add window</button>
              </div>
            </form>
          </Card>

          <Card>
            <CardHeader
              title="Bonus screen time"
              description={`Give ${kid.name} minutes without homework. They go into the bank and are used automatically. Bonus minutes don't count toward the earning limit.`}
            />
            <form action={giveBonus.bind(null, kid.id)} className="flex flex-wrap items-end gap-3">
              <label className={labelText}>
                Minutes
                <input name="minutes" type="number" min={1} max={240} defaultValue={15} required className={`${field} w-28`} />
              </label>
              <button className={btn.primary}>Give bonus</button>
            </form>

            <h3 className="mb-2 mt-6 text-sm font-medium text-slate-700">Recent activity</h3>
            {activity.length > 0 ? (
              <ul className="divide-y divide-slate-100 text-sm">
                {activity.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-3 py-2">
                    <span>
                      {ACTIVITY_LABEL[a.reason] ?? "Adjustment"}
                      <span className="ml-2 text-xs text-slate-500">{fmtWhen.format(a.createdAt)}</span>
                    </span>
                    <span className={`tabular-nums font-medium ${a.deltaMinutes > 0 ? "text-emerald-700" : "text-slate-600"}`}>
                      {a.deltaMinutes > 0 ? "+" : ""}
                      {a.deltaMinutes} min
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-500">Nothing yet.</p>
            )}
          </Card>

          <Card>
            <CardHeader
              title="Paper checking"
              description={`When ${kid.name} does homework on paper and sends a photo, ${kid.name} chooses who checks it. You always see the photos for ${PHOTO_RETENTION_DAYS} days.`}
            />
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 p-3">
              <div className="text-sm">
                <p className="font-medium">
                  AI checking is{" "}
                  <Badge tone={kid.aiCheckEnabled ? "good" : "neutral"}>{kid.aiCheckEnabled ? "On" : "Off"}</Badge>
                </p>
                <p className="mt-1 max-w-md text-slate-600">
                  {kid.aiCheckEnabled
                    ? `${kid.name} can choose "Check with AI": the AI reads the paper and adds the minutes straight away. The photos are sent to the AI service.`
                    : `Every paper is checked by you. ${kid.name} can still send a photo, but it goes only to you and is not shown to any AI unless you ask for suggestions.`}
                </p>
              </div>
              <form action={setAiCheck.bind(null, kid.id, !kid.aiCheckEnabled)}>
                <button className={kid.aiCheckEnabled ? btn.secondary : btn.primary}>{kid.aiCheckEnabled ? "Turn off" : "Turn on"}</button>
              </form>
            </div>

            {recentPapers.length > 0 && (
              <>
                <h3 className="mb-2 mt-5 text-sm font-medium text-slate-700">Recent papers</h3>
                <ul className="divide-y divide-slate-100 text-sm">
                  {recentPapers.map((r) => (
                    <li key={r.id} className="flex items-center justify-between gap-3 py-2">
                      <span>
                        {r.subject}
                        <span className="ml-2 text-xs text-slate-500">{fmtWhen.format(r.createdAt)}</span>
                      </span>
                      <span className="flex items-center gap-3">
                        {r.status === "rejected" ? (
                          <Badge>Discarded</Badge>
                        ) : (
                          <Badge tone="good">{r.autoApproved ? "Checked by AI" : "You approved"}: +{r.awardedMinutes ?? 0} min</Badge>
                        )}
                        <Link href={`/kids/${kid.id}/papers/${r.id}`} className={btn.link}>
                          Open
                        </Link>
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </Card>

          <Card>
            <CardHeader
              title="Withdraw minutes"
              description={`Take minutes out of ${kid.name}'s bank, or empty it. ${kid.name} has ${overview.balanceMinutes} min now. The bank never goes below zero, and the phone picks up the change within a few minutes.`}
            />
            <form action={withdrawFromBank.bind(null, kid.id)} className="flex flex-wrap items-end gap-3">
              <label className={labelText}>
                Minutes
                <input name="minutes" type="number" min={1} max={10000} defaultValue={10} required className={`${field} w-28`} />
              </label>
              <button className={btn.secondary} disabled={overview.balanceMinutes === 0}>
                Withdraw
              </button>
            </form>
            <form action={resetBank.bind(null, kid.id)} className="mt-4 border-t border-slate-100 pt-4">
              <ConfirmButton
                message={`Reset ${kid.name}'s bank to zero? This removes ${overview.balanceMinutes} minutes.`}
                className={`${btn.danger} disabled:cursor-not-allowed disabled:opacity-50`}
              >
                Reset bank to zero
              </ConfirmButton>
            </form>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Phones" description="Create a code, then enter it in the Study Plan app on the kid's phone." />
            <form action={createPairingCode.bind(null, kid.id)} className="flex gap-2">
              <select name="platform" aria-label="Phone type" className={`${field} !mt-0`}>
                <option value="android">Android</option>
                <option value="ios">iPhone/iPad</option>
                <option value="web">Web</option>
              </select>
              <button className={`${btn.secondary} shrink-0`}>New code</button>
            </form>
            {list.length > 0 && (
              <ul className="mt-4 space-y-2">
                {list.map((d) => {
                  const live = !d.tokenHash && isPairingValid(d.pairingExpiresAt, now);
                  return (
                    <li key={d.id} className="rounded-lg border border-slate-200 p-3 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="font-medium capitalize">{d.platform}</span>
                        {d.tokenHash ? <Badge tone="good">Paired</Badge> : live ? <Badge tone="warn">Waiting</Badge> : <Badge>Expired</Badge>}
                      </div>
                      {live && (
                        <p className="mt-2">
                          <span className="block font-mono text-2xl font-semibold tracking-widest">{d.pairingCode}</span>
                          <span className="text-xs text-slate-500">
                            Valid until {fmtTime.format(d.pairingExpiresAt!)}
                          </span>
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader
              title="Settings and uninstall"
              description={`On ${kid.name}'s phone these are parents-only. Approve here, or type your parent PIN on the phone. Approval lasts ${APPROVAL_MINUTES} minutes.`}
            />
            {approved ? (
              <div className="flex items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm">
                <span>Approved until {fmtTime.format(approved)}</span>
                <form action={revokeApproval.bind(null, kid.id)}>
                  <button className={btn.danger}>Cancel</button>
                </form>
              </div>
            ) : (
              <form action={grantApproval.bind(null, kid.id)}>
                <button className={btn.secondary}>Allow for {APPROVAL_MINUTES} minutes</button>
              </form>
            )}
          </Card>

          <Card>
            <CardHeader
              title="Profile"
              description={
                <>
                  The kid&apos;s app fits the age. See it as {kid.name} would:{" "}
                  <Link href={`/kids/${kid.id}/preview/little`} className={btn.link}>
                    Young
                  </Link>
                  {" · "}
                  <Link href={`/kids/${kid.id}/preview/middle`} className={btn.link}>
                    Middle
                  </Link>
                  {" · "}
                  <Link href={`/kids/${kid.id}/preview/teen`} className={btn.link}>
                    Teen
                  </Link>
                </>
              }
            />
            <form action={updateKid.bind(null, kid.id)} className="space-y-4">
              <KidFields d={kid} pinHint={kid.pinHash ? "Leave blank to keep current" : "Not set"} />
              <button className={btn.primary}>Save</button>
            </form>
          </Card>
        </div>
      </div>
    </ParentShell>
  );
}

export default function KidPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<PageLoading />}>
      <KidDetails params={params} />
    </Suspense>
  );
}
