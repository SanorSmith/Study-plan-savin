import { z } from "zod";

export const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

const TIME = /^([01]\d|2[0-3]):([0-5]\d)$/;
const minutes = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

export const ScheduleInput = z
  .object({
    mode: z.enum(["blocked", "free"]),
    days: z.number().int().min(1, "Pick at least one day").max(127),
    start: z.string().regex(TIME, "Enter a start time"),
    end: z.string().regex(TIME, "Enter an end time"),
  })
  .refine((r) => r.start !== r.end, { message: "Start and end must differ" })
  .transform((r) => ({
    mode: r.mode,
    days: r.days,
    startMinute: minutes(r.start),
    endMinute: minutes(r.end),
  }));

/** Day checkboxes (values "0".."6", Monday first) to a bitmask. */
export function daysMask(values: string[]): number {
  return values.reduce((mask, v) => {
    const d = Number(v);
    return Number.isInteger(d) && d >= 0 && d <= 6 ? mask | (1 << d) : mask;
  }, 0);
}

export function formatMinute(total: number): string {
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

export function daysLabel(mask: number): string {
  if (mask === 127) return "Every day";
  if (mask === 0b0011111) return "Mon to Fri";
  if (mask === 0b1100000) return "Sat and Sun";
  return DAY_LABELS.filter((_, i) => mask & (1 << i)).join(", ");
}
