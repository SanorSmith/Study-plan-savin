import { getDb } from "@/db";
import { kids } from "@/db/schema";
import { KidInput, PinInput } from "@/lib/kid-input";
import { getParentApp } from "@/lib/parent-device";
import { hashPin } from "@/lib/pin";

/** Adds a kid from the parent app. The PIN is optional here; a kid cannot sign in on a phone until one is set. */
export async function POST(request: Request) {
  const parent = await getParentApp();
  if (!parent) return Response.json({ error: "sign in required" }, { status: 401 });
  const raw = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const profile = KidInput.safeParse(raw?.profile);
  if (!profile.success) return Response.json({ error: profile.error.issues[0].message }, { status: 400 });
  let pinHash: string | undefined;
  if (typeof raw?.pin === "string" && raw.pin !== "") {
    const pin = PinInput.safeParse(raw.pin);
    if (!pin.success) return Response.json({ error: pin.error.issues[0].message }, { status: 400 });
    pinHash = await hashPin(pin.data);
  }
  const [kid] = await getDb().insert(kids).values({ ...profile.data, parentId: parent.id, pinHash }).returning({ id: kids.id });
  return Response.json({ ok: true, id: kid.id });
}
