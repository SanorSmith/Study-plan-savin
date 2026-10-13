import { describe, expect, it } from "vitest";
import { isEmailAllowed, parseAllowlist } from "./allowlist";

describe("parseAllowlist", () => {
  it("splits, trims and lowercases", () => {
    expect(parseAllowlist(" A@x.com, b@Y.com ,,")).toEqual(["a@x.com", "b@y.com"]);
  });

  it("is empty for undefined", () => {
    expect(parseAllowlist(undefined)).toEqual([]);
  });
});

describe("isEmailAllowed", () => {
  it("allows listed emails regardless of case", () => {
    expect(isEmailAllowed("Parent@Example.com", "parent@example.com", true)).toBe(true);
  });

  it("rejects unlisted emails", () => {
    expect(isEmailAllowed("stranger@example.com", "parent@example.com", true)).toBe(false);
  });

  it("rejects a missing email when a list is set", () => {
    expect(isEmailAllowed(undefined, "parent@example.com", true)).toBe(false);
  });

  it("fails closed in production when the list is empty", () => {
    expect(isEmailAllowed("parent@example.com", "", true)).toBe(false);
    expect(isEmailAllowed("parent@example.com", undefined, true)).toBe(false);
  });

  it("is open in development when the list is empty", () => {
    expect(isEmailAllowed("anyone@example.com", "", false)).toBe(true);
  });
});
