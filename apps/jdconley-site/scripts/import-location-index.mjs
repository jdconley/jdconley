import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawn } from "node:child_process";

const APP_DIRECTORY = fileURLToPath(new URL("../", import.meta.url));
const COLUMNS = ["kind", "search_name", "display_name", "state_code", "zip", "latitude", "longitude", "time_zone"];

export function parseImportArguments(args) {
  const modes = args.filter((arg) => arg === "--local" || arg === "--remote");
  const unknown = args.filter((arg) => !["--local", "--remote", "--fixtures"].includes(arg));
  if (modes.length !== 1 || unknown.length > 0 || args.filter((arg) => arg === "--fixtures").length > 1) {
    throw new Error("Usage: import-location-index.mjs (--local|--remote) [--fixtures]");
  }
  return { mode: modes[0], fixtures: args.includes("--fixtures") };
}

function sqlLiteral(value) {
  if (value === null) return "NULL";
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return `'${String(value).replaceAll("'", "''")}'`;
}

export function validateRecord(record) {
  if (!record || !COLUMNS.every((column) => Object.hasOwn(record, column))) throw new Error("Location record is missing required fields");
  if (!['place', 'zip'].includes(record.kind) || !/^[A-Z]{2}$/u.test(record.state_code) ||
    (record.zip !== null && !/^\d{5}$/u.test(record.zip)) || !Number.isFinite(record.latitude) || !Number.isFinite(record.longitude)) {
    throw new Error(`Invalid location record: ${JSON.stringify(record)}`);
  }
  return record;
}

export function buildImportSql(records) {
  const values = records.map((record) => `(${COLUMNS.map((column) => sqlLiteral(validateRecord(record)[column])).join(",")})`);
  return [
    "DELETE FROM locations;",
    ...Array.from({ length: Math.ceil(values.length / 250) }, (_, index) =>
      `INSERT INTO locations(${COLUMNS.join(",")}) VALUES\n${values.slice(index * 250, (index + 1) * 250).join(",\n")};`),
    "INSERT INTO locations_fts(locations_fts) VALUES('rebuild');"
  ].join("\n");
}

async function loadRecords(fixtures) {
  if (fixtures) return JSON.parse(await readFile(path.join(APP_DIRECTORY, "data/location-fixtures.json"), "utf8"));
  const contents = await readFile(path.join(APP_DIRECTORY, "data/generated/locations.ndjson"), "utf8");
  return contents.split(/\r?\n/u).filter(Boolean).map((line) => JSON.parse(line));
}

function runWrangler(args) {
  return new Promise((resolve, reject) => {
    const child = spawn("pnpm", ["exec", "wrangler", ...args], { cwd: APP_DIRECTORY, stdio: "inherit", shell: false });
    child.once("error", reject);
    child.once("exit", (code, signal) => code === 0 ? resolve() : reject(new Error(`Wrangler exited with ${code ?? signal}`)));
  });
}

export async function importLocations(args = process.argv.slice(2)) {
  const options = parseImportArguments(args);
  const records = await loadRecords(options.fixtures);
  const directory = await mkdtemp(path.join(os.tmpdir(), "a-better-time-locations-"));
  const sqlPath = path.join(directory, "import.sql");
  try {
    // Wrangler's execute command accepts files, not bind parameters. Values are
    // validated and encoded as SQL literals, then passed as a spawn argument;
    // no user-controlled value is ever interpreted by a shell.
    await writeFile(sqlPath, buildImportSql(records), { mode: 0o600 });
    await runWrangler(["d1", "execute", "a-better-time", options.mode, "--file", sqlPath, "--yes"]);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
  console.log(`Imported ${records.length} ${options.fixtures ? "fixture" : "generated"} locations (${options.mode.slice(2)}).`);
}

const isCli = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isCli) await importLocations();
