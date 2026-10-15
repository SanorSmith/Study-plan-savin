import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { kids } from "@/db/schema";
import { BonusInput } from "@/lib/bonus-input";
import { APPROVAL_MINUTES, balanceOf, grantBonus, setApproval, withdrawMinutes } from "@/lib/kid-service";
import { getParentApp } from "@/lib/parent-device";
import { WithdrawInput } from "@/lib/withdraw-input";

const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("bonus"), minutes: z.unknown() }),
  z.object({ action: z.literal("withdraw"), minutes: z.unknown() }),
  z.object({ action: z.literal("reset") }),
  z.object({ action: z.literal("ai"), enabled: z.boolean() }),
  z.object({ action: z.literal("allow_settings") }),
  z.object({ action: z.literal("block_settings") }),
]);

/** What a parent can do to a kid from the app: bonus, withdraw, empty the bank, AI checking, allow Settings on the kid's phone. */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const parent = await getParentApp();
  if (!parent) return Response.json({ error: "sign in required" }, { status: 401 });
  const id = z.uuid().safeParse((await context.params).id);
  const body = Body.safeParse(await request.json().catch(() => null));
  if (!id.success || !body.success) return Response.json({ error: "bad request" }, { status: 400 });

  const [kid] = await getDb().select({ id: kids.id }).from(kids).where(and(eq(kids.id, id.data), eq(kids.parentId, parent.id)));
  if (!kid) return Response.json({ error: "not found" }, { status: 404 });

  const b = body.data;
  let changed = 0;
  if (b.action === "bonus") {
    const input = BonusInput.safeParse({ minutes: b.minutes });
    if (!input.success) return Response.json({ error: input.error.issues[0].message }, { status: 400 });
    await grantBonus(kid.id, input.data.minutes);
    changed = input.data.minutes;
  } else if (b.action === "withdraw") {
    const input = WithdrawInput.safeParse({ minutes: b.minutes });
    if (!input.success) return Response.json({ error: input.error.issues[0].message }, { status: 400 });
    changed = await withdrawMinutes(kid.id, input.data.minutes);
  } else if (b.action === "reset") {
    changed = await withdrawMinutes(kid.id, null);
  } else if (b.action === "ai") {
    await getDb().update(kids).set({ aiCheckEnabled: b.enabled }).where(eq(kids.id, kid.id));
  } else if (b.action === "allow_settings") {
    await setApproval(kid.id, APPROVAL_MINUTES);
  } else {
    await setApproval(kid.id, null);
  }
  return Response.json({ ok: true, changedMinutes: changed, balanceMinutes: await balanceOf(kid.id) });
}
