import { describe, expect, it } from "vitest";
import {
  formatDuration,
  minutesInputToSeconds,
  minutesToSeconds,
  secondsToMinutes,
  secondsToMinutesInput,
} from "./duration";

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

describe("minutesInputToSeconds", () => {
  it("converts whole minutes to seconds", () => {
    expect(minutesInputToSeconds("45")).toBe(2700);
    expect(minutesInputToSeconds("0")).toBe(0);
    expect(minutesInputToSeconds("  90  ")).toBe(5400);
  });

  it("converts short decimals that land on whole seconds", () => {
    expect(minutesInputToSeconds("1.5")).toBe(90);
    expect(minutesInputToSeconds("1.50")).toBe(90);
    expect(minutesInputToSeconds("0.5")).toBe(30);
    expect(minutesInputToSeconds("0.05")).toBe(3);
    expect(minutesInputToSeconds("1.05")).toBe(63);
    expect(minutesInputToSeconds("2.25")).toBe(135);
  });

  it("rejects blanks, negatives and garbage", () => {
    expect(minutesInputToSeconds("")).toBeNull();
    expect(minutesInputToSeconds("   ")).toBeNull();
    expect(minutesInputToSeconds("-3")).toBeNull();
    expect(minutesInputToSeconds("abc")).toBeNull();
    expect(minutesInputToSeconds(".5")).toBeNull();
    expect(minutesInputToSeconds("5.")).toBeNull();
    expect(minutesInputToSeconds("1,5")).toBeNull();
  });

  it("rejects decimals past 2 places or off whole seconds", () => {
    expect(minutesInputToSeconds("1.555")).toBeNull();
    expect(minutesInputToSeconds("1.01")).toBeNull();
    expect(minutesInputToSeconds("0.01")).toBeNull();
    expect(minutesInputToSeconds("1.07")).toBeNull();
  });
});

describe("secondsToMinutesInput", () => {
  it("formats whole minutes without decimals", () => {
    expect(secondsToMinutesInput(0)).toBe("0");
    expect(secondsToMinutesInput(60)).toBe("1");
    expect(secondsToMinutesInput(3600)).toBe("60");
  });

  it("formats exact short decimals", () => {
    expect(secondsToMinutesInput(90)).toBe("1.5");
    expect(secondsToMinutesInput(30)).toBe("0.5");
    expect(secondsToMinutesInput(3)).toBe("0.05");
    expect(secondsToMinutesInput(63)).toBe("1.05");
    expect(secondsToMinutesInput(135)).toBe("2.25");
  });

  it("returns null when not representable in 2 decimals", () => {
    expect(secondsToMinutesInput(1)).toBeNull();
    expect(secondsToMinutesInput(59)).toBeNull();
    expect(secondsToMinutesInput(61)).toBeNull();
    expect(secondsToMinutesInput(3661)).toBeNull();
  });

  it("returns null for negative input", () => {
    expect(secondsToMinutesInput(-5)).toBeNull();
  });

  it("round-trips through the parser", () => {
    for (const seconds of [0, 3, 30, 60, 63, 90, 135, 3600]) {
      const text = secondsToMinutesInput(seconds);
      expect(text).not.toBeNull();
      expect(minutesInputToSeconds(text!)).toBe(seconds);
    }
  });
});
