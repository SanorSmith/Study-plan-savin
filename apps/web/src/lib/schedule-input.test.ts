import { describe, expect, it } from "vitest";
import { daysLabel, daysMask, formatMinute, ScheduleInput } from "./schedule-input";

describe("ScheduleInput", () => {
  it("turns times into minutes after midnight", () => {
    expect(ScheduleInput.parse({ mode: "blocked", days: 127, start: "21:30", end: "07:00" })).toEqual({
      mode: "blocked",
      days: 127,
      startMinute: 1290,
      endMinute: 420,
    });
  });

  it("rejects equal start and end, bad times and empty days", () => {
    expect(ScheduleInput.safeParse({ mode: "free", days: 1, start: "08:00", end: "08:00" }).success).toBe(false);
    expect(ScheduleInput.safeParse({ mode: "free", days: 1, start: "24:00", end: "08:00" }).success).toBe(false);
    expect(ScheduleInput.safeParse({ mode: "free", days: 0, start: "08:00", end: "09:00" }).success).toBe(false);
    expect(ScheduleInput.safeParse({ mode: "other", days: 1, start: "08:00", end: "09:00" }).success).toBe(false);
  });
});

describe("daysMask", () => {
  it("builds a Monday-first bitmask and ignores junk", () => {
    expect(daysMask(["0", "4"])).toBe(0b10001);
    expect(daysMask(["6", "x", "9"])).toBe(64);
  });
});

describe("labels", () => {
  it("formats minutes and day sets", () => {
    expect(formatMinute(7 * 60 + 5)).toBe("07:05");
    expect(daysLabel(127)).toBe("Every day");
    expect(daysLabel(0b0011111)).toBe("Mon to Fri");
    expect(daysLabel(0b0000101)).toBe("Mon, Wed");
  });
});
