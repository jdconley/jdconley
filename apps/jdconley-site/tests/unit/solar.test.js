import { describe, expect, it } from "vitest";

import { buildSolarYear } from "../../js/a-better-time/core/solar.js";

describe("buildSolarYear", () => {
  it("returns one entry for every day in a leap year", () => {
    const year = buildSolarYear({
      year: 2028,
      lat: 38.9399,
      lon: -119.9772
    });

    expect(year).toHaveLength(366);
    expect(year[0].date).toBe("2028-01-01");
    expect(year.at(-1).date).toBe("2028-12-31");
    expect(year[0]).toEqual({
      date: "2028-01-01",
      state: "normal",
      sunriseUtcMs: expect.any(Number),
      sunsetUtcMs: expect.any(Number),
      daylightSeconds: expect.any(Number)
    });
  });

  it("shows substantially more summer daylight than winter daylight in Tahoe", () => {
    const year = buildSolarYear({
      year: 2026,
      lat: 38.9399,
      lon: -119.9772
    });

    expect(year[171].state).toBe("normal");
    expect(year[354].state).toBe("normal");
    expect(year[171].daylightSeconds).toBeGreaterThan(
      year[354].daylightSeconds + 18_000
    );
  });

  it("identifies polar day and polar night in Utqiagvik", () => {
    const year = buildSolarYear({
      year: 2026,
      lat: 71.2906,
      lon: -156.7886
    });

    expect(year[171]).toEqual({
      date: "2026-06-21",
      state: "polar-day",
      sunriseUtcMs: null,
      sunsetUtcMs: null,
      daylightSeconds: 86_400
    });
    expect(year[354]).toEqual({
      date: "2026-12-21",
      state: "polar-night",
      sunriseUtcMs: null,
      sunsetUtcMs: null,
      daylightSeconds: 0
    });
  });
});
