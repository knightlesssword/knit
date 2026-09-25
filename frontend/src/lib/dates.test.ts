import { describe, expect, it } from "vitest";
import { addDays, formatDayLabel, parseISODate, toISODate, weekStart } from "./dates";

describe("toISODate / parseISODate", () => {
  it("round-trips a date", () => {
    const d = new Date(2026, 8, 25);
    expect(parseISODate(toISODate(d)).getTime()).toBe(d.getTime());
  });

  it("zero-pads month and day", () => {
    expect(toISODate(new Date(2026, 0, 5))).toBe("2026-01-05");
  });

  it("rejects bad input", () => {
    expect(() => parseISODate("not-a-date")).toThrow();
    expect(() => parseISODate("2026-02-30")).toThrow();
    expect(() => parseISODate("2026-13-01")).toThrow();
  });
});

describe("weekStart", () => {
  it("keeps Monday as is", () => {
    expect(toISODate(weekStart(new Date(2026, 8, 21)))).toBe("2026-09-21");
  });

  it("snaps Sunday back to the previous Monday", () => {
    expect(toISODate(weekStart(new Date(2026, 8, 27)))).toBe("2026-09-21");
  });

  it("snaps mid-week days back to Monday", () => {
    expect(toISODate(weekStart(new Date(2026, 8, 25)))).toBe("2026-09-21");
  });

  it("crosses a month boundary", () => {
    // 2026-09-01 is a Tuesday; its Monday is 2026-08-31.
    expect(toISODate(weekStart(new Date(2026, 8, 1)))).toBe("2026-08-31");
  });
});

describe("addDays", () => {
  it("crosses month boundaries", () => {
    expect(toISODate(addDays(new Date(2026, 0, 31), 1))).toBe("2026-02-01");
    expect(toISODate(addDays(new Date(2026, 1, 1), -1))).toBe("2026-01-31");
  });

  it("crosses year boundaries", () => {
    expect(toISODate(addDays(new Date(2025, 11, 31), 1))).toBe("2026-01-01");
  });
});

describe("formatDayLabel", () => {
  it("formats lowercase short labels", () => {
    expect(formatDayLabel("2026-09-21")).toBe("mon 21");
    expect(formatDayLabel("2026-09-27")).toBe("sun 27");
  });
});
