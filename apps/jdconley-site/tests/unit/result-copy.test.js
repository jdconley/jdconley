import { describe, expect, it } from "vitest";
import { resultCopy } from "../../js/a-better-time/result-copy.js";

describe("resultCopy", () => {
  it("describes positive, neutral, and negative comparisons honestly", () => {
    expect(resultCopy(12)).toEqual({
      heading: "More useful light with these settings",
      metric: "+12 hours",
      detail: "more useful daylight than current clock policy across your waking hours this year"
    });
    expect(resultCopy(0)).toEqual({
      heading: "The same useful light with these settings",
      metric: "0 hours",
      detail: "difference from current clock policy across your waking hours this year"
    });
    expect(resultCopy(-117)).toEqual({
      heading: "Less useful light with these settings",
      metric: "−117 hours",
      detail: "less useful daylight than current clock policy across your waking hours this year"
    });
  });
});
