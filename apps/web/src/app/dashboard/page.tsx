import { Suspense } from "react";
import Link from "next/link";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { kids } from "@/db/schema";
import { requireParent } from "@/lib/auth";
import { signOut } from "../login/actions";

async function KidList() {
  const parent = await requireParent();
  const list = await getDb().select().from(kids).where(eq(kids.parentId, parent.id));

  return (
    <main className="mx-auto max-w-2xl p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Your kids</h1>
        <Link href="/kids/new" className="rounded bg-black px-3 py-2 text-white">
          Add kid
        </Link>
      </div>
      <ul className="mt-6 divide-y rounded border">
        {list.length === 0 && <li className="p-4 text-gray-600">No kids yet.</li>}
        {list.map((k) => (
          <li key={k.id}>
            <Link href={`/kids/${k.id}`} className="flex justify-between p-4 hover:bg-gray-50">
              <span>{k.name}</span>
              <span className="text-gray-600">Grade {k.grade}</span>
            </Link>
          </li>
        ))}
      </ul>
      <form action={signOut} className="mt-6">
        <button className="text-sm text-gray-600 underline">Sign out</button>
      </form>
    </main>
  );
}

export default function Dashboard() {
  return (
    <Suspense fallback={<main className="p-6">Loading…</main>}>
      <KidList />
    </Suspense>
  );
}
