import { describe, expect, it } from "vitest";
import { activeWindow, type ScheduleRule } from "./schedule";

const TZ = "Europe/Stockholm";
const EVERY_DAY = 127;
const MON_FRI = 0b0011111;

// Stockholm is UTC+2 until 2026-10-25. 2026-10-13 is a Tuesday.
const at = (day: number, hour: number, minute: number) => Date.UTC(2026, 9, day, hour - 2, minute);

describe("activeWindow", () => {
  it("is null with no rules", () => {
    expect(activeWindow([], TZ, at(13, 12, 0))).toBeNull();
  });

  it("covers a daytime window only on its days and hours", () => {
    const rules: ScheduleRule[] = [{ mode: "blocked", days: MON_FRI, startMinute: 8 * 60, endMinute: 15 * 60 }];
    expect(activeWindow(rules, TZ, at(13, 9, 0))?.mode).toBe("blocked"); // Tuesday 09:00
    expect(activeWindow(rules, TZ, at(13, 15, 0))).toBeNull(); // end is exclusive
    expect(activeWindow(rules, TZ, at(17, 9, 0))).toBeNull(); // Saturday
  });

  it("runs an overnight window into the next day", () => {
    const rules: ScheduleRule[] = [{ mode: "blocked", days: MON_FRI, startMinute: 21 * 60, endMinute: 7 * 60 }];
    expect(activeWindow(rules, TZ, at(13, 22, 0))?.mode).toBe("blocked"); // Tue 22:00
    expect(activeWindow(rules, TZ, at(14, 6, 59))?.mode).toBe("blocked"); // Wed 06:59, started Tuesday
    expect(activeWindow(rules, TZ, at(14, 7, 0))).toBeNull();
    expect(activeWindow(rules, TZ, at(17, 22, 0))).toBeNull(); // Saturday night is not in the days
    expect(activeWindow(rules, TZ, at(17, 6, 0))?.mode).toBe("blocked"); // Sat 06:00 started Friday night
  });

  it("lets blocked beat free", () => {
    const rules: ScheduleRule[] = [
      { mode: "free", days: EVERY_DAY, startMinute: 0, endMinute: 23 * 60 },
      { mode: "blocked", days: EVERY_DAY, startMinute: 12 * 60, endMinute: 13 * 60 },
    ];
    expect(activeWindow(rules, TZ, at(13, 12, 30))?.mode).toBe("blocked");
    expect(activeWindow(rules, TZ, at(13, 14, 0))?.mode).toBe("free");
  });

  it("uses the schedule's timezone, not the machine's", () => {
    const rules: ScheduleRule[] = [{ mode: "blocked", days: EVERY_DAY, startMinute: 9 * 60, endMinute: 10 * 60 }];
    // 09:30 in Tokyo (UTC+9) is 00:30 UTC.
    expect(activeWindow(rules, "Asia/Tokyo", Date.UTC(2026, 9, 13, 0, 30))?.mode).toBe("blocked");
  });
});
