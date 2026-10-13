import { Suspense } from "react";
import Link from "next/link";
import { and, desc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { getDb } from "@/db";
import { devices, kids, scheduleRules } from "@/db/schema";
import { requireParent } from "@/lib/auth";
import { isPairingValid } from "@/lib/pairing";
import { KidFields } from "../KidFields";
import { recentActivity } from "@/lib/results";
import { daysLabel, DAY_LABELS, formatMinute } from "@/lib/schedule-input";
import { addScheduleRule, createPairingCode, deleteScheduleRule, giveBonus, updateKid } from "../actions";

async function KidDetails({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const parent = await requireParent();
  const db = getDb();
  const [kid] = await db
    .select()
    .from(kids)
    .where(and(eq(kids.id, id), eq(kids.parentId, parent.id)));
  if (!kid) notFound();

  const list = await db
    .select()
    .from(devices)
    .where(eq(devices.kidId, kid.id))
    .orderBy(desc(devices.createdAt));
  const now = new Date();
  const activity = await recentActivity(kid.id);
  const rules = await db
    .select()
    .from(scheduleRules)
    .where(eq(scheduleRules.kidId, kid.id))
    .orderBy(scheduleRules.startMinute);

  return (
    <main className="mx-auto max-w-md space-y-10 p-6">
      <section>
        <h1 className="mb-6 text-2xl font-semibold">{kid.name}</h1>
        <form action={updateKid.bind(null, kid.id)} className="space-y-4">
          <KidFields d={kid} pinHint={kid.pinHash ? "Leave blank to keep current" : "Not set"} />
          <button className="rounded bg-black px-4 py-2 text-white">Save</button>
        </form>
      </section>
      <section>
        <Link href={`/kids/${kid.id}/homework/new`} className="rounded bg-black px-4 py-2 text-white">
          Add homework from a photo
        </Link>{" "}
        <Link href={`/kids/${kid.id}/homework`} className="rounded border px-4 py-2">
          Homework and results
        </Link>
      </section>
      <section>
        <h2 className="mb-1 text-xl font-semibold">Screen schedule</h2>
        <p className="mb-3 text-sm text-gray-600">
          <b>Locked</b> times block the phone even if {kid.name} has minutes (bedtime, school).{" "}
          <b>Free</b> times allow any app without using minutes. Outside these windows, minutes are used only while
          the screen is on and an app is open.
        </p>
        {rules.length > 0 && (
          <ul className="mb-4 space-y-2">
            {rules.map((r) => (
              <li key={r.id} className="flex items-center justify-between rounded border p-3 text-sm">
                <span>
                  <b>{r.mode === "blocked" ? "Locked" : "Free"}</b> · {daysLabel(r.days)} ·{" "}
                  {formatMinute(r.startMinute)} to {formatMinute(r.endMinute)}
                  {r.endMinute < r.startMinute && " (next day)"}
                </span>
                <form action={deleteScheduleRule.bind(null, kid.id, r.id)}>
                  <button className="text-red-600 underline">Remove</button>
                </form>
              </li>
            ))}
          </ul>
        )}
        <form action={addScheduleRule.bind(null, kid.id)} className="space-y-3 rounded border p-3">
          <select name="mode" className="w-full rounded border p-2">
            <option value="blocked">Locked (phone off)</option>
            <option value="free">Free (no minutes used)</option>
          </select>
          <div className="flex flex-wrap gap-3 text-sm">
            {DAY_LABELS.map((d, i) => (
              <label key={d} className="flex items-center gap-1">
                <input type="checkbox" name="day" value={i} defaultChecked />
                {d}
              </label>
            ))}
          </div>
          <div className="flex items-center gap-2 text-sm">
            <input name="start" type="time" required defaultValue="21:00" className="rounded border p-2" />
            to
            <input name="end" type="time" required defaultValue="07:00" className="rounded border p-2" />
          </div>
          <button className="rounded border px-4 py-2">Add time window</button>
        </form>
      </section>
      <section>
        <h2 className="mb-1 text-xl font-semibold">Bonus screen time</h2>
        <p className="mb-3 text-sm text-gray-600">
          Give {kid.name} minutes without any homework. They go into the bank and are used automatically while {kid.name} uses the phone. Bonus minutes don&apos;t count toward the daily limit.
        </p>
        <form action={giveBonus.bind(null, kid.id)} className="space-y-3">
          <div className="flex items-center gap-2">
            <input
              name="minutes"
              type="number"
              min={1}
              max={240}
              defaultValue={15}
              required
              className="w-24 rounded border p-2"
            />
            <span>minutes</span>
          </div>
          <button className="rounded bg-black px-4 py-2 text-white">Give bonus</button>
        </form>
        {activity.length > 0 && (
          <ul className="mt-4 space-y-1 text-sm">
            {activity.map((a) => (
              <li key={a.id} className="flex justify-between text-gray-700">
                <span>
                  {a.reason === "bonus"
                    ? "Bonus from parent"
                    : a.reason === "correct_answer"
                      ? "Earned from homework"
                      : a.reason === "usage" || a.reason === "spend"
                        ? "Used as screen time"
                        : "Adjustment"}
                </span>
                <span className={a.deltaMinutes > 0 ? "text-green-700" : "text-gray-600"}>
                  {a.deltaMinutes > 0 ? "+" : ""}
                  {a.deltaMinutes} min
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section>
        <h2 className="mb-3 text-xl font-semibold">Devices</h2>
        <form action={createPairingCode.bind(null, kid.id)} className="flex gap-2">
          <select name="platform" className="rounded border p-2">
            <option value="android">Android</option>
            <option value="ios">iPhone/iPad</option>
            <option value="web">Web</option>
          </select>
          <button className="rounded border px-3 py-2">New pairing code</button>
        </form>
        <ul className="mt-4 space-y-2">
          {list.map((d) => (
            <li key={d.id} className="rounded border p-3">
              {d.platform} ·{" "}
              {d.tokenHash
                ? "paired"
                : isPairingValid(d.pairingExpiresAt, now)
                  ? <>code <b className="font-mono">{d.pairingCode}</b> (15 min)</>
                  : "code expired"}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}

export default function KidPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<main className="p-6">Loading…</main>}>
      <KidDetails params={params} />
    </Suspense>
  );
}
