import { describe, expect, it } from "vitest";
import { validateEmail, validateName, validatePassword } from "./validation";

describe("validation", () => {
  it("accepts a normal registration", () => {
    expect(validateName("Ava")).toBeNull();
    expect(validateEmail("ava@example.com")).toBeNull();
    expect(validatePassword("password123")).toBeNull();
  });

  it("rejects blank names", () => {
    expect(validateName("   ")).not.toBeNull();
  });

  it("rejects malformed emails", () => {
    expect(validateEmail("not-an-email")).not.toBeNull();
    expect(validateEmail("a@b")).not.toBeNull();
  });

  it("normalizes case when checking email shape", () => {
    expect(validateEmail("AVA@EXAMPLE.COM")).toBeNull();
  });

  it("rejects short passwords", () => {
    expect(validatePassword("short")).not.toBeNull();
  });
});
