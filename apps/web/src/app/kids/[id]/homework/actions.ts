"use server";

import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { homeworkSets, kids, questions } from "@/db/schema";
import { requireParent } from "@/lib/auth";
import { HomeworkInput } from "@/lib/homework-input";

/** Saves a parent-confirmed answer key and assigns the set to the kid. */
export async function assignHomework(kidId: string, form: FormData) {
  const parent = await requireParent();
  const input = HomeworkInput.parse({
    subject: form.get("subject"),
    questions: JSON.parse(String(form.get("questions") ?? "[]")),
  });

  const db = getDb();
  const [kid] = await db
    .select({ id: kids.id })
    .from(kids)
    .where(and(eq(kids.id, kidId), eq(kids.parentId, parent.id)));
  if (!kid) throw new Error("kid not found");

  const [set] = await db
    .insert(homeworkSets)
    .values({ kidId: kid.id, subject: input.subject, status: "assigned" })
    .returning({ id: homeworkSets.id });
  await db.insert(questions).values(
    input.questions.map((q) => ({
      setId: set.id,
      text: q.text,
      type: q.type,
      options: q.type === "multiple_choice" ? q.options : null,
      answerKey: q.answerKey,
      confirmed: true,
    })),
  );
  redirect(`/kids/${kid.id}`);
}
