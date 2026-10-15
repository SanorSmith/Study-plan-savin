import { describe, expect, it } from "vitest";
import { ageBand } from "./age-band";

describe("ageBand", () => {
  it("follows the grade when the style is automatic", () => {
    expect(ageBand(1)).toBe("little");
    expect(ageBand(3)).toBe("little");
    expect(ageBand(4)).toBe("middle");
    expect(ageBand(6)).toBe("middle");
    expect(ageBand(7)).toBe("teen");
    expect(ageBand(12)).toBe("teen");
  });

  it("lets a parent force a style whatever the grade", () => {
    expect(ageBand(9, "little")).toBe("little");
    expect(ageBand(1, "teen")).toBe("teen");
    expect(ageBand(5, "middle")).toBe("middle");
  });

  it("ignores an unknown style", () => {
    expect(ageBand(2, "robot")).toBe("little");
    expect(ageBand(8, "")).toBe("teen");
  });
});
