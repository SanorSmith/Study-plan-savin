import { Suspense } from "react";
import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { getDb } from "@/db";
import { kids } from "@/db/schema";
import { requireParent } from "@/lib/auth";
import { HomeworkReview } from "./HomeworkReview";

async function Content({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const parent = await requireParent();
  const [kid] = await getDb()
    .select()
    .from(kids)
    .where(and(eq(kids.id, id), eq(kids.parentId, parent.id)));
  if (!kid) notFound();

  return (
    <main className="mx-auto max-w-md p-6">
      <h1 className="mb-6 text-2xl font-semibold">New homework for {kid.name}</h1>
      <HomeworkReview kidId={kid.id} grade={kid.grade} />
    </main>
  );
}

export default function NewHomeworkPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<main className="p-6">Loading…</main>}>
      <Content params={params} />
    </Suspense>
  );
}
