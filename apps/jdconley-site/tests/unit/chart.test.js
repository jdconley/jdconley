import { describe, expect, it } from "vitest";
import {
  buildLinePath,
  buildLinkedActiveState,
  buildReadout,
  formatClockMinute,
  getDstTransitionIndices,
  getNearestDay,
  getTickIndices,
  getChartSeries
} from "../../js/a-better-time/chart.js";
import { getInitialDayIndex } from "../../js/a-better-time/chart.js";

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
  it("describes current-policy series as dashed reference lines", () => {
    const series = getChartSeries("daylight");
    expect(series.filter(({ name }) => name.startsWith("current-"))).toEqual([
      expect.objectContaining({ name: "current-sunrise", className: "reference-line", strokeDasharray: "5 5" }),
      expect.objectContaining({ name: "current-sunset", className: "reference-line", strokeDasharray: "5 5" })
    ]);
  });

  it("shares one active index, cursor position, and aria date across chart instances", () => {
    expect(buildLinkedActiveState(182, 365, "July 2", ["daylight", "clock"])).toEqual({
      daylight: { activeIndex: 182, cursorX: 397, ariaValueNow: "182", ariaValueText: "July 2" },
      clock: { activeIndex: 182, cursorX: 397, ariaValueNow: "182", ariaValueText: "July 2" }
    });
  });

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

  it("describes civil-time transition direction", async () => {
    const { getDstTransitions } = await import("../../js/a-better-time/chart.js");
    expect(getDstTransitions([
      { currentUtcOffsetMinutes: -480 },
      { currentUtcOffsetMinutes: -420 },
      { currentUtcOffsetMinutes: -480 }
    ])).toEqual([
      { index: 1, label: "DST starts" },
      { index: 2, label: "Standard time" }
    ]);
  });

  it("uses the selected timezone calendar date and actual leap-year length", () => {
    expect(getInitialDayIndex(2026, "America/Los_Angeles", new Date("2026-01-02T01:00:00Z"))).toBe(0);
    expect(getInitialDayIndex(2024, "America/Los_Angeles", new Date("2025-01-01T07:30:00Z"))).toBe(365);
    expect(getInitialDayIndex(2025, "America/Los_Angeles", new Date("2026-01-01T08:00:00Z"))).toBe(182);
  });

  it("maps vertical arrows to the same one-day slider steps", async () => {
    const { getKeyboardDayIndex } = await import("../../js/a-better-time/chart.js");
    expect(getKeyboardDayIndex("ArrowUp", 10, 365)).toBe(11);
    expect(getKeyboardDayIndex("ArrowDown", 10, 365)).toBe(9);
    expect(getKeyboardDayIndex("Home", 10, 365)).toBe(0);
    expect(getKeyboardDayIndex("End", 10, 365)).toBe(364);
  });

  it("gives daily adjustments a distinct, meaningful seconds band", async () => {
    const { getClockBandLayout } = await import("../../js/a-better-time/chart.js");
    expect(getClockBandLayout(310)).toEqual(expect.objectContaining({
      adjustmentDomain: [-60, 60],
      adjustmentTop: expect.any(Number),
      adjustmentBottom: expect.any(Number)
    }));
    const layout = getClockBandLayout(310);
    expect(layout.adjustmentBottom - layout.adjustmentTop).toBeGreaterThan(50);
    expect(layout.offsetBottom).toBeLessThan(layout.adjustmentTop);
  });

  it("maps clock offset ticks and paths through the same upper-band scale", async () => {
    const { getClockScales } = await import("../../js/a-better-time/chart.js");
    const scales = getClockScales(310, [-180, 180]);
    expect([-180, 0, 180].map(scales.offsetY)).toEqual([
      scales.layout.offsetBottom,
      (scales.layout.offsetTop + scales.layout.offsetBottom) / 2,
      scales.layout.offsetTop
    ]);
    expect([-60, 0, 60].map(scales.adjustmentY)).toEqual([
      scales.layout.adjustmentBottom,
      (scales.layout.adjustmentTop + scales.layout.adjustmentBottom) / 2,
      scales.layout.adjustmentTop
    ]);
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
