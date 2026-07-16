import { describe, expect, it } from "vitest";

import {
  getOffsetMinutes,
  getStandardOffsetMinutes
} from "../../js/a-better-time/core/civil-time.js";

describe("getOffsetMinutes", () => {
  it("returns Los Angeles winter standard time", () => {
    expect(
      getOffsetMinutes(Date.UTC(2026, 0, 15, 12), "America/Los_Angeles")
    ).toBe(-480);
  });

  it("returns Los Angeles summer daylight time", () => {
    expect(
      getOffsetMinutes(Date.UTC(2026, 6, 15, 12), "America/Los_Angeles")
    ).toBe(-420);
  });

  it("returns Phoenix time without a daylight-saving shift", () => {
    expect(
      getOffsetMinutes(Date.UTC(2026, 0, 15, 12), "America/Phoenix")
    ).toBe(-420);
    expect(
      getOffsetMinutes(Date.UTC(2026, 6, 15, 12), "America/Phoenix")
    ).toBe(-420);
  });

  it("returns Honolulu summer time without a daylight-saving shift", () => {
    expect(
      getOffsetMinutes(Date.UTC(2026, 6, 15, 12), "Pacific/Honolulu")
    ).toBe(-600);
  });
});

describe("getStandardOffsetMinutes", () => {
  it("chooses the Los Angeles standard offset", () => {
    expect(getStandardOffsetMinutes(2026, "America/Los_Angeles")).toBe(-480);
  });

  it("keeps the year-round Phoenix offset", () => {
    expect(getStandardOffsetMinutes(2026, "America/Phoenix")).toBe(-420);
  });
});
