/** Same rules as the Android app (Schedule.kt): which parent-set window applies at a given moment. */
export type ScheduleRule = { mode: string; days: number; startMinute: number; endMinute: number };
export type ActiveWindow = { mode: "blocked" | "free"; endMinute: number };

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** Day of week (Monday = 0) and minute of the day in the given timezone. */
function localParts(nowMs: number, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(nowMs));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return {
    day: Math.max(0, WEEKDAYS.indexOf(get("weekday"))),
    minute: Number(get("hour")) * 60 + Number(get("minute")),
  };
}

/** Blocked beats free; null means no window applies and minutes are used as normal. */
export function activeWindow(rules: ScheduleRule[], timeZone: string, nowMs: number): ActiveWindow | null {
  const { day, minute } = localParts(nowMs, timeZone);
  const today = 1 << day;
  const yesterday = 1 << ((day + 6) % 7);

  let free: ActiveWindow | null = null;
  for (const r of rules) {
    const active =
      r.startMinute < r.endMinute
        ? (r.days & today) !== 0 && minute >= r.startMinute && minute < r.endMinute
        : ((r.days & today) !== 0 && minute >= r.startMinute) || ((r.days & yesterday) !== 0 && minute < r.endMinute);
    if (!active) continue;
    if (r.mode === "blocked") return { mode: "blocked", endMinute: r.endMinute };
    free = { mode: "free", endMinute: r.endMinute };
  }
  return free;
}
