import { z } from "zod";

export const BonusInput = z.object({
  minutes: z.coerce.number().int("Whole minutes only").min(1, "At least 1 minute").max(240, "At most 240 minutes"),
  startNow: z.boolean(),
});
