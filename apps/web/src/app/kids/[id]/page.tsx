import { Suspense } from "react";
import Link from "next/link";
import { and, desc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { getDb } from "@/db";
import { devices, kids, scheduleRules } from "@/db/schema";
import { Avatar, Badge, btn, Card, CardHeader, field, labelText } from "@/components/ui";
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
  sendKidMessage,
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
  bonus: "Bonus from you",
  correct_answer: "Earned from homework",
  usage: "Used as screen time",
  withdrawal: "Taken out by you",
  spend: "Used as screen time",
};

const TABS = [
  { id: "today", label: "Today", icon: "🏠" },
  { id: "homework", label: "Homework", icon: "📚" },
  { id: "time", label: "Time", icon: "⏰" },
  { id: "settings", label: "Settings", icon: "⚙️" },
] as const;
type TabId = (typeof TABS)[number]["id"];

function Tile({ href, icon, title, text, primary = false }: { href: string; icon: string; title: string; text: string; primary?: boolean }) {
  return (
    <Link
      href={href}
      className={`flex flex-col gap-1 rounded-2xl p-4 transition hover:-translate-y-0.5 hover:shadow-md ${
        primary ? "bg-gradient-to-br from-violet-600 to-indigo-600 text-white shadow-md shadow-violet-300/40" : "bg-white text-slate-900 shadow-sm ring-1 ring-slate-100"
      }`}
    >
      <span className="text-2xl" aria-hidden="true">
        {icon}
      </span>
      <span className="font-semibold">{title}</span>
      <span className={`text-sm ${primary ? "text-violet-100" : "text-slate-500"}`}>{text}</span>
    </Link>
  );
}

async function KidDetails({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const { id } = await params;
  const { tab: rawTab } = await searchParams;
  const tab: TabId = TABS.some((t) => t.id === rawTab) ? (rawTab as TabId) : "today";
  const parent = await requireParent();
  const db = getDb();
  const [kid] = await db
    .select()
    .from(kids)
    .where(and(eq(kids.id, id), eq(kids.parentId, parent.id)));
  if (!kid) notFound();

  const [list, activity, rules, overview, papers, recentPapers] = await Promise.all([
    db.select().from(devices).where(eq(devices.kidId, kid.id)).orderBy(desc(devices.createdAt)),
    recentActivity(kid.id, 8),
    db.select().from(scheduleRules).where(eq(scheduleRules.kidId, kid.id)).orderBy(scheduleRules.startMinute),
    kidOverview(kid.id),
    pendingSubmissions(kid.id),
    recentSubmissions(kid.id),
  ]);
  const now = new Date();
  const paired = list.filter((d) => d.tokenHash).length;
  const approved = kid.settingsApprovedUntil && kid.settingsApprovedUntil > now ? kid.settingsApprovedUntil : null;
  const base = `/kids/${kid.id}`;

  return (
    <ParentShell width="max-w-4xl">
      <Link href="/dashboard" className={`${btn.link} mb-3 inline-block`}>
        ← All kids
      </Link>

      <section className="mb-6 overflow-hidden rounded-3xl bg-gradient-to-br from-violet-600 via-indigo-600 to-sky-500 p-5 text-white shadow-lg shadow-indigo-300/40 sm:p-6">
        <div className="flex items-center gap-4">
          <Avatar name={kid.name} size="lg" />
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-2xl font-bold sm:text-3xl">{kid.name}</h1>
            <p className="text-violet-100">Grade {kid.grade}</p>
          </div>
          <div className="text-right">
            <p className="text-4xl font-bold tabular-nums sm:text-5xl">{overview.balanceMinutes}</p>
            <p className="text-sm text-violet-100">min in the bank</p>
          </div>
        </div>
        <dl className="mt-5 grid grid-cols-3 gap-3 text-center text-sm">
          <div className="rounded-2xl bg-white/15 px-2 py-3">
            <dt className="text-xs text-violet-100">Answers right</dt>
            <dd className="mt-0.5 text-lg font-semibold">{overview.attemptsTotal ? `${overview.attemptsCorrect}/${overview.attemptsTotal}` : "-"}</dd>
          </div>
          <div className="rounded-2xl bg-white/15 px-2 py-3">
            <dt className="text-xs text-violet-100">Phones</dt>
            <dd className="mt-0.5 text-lg font-semibold">{paired}</dd>
          </div>
          <div className="rounded-2xl bg-white/15 px-2 py-3">
            <dt className="text-xs text-violet-100">Daily limit</dt>
            <dd className="mt-0.5 text-lg font-semibold">{kid.dailyCapMinutes} min</dd>
          </div>
        </dl>
      </section>

      {papers.length > 0 && (
        <Card className="mb-6 !bg-amber-50 ring-amber-200">
          <CardHeader
            icon="📝"
            title={papers.length === 1 ? "1 paper is waiting for you" : `${papers.length} papers are waiting for you`}
            description="Check it and approve to add the minutes."
          />
          <ul className="space-y-2">
            {papers.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 text-sm">
                <span>
                  <span className="font-medium">{p.subject}</span> · {p.submittedBy === "kid" ? `from ${kid.name}` : "from you"} · {fmtWhen.format(p.createdAt)}
                </span>
                <Link href={`${base}/papers/${p.id}`} className={btn.primary}>
                  Review
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <nav className="mb-6 grid grid-cols-4 gap-1.5 rounded-2xl bg-white p-1.5 shadow-sm ring-1 ring-slate-100" aria-label={`${kid.name}'s pages`}>
        {TABS.map((t) => (
          <Link
            key={t.id}
            href={`${base}?tab=${t.id}`}
            aria-current={t.id === tab ? "page" : undefined}
            className={`flex flex-col items-center gap-0.5 rounded-xl px-2 py-2.5 text-xs font-semibold transition sm:flex-row sm:justify-center sm:gap-2 sm:text-sm ${
              t.id === tab ? "bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-sm" : "text-slate-600 hover:bg-violet-50"
            }`}
          >
            <span className="text-lg sm:text-base" aria-hidden="true">
              {t.icon}
            </span>
            {t.label}
          </Link>
        ))}
      </nav>

      {tab === "today" && (
        <div className="space-y-6">
          <Card>
            <CardHeader icon="🎁" title="Give bonus time" description={`Minutes without homework. They go into the bank and do not count toward ${kid.name}'s daily limit.`} />
            <form action={giveBonus.bind(null, kid.id)} className="grid grid-cols-4 gap-2">
              {[5, 10, 15, 30].map((m) => (
                <button key={m} name="minutes" value={m} className={`${btn.secondary} !px-2`}>
                  +{m}
                </button>
              ))}
            </form>
            <details className="mt-4 rounded-xl bg-slate-50 p-3">
              <summary className="cursor-pointer text-sm font-medium text-slate-700">Other amounts, or take minutes out</summary>
              <div className="mt-4 space-y-5">
                <form action={giveBonus.bind(null, kid.id)} className="flex flex-wrap items-end gap-3">
                  <label className={labelText}>
                    Bonus minutes
                    <input name="minutes" type="number" min={1} max={240} defaultValue={20} required className={`${field} w-28`} />
                  </label>
                  <button className={btn.primary}>Give</button>
                </form>
                <form action={withdrawFromBank.bind(null, kid.id)} className="flex flex-wrap items-end gap-3">
                  <label className={labelText}>
                    Take out (minutes)
                    <input name="minutes" type="number" min={1} max={10000} defaultValue={10} required className={`${field} w-28`} />
                  </label>
                  <button className={btn.secondary} disabled={overview.balanceMinutes === 0}>
                    Take out
                  </button>
                </form>
                <form action={resetBank.bind(null, kid.id)}>
                  <ConfirmButton
                    message={`Reset ${kid.name}'s bank to zero? This removes ${overview.balanceMinutes} minutes.`}
                    className={`${btn.danger} disabled:cursor-not-allowed disabled:opacity-50`}
                  >
                    Empty the bank ({overview.balanceMinutes} min)
                  </ConfirmButton>
                </form>
              </div>
            </details>
          </Card>

          <Card>
            <CardHeader icon="💬" title="Send a message" description={`A short note that shows up in ${kid.name}'s app.`} />
            <form action={sendKidMessage.bind(null, kid.id)} className="flex flex-wrap items-end gap-3">
              <label className={`${labelText} min-w-0 flex-1`}>
                Your message
                <input name="text" required maxLength={500} placeholder="Well done this week!" className={field} />
              </label>
              <button className={btn.primary}>Send</button>
            </form>
          </Card>

          <Card>
            <CardHeader icon="🕘" title="Recent activity" />
            {activity.length > 0 ? (
              <ul className="divide-y divide-slate-100 text-sm">
                {activity.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-3 py-3">
                    <span>
                      {ACTIVITY_LABEL[a.reason] ?? "Adjustment"}
                      <span className="ml-2 text-xs text-slate-400">{fmtWhen.format(a.createdAt)}</span>
                    </span>
                    <span className={`tabular-nums font-semibold ${a.deltaMinutes > 0 ? "text-emerald-600" : "text-slate-500"}`}>
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
        </div>
      )}

      {tab === "homework" && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Tile primary href={`${base}/homework/new`} icon="➕" title="Add homework" text="From a photo or PDF" />
            <Tile href={`${base}/homework`} icon="📚" title="Results" text="Every question and try" />
            <Tile href={`${base}/performance`} icon="📈" title="How is it going?" text="Strengths and weaknesses" />
            <Tile href={`${base}/practice`} icon="🎯" title="Practice" text="Questions from the AI" />
          </div>

          <Card>
            <CardHeader
              icon="🤖"
              title="Paper checking"
              description={`When ${kid.name} does homework on paper and sends a photo, ${kid.name} chooses who checks it. You always see the photos for ${PHOTO_RETENTION_DAYS} days.`}
            />
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 p-4">
              <div className="text-sm">
                <p className="font-semibold">
                  AI checking is <Badge tone={kid.aiCheckEnabled ? "good" : "neutral"}>{kid.aiCheckEnabled ? "On" : "Off"}</Badge>
                </p>
                <p className="mt-1 max-w-md text-slate-500">
                  {kid.aiCheckEnabled
                    ? `${kid.name} can choose "Check with AI": the AI reads the paper and adds the minutes at once.`
                    : `Every paper comes to you. It is not shown to any AI unless you ask for suggestions.`}
                </p>
              </div>
              <form action={setAiCheck.bind(null, kid.id, !kid.aiCheckEnabled)}>
                <button className={kid.aiCheckEnabled ? btn.secondary : btn.primary}>{kid.aiCheckEnabled ? "Turn off" : "Turn on"}</button>
              </form>
            </div>

            {recentPapers.length > 0 && (
              <>
                <h3 className="mb-1 mt-6 text-sm font-semibold text-slate-700">Recent papers</h3>
                <ul className="divide-y divide-slate-100 text-sm">
                  {recentPapers.map((r) => (
                    <li key={r.id} className="flex items-center justify-between gap-3 py-3">
                      <span>
                        <span className="font-medium">{r.subject}</span>
                        <span className="ml-2 text-xs text-slate-400">{fmtWhen.format(r.createdAt)}</span>
                      </span>
                      <span className="flex items-center gap-3">
                        {r.status === "rejected" ? (
                          <Badge>Sent back</Badge>
                        ) : (
                          <Badge tone="good">
                            {r.autoApproved ? "AI" : "You"}: +{r.awardedMinutes ?? 0} min
                          </Badge>
                        )}
                        <Link href={`${base}/papers/${r.id}`} className={btn.link}>
                          Open
                        </Link>
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </Card>
        </div>
      )}

      {tab === "time" && (
        <Card>
          <CardHeader
            icon="⏰"
            title="Screen schedule"
            description={
              <>
                <b>Locked</b> times block the phone even if {kid.name} has minutes (bedtime, school). <b>Free</b> times allow any app without using minutes.
              </>
            }
          />
          {rules.length > 0 ? (
            <ul className="mb-5 space-y-2">
              {rules.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 p-3 text-sm">
                  <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <Badge tone={r.mode === "blocked" ? "bad" : "good"}>{r.mode === "blocked" ? "🔒 Locked" : "🎈 Free"}</Badge>
                    <span className="font-medium">{daysLabel(r.days)}</span>
                    <span className="tabular-nums text-slate-500">
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
            <p className="mb-5 rounded-xl bg-slate-50 p-4 text-sm text-slate-500">No time windows yet. Minutes are used whenever {kid.name} uses the phone.</p>
          )}
          <form action={addScheduleRule.bind(null, kid.id)} className="space-y-4 rounded-2xl border-2 border-dashed border-violet-200 p-4">
            <p className="font-semibold">Add a time window</p>
            <label className={labelText}>
              Type
              <select name="mode" className={field}>
                <option value="blocked">🔒 Locked (phone off)</option>
                <option value="free">🎈 Free (no minutes used)</option>
              </select>
            </label>
            <fieldset>
              <legend className={labelText}>Days</legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {DAY_LABELS.map((d, i) => (
                  <label key={d} className="cursor-pointer">
                    <input type="checkbox" name="day" value={i} defaultChecked className="peer sr-only" />
                    <span className="inline-flex min-h-10 min-w-12 items-center justify-center rounded-full border border-slate-200 bg-white px-3 text-sm font-medium peer-checked:border-violet-600 peer-checked:bg-violet-600 peer-checked:text-white peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-violet-600">
                      {d}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="flex flex-wrap items-end gap-3">
              <label className={labelText}>
                From
                <input name="start" type="time" required defaultValue="21:00" className={`${field} w-36`} />
              </label>
              <label className={labelText}>
                To
                <input name="end" type="time" required defaultValue="07:00" className={`${field} w-36`} />
              </label>
              <button className={btn.primary}>Add window</button>
            </div>
          </form>
        </Card>
      )}

      {tab === "settings" && (
        <div className="space-y-6">
          <Card>
            <CardHeader icon="📱" title="Phones" description={`Make a code, then type it in the Study Plan app on ${kid.name}'s phone.`} />
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
                    <li key={d.id} className="rounded-xl bg-slate-50 p-3 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="font-medium capitalize">{d.platform}</span>
                        {d.tokenHash ? <Badge tone="good">Paired</Badge> : live ? <Badge tone="warn">Waiting for the code</Badge> : <Badge>Expired</Badge>}
                      </div>
                      {live && (
                        <p className="mt-2">
                          <span className="block font-mono text-3xl font-bold tracking-widest text-violet-700">{d.pairingCode}</span>
                          <span className="text-xs text-slate-500">Valid until {fmtTime.format(d.pairingExpiresAt!)}</span>
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
              icon="🔓"
              title="Settings and uninstall"
              description={`On ${kid.name}'s phone these are parents-only. Approve here, or type your parent PIN on the phone. Approval lasts ${APPROVAL_MINUTES} minutes.`}
            />
            {approved ? (
              <div className="flex items-center justify-between gap-3 rounded-xl bg-emerald-50 p-4 text-sm">
                <span className="font-medium text-emerald-900">Open until {fmtTime.format(approved)}</span>
                <form action={revokeApproval.bind(null, kid.id)}>
                  <button className={btn.danger}>Close now</button>
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
              icon="🙂"
              title="Profile"
              description={
                <>
                  The kid&apos;s app fits the age. See it as {kid.name} would:{" "}
                  <Link href={`${base}/preview/little`} className={btn.link}>
                    Young
                  </Link>
                  {" · "}
                  <Link href={`${base}/preview/middle`} className={btn.link}>
                    Middle
                  </Link>
                  {" · "}
                  <Link href={`${base}/preview/teen`} className={btn.link}>
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
      )}
    </ParentShell>
  );
}

export default function KidPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  return (
    <Suspense fallback={<PageLoading />}>
      <KidDetails params={params} searchParams={searchParams} />
    </Suspense>
  );
}
