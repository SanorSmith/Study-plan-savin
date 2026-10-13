"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { devices, kids } from "@/db/schema";
import { requireParent } from "@/lib/auth";
import { KidInput, PinInput } from "@/lib/kid-input";
import { generatePairingCode, pairingExpiry } from "@/lib/pairing";
import { hashPin } from "@/lib/pin";

const fields = (form: FormData) => ({
  name: form.get("name"),
  grade: form.get("grade"),
  minutesPerQuestion: form.get("minutesPerQuestion"),
  dailyCapMinutes: form.get("dailyCapMinutes"),
});

async function pinHashFrom(form: FormData): Promise<string | undefined> {
  const raw = String(form.get("pin") ?? "");
  if (raw === "") return undefined;
  return hashPin(PinInput.parse(raw));
}

export async function createKid(form: FormData) {
  const parent = await requireParent();
  const input = KidInput.parse(fields(form));
  const pinHash = await pinHashFrom(form);
  const [kid] = await getDb()
    .insert(kids)
    .values({ ...input, parentId: parent.id, pinHash })
    .returning({ id: kids.id });
  redirect(`/kids/${kid.id}`);
}

export async function updateKid(kidId: string, form: FormData) {
  const parent = await requireParent();
  const input = KidInput.parse(fields(form));
  const pinHash = await pinHashFrom(form);
  await getDb()
    .update(kids)
    .set({
      ...input,
      ...(pinHash ? { pinHash, pinFailedAttempts: 0, pinLockedUntil: null } : {}),
    })
    .where(and(eq(kids.id, kidId), eq(kids.parentId, parent.id)));
  revalidatePath(`/kids/${kidId}`);
  revalidatePath("/dashboard");
}

export async function createPairingCode(kidId: string, form: FormData) {
  const parent = await requireParent();
  const platform = String(form.get("platform") ?? "android");
  if (!["android", "ios", "web"].includes(platform)) throw new Error("bad platform");

  const db = getDb();
  const [kid] = await db
    .select({ id: kids.id })
    .from(kids)
    .where(and(eq(kids.id, kidId), eq(kids.parentId, parent.id)));
  if (!kid) throw new Error("kid not found");

  await db.insert(devices).values({
    kidId: kid.id,
    platform,
    pairingCode: generatePairingCode(),
    pairingExpiresAt: pairingExpiry(new Date()),
  });
  revalidatePath(`/kids/${kidId}`);
}
