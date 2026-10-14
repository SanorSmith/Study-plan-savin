import { z } from "zod";

export const WithdrawInput = z.object({
  minutes: z.coerce.number().int("Whole minutes only").min(1, "At least 1 minute").max(10000, "That is more than the bank can hold"),
});
