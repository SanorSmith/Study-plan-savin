import { z } from "zod";
import { HomeworkInput } from "@/lib/homework-input";
import { getParentApp } from "@/lib/parent-device";
import { deleteHomeworkSet, ownedKidOf, updateHomeworkSet } from "@/lib/parent-kid";

async function owned(context: { params: Promise<{ id: string; setId: string }> }) {
  const parent = await getParentApp();
  if (!parent) return { error: Response.json({ error: "sign in required" }, { status: 401 }) };
  const params = z.object({ id: z.uuid(), setId: z.uuid() }).safeParse(await context.params);
  const kid = params.success ? await ownedKidOf(parent.id, params.data.id) : null;
  if (!params.success || !kid) return { error: Response.json({ error: "not found" }, { status: 404 }) };
  return { kid, setId: params.data.setId };
}

/** Edits a set: subject, and its questions (the ones that come with an id are changed in place, the others added, missing ones removed). */
export async function PUT(request: Request, context: { params: Promise<{ id: string; setId: string }> }) {
  const found = await owned(context);
  if (found.error) return found.error;
  const raw = (await request.json().catch(() => null)) as { subject?: unknown; questions?: unknown } | null;
  const list = Array.isArray(raw?.questions) ? (raw.questions as Record<string, unknown>[]) : [];
  const ids = list.map((q) => (typeof q?.id === "string" ? q.id : null));
  if (ids.some((id) => id !== null && !z.uuid().safeParse(id).success)) return Response.json({ error: "bad question id" }, { status: 400 });
  const input = HomeworkInput.safeParse({ subject: raw?.subject, questions: list.map((q) => Object.fromEntries(Object.entries(q).filter(([k]) => k !== "id"))) });
  if (!input.success) return Response.json({ error: input.error.issues[0].message }, { status: 400 });
  const ok = await updateHomeworkSet(found.kid.id, found.setId, input.data, ids);
  return ok ? Response.json({ ok: true }) : Response.json({ error: "not found" }, { status: 404 });
}

/** Removes a set. Minutes the kid earned from it stay in the bank. */
export async function DELETE(_request: Request, context: { params: Promise<{ id: string; setId: string }> }) {
  const found = await owned(context);
  if (found.error) return found.error;
  const ok = await deleteHomeworkSet(found.kid.id, found.setId);
  return ok ? Response.json({ ok: true }) : Response.json({ error: "not found" }, { status: 404 });
}
