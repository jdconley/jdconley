import { describe, expect, it } from "vitest";

import {
  chooseIdealSunrise,
  constrainCircularOffsets,
  optimizeYear
} from "../../js/a-better-time/core/optimizer.js";
import { buildSolarYear } from "../../js/a-better-time/core/solar.js";

function compareIntegerSchedules(a, b, ideals) {
  const objective = (values) =>
    values.reduce((sum, value, index) => sum + (value - ideals[index]) ** 2, 0);
  const objectiveDifference = objective(a) - objective(b);
  if (Math.abs(objectiveDifference) > 1e-9) return objectiveDifference;
  const absoluteDifference =
    a.reduce((sum, value) => sum + Math.abs(value), 0) -
    b.reduce((sum, value) => sum + Math.abs(value), 0);
  if (absoluteDifference !== 0) return absoluteDifference;
  for (let index = 0; index < a.length; index += 1) {
    if (a[index] !== b[index]) return a[index] - b[index];
  }
  return 0;
}

function bruteForceCircularOffsets(ideals, cap) {
  const lower = Math.floor(Math.min(...ideals)) - cap * ideals.length - 1;
  const upper = Math.ceil(Math.max(...ideals)) + cap * ideals.length + 1;
  let best = null;
  const candidate = [];

  function visit(index) {
    if (index === ideals.length) {
      if (Math.abs(candidate.at(-1) - candidate[0]) > cap) return;
      if (!best || compareIntegerSchedules(candidate, best, ideals) < 0) {
        best = candidate.slice();
      }
      return;
    }
    const start = index === 0 ? lower : Math.max(lower, candidate[index - 1] - cap);
    const end = index === 0 ? upper : Math.min(upper, candidate[index - 1] + cap);
    for (let value = start; value <= end; value += 1) {
      candidate[index] = value;
      visit(index + 1);
    }
  }
  visit(0);
  return best;
}

describe("chooseIdealSunrise", () => {
  it("places a neutral bias halfway through the feasible sunrise interval", () => {
    expect(
      chooseIdealSunrise({
        wake: 420,
        sleep: 1320,
        daylightMinutes: 600,
        bias: 0
      })
    ).toBe(570);
  });

  it("places the extreme biases at the feasible interval endpoints", () => {
    const inputs = { wake: 420, sleep: 1320, daylightMinutes: 600 };

    expect(chooseIdealSunrise({ ...inputs, bias: -100 })).toBe(420);
    expect(chooseIdealSunrise({ ...inputs, bias: 100 })).toBe(720);
  });

  it("supports waking windows that cross midnight", () => {
    expect(
      chooseIdealSunrise({
        wake: 1320,
        sleep: 420,
        daylightMinutes: 600,
        bias: 0
      })
    ).toBe(1290);
  });

  it("rejects non-finite clock inputs", () => {
    expect(() =>
      chooseIdealSunrise({
        wake: Number.NaN,
        sleep: 1320,
        daylightMinutes: 600,
        bias: 0
      })
    ).toThrow(/wake.*finite/i);
  });

  it("rejects clock minutes outside a civil day", () => {
    expect(() =>
      chooseIdealSunrise({
        wake: -1,
        sleep: 1320,
        daylightMinutes: 600,
        bias: 0
      })
    ).toThrow(/wake.*0.*1439/i);
  });
});

describe("constrainCircularOffsets", () => {
  it("projects a circular sequence to the daily adjustment cap", () => {
    const projected = constrainCircularOffsets([0, 240, 240, 0], 60);

    expect(projected).toHaveLength(4);
    expect(projected.every(Number.isInteger)).toBe(true);
    for (let day = 0; day < projected.length; day += 1) {
      const previous = projected[(day - 1 + projected.length) % projected.length];
      expect(Math.abs(projected[day] - previous)).toBeLessThanOrEqual(60);
    }
  });

  it("is deterministic for a smooth annual ideal schedule", () => {
    const ideals = Array.from({ length: 365 }, (_, day) =>
      Math.sin(day / 58) * 5400
    );

    const first = constrainCircularOffsets(ideals, 60);
    const second = constrainCircularOffsets(ideals, 60);

    expect(second).toEqual(first);
    expect(first.every(Number.isInteger)).toBe(true);
    for (let day = 0; day < first.length; day += 1) {
      const previous = first[(day - 1 + first.length) % first.length];
      expect(Math.abs(first[day] - previous)).toBeLessThanOrEqual(60);
    }
  });

  it("validates ideals and the positive adjustment cap", () => {
    expect(() => constrainCircularOffsets([], 60)).toThrow(/non-empty/i);
    expect(() => constrainCircularOffsets([0, Number.NaN], 60)).toThrow(
      /finite/i
    );
    expect(() => constrainCircularOffsets([0, 1], 0)).toThrow(/positive/i);
    expect(() => constrainCircularOffsets([0, 1], 1.5)).toThrow(/integer/i);
  });

  it("returns the integer least-squares optimum for rounding counterexamples", () => {
    expect(constrainCircularOffsets([-193.2, 154.7, 157], 60)).toEqual([
      -1, 59, 59
    ]);
    expect(constrainCircularOffsets([-100, 1], 60)).toEqual([-79, -19]);
  });

  it("matches a brute-force integer oracle including deterministic tie-breaks", () => {
    let seed = 0x5eed1234;
    const random = () => {
      seed = (1664525 * seed + 1013904223) >>> 0;
      return seed / 2 ** 32;
    };

    for (let sample = 0; sample < 96; sample += 1) {
      const length = 2 + (sample % 3);
      const cap = 1 + (sample % 3);
      const ideals = Array.from(
        { length },
        () => Math.round((random() * 12 - 6) * 10) / 10
      );
      expect(constrainCircularOffsets(ideals, cap)).toEqual(
        bruteForceCircularOffsets(ideals, cap)
      );
    }
  });
});

describe("optimizeYear", () => {
  const tahoe = buildSolarYear({
    year: 2026,
    lat: 38.9399,
    lon: -119.9772
  });

  it("returns a complete, finite Tahoe schedule that never adjusts over a minute", () => {
    const result = optimizeYear({
      solarYear: tahoe,
      timeZone: "America/Los_Angeles",
      wake: 420,
      sleep: 1320,
      bias: 0
    });

    expect(Object.keys(result)).toEqual([
      "days",
      "gainedSeconds",
      "gainedHoursRounded",
      "standardUtcOffsetMinutes"
    ]);
    expect(result.days).toHaveLength(365);
    expect(result.days.map(({ date }) => date)).toEqual(
      tahoe.map(({ date }) => date)
    );
    expect(result.standardUtcOffsetMinutes).toBe(-480);
    expect(result.gainedHoursRounded).toBe(
      Math.round(result.gainedSeconds / 3600)
    );

    let summedGain = 0;
    for (const day of result.days) {
      expect(Object.keys(day)).toEqual([
        "date",
        "solarState",
        "proposedSunriseMinute",
        "proposedSunsetMinute",
        "currentSunriseMinute",
        "currentSunsetMinute",
        "proposedOffsetSeconds",
        "dailyAdjustmentSeconds",
        "currentUtcOffsetMinutes",
        "proposedOverlapSeconds",
        "currentOverlapSeconds"
      ]);
      expect(day.solarState).toBe("normal");
      for (const key of [
        "proposedSunriseMinute",
        "proposedSunsetMinute",
        "currentSunriseMinute",
        "currentSunsetMinute",
        "proposedOffsetSeconds",
        "dailyAdjustmentSeconds",
        "currentUtcOffsetMinutes",
        "proposedOverlapSeconds",
        "currentOverlapSeconds"
      ]) {
        expect(Number.isFinite(day[key])).toBe(true);
      }
      expect(Number.isInteger(day.proposedOffsetSeconds)).toBe(true);
      expect(Number.isInteger(day.dailyAdjustmentSeconds)).toBe(true);
      expect(Math.abs(day.dailyAdjustmentSeconds)).toBeLessThanOrEqual(60);
      summedGain += day.proposedOverlapSeconds - day.currentOverlapSeconds;
    }
    expect(result.gainedSeconds).toBeCloseTo(summedGain, 7);
  });

  it("does not reduce total waking-hours daylight in the default Tahoe fixture", () => {
    const result = optimizeYear({
      solarYear: tahoe,
      timeZone: "America/Los_Angeles",
      wake: 420,
      sleep: 1320,
      bias: 0
    });
    const proposed = result.days.reduce(
      (sum, day) => sum + day.proposedOverlapSeconds,
      0
    );
    const current = result.days.reduce(
      (sum, day) => sum + day.currentOverlapSeconds,
      0
    );

    expect(proposed).toBeGreaterThanOrEqual(current);
  });

  it("handles polar states with exact waking-window overlap and null clock events", () => {
    const result = optimizeYear({
      solarYear: buildSolarYear({
        year: 2026,
        lat: 71.2906,
        lon: -156.7886
      }),
      timeZone: "America/Anchorage",
      wake: 420,
      sleep: 1320,
      bias: 0
    });
    const polarDay = result.days.find(
      ({ solarState }) => solarState === "polar-day"
    );
    const polarNight = result.days.find(
      ({ solarState }) => solarState === "polar-night"
    );

    expect(polarDay).toMatchObject({
      proposedSunriseMinute: null,
      proposedSunsetMinute: null,
      currentSunriseMinute: null,
      currentSunsetMinute: null,
      proposedOverlapSeconds: 54_000,
      currentOverlapSeconds: 54_000
    });
    expect(polarNight).toMatchObject({
      proposedSunriseMinute: null,
      proposedSunsetMinute: null,
      currentSunriseMinute: null,
      currentSunsetMinute: null,
      proposedOverlapSeconds: 0,
      currentOverlapSeconds: 0
    });
  });

  it("keeps cross-midnight events attached to their source date", () => {
    const result = optimizeYear({
      solarYear: buildSolarYear({
        year: 2026,
        lat: 61.2181,
        lon: -149.9003
      }),
      timeZone: "America/Anchorage",
      wake: 1320,
      sleep: 420,
      bias: 0
    });

    const januaryFirst = result.days[0];
    expect(januaryFirst.date).toBe("2026-01-01");
    expect(januaryFirst.proposedSunsetMinute).toBeGreaterThan(1440);
  });

  it("keeps Arizona's current-policy UTC offset free of seasonal jumps", () => {
    const result = optimizeYear({
      solarYear: buildSolarYear({ year: 2026, lat: 33.4484, lon: -112.074 }),
      timeZone: "America/Phoenix",
      wake: 420,
      sleep: 1320,
      bias: 0
    });

    expect(new Set(result.days.map((day) => day.currentUtcOffsetMinutes))).toEqual(
      new Set([-420])
    );
  });

  it("is deterministic and circularly valid across leap day", () => {
    const inputs = {
      solarYear: buildSolarYear({
        year: 2028,
        lat: 38.9399,
        lon: -119.9772
      }),
      timeZone: "America/Los_Angeles",
      wake: 420,
      sleep: 1320,
      bias: 0
    };
    const first = optimizeYear(inputs);
    const second = optimizeYear(inputs);

    expect(first).toEqual(second);
    expect(first.days).toHaveLength(366);
    expect(first.days[59].date).toBe("2028-02-29");
    for (let day = 0; day < first.days.length; day += 1) {
      const previous = first.days[(day - 1 + first.days.length) % first.days.length];
      expect(
        Math.abs(
          first.days[day].proposedOffsetSeconds -
            previous.proposedOffsetSeconds
        )
      ).toBeLessThanOrEqual(60);
    }
  });

  it("rejects unknown solar states", () => {
    expect(() =>
      optimizeYear({
        solarYear: [
          {
            date: "2026-01-01",
            state: "cloudy",
            sunriseUtcMs: null,
            sunsetUtcMs: null,
            daylightSeconds: 0
          }
        ],
        timeZone: "UTC",
        wake: 420,
        sleep: 1320,
        bias: 0
      })
    ).toThrow(/solar state/i);
  });

  it("rejects inconsistent normal solar event ordering", () => {
    expect(() =>
      optimizeYear({
        solarYear: [
          {
            date: "2026-01-01",
            state: "normal",
            sunriseUtcMs: Date.UTC(2026, 0, 1, 18),
            sunsetUtcMs: Date.UTC(2026, 0, 1, 8),
            daylightSeconds: 36_000
          }
        ],
        timeZone: "UTC",
        wake: 420,
        sleep: 1320,
        bias: 0
      })
    ).toThrow(/ordered.*daylight/i);
  });
});
