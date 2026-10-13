"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/db";
import { parents } from "@/db/schema";
import { requireParent } from "@/lib/auth";
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
