import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  buildLocationRecords,
  parsePopulationCsv,
  parseDelimited,
  resolveGenerationTime,
  serializeLocationIndex,
  verifyChecksum
} from "../../scripts/build-location-index.mjs";
import { buildImportSql, importLocations, loadGeneratedRecords, parseImportArguments } from "../../scripts/import-location-index.mjs";
import { resolveUsTimeZone, US_STATE_TIME_ZONES } from "../../worker/us-time-zones.js";

describe("location index source parsing", () => {
  it("parses BOM-prefixed Census pipe records by header", () => {
    const rows = parseDelimited("\uFEFFUSPS|NAME|INTPTLAT|INTPTLONG\nCA|South Lake Tahoe city|38.933|-119.984\n");
    expect(rows).toEqual([{ USPS: "CA", NAME: "South Lake Tahoe city", INTPTLAT: "38.933", INTPTLONG: "-119.984" }]);
  });

  it("fails closed when a source checksum does not match", () => {
    expect(() => verifyChecksum(new TextEncoder().encode("changed"), "0".repeat(64), "fixture"))
      .toThrow(/checksum mismatch.*fixture/i);
  });

  it("accepts a matching SHA-256 checksum", () => {
    const bytes = new TextEncoder().encode("fixture");
    const checksum = createHash("sha256").update(bytes).digest("hex");
    expect(verifyChecksum(bytes, checksum, "fixture")).toBe(checksum);
  });
});

describe("location import command", () => {
  it("requires exactly one explicit local or remote mode", () => {
    expect(parseImportArguments(["--local", "--fixtures"])).toEqual({ mode: "--local", fixtures: true });
    expect(parseImportArguments(["--local", "--", "--fixtures"])).toEqual({ mode: "--local", fixtures: true });
    expect(() => parseImportArguments([])).toThrow(/usage/i);
    expect(() => parseImportArguments(["--local", "--remote"])).toThrow(/usage/i);
    expect(() => parseImportArguments(["--local", "--local"])).toThrow(/usage/i);
    expect(() => parseImportArguments(["--local", "--", "--"])).toThrow(/usage/i);
    expect(() => parseImportArguments(["--local", "--fixtures", "--fixtures"])).toThrow(/usage/i);
    expect(() => parseImportArguments(["--remote", "--surprise"])).toThrow(/usage/i);
  });

  it("keeps local generated-data import as the package default and composes the fixture command conventionally", () => {
    const packageJson = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8"));
    expect(packageJson.scripts["locations:import:local"]).toBe("node ./scripts/import-location-index.mjs --local");
    const forwarded = packageJson.scripts["locations:import:local"].split(" ").slice(2).concat(["--", "--fixtures"]);
    expect(parseImportArguments(forwarded)).toEqual({ mode: "--local", fixtures: true });
  });

  it("validates and safely quotes batched record values", () => {
    const sql = buildImportSql([{
      kind: "place", search_name: "o'fallon", display_name: "O'Fallon, MO", state_code: "MO", zip: null,
      latitude: 38.8106, longitude: -90.6998, time_zone: "America/Chicago", population: 91000
    }]);
    expect(sql).toContain("'o''fallon'");
    expect(sql).not.toContain("BEGIN");
    expect(sql.indexOf("DELETE FROM locations;")).toBeLessThan(sql.indexOf("INSERT INTO locations("));
    expect(sql).toContain("INSERT INTO locations_fts(locations_fts) VALUES('rebuild')");
    expect(sql.indexOf("INSERT INTO locations(")).toBeLessThan(sql.indexOf("INSERT INTO locations_fts"));
  });

  it("rejects tampered or truncated generated data before import", async () => {
    const record = { kind: "place", search_name: "test", display_name: "Test, CA", state_code: "CA", zip: null, latitude: 38, longitude: -120, time_zone: "America/Los_Angeles", population: 1 };
    const ndjson = `${JSON.stringify(record)}\n`;
    const sha = createHash("sha256").update(ndjson).digest("hex");
    const files = new Map([
      ["locations.ndjson", ndjson],
      ["locations.manifest.json", JSON.stringify({ ndjsonSha256: sha, outputRows: { total: 2, places: 1, zips: 1 } })]
    ]);
    await expect(loadGeneratedRecords(async (name) => files.get(name))).rejects.toThrow(/row count/i);
    files.set("locations.manifest.json", JSON.stringify({ ndjsonSha256: "0".repeat(64), outputRows: { total: 1, places: 1, zips: 0 } }));
    await expect(loadGeneratedRecords(async (name) => files.get(name))).rejects.toThrow(/checksum/i);
    let wranglerCalled = false;
    await expect(importLocations(["--local"], {
      load: () => loadGeneratedRecords(async (name) => files.get(name)),
      run: async () => { wranglerCalled = true; }
    })).rejects.toThrow(/checksum/i);
    expect(wranglerCalled).toBe(false);
  });
});

describe("U.S. civil time zones", () => {
  it.each([
    ["ME", 45.188, -67.278, "America/Moncton", "America/New_York"],
    ["AK", 65.758, -168.953, "Asia/Anadyr", "America/Anchorage"],
    ["TX", 26.05, -97.6, "America/Matamoros", "America/Chicago"],
    ["TX", 31.75, -106.5, "America/Ojinaga", "America/Denver"]
  ])("corrects %s foreign lookup %s", (state, latitude, longitude, lookedUp, expected) => {
    expect(resolveUsTimeZone(state, latitude, longitude, () => lookedUp)).toBe(expected);
  });

  it.each([
    ["AZ", 36.99, -110.1, "America/Denver"],
    ["IN", 41.6, -87.3, "America/Indiana/Knox"],
    ["AK", 51.88, -176.65, "America/Adak"],
    ["AK", 55.13, -131.57, "America/Metlakatla"]
  ])("preserves valid special zone %s %s", (state, latitude, longitude, zone) => {
    expect(resolveUsTimeZone(state, latitude, longitude, () => zone)).toBe(zone);
  });
});

describe("location index normalization", () => {
  it("keeps only states and DC, assigns ZCTA state by largest land overlap, and sorts deterministically", () => {
    const places = [
      { USPS: "OR", NAME: "  Portland   city ", INTPTLAT: "45.520", INTPTLONG: "-122.675" },
      { USPS: "PR", NAME: "San Juan zona urbana", INTPTLAT: "18.4", INTPTLONG: "-66.1" }
    ];
    const zctas = [{ GEOID: "97205", INTPTLAT: "45.521", INTPTLONG: "-122.689" }];
    const relationships = [
      { GEOID_ZCTA5_20: "97205", GEOID_COUNTY_20: "41051", AREALAND_PART: "100", AREAWATER_PART: "0" },
      { GEOID_ZCTA5_20: "97205", GEOID_COUNTY_20: "53011", AREALAND_PART: "10", AREAWATER_PART: "0" }
    ];

    const records = buildLocationRecords({ places, zctas, relationships, timezoneFor: () => "America/Los_Angeles" });

    expect(records).toEqual([
      expect.objectContaining({ kind: "zip", search_name: "97205", display_name: "97205, OR", state_code: "OR", zip: "97205" }),
      expect.objectContaining({ kind: "place", search_name: "portland", display_name: "Portland, OR", state_code: "OR" })
    ]);
  });

  it("aggregates ZCTA overlap by state before selecting the largest state", () => {
    const records = buildLocationRecords({
      places: [],
      zctas: [{ GEOID: "87328", INTPTLAT: "35.2", INTPTLONG: "-109" }],
      relationships: [
        { GEOID_ZCTA5_20: "87328", GEOID_COUNTY_20: "04001", AREALAND_PART: "354471105", AREAWATER_PART: "0" },
        { GEOID_ZCTA5_20: "87328", GEOID_COUNTY_20: "35001", AREALAND_PART: "300000000", AREAWATER_PART: "0" },
        { GEOID_ZCTA5_20: "87328", GEOID_COUNTY_20: "35031", AREALAND_PART: "259211065", AREAWATER_PART: "0" }
      ],
      populations: [], timezoneFor: () => "America/Denver"
    });
    expect(records[0].state_code).toBe("NM");
  });

  it("joins official population by state and place GEOID", () => {
    const populations = parsePopulationCsv("SUMLEV,STATE,PLACE,NAME,POPESTIMATE042020\n162,06,66000,San Diego city,1422710\n");
    const records = buildLocationRecords({
      places: [{ USPS: "CA", GEOID: "0666000", NAME: "San Diego city", INTPTLAT: "32.7", INTPTLONG: "-117.1" }],
      zctas: [], relationships: [], populations, timezoneFor: () => "America/Los_Angeles"
    });
    expect(records[0].population).toBe(1422710);
  });

  it("produces only state-allowed time zones", () => {
    const records = buildLocationRecords({
      places: [{ USPS: "ME", GEOID: "0612345", NAME: "Calais city", INTPTLAT: "45.188", INTPTLONG: "-67.278" }],
      zctas: [], relationships: [], populations: [], timezoneFor: () => "America/Moncton"
    });
    expect(US_STATE_TIME_ZONES.ME).toContain(records[0].time_zone);
  });

  it("normalizes names to NFC and collapses whitespace", () => {
    const records = buildLocationRecords({
      places: [{ USPS: "CA", NAME: "  Cafe\u0301   city ", INTPTLAT: "38", INTPTLONG: "-120" }],
      zctas: [], relationships: [], timezoneFor: () => "America/Los_Angeles"
    });
    expect(records[0]).toMatchObject({ search_name: "café", display_name: "Café, CA" });
  });

  it("deduplicates same-name places in a state by the lowest Census GEOID", () => {
    const records = buildLocationRecords({
      places: [
        { USPS: "CA", GEOID: "0699999", NAME: "Franklin CDP", INTPTLAT: "39", INTPTLONG: "-121" },
        { USPS: "CA", GEOID: "0612345", NAME: "Franklin city", INTPTLAT: "38", INTPTLONG: "-120" }
      ],
      zctas: [], relationships: [], timezoneFor: () => "America/Los_Angeles"
    });
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({ display_name: "Franklin, CA", latitude: 38, longitude: -120 });
  });

  it("sorts by stable code points instead of host locale collation", () => {
    const records = buildLocationRecords({
      places: [
        { USPS: "CA", GEOID: "0600002", NAME: "Ångwin CDP", INTPTLAT: "39", INTPTLONG: "-121" },
        { USPS: "CA", GEOID: "0600001", NAME: "Zzyzx CDP", INTPTLAT: "38", INTPTLONG: "-120" }
      ],
      zctas: [], relationships: [], timezoneFor: () => "America/Los_Angeles"
    });
    expect(records.map(({ display_name }) => display_name)).toEqual(["Zzyzx, CA", "Ångwin, CA"]);
  });

  it("serializes byte-for-byte reproducibly with an explicit generation time", () => {
    const records = [{ kind: "zip", search_name: "97205", display_name: "97205, OR", state_code: "OR", zip: "97205", latitude: 45.52, longitude: -122.7, time_zone: "America/Los_Angeles" }];
    const options = { generatedAt: "2025-09-08T00:00:00.000Z", sourceRows: { places: 0, zctas: 1, zctaCountyRelationships: 1, populations: 0 } };
    expect(serializeLocationIndex(records, options)).toEqual(serializeLocationIndex(records, options));
  });

  it("uses the pinned source release time when no generation override is provided", () => {
    expect(resolveGenerationTime({ sourceDateEpoch: undefined })).toEqual({
      generatedAt: "2025-09-08T00:00:00.000Z",
      generationTime: "pinned-source-release"
    });
    expect(resolveGenerationTime({ sourceDateEpoch: "0" })).toEqual({
      generatedAt: "1970-01-01T00:00:00.000Z",
      generationTime: "SOURCE_DATE_EPOCH"
    });
  });
});
