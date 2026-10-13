import { Suspense } from "react";
import { requireParent } from "@/lib/auth";
import { KidFields } from "../KidFields";
import { createKid } from "../actions";

async function NewKidForm() {
  await requireParent();
  return (
    <main className="mx-auto max-w-md p-6">
      <h1 className="mb-6 text-2xl font-semibold">Add kid</h1>
      <form action={createKid} className="space-y-4">
        <KidFields pinHint="Optional now, can be set later" />
        <button className="rounded bg-black px-4 py-2 text-white">Create</button>
      </form>
    </main>
  );
}

export default function NewKid() {
  return (
    <Suspense fallback={<main className="p-6">Loading…</main>}>
      <NewKidForm />
    </Suspense>
  );
}
