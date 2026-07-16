import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";

import {
  buildLocationRecords,
  parseDelimited,
  serializeLocationIndex,
  verifyChecksum
} from "../../scripts/build-location-index.mjs";
import { buildImportSql, parseImportArguments } from "../../scripts/import-location-index.mjs";

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
    expect(() => parseImportArguments([])).toThrow(/usage/i);
    expect(() => parseImportArguments(["--local", "--remote"])).toThrow(/usage/i);
    expect(() => parseImportArguments(["--remote", "--surprise"])).toThrow(/usage/i);
  });

  it("validates and safely quotes batched record values", () => {
    const sql = buildImportSql([{
      kind: "place", search_name: "o'fallon", display_name: "O'Fallon, MO", state_code: "MO", zip: null,
      latitude: 38.8106, longitude: -90.6998, time_zone: "America/Chicago"
    }]);
    expect(sql).toContain("'o''fallon'");
    expect(sql).toContain("INSERT INTO locations_fts(locations_fts) VALUES('rebuild')");
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
    const options = { generatedAt: "2025-09-08T00:00:00.000Z", sourceRows: { places: 0, zctas: 1, zctaCountyRelationships: 1 } };
    expect(serializeLocationIndex(records, options)).toEqual(serializeLocationIndex(records, options));
  });
});
