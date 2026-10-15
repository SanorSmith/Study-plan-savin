import { Suspense } from "react";
import Link from "next/link";
import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { getDb } from "@/db";
import { kids } from "@/db/schema";
import { btn, PageHeader } from "@/components/ui";
import { PageLoading, ParentShell } from "@/components/ParentShell";
import { requireParent } from "@/lib/auth";
import { ageBand, type AgeBand } from "@/lib/age-band";
import { PreviewClient } from "./PreviewClient";

const STYLES: { value: AgeBand; label: string }[] = [
  { value: "little", label: "Young" },
  { value: "middle", label: "Middle" },
  { value: "teen", label: "Teen" },
];

async function Preview({ params }: { params: Promise<{ id: string; style: string }> }) {
  const { id, style } = await params;
  if (style !== "little" && style !== "middle" && style !== "teen") notFound();
  const parent = await requireParent();
  const [kid] = await getDb()
    .select()
    .from(kids)
    .where(and(eq(kids.id, id), eq(kids.parentId, parent.id)));
  if (!kid) notFound();
  const current = ageBand(kid.grade, kid.uiStyle);

  return (
    <ParentShell>
      <PageHeader
        back={
          <Link href={`/kids/${kid.id}`} className={btn.link}>
            ← {kid.name}
          </Link>
        }
        title={`How ${kid.name}'s app looks`}
        subtitle={`Try it: this is a working preview with made-up homework. Nothing is saved. ${kid.name} sees the ${STYLES.find((s) => s.value === current)?.label} look now. Change it in the profile.`}
        actions={
          <div className="flex gap-2">
            {STYLES.map((s) => (
              <Link key={s.value} href={`/kids/${kid.id}/preview/${s.value}`} className={s.value === style ? btn.primary : btn.secondary}>
                {s.label}
              </Link>
            ))}
          </div>
        }
      />
      <PreviewClient key={style} band={style} name={kid.name} minutesPerQuestion={kid.minutesPerQuestion} />
    </ParentShell>
  );
}

export default function PreviewPage({ params }: { params: Promise<{ id: string; style: string }> }) {
  return (
    <Suspense fallback={<PageLoading />}>
      <Preview params={params} />
    </Suspense>
  );
}
