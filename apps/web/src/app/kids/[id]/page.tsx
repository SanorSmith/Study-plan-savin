import { Suspense } from "react";
import Link from "next/link";
import { and, desc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { getDb } from "@/db";
import { devices, kids } from "@/db/schema";
import { requireParent } from "@/lib/auth";
import { isPairingValid } from "@/lib/pairing";
import { KidFields } from "../KidFields";
import { createPairingCode, updateKid } from "../actions";

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
        </Link>
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
