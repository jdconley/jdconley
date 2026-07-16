import { describe, expect, it } from "vitest";
import {
  buildLinePath,
  buildReadout,
  formatClockMinute,
  getDstTransitionIndices,
  getNearestDay,
  getTickIndices
} from "../../js/a-better-time/chart.js";

describe("buildLinePath", () => {
  const scales = { x: (index) => index * 10, y: (value) => 100 - value };

  it("creates a stable SVG path and splits around missing solar events", () => {
    const days = [{ value: 10 }, { value: 20 }, { value: null }, { value: 30 }, { value: Infinity }, { value: 40 }];
    expect(buildLinePath(days, (day) => day.value, scales)).toBe("M0 90L10 80M30 70M50 60");
  });
});

describe("getNearestDay", () => {
  it("rounds deterministically and clamps to the year", () => {
    const bounds = { left: 100, width: 200 };
    expect(getNearestDay(100, bounds, 365)).toBe(0);
    expect(getNearestDay(200, bounds, 365)).toBe(182);
    expect(getNearestDay(400, bounds, 365)).toBe(364);
  });
});

describe("formatClockMinute", () => {
  it("formats civil times while retaining adjacent-day identity", () => {
    expect(formatClockMinute(0)).toBe("12:00 AM");
    expect(formatClockMinute(780)).toBe("1:00 PM");
    expect(formatClockMinute(-30)).toBe("11:30 PM, previous day");
    expect(formatClockMinute(1470)).toBe("12:30 AM, next day");
  });
});

describe("chart metadata", () => {
  it("reduces month ticks on compact screens", () => {
    expect(getTickIndices(365, false)).toHaveLength(12);
    expect(getTickIndices(365, true)).toHaveLength(4);
  });

  it("finds only actual current-policy offset changes", () => {
    const days = [
      { currentUtcOffsetMinutes: -480 },
      { currentUtcOffsetMinutes: -420 },
      { currentUtcOffsetMinutes: -420 },
      { currentUtcOffsetMinutes: -480 }
    ];
    expect(getDstTransitionIndices(days)).toEqual([1, 3]);
    expect(getDstTransitionIndices(days.map(() => ({ currentUtcOffsetMinutes: -420 })))).toEqual([]);
  });

  it("builds an accessible active-date readout for normal and polar days", () => {
    expect(buildReadout({
      date: "2026-07-15",
      solarState: "normal",
      proposedSunriseMinute: 343,
      proposedSunsetMinute: 1231,
      proposedOffsetSeconds: 1380,
      dailyAdjustmentSeconds: -20
    })).toMatchObject({
      dateLabel: "July 15",
      daylight: "Sunrise 5:43 AM · Sunset 8:31 PM",
      clock: "Clock offset +23 min · Today’s change −20 sec"
    });
    expect(buildReadout({ date: "2026-12-15", solarState: "polar-night", proposedOffsetSeconds: 0, dailyAdjustmentSeconds: 0 }).daylight).toBe("Polar night · No sunrise or sunset");
  });
});
