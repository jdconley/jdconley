import { appendFile, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

const APP_DIRECTORY = fileURLToPath(new URL("../", import.meta.url));
const DATABASE_NAME = "a-better-time";
const WIDGET_NAME = "A Better Time - jdconley.com";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
export const TURNSTILE_DOMAINS = Object.freeze([
  "jdconley.com",
  "www.jdconley.com",
  "jdconley-site.jd-conley.workers.dev"
]);

function selectNamedResource(resources, name, kind) {
  const matches = resources.filter((resource) => resource?.name === name);
  if (matches.length > 1) throw new Error(`Cloudflare returned multiple ${kind} resources named ${name}`);
  return matches[0] ?? null;
}

export function selectDatabase(databases, name = "a-better-time") {
  return selectNamedResource(databases, name, "D1 database");
}

export function selectTurnstileWidget(widgets, name = "A Better Time - jdconley.com") {
  return selectNamedResource(widgets, name, "Turnstile widget");
}

export function renderWranglerConfig(config, databaseId) {
  if (typeof databaseId !== "string" || !UUID_PATTERN.test(databaseId)) throw new Error("Invalid D1 database UUID");
  const headers = [...config.matchAll(/^[ \t]*\[\[d1_databases\]\]\s*(?:#.*)?$/gmu)];
  const namedBlocks = [];
  for (const header of headers) {
    const start = header.index;
    const remainder = config.slice(start + header[0].length);
    const nextHeader = remainder.match(/^[ \t]*\[{1,2}[^\]\r\n]+\]{1,2}\s*(?:#.*)?$/mu);
    const end = nextHeader ? start + header[0].length + nextHeader.index : config.length;
    const block = config.slice(start, end);
    if (!/^[ \t]*database_name\s*=\s*(["'])a-better-time\1\s*(?:#.*)?$/mu.test(block)) continue;
    namedBlocks.push({ start, block });
  }
  if (namedBlocks.length !== 1) throw new Error(`Expected exactly one named D1 database block, received ${namedBlocks.length}`);
  const [{ start: blockStart, block }] = namedBlocks;
  const bindings = [...block.matchAll(/^[ \t]*binding\s*=\s*(["'])([^\r\n]*?)\1\s*(?:#.*)?$/gmu)];
  if (bindings.length !== 1 || bindings[0][2] !== "DB") throw new Error("Named D1 database block must use binding DB exactly once");
  const identifiers = [...block.matchAll(/^([ \t]*database_id\s*=\s*)(["'])([^\r\n]*?)\2(\s*(?:#.*)?$)/gmu)];
  if (identifiers.length !== 1) throw new Error(`Expected exactly one D1 database_id assignment, received ${identifiers.length}`);
  const [match] = identifiers;
  if (!UUID_PATTERN.test(match[3])) throw new Error("Existing D1 database_id is not a standard UUID");
  const start = blockStart + match.index;
  const replacement = `${match[1]}${match[2]}${databaseId}${match[2]}${match[4]}`;
  return `${config.slice(0, start)}${replacement}${config.slice(start + match[0].length)}`;
}

export function needsLocationImport(state, manifest, actualCount) {
  const expectedCount = manifest?.outputRows?.total;
  return !state || state.checksum !== manifest?.ndjsonSha256 || Number(state.row_count) !== expectedCount || Number(actualCount) !== expectedCount;
}

export function needsTurnstileUpdate(widget, expectedDomains = TURNSTILE_DOMAINS) {
  const actual = [...(widget?.domains ?? [])].sort();
  const expected = [...expectedDomains].sort();
  return widget?.mode !== "managed" || actual.length !== expected.length || actual.some((domain, index) => domain !== expected[index]);
}

export function redactError(error) {
  return String(error?.message ?? error)
    .replace(/Bearer\s+[^\s,;]+/giu, "Bearer [REDACTED]")
    .replace(/((?:token|secret|api[_-]?key|authorization)\s*[:=]\s*)([^\s,;]+)/giu, "$1[REDACTED]")
    .replace(/[A-Za-z0-9][A-Za-z0-9._~+/=-]{23,}/gu, "[REDACTED]");
}

export function assertCloudflareEnvelope(envelope) {
  if (envelope?.success === true) return envelope.result;
  const details = envelope?.errors?.length ? JSON.stringify(envelope.errors) : "Cloudflare API request failed";
  throw new Error(redactError(details));
}

function realRun(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd ?? APP_DIRECTORY,
      env: options.env ?? process.env,
      shell: false,
      stdio: ["pipe", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8").on("data", (chunk) => { stdout += chunk; });
    child.stderr.setEncoding("utf8").on("data", (chunk) => { stderr += chunk; });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(`${command} exited with ${code ?? signal}: ${stderr || stdout}`));
    });
    child.stdin.end(options.input ?? "");
  });
}

async function realTemp(env) {
  const root = env.RUNNER_TEMP || os.tmpdir();
  const directory = await mkdtemp(path.join(root, "jdconley-production-"));
  return path.join(directory, "wrangler.toml");
}

function validateEnvironment(env) {
  for (const name of ["CLOUDFLARE_API_TOKEN", "CLOUDFLARE_ACCOUNT_ID", "SUPPORT_IP_HMAC_SECRET", "SITE_URL"]) {
    if (!String(env[name] ?? "").trim()) throw new Error(`${name} is required`);
  }
  if (!/^[0-9a-f]{32}$/iu.test(env.CLOUDFLARE_ACCOUNT_ID)) throw new Error("CLOUDFLARE_ACCOUNT_ID must be exactly 32 hexadecimal characters");
  let siteUrl;
  try { siteUrl = new URL(env.SITE_URL); } catch { throw new Error("SITE_URL must be the canonical https://jdconley.com origin"); }
  if (!["https://jdconley.com", "https://jdconley.com/"].includes(env.SITE_URL) || siteUrl.protocol !== "https:" ||
    siteUrl.hostname !== "jdconley.com" || siteUrl.port || siteUrl.username || siteUrl.password ||
    siteUrl.pathname !== "/" || siteUrl.search || siteUrl.hash) {
    throw new Error("SITE_URL must be the canonical https://jdconley.com origin");
  }
  if (new TextEncoder().encode(env.SUPPORT_IP_HMAC_SECRET).byteLength < 32) throw new Error("SUPPORT_IP_HMAC_SECRET must contain at least 32 bytes");
}

function normalizeRunJson(result) {
  if (result && typeof result === "object" && !Object.hasOwn(result, "stdout")) return result;
  const text = String(result?.stdout ?? result ?? "").trim();
  return text ? JSON.parse(text) : null;
}

function extractQueryRows(payload) {
  const entries = Array.isArray(payload) ? payload : [payload];
  return entries.flatMap((entry) => {
    if (Array.isArray(entry?.results)) return [entry.results];
    if (Array.isArray(entry?.result)) return entry.result.map((result) => result?.results ?? []);
    return [];
  });
}

async function queryLocationStatus(run, configPath) {
  const sql = "SELECT checksum, row_count FROM production_resource_state WHERE resource_name = 'locations'; SELECT COUNT(*) AS count FROM locations;";
  const result = normalizeRunJson(await run("pnpm", ["exec", "wrangler", "d1", "execute", DATABASE_NAME, "--remote", "--config", configPath, "--command", sql, "--json"], { cwd: APP_DIRECTORY }));
  if (result && (Object.hasOwn(result, "state") || Object.hasOwn(result, "actualCount"))) return result;
  const [stateRows = [], countRows = []] = extractQueryRows(result);
  return { state: stateRows[0] ?? null, actualCount: Number(countRows[0]?.count ?? -1) };
}

async function queryLocationCount(run, configPath) {
  const sql = "SELECT COUNT(*) AS count FROM locations;";
  const result = normalizeRunJson(await run("pnpm", ["exec", "wrangler", "d1", "execute", DATABASE_NAME, "--remote", "--config", configPath, "--command", sql, "--json"], { cwd: APP_DIRECTORY }));
  if (result && Object.hasOwn(result, "actualCount")) return Number(result.actualCount);
  return Number(extractQueryRows(result)[0]?.[0]?.count ?? -1);
}

async function cloudflareEnvelope(fetchImpl, env, pathname, init = {}) {
  const response = await fetchImpl(`https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}${pathname}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}`,
      "Content-Type": "application/json",
      ...init.headers
    }
  });
  let envelope;
  try { envelope = await response.json(); } catch { throw new Error(`Cloudflare API returned invalid JSON (${response.status ?? "unknown status"})`); }
  assertCloudflareEnvelope(envelope);
  return envelope;
}

async function cloudflareRequest(fetchImpl, env, pathname, init = {}) {
  return assertCloudflareEnvelope(await cloudflareEnvelope(fetchImpl, env, pathname, init));
}

async function listCloudflareResources(fetchImpl, env, pathname, perPage = 1000) {
  const resources = [];
  let page = 1;
  for (;;) {
    const separator = pathname.includes("?") ? "&" : "?";
    const envelope = await cloudflareEnvelope(fetchImpl, env, `${pathname}${separator}per_page=${perPage}&page=${page}`);
    const pageResources = assertCloudflareEnvelope(envelope);
    if (!Array.isArray(pageResources)) throw new Error("Cloudflare list response did not contain an array");
    resources.push(...pageResources);

    const info = envelope.result_info ?? {};
    const currentPage = Number(info.current_page ?? info.page ?? page);
    const totalPages = Number(info.total_pages ?? (Number.isFinite(Number(info.total_count)) && Number(info.per_page) > 0
      ? Math.ceil(Number(info.total_count) / Number(info.per_page)) : Number.NaN));
    const hasMore = Number.isFinite(totalPages) ? currentPage < totalPages : pageResources.length === perPage;
    if (!hasMore) return resources;
    page = Number.isFinite(currentPage) && currentPage >= page ? currentPage + 1 : page + 1;
  }
}

function databaseId(database) {
  const id = database?.uuid ?? database?.id;
  if (!UUID_PATTERN.test(id ?? "")) throw new Error(`Cloudflare D1 database ${DATABASE_NAME} has no standard UUID`);
  return id;
}

function widgetCredentials(widget) {
  if (!widget?.sitekey || !widget?.secret) throw new Error(`Cloudflare Turnstile widget ${WIDGET_NAME} did not return a sitekey and secret`);
  return { sitekey: widget.sitekey, secret: widget.secret };
}

function validateLocationManifest(manifest) {
  if (!/^[0-9a-f]{64}$/u.test(manifest?.ndjsonSha256 ?? "") ||
    !Number.isInteger(manifest?.outputRows?.total) || manifest.outputRows.total < 0) {
    throw new Error("Generated location manifest has an invalid checksum or row count");
  }
  return manifest;
}

async function defaultOutput(env, key, value) {
  if (env.GITHUB_OUTPUT) await appendFile(env.GITHUB_OUTPUT, `${key}=${value}\n`, "utf8");
}

export async function cleanupReconciledConfig(configPath, { remove = rm } = {}) {
  if (typeof configPath !== "string" || !path.isAbsolute(configPath) || path.normalize(configPath) !== configPath) {
    throw new Error("Unsafe reconciled Wrangler config cleanup path");
  }
  const generatedDirectory = path.dirname(configPath);
  if (path.basename(configPath) !== "wrangler.toml" ||
    !/^jdconley-production-[A-Za-z0-9]{6}$/u.test(path.basename(generatedDirectory)) ||
    path.join(generatedDirectory, "wrangler.toml") !== configPath) {
    throw new Error("Reconciled Wrangler config must be directly inside a generated jdconley-production directory");
  }
  await remove(generatedDirectory, { recursive: true, force: true });
}

export async function reconcileProductionResources(options = {}, injected = {}) {
  const env = options.env ?? process.env;
  const dryRun = options.dryRun === true;
  const dependencies = Object.fromEntries(
    ["fetch", "run", "read", "write", "remove", "temp", "output", "log"]
      .filter((name) => typeof options[name] === "function")
      .map((name) => [name, options[name]])
  );
  Object.assign(dependencies, options.dependencies, injected);
  const fetchImpl = dependencies.fetch ?? globalThis.fetch;
  const run = dependencies.run ?? realRun;
  const read = dependencies.read ?? readFile;
  const write = dependencies.write ?? writeFile;
  const remove = dependencies.remove ?? rm;
  const temp = dependencies.temp ?? (() => realTemp(env));
  const output = dependencies.output ?? ((key, value) => defaultOutput(env, key, value));
  const log = dependencies.log ?? console.log;

  validateEnvironment(env);

  let wranglerConfigPath;
  try {
    let databases = await listCloudflareResources(fetchImpl, env, "/d1/database");
    let database = selectDatabase(databases, DATABASE_NAME);
    const plannedMutations = [];
    if (!database) {
      if (dryRun) plannedMutations.push(`Create D1 database ${DATABASE_NAME} in wnam`);
      else {
        await cloudflareRequest(fetchImpl, env, "/d1/database", {
          method: "POST",
          body: JSON.stringify({ name: DATABASE_NAME, primary_location_hint: "wnam" })
        });
        databases = await listCloudflareResources(fetchImpl, env, "/d1/database");
        database = selectDatabase(databases, DATABASE_NAME);
        if (!database) throw new Error(`Cloudflare did not return ${DATABASE_NAME} after creating it`);
      }
    }
    if (database) databaseId(database);

    if (dryRun) {
      plannedMutations.push("Apply remote D1 migrations", "Build and reconcile the production location index");
      const widgets = await listCloudflareResources(fetchImpl, env, "/challenges/widgets");
      const widget = selectTurnstileWidget(widgets, WIDGET_NAME);
      if (!widget) plannedMutations.push(`Create Turnstile widget ${WIDGET_NAME}`);
      else if (needsTurnstileUpdate(widget, TURNSTILE_DOMAINS)) plannedMutations.push(`Update Turnstile widget ${WIDGET_NAME}`);
      plannedMutations.push("Upload Worker secrets");
      for (const mutation of plannedMutations) log(`[dry-run] ${mutation}`);
      return { dryRun: true, plannedMutations, wranglerConfigPath: null, turnstileSiteKey: widget?.sitekey ?? null };
    }

    const sourceConfig = await read(path.join(APP_DIRECTORY, "wrangler.toml"), "utf8");
    const reconciledConfig = renderWranglerConfig(sourceConfig, databaseId(database));
    wranglerConfigPath = await temp("wrangler-production", env);
    await write(wranglerConfigPath, reconciledConfig, { mode: 0o600 });

    await run("pnpm", ["exec", "wrangler", "d1", "migrations", "apply", DATABASE_NAME, "--remote", "--config", wranglerConfigPath], { cwd: APP_DIRECTORY });
    await run("pnpm", ["run", "locations:build"], { cwd: APP_DIRECTORY });
    const manifest = validateLocationManifest(JSON.parse(await read(path.join(APP_DIRECTORY, "data/generated/locations.manifest.json"), "utf8")));
    const status = await queryLocationStatus(run, wranglerConfigPath);
    if (needsLocationImport(status.state, manifest, status.actualCount)) {
      await run("pnpm", ["run", "locations:import:remote", "--", "--config", wranglerConfigPath], { cwd: APP_DIRECTORY });
      const verifiedCount = await queryLocationCount(run, wranglerConfigPath);
      if (verifiedCount !== manifest.outputRows.total) throw new Error(`Location import verification failed: expected ${manifest.outputRows.total}, received ${verifiedCount}`);
      const upsert = `INSERT INTO production_resource_state(resource_name, checksum, row_count, updated_at) VALUES('locations', '${manifest.ndjsonSha256}', ${manifest.outputRows.total}, datetime('now')) ON CONFLICT(resource_name) DO UPDATE SET checksum=excluded.checksum, row_count=excluded.row_count, updated_at=excluded.updated_at;`;
      await run("pnpm", ["exec", "wrangler", "d1", "execute", DATABASE_NAME, "--remote", "--config", wranglerConfigPath, "--command", upsert, "--yes"], { cwd: APP_DIRECTORY });
    }

    const widgets = await listCloudflareResources(fetchImpl, env, "/challenges/widgets");
    let widget = selectTurnstileWidget(widgets, WIDGET_NAME);
    if (!widget) {
      widget = await cloudflareRequest(fetchImpl, env, "/challenges/widgets", {
        method: "POST",
        body: JSON.stringify({ name: WIDGET_NAME, domains: TURNSTILE_DOMAINS, mode: "managed" })
      });
    } else if (needsTurnstileUpdate(widget, TURNSTILE_DOMAINS)) {
      widget = await cloudflareRequest(fetchImpl, env, `/challenges/widgets/${encodeURIComponent(widget.sitekey)}`, {
        method: "PUT",
        // Secret rotation is a separate Cloudflare endpoint. Updating the
        // widget configuration through PUT preserves the existing secret.
        body: JSON.stringify({ name: WIDGET_NAME, domains: TURNSTILE_DOMAINS, mode: "managed" })
      });
    } else if (!widget.secret) {
      widget = await cloudflareRequest(fetchImpl, env, `/challenges/widgets/${encodeURIComponent(widget.sitekey)}`);
    }

    const { sitekey, secret } = widgetCredentials(widget);
    if (env.GITHUB_ACTIONS === "true") {
      log(`::add-mask::${sitekey}`);
      log(`::add-mask::${secret}`);
    }
    await run("pnpm", ["exec", "wrangler", "secret", "bulk", "--config", wranglerConfigPath], {
      cwd: APP_DIRECTORY,
      input: JSON.stringify({ TURNSTILE_SECRET_KEY: secret, SUPPORT_IP_HMAC_SECRET: env.SUPPORT_IP_HMAC_SECRET })
    });
    await output("WRANGLER_CONFIG", wranglerConfigPath);
    await output("TURNSTILE_SITE_KEY", sitekey);
    return { wranglerConfigPath, turnstileSiteKey: sitekey };
  } catch (error) {
    const message = redactError(error);
    if (wranglerConfigPath) {
      try { await cleanupReconciledConfig(wranglerConfigPath, { remove }); }
      catch (cleanupError) { throw new Error(`${message}; reconciled config cleanup failed: ${redactError(cleanupError)}`); }
    }
    throw new Error(message);
  }
}

const isCli = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isCli) {
  const args = process.argv.slice(2);
  if (args[0] === "--cleanup" && args.length === 2) await cleanupReconciledConfig(args[1]);
  else {
    const dryRun = args.includes("--dry-run");
    const unknown = args.filter((argument) => argument !== "--dry-run");
    if (unknown.length) throw new Error("Usage: reconcile-production-resources.mjs [--dry-run] | --cleanup <config-path>");
    await reconcileProductionResources({ dryRun });
  }
}
