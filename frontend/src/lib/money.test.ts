import { describe, expect, it } from "vitest";
import { formatMoney, majorToMinor, minorToMajor } from "./money";

describe("money", () => {
  it("parses zero values", () => {
    expect(majorToMinor("0")).toBe(0);
    expect(majorToMinor("0.00")).toBe(0);
  });

  it("parses one cent", () => {
    expect(majorToMinor("0.01")).toBe(1);
  });

  it("parses whole and half values", () => {
    expect(majorToMinor("10")).toBe(1000);
    expect(majorToMinor("10.5")).toBe(1050);
    expect(majorToMinor("42.50")).toBe(4250);
  });

  it("parses large values without float error", () => {
    expect(majorToMinor("1234567.89")).toBe(123456789);
    expect(majorToMinor("0.07")).toBe(7);
    // 19.99 * 100 in float would be 1998.999..., string parse stays exact
    expect(majorToMinor("19.99")).toBe(1999);
  });

  it("rejects invalid input", () => {
    expect(majorToMinor("")).toBeNull();
    expect(majorToMinor("   ")).toBeNull();
    expect(majorToMinor("abc")).toBeNull();
    expect(majorToMinor("-5")).toBeNull();
    expect(majorToMinor("10.999")).toBeNull();
    expect(majorToMinor("10..5")).toBeNull();
    expect(majorToMinor("$10")).toBeNull();
  });

  it("formats minor back to major", () => {
    expect(minorToMajor(0)).toBe("0.00");
    expect(minorToMajor(1)).toBe("0.01");
    expect(minorToMajor(4250)).toBe("42.50");
  });

  it("formats all three currencies", () => {
    expect(formatMoney(4250, "USD")).toBe("$42.50");
    expect(formatMoney(4250, "GBP")).toBe("£42.50");
    expect(formatMoney(4250, "INR")).toContain("42.50");
  });
});
