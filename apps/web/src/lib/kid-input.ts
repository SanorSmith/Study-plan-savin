import { z } from "zod";

export const KidInput = z.object({
  name: z.string().trim().min(1, "Name is required").max(60),
  grade: z.coerce.number().int().min(1).max(12),
  minutesPerQuestion: z.coerce.number().int().min(1).max(60),
  dailyCapMinutes: z.coerce.number().int().min(10).max(480),
  uiStyle: z.enum(["auto", "little", "middle", "teen"]).default("auto"),
});

export const PinInput = z.string().regex(/^\d{4}$/, "PIN must be 4 digits");
