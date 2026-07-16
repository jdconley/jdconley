import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawn } from "node:child_process";

const APP_DIRECTORY = fileURLToPath(new URL("../", import.meta.url));
const COLUMNS = ["kind", "search_name", "display_name", "state_code", "zip", "latitude", "longitude", "time_zone", "population"];

export function parseImportArguments(args) {
  const separators = args.filter((arg) => arg === "--");
  const normalized = args.filter((arg) => arg !== "--");
  const modes = normalized.filter((arg) => arg === "--local" || arg === "--remote");
  const fixtures = normalized.filter((arg) => arg === "--fixtures");
  const configIndexes = normalized.flatMap((arg, index) => arg === "--config" ? [index] : []);
  const configIndex = configIndexes[0];
  const config = configIndex === undefined ? undefined : normalized[configIndex + 1];
  const recognized = new Set(["--local", "--remote", "--fixtures"]);
  if (configIndex !== undefined) { recognized.add("--config"); recognized.add(config); }
  const unknown = normalized.filter((arg) => !recognized.has(arg));
  if (modes.length !== 1 || fixtures.length > 1 || separators.length > 1 || configIndexes.length > 1 ||
    (configIndex !== undefined && (!config || config.startsWith("--"))) || unknown.length > 0) {
    throw new Error("Usage: import-location-index.mjs (--local|--remote) [--fixtures] [--config <path>]");
  }
  return { mode: modes[0], fixtures: fixtures.length === 1, ...(config ? { config } : {}) };
}

function sqlLiteral(value) {
  if (value === null) return "NULL";
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return `'${String(value).replaceAll("'", "''")}'`;
}

export function validateRecord(record) {
  if (!record || !COLUMNS.every((column) => Object.hasOwn(record, column))) throw new Error("Location record is missing required fields");
  if (!['place', 'zip'].includes(record.kind) || !/^[A-Z]{2}$/u.test(record.state_code) ||
    (record.zip !== null && !/^\d{5}$/u.test(record.zip)) || !Number.isFinite(record.latitude) || !Number.isFinite(record.longitude) ||
    !Number.isInteger(record.population) || record.population < 0) {
    throw new Error(`Invalid location record: ${JSON.stringify(record)}`);
  }
  return record;
}

export function buildImportSql(records) {
  const values = records.map((record) => `(${COLUMNS.map((column) => sqlLiteral(validateRecord(record)[column])).join(",")})`);
  return [
    // D1's Wrangler executor rejects BEGIN/SAVEPOINT transaction statements.
    // Keep the destructive operation after all local validation and preserve
    // strict statement order: delete, batched inserts, then deterministic FTS.
    "DELETE FROM locations;",
    ...Array.from({ length: Math.ceil(values.length / 250) }, (_, index) =>
      `INSERT INTO locations(${COLUMNS.join(",")}) VALUES\n${values.slice(index * 250, (index + 1) * 250).join(",\n")};`),
    "INSERT INTO locations_fts(locations_fts) VALUES('rebuild');"
  ].join("\n");
}

export async function loadGeneratedRecords(readGeneratedFile) {
  const [contents, manifestText] = await Promise.all([
    readGeneratedFile("locations.ndjson"), readGeneratedFile("locations.manifest.json")
  ]);
  const manifest = JSON.parse(manifestText);
  const actualChecksum = createHash("sha256").update(contents).digest("hex");
  if (actualChecksum !== manifest.ndjsonSha256) throw new Error(`Generated location checksum mismatch: expected ${manifest.ndjsonSha256}, received ${actualChecksum}`);
  const records = contents.split(/\r?\n/u).filter(Boolean).map((line) => JSON.parse(line));
  const counts = { total: records.length, places: records.filter(({ kind }) => kind === "place").length, zips: records.filter(({ kind }) => kind === "zip").length };
  for (const key of Object.keys(counts)) if (counts[key] !== manifest.outputRows?.[key]) throw new Error(`Generated location row count mismatch for ${key}: expected ${manifest.outputRows?.[key]}, received ${counts[key]}`);
  return records;
}

async function loadRecords(fixtures) {
  if (fixtures) return JSON.parse(await readFile(path.join(APP_DIRECTORY, "data/location-fixtures.json"), "utf8"));
  return loadGeneratedRecords((name) => readFile(path.join(APP_DIRECTORY, "data/generated", name), "utf8"));
}

function runWrangler(args) {
  return new Promise((resolve, reject) => {
    const child = spawn("pnpm", ["exec", "wrangler", ...args], { cwd: APP_DIRECTORY, stdio: "inherit", shell: false });
    child.once("error", reject);
    child.once("exit", (code, signal) => code === 0 ? resolve() : reject(new Error(`Wrangler exited with ${code ?? signal}`)));
  });
}

export async function importLocations(args = process.argv.slice(2), { load = loadRecords, run = runWrangler } = {}) {
  const options = parseImportArguments(args);
  const records = await load(options.fixtures);
  const directory = await mkdtemp(path.join(os.tmpdir(), "a-better-time-locations-"));
  const sqlPath = path.join(directory, "import.sql");
  try {
    // Wrangler's execute command accepts files, not bind parameters. Values are
    // validated and encoded as SQL literals, then passed as a spawn argument;
    // no user-controlled value is ever interpreted by a shell.
    await writeFile(sqlPath, buildImportSql(records), { mode: 0o600 });
    await run(["d1", "execute", "a-better-time", options.mode, "--file", sqlPath, "--yes", ...(options.config ? ["--config", options.config] : [])]);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
  console.log(`Imported ${records.length} ${options.fixtures ? "fixture" : "generated"} locations (${options.mode.slice(2)}).`);
}

const isCli = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isCli) await importLocations();
