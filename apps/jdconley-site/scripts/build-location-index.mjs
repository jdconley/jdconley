import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

import { unzipSync } from "fflate";
import tzLookup from "tz-lookup";
import { createDotTimeZoneLookup, resolveUsTimeZone } from "../worker/us-time-zones.js";

export const SOURCES = Object.freeze({
  places: {
    url: "https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2025_Gazetteer/2025_Gaz_place_national.zip",
    sha256: "49644173a453469d9bd77fb7a493b027f87567e209edaf2078aac7543ac2ee29"
  },
  zctas: {
    url: "https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2025_Gazetteer/2025_Gaz_zcta_national.zip",
    sha256: "51516a4283bab5cd2376eec75609ddc4b363a18297e8adeeaac7b03cf7c84dbe"
  },
  zctaCounties: {
    // Gazetteer ZCTA rows have no state. This official relationship file lets
    // us choose the state containing the largest land-area share of each ZCTA.
    url: "https://www2.census.gov/geo/docs/maps-data/data/rel2020/zcta520/tab20_zcta520_county20_natl.txt",
    sha256: "3ed41278d637dc249e0323306f68be8a6c234e3090f4de88ef328dee71aeaaaf"
  },
  populations: {
    urlTemplate: "https://services.arcgis.com/P3ePLMYs2RVChkJx/arcgis/rest/services/USA_Census_Populated_Places/FeatureServer/0/query?where=1%3D1&outFields=PLACEFIPS%2CPOPULATION&returnGeometry=false&orderByFields=PLACEFIPS&resultOffset={offset}&resultRecordCount=2000&f=json",
    aggregateSha256: "9fb6fd922298fedf9ddf61cb5de0b3a311d2d211bc070a589bfbbddf499ff8f6",
    provenance: "Esri USA Census Populated Places; POPULATION is 2020 Census PL 94-171 total population; 31,615 incorporated places and CDPs.",
    terms: "https://www.esri.com/en-us/legal/terms/full-master-agreement"
  },
  timeZones: {
    url: "https://services.arcgis.com/xOi1kZaI0eWDREZv/arcgis/rest/services/NTAD_Time_Zones/FeatureServer/0/query?where=1%3D1&outFields=*&returnGeometry=true&outSR=4326&f=geojson",
    sha256: "23fd76af3f675ae4c30718ceee2fe4e24fdea8122b64b72210ac40bb2abbb2dd",
    provenance: "U.S. DOT/BTS NTAD verified representation of 49 CFR Part 71 time-zone boundaries."
  }
});

const STATE_FIPS = Object.freeze({
  "01": "AL", "02": "AK", "04": "AZ", "05": "AR", "06": "CA", "08": "CO", "09": "CT", "10": "DE", "11": "DC", "12": "FL",
  "13": "GA", "15": "HI", "16": "ID", "17": "IL", "18": "IN", "19": "IA", "20": "KS", "21": "KY", "22": "LA", "23": "ME", "24": "MD",
  "25": "MA", "26": "MI", "27": "MN", "28": "MS", "29": "MO", "30": "MT", "31": "NE", "32": "NV", "33": "NH", "34": "NJ", "35": "NM",
  "36": "NY", "37": "NC", "38": "ND", "39": "OH", "40": "OK", "41": "OR", "42": "PA", "44": "RI", "45": "SC", "46": "SD", "47": "TN",
  "48": "TX", "49": "UT", "50": "VT", "51": "VA", "53": "WA", "54": "WV", "55": "WI", "56": "WY"
});
const STATE_CODES = new Set(Object.values(STATE_FIPS));
const PLACE_SUFFIX = /\s+(?:city and borough|unified government|consolidated government|municipality|metropolitan government|urban county|city|town|village|borough|CDP)$/iu;
const PINNED_SOURCE_RELEASE = "2025-09-08T00:00:00.000Z";

export function normalizeWhitespace(value) {
  return String(value ?? "").normalize("NFC").replace(/\s+/gu, " ").trim();
}

export function normalizeSearchName(value) {
  return normalizeWhitespace(value).toLocaleLowerCase("en-US");
}

export function parseDelimited(text, delimiter = "|") {
  const lines = String(text).replace(/^\uFEFF/u, "").split(/\r?\n/u).filter((line) => line.length > 0);
  if (lines.length === 0) return [];
  const headers = lines[0].split(delimiter).map(normalizeWhitespace);
  return lines.slice(1).map((line) => Object.fromEntries(headers.map((header, index) => [header, line.split(delimiter)[index] ?? ""])));
}

function parseCsvRows(text) {
  const rows = [];
  let row = [], field = "", quoted = false;
  const input = String(text).replace(/^\uFEFF/u, "");
  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];
    if (quoted && character === '"' && input[index + 1] === '"') { field += '"'; index += 1; }
    else if (character === '"') quoted = !quoted;
    else if (!quoted && character === ",") { row.push(field); field = ""; }
    else if (!quoted && (character === "\n" || character === "\r")) {
      if (character === "\r" && input[index + 1] === "\n") index += 1;
      row.push(field); field = ""; if (row.some(Boolean)) rows.push(row); row = [];
    } else field += character;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows;
}

export function parsePopulationCsv(text) {
  const [headers, ...rows] = parseCsvRows(text);
  if (!headers) return [];
  return rows.map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""])))
    .filter((row) => row.SUMLEV === "162" && STATE_FIPS[row.STATE])
    .map((row) => ({ geoid: `${row.STATE}${row.PLACE}`, population: Math.max(0, Number.parseInt(row.POPESTIMATE042020, 10) || 0) }));
}

export function verifyChecksum(bytes, expected, label) {
  const actual = createHash("sha256").update(bytes).digest("hex");
  if (actual !== expected) throw new Error(`Checksum mismatch for ${label}: expected ${expected}, received ${actual}`);
  return actual;
}

function numeric(value, label) {
  const result = Number(value);
  if (!Number.isFinite(result)) throw new Error(`Invalid ${label}: ${value}`);
  return result;
}

function preferredZctaStates(relationships) {
  const totals = new Map();
  for (const row of relationships) {
    const zip = normalizeWhitespace(row.GEOID_ZCTA5_20);
    const state = STATE_FIPS[normalizeWhitespace(row.GEOID_COUNTY_20).slice(0, 2)];
    if (!/^\d{5}$/u.test(zip) || !state) continue;
    const land = Number(row.AREALAND_PART) || 0;
    const water = Number(row.AREAWATER_PART) || 0;
    const key = `${zip}\u0000${state}`;
    const total = totals.get(key) ?? { zip, state, land: 0, water: 0 };
    total.land += land;
    total.water += water;
    totals.set(key, total);
  }
  const preferred = new Map();
  for (const { zip, state, land, water } of totals.values()) {
    const score = [land, water, state];
    const current = preferred.get(zip);
    if (!current || score[0] > current.score[0] || (score[0] === current.score[0] && score[1] > current.score[1]) ||
      (score[0] === current.score[0] && score[1] === current.score[1] && state < current.state)) {
      preferred.set(zip, { state, score });
    }
  }
  return new Map([...preferred].map(([zip, value]) => [zip, value.state]));
}

function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

export function buildLocationRecords({ places, zctas, relationships, populations = [], timezoneFor = tzLookup, dotTimeZoneFor }) {
  const records = [];
  const uniquePlaces = new Map();
  const populationByGeoid = new Map(populations.map(({ geoid, population }) => [geoid, population]));
  for (const row of [...places].sort((a, b) => compareText(normalizeWhitespace(a.GEOID), normalizeWhitespace(b.GEOID)))) {
    const state = normalizeWhitespace(row.USPS);
    if (!STATE_CODES.has(state)) continue;
    const latitude = numeric(row.INTPTLAT, "place latitude");
    const longitude = numeric(row.INTPTLONG, "place longitude");
    const name = normalizeWhitespace(row.NAME).replace(PLACE_SUFFIX, "");
    const record = {
      kind: "place", search_name: normalizeSearchName(name), display_name: `${name}, ${state}`,
      state_code: state, zip: null, latitude, longitude,
      time_zone: resolveUsTimeZone(state, latitude, longitude, timezoneFor, dotTimeZoneFor),
      population: populationByGeoid.get(normalizeWhitespace(row.GEOID)) ?? 0
    };
    const key = `${record.search_name}\u0000${state}`;
    if (!uniquePlaces.has(key)) uniquePlaces.set(key, record);
  }
  records.push(...uniquePlaces.values());

  const statesByZip = preferredZctaStates(relationships);
  for (const row of zctas) {
    const zip = normalizeWhitespace(row.GEOID);
    const state = statesByZip.get(zip);
    if (!state) continue;
    const latitude = numeric(row.INTPTLAT, "ZCTA latitude");
    const longitude = numeric(row.INTPTLONG, "ZCTA longitude");
    records.push({
      kind: "zip", search_name: zip, display_name: `${zip}, ${state}`, state_code: state, zip,
      latitude, longitude, time_zone: resolveUsTimeZone(state, latitude, longitude, timezoneFor, dotTimeZoneFor), population: 0
    });
  }

  return records.sort((a, b) => compareText(a.state_code, b.state_code) ||
    compareText(a.search_name, b.search_name) || compareText(a.kind, b.kind) || compareText(a.zip ?? "", b.zip ?? ""));
}

function unzipText(bytes, label) {
  const files = Object.entries(unzipSync(bytes));
  if (files.length !== 1) throw new Error(`Expected one file in ${label}, received ${files.length}`);
  return new TextDecoder().decode(files[0][1]);
}

async function download(source, fetcher) {
  const response = await fetcher(source.url);
  if (!response.ok) throw new Error(`Download failed (${response.status}) for ${source.url}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  verifyChecksum(bytes, source.sha256, source.url);
  return bytes;
}

async function downloadPopulations(fetcher) {
  const rows = [];
  for (let offset = 0; offset < 40000; offset += 2000) {
    const url = SOURCES.populations.urlTemplate.replace("{offset}", String(offset));
    const response = await fetcher(url);
    if (!response.ok) throw new Error(`Download failed (${response.status}) for ${url}`);
    const payload = await response.json();
    if (payload.error) throw new Error(`Population service error: ${JSON.stringify(payload.error)}`);
    const page = payload.features.map(({ attributes }) => ({ geoid: attributes.PLACEFIPS, population: Math.max(0, attributes.POPULATION ?? 0) }));
    rows.push(...page);
    if (page.length < 2000) break;
  }
  rows.sort((a, b) => compareText(a.geoid, b.geoid));
  const normalized = `${rows.map(({ geoid, population }) => `${geoid},${population}`).join("\n")}\n`;
  verifyChecksum(new TextEncoder().encode(normalized), SOURCES.populations.aggregateSha256, "Census populated-place aggregate");
  if (rows.length < 31000 || !rows.some(({ geoid }) => geoid === "5103000") || !rows.some(({ geoid }) => geoid === "3254600")) throw new Error("Population coverage is incomplete for Arlington VA or Paradise NV");
  return rows;
}

export function serializeLocationIndex(records, { generatedAt, generationTime = "explicit", sourceRows }) {
  const ndjson = `${records.map((record) => JSON.stringify(record)).join("\n")}\n`;
  const manifest = {
    generatedAt,
    generationTime,
    sources: SOURCES,
    sourceRows,
    outputRows: { total: records.length, places: records.filter(({ kind }) => kind === "place").length, zips: records.filter(({ kind }) => kind === "zip").length },
    ndjsonSha256: createHash("sha256").update(ndjson).digest("hex")
  };
  return { ndjson, manifest };
}

export function resolveGenerationTime({ generatedAt, sourceDateEpoch = process.env.SOURCE_DATE_EPOCH } = {}) {
  if (generatedAt !== undefined) return { generatedAt: new Date(generatedAt).toISOString(), generationTime: "explicit" };
  if (sourceDateEpoch !== undefined) {
    const timestamp = Number(sourceDateEpoch);
    if (!Number.isFinite(timestamp)) throw new Error("SOURCE_DATE_EPOCH must be a finite Unix timestamp");
    return { generatedAt: new Date(timestamp * 1000).toISOString(), generationTime: "SOURCE_DATE_EPOCH" };
  }
  // The source archives are dated 2025-09-08. Using that release date makes
  // an ordinary build reproducible without requiring ambient environment state.
  return { generatedAt: PINNED_SOURCE_RELEASE, generationTime: "pinned-source-release" };
}

export async function generateLocationIndex({ fetcher = fetch, generatedAt, outputDirectory } = {}) {
  const [placeBytes, zctaBytes, relationshipBytes, populations, timeZoneBytes] = await Promise.all([
    download(SOURCES.places, fetcher), download(SOURCES.zctas, fetcher), download(SOURCES.zctaCounties, fetcher), downloadPopulations(fetcher), download(SOURCES.timeZones, fetcher)
  ]);
  const places = parseDelimited(unzipText(placeBytes, "places"));
  const zctas = parseDelimited(unzipText(zctaBytes, "ZCTAs"));
  const relationships = parseDelimited(new TextDecoder().decode(relationshipBytes));
  const dotTimeZoneFor = createDotTimeZoneLookup(JSON.parse(new TextDecoder().decode(timeZoneBytes)));
  const records = buildLocationRecords({ places, zctas, relationships, populations, dotTimeZoneFor });
  const generation = resolveGenerationTime({ generatedAt });
  const { ndjson, manifest } = serializeLocationIndex(records, {
    ...generation,
    sourceRows: { places: places.length, zctas: zctas.length, zctaCountyRelationships: relationships.length, populations: populations.length }
  });
  if (outputDirectory) {
    await mkdir(outputDirectory, { recursive: true });
    await Promise.all([
      writeFile(path.join(outputDirectory, "locations.ndjson"), ndjson),
      writeFile(path.join(outputDirectory, "locations.manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`)
    ]);
  }
  return { records, ndjson, manifest };
}

const isCli = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isCli) {
  const outputDirectory = fileURLToPath(new URL("../data/generated/", import.meta.url));
  const { manifest } = await generateLocationIndex({ outputDirectory });
  console.log(`Wrote ${manifest.outputRows.total} locations to ${outputDirectory}`);
  console.log(JSON.stringify(manifest, null, 2));
}
