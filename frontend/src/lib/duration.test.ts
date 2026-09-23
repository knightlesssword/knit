import { describe, expect, it } from "vitest";
import { formatDuration, minutesToSeconds, secondsToMinutes } from "./duration";

describe("formatDuration", () => {
  it("formats zero as 0m", () => {
    expect(formatDuration(0)).toBe("0m");
  });

  it("formats sub-minute values as 0m", () => {
    expect(formatDuration(59)).toBe("0m");
  });

  it("formats minutes without hours", () => {
    expect(formatDuration(2700)).toBe("45m");
  });

  it("formats 9000 seconds as 2h 30m", () => {
    expect(formatDuration(9000)).toBe("2h 30m");
  });

  it("formats exact hours with 0m remainder", () => {
    expect(formatDuration(3600)).toBe("1h 0m");
  });

  it("drops leftover seconds", () => {
    expect(formatDuration(90)).toBe("1m");
    expect(formatDuration(3661)).toBe("1h 1m");
  });

  it("clamps negative input to 0m", () => {
    expect(formatDuration(-5)).toBe("0m");
  });
});

describe("minutesToSeconds", () => {
  it("converts whole minutes to seconds", () => {
    expect(minutesToSeconds("45")).toBe(2700);
    expect(minutesToSeconds("0")).toBe(0);
  });

  it("rejects blanks, decimals and negatives", () => {
    expect(minutesToSeconds("")).toBeNull();
    expect(minutesToSeconds("1.5")).toBeNull();
    expect(minutesToSeconds("-3")).toBeNull();
    expect(minutesToSeconds("abc")).toBeNull();
  });
});

describe("secondsToMinutes", () => {
  it("returns whole minutes", () => {
    expect(secondsToMinutes(9000)).toBe(150);
    expect(secondsToMinutes(59)).toBe(0);
  });
});
