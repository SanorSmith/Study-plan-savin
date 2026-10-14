"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/db";
import { parents } from "@/db/schema";
import { requireParent } from "@/lib/auth";
import { neonAuth } from "@/lib/neon-auth";
import { hashPin } from "@/lib/pin";

const ParentPin = z.string().regex(/^\d{6}$/, "The parent PIN must be 6 digits");

/** Sets the parent PIN used on kids' phones to open Settings and uninstall screens. */
export async function setParentPin(form: FormData) {
  const parent = await requireParent();
  const pin = ParentPin.parse(form.get("pin"));
  await getDb()
    .update(parents)
    .set({ approvalPinHash: await hashPin(pin), approvalFailedAttempts: 0, approvalLockedUntil: null })
    .where(eq(parents.id, parent.id));
  revalidatePath("/dashboard");
}

export type PasswordState = { error?: string; ok?: boolean } | null;

const PasswordChange = z.object({
  current: z.string().min(1, "Enter your current password").max(128),
  password: z.string().min(8, "The new password must be at least 8 characters").max(128),
});

/** Changes the signed-in parent's password and signs out their other sessions. */
export async function changePassword(_prev: PasswordState, form: FormData): Promise<PasswordState> {
  await requireParent();
  const parsed = PasswordChange.safeParse({ current: form.get("current"), password: form.get("password") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { error } = await neonAuth.changePassword({
    currentPassword: parsed.data.current,
    newPassword: parsed.data.password,
    revokeOtherSessions: true,
  });
  if (error) return { error: "The current password is wrong" };
  return { ok: true };
}
