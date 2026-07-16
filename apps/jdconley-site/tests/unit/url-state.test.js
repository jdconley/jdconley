import { describe, expect, it } from "vitest";

import {
  DEFAULT_STATE,
  parseState,
  serializeState
} from "../../js/a-better-time/core/url-state.js";

const CANONICAL_QUERY =
  "lat=38.940&lon=-119.977&place=South+Lake+Tahoe%2C+CA&tz=America%2FLos_Angeles&wake=420&sleep=1320&bias=25&year=2026";

describe("DEFAULT_STATE", () => {
  it("uses normalized South Lake Tahoe defaults and the current year", () => {
    expect(DEFAULT_STATE).toEqual({
      lat: 38.94,
      lon: -119.977,
      place: "South Lake Tahoe, CA",
      tz: "America/Los_Angeles",
      wake: 420,
      sleep: 1320,
      bias: 0,
      year: new Date().getFullYear()
    });
  });
});

describe("serializeState", () => {
  it("serializes a complete state in stable canonical order", () => {
    const input = {
      lat: 38.939926,
      lon: -119.977187,
      place: "South Lake Tahoe, CA",
      tz: "America/Los_Angeles",
      wake: 420,
      sleep: 1320,
      bias: 25,
      year: 2026
    };

    expect(serializeState(input)).toBe(CANONICAL_QUERY);
  });

  it("rounds coordinates to three decimals without negative zero", () => {
    expect(
      serializeState({ ...DEFAULT_STATE, lat: -0.0001, lon: -0 })
    ).toMatch(/^lat=0\.000&lon=0\.000&/);
  });

  it("normalizes Unicode and whitespace and limits place to 60 code points", () => {
    const place = `  Cafe\u0301\n\t${"😀".repeat(80)}  `;
    const query = serializeState({ ...DEFAULT_STATE, place });
    const serializedPlace = new URLSearchParams(query).get("place");

    expect(serializedPlace).toBe(`Café ${"😀".repeat(55)}`);
    expect(Array.from(serializedPlace)).toHaveLength(60);
    expect(serializedPlace.endsWith("\ud83d")).toBe(false);
  });

  it("normalizes malformed fields independently to defaults", () => {
    const query = serializeState({
      ...DEFAULT_STATE,
      lat: 91,
      tz: "Not/A_Zone",
      bias: 1.5,
      year: 99
    });
    const params = new URLSearchParams(query);

    expect(params.get("lat")).toBe(DEFAULT_STATE.lat.toFixed(3));
    expect(params.get("tz")).toBe(DEFAULT_STATE.tz);
    expect(params.get("bias")).toBe(String(DEFAULT_STATE.bias));
    expect(params.get("year")).toBe(String(DEFAULT_STATE.year));
  });

  it("normalizes both ends of an invalid waking window to defaults", () => {
    const params = new URLSearchParams(
      serializeState({ ...DEFAULT_STATE, wake: 600, sleep: 660 })
    );

    expect(params.get("wake")).toBe(String(DEFAULT_STATE.wake));
    expect(params.get("sleep")).toBe(String(DEFAULT_STATE.sleep));
  });
});

describe("parseState", () => {
  it("parses the canonical fixture and rounds coordinates", () => {
    const input = {
      lat: 38.939926,
      lon: -119.977187,
      place: "South Lake Tahoe, CA",
      tz: "America/Los_Angeles",
      wake: 420,
      sleep: 1320,
      bias: 25,
      year: 2026
    };
    const query = new URLSearchParams({
      ...input,
      lat: String(input.lat),
      lon: String(input.lon)
    });

    expect(parseState(query).state).toEqual({
      ...input,
      lat: 38.94,
      lon: -119.977
    });
    expect(parseState(query).resetFields).toEqual([]);
  });

  it("uses defaults for missing fields without reporting reset errors", () => {
    expect(parseState("")).toEqual({ state: DEFAULT_STATE, resetFields: [] });
    expect(parseState("?")).toEqual({ state: DEFAULT_STATE, resetFields: [] });
  });

  it("falls back independently and reports malformed present fields in canonical order", () => {
    const result = parseState(
      "lat=nope&lon=-112.074&place=Phoenix%2C+AZ&tz=America%2FPhoenix&bias=900"
    );

    expect(result.state.lon).toBe(-112.074);
    expect(result.state.place).toBe("Phoenix, AZ");
    expect(result.state.tz).toBe("America/Phoenix");
    expect(result.state.lat).toBe(DEFAULT_STATE.lat);
    expect(result.state.bias).toBe(DEFAULT_STATE.bias);
    expect(result.resetFields).toEqual(["lat", "bias"]);
  });

  it("rejects out-of-bounds coordinates and rounds valid coordinates", () => {
    const result = parseState("?lat=90.001&lon=-0.0001");

    expect(result.state.lat).toBe(DEFAULT_STATE.lat);
    expect(Object.is(result.state.lon, -0)).toBe(false);
    expect(result.state.lon).toBe(0);
    expect(result.resetFields).toEqual(["lat"]);
  });

  it("falls back only an invalid IANA time zone", () => {
    const result = parseState("lat=40&tz=Definitely%2FInvalid&bias=20");

    expect(result.state.lat).toBe(40);
    expect(result.state.tz).toBe(DEFAULT_STATE.tz);
    expect(result.state.bias).toBe(20);
    expect(result.resetFields).toEqual(["tz"]);
  });

  it("uses the last duplicate value and ignores unknown keys", () => {
    const result = parseState("lat=nope&lat=40&unknown=bad&bias=10&bias=20");

    expect(result.state.lat).toBe(40);
    expect(result.state.bias).toBe(20);
    expect(result.resetFields).toEqual([]);
  });

  it("accepts valid cross-midnight waking windows", () => {
    const result = parseState("wake=1200&sleep=480");

    expect(result.state.wake).toBe(1200);
    expect(result.state.sleep).toBe(480);
    expect(result.resetFields).toEqual([]);
  });

  it("resets both individually valid times when duration is outside 8 to 20 hours", () => {
    const tooShort = parseState("wake=420&sleep=899");
    const tooLong = parseState("wake=420&sleep=181");

    expect(tooShort.state.wake).toBe(DEFAULT_STATE.wake);
    expect(tooShort.state.sleep).toBe(DEFAULT_STATE.sleep);
    expect(tooShort.resetFields).toEqual(["wake", "sleep"]);
    expect(tooLong.resetFields).toEqual(["wake", "sleep"]);
  });

  it("resets and reports a one-sided time that makes the default pair invalid", () => {
    const wakeOnly = parseState("wake=1000");
    const sleepOnly = parseState("sleep=400");

    expect(wakeOnly.state.wake).toBe(DEFAULT_STATE.wake);
    expect(wakeOnly.state.sleep).toBe(DEFAULT_STATE.sleep);
    expect(wakeOnly.resetFields).toEqual(["wake"]);
    expect(sleepOnly.state.wake).toBe(DEFAULT_STATE.wake);
    expect(sleepOnly.state.sleep).toBe(DEFAULT_STATE.sleep);
    expect(sleepOnly.resetFields).toEqual(["sleep"]);
  });

  it("resets and reports both supplied times when malformed fallback makes the pair invalid", () => {
    const malformedWake = parseState("wake=nope&sleep=400");
    const malformedSleep = parseState("wake=1000&sleep=nope");

    expect(malformedWake.state.wake).toBe(DEFAULT_STATE.wake);
    expect(malformedWake.state.sleep).toBe(DEFAULT_STATE.sleep);
    expect(malformedWake.resetFields).toEqual(["wake", "sleep"]);
    expect(malformedSleep.state.wake).toBe(DEFAULT_STATE.wake);
    expect(malformedSleep.state.sleep).toBe(DEFAULT_STATE.sleep);
    expect(malformedSleep.resetFields).toEqual(["wake", "sleep"]);
  });

  it("accepts inclusive 8-hour and 20-hour duration boundaries", () => {
    expect(parseState("wake=420&sleep=900").resetFields).toEqual([]);
    expect(parseState("wake=420&sleep=180").resetFields).toEqual([]);
  });

  it("strictly requires integer minute, bias, and four-digit year values", () => {
    const result = parseState(
      "wake=420.0&sleep=1320&bias=2.5&year=2026.0"
    );

    expect(result.resetFields).toEqual(["wake", "bias", "year"]);
    expect(result.state.wake).toBe(DEFAULT_STATE.wake);
    expect(result.state.sleep).toBe(1320);
    expect(result.state.bias).toBe(DEFAULT_STATE.bias);
    expect(result.state.year).toBe(DEFAULT_STATE.year);
  });

  it("normalizes a parsed place label with the same Unicode-safe limit", () => {
    const place = `  Cafe\u0301   ${"😀".repeat(80)}  `;
    const result = parseState(`place=${encodeURIComponent(place)}`);

    expect(result.state.place).toBe(`Café ${"😀".repeat(55)}`);
    expect(Array.from(result.state.place)).toHaveLength(60);
    expect(result.resetFields).toEqual([]);
  });
});
