import { Suspense } from "react";
import Link from "next/link";
import { btn, Card, PageHeader } from "@/components/ui";
import { PageLoading, ParentShell } from "@/components/ParentShell";
import { requireParent } from "@/lib/auth";
import { KidFields } from "../KidFields";
import { createKid } from "../actions";

async function NewKidForm() {
  await requireParent();
  return (
    <ParentShell width="max-w-xl">
      <PageHeader
        back={
          <Link href="/dashboard" className={btn.link}>
            ← All kids
          </Link>
        }
        title="Add a kid"
        subtitle="You can pair their phone and set a schedule on the next page."
      />
      <Card>
        <form action={createKid} className="space-y-5">
          <KidFields pinHint="Optional now, can be set later" />
          <button className={btn.primary}>Create</button>
        </form>
      </Card>
    </ParentShell>
  );
}

export default function NewKid() {
  return (
    <Suspense fallback={<PageLoading />}>
      <NewKidForm />
    </Suspense>
  );
}
