import { z } from "zod";
import { HomeworkInput } from "@/lib/homework-input";
import { getParentApp } from "@/lib/parent-device";
import { assignHomeworkSet, ownedKidOf } from "@/lib/parent-kid";

/** Assigns a worksheet whose answer key the parent has confirmed. */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const parent = await getParentApp();
  if (!parent) return Response.json({ error: "sign in required" }, { status: 401 });
  const id = z.uuid().safeParse((await context.params).id);
  const kid = id.success ? await ownedKidOf(parent.id, id.data) : null;
  if (!kid) return Response.json({ error: "not found" }, { status: 404 });
  const input = HomeworkInput.safeParse(await request.json().catch(() => null));
  if (!input.success) return Response.json({ error: input.error.issues[0].message }, { status: 400 });
  return Response.json({ ok: true, id: await assignHomeworkSet(kid.id, input.data) });
}
