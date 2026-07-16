import { execFile } from "node:child_process";
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { importLocations, parseImportArguments } from "../../scripts/import-location-index.mjs";

import {
  assertCloudflareEnvelope,
  cleanupReconciledConfig,
  needsLocationImport,
  needsTurnstileUpdate,
  reconcileProductionResources,
  redactError,
  renderWranglerConfig,
  resolveReconciliationTempRoot,
  selectDatabase,
  selectTurnstileWidget,
  writeGithubOutput
} from "../../scripts/reconcile-production-resources.mjs";

const validEnv = {
  CLOUDFLARE_API_TOKEN: "cloudflare-token-value",
  CLOUDFLARE_ACCOUNT_ID: "a".repeat(32),
  SUPPORT_IP_HMAC_SECRET: "h".repeat(32),
  SITE_URL: "https://jdconley.com",
  RUNNER_TEMP: "/runner-temp"
};
const domains = ["jdconley.com", "www.jdconley.com", "jdconley-site.jd-conley.workers.dev"];
const databaseUuid = "123e4567-e89b-42d3-a456-426614174000";
const createdDatabaseUuid = "123e4567-e89b-42d3-a456-426614174001";
const replacementDatabaseUuid = "123e4567-e89b-42d3-a456-426614174002";
const sourceDirectory = '/checkout/apps/site "quoted"';
const tempDirectory = "/runner-temp/jdconley-production-a1B2c3";
const tempConfigPath = `${tempDirectory}/wrangler.toml`;
const tempSecretsPath = `${tempDirectory}/wrangler-secrets.json`;
const wranglerSource = `name = "jdconley-site"\nmain = "worker/index.js"\ncompatibility_date = "2026-07-15"\n[assets]\ndirectory = "dist"\nbinding = "ASSETS"\n[[d1_databases]]\nbinding = "DB"\ndatabase_name = "a-better-time"\ndatabase_id = "${databaseUuid}"\nmigrations_dir = "migrations"\n`;
const manifest = { ndjsonSha256: "a".repeat(64), outputRows: { total: 12 } };
const execFileAsync = promisify(execFile);
const appDirectory = fileURLToPath(new URL("../../", import.meta.url));

function cloudflareResponse(result, success = true, resultInfo) {
  return { ok: true, json: async () => ({ success, result, ...(resultInfo ? { result_info: resultInfo } : {}), ...(success ? {} : { errors: result }) }) };
}

function harness({ databases = [{ name: "a-better-time", uuid: databaseUuid }], widgets = [], state = null, actualCount = 0, generatedManifest = manifest, verifiedCount = manifest.outputRows.total } = {}) {
  const events = [];
  let databaseLists = 0;
  const fetch = async (url, init = {}) => {
    const method = init.method ?? "GET";
    const pathname = new URL(url).pathname;
    events.push(["fetch", method, url, init.body ? JSON.parse(init.body) : undefined]);
    if (pathname.endsWith("/d1/database") && method === "GET") {
      databaseLists += 1;
      return cloudflareResponse(databaseLists === 1 ? databases : [{ name: "a-better-time", uuid: createdDatabaseUuid }]);
    }
    if (pathname.endsWith("/d1/database") && method === "POST") return cloudflareResponse({ name: "a-better-time", uuid: createdDatabaseUuid });
    if (pathname.endsWith("/challenges/widgets") && method === "GET") return cloudflareResponse(widgets);
    if (pathname.endsWith("/challenges/widgets") && method === "POST") return cloudflareResponse({ name: "A Better Time - jdconley.com", sitekey: "new-site-key", secret: "new-widget-secret", domains, mode: "managed" });
    if (pathname.includes("/challenges/widgets/") && method === "PUT") return cloudflareResponse({ name: "A Better Time - jdconley.com", sitekey: "existing-site-key", secret: "existing-widget-secret", domains, mode: "managed" });
    if (pathname.includes("/challenges/widgets/") && method === "GET") return cloudflareResponse({ ...widgets[0], secret: "existing-widget-secret" });
    throw new Error(`Unexpected fetch ${method} ${url}`);
  };
  let countQueries = 0;
  const run = async (command, args, options = {}) => {
    events.push(["run", command, args, options]);
    const sql = args[args.indexOf("--command") + 1];
    if (sql?.includes("production_resource_state") && sql?.includes("COUNT(*)")) return { state, actualCount };
    if (sql?.startsWith("SELECT COUNT(*)")) {
      countQueries += 1;
      return { actualCount: countQueries ? verifiedCount : actualCount };
    }
    return { stdout: "" };
  };
  const read = async (file) => {
    events.push(["read", file]);
    return file.endsWith("locations.manifest.json") ? JSON.stringify(generatedManifest) : wranglerSource;
  };
  const write = async (...args) => { events.push(["write", ...args]); };
  const temp = async (root) => { events.push(["temp", root]); return tempConfigPath; };
  const output = async (...args) => { events.push(["output", ...args]); };
  const log = (...args) => { events.push(["log", ...args]); };
  const remove = async (...args) => { events.push(["remove", ...args]); };
  return { events, dependencies: { fetch, run, read, write, temp, output, log, remove } };
}

describe("production reconciliation helpers", () => {
  test("selects one named database and rejects duplicates", () => {
    expect(selectDatabase([{ name: "other" }], "a-better-time")).toBeNull();
    expect(selectDatabase([{ name: "a-better-time", uuid: databaseUuid }], "a-better-time")).toEqual({ name: "a-better-time", uuid: databaseUuid });
    expect(() => selectDatabase([{ name: "a-better-time" }, { name: "a-better-time" }], "a-better-time")).toThrow(/multiple/i);
  });

  test("anchors path settings to the source directory while preserving all other TOML", () => {
    const input = `name = "site"\nmain = "worker/index.js"\n\n[assets]\ndirectory = "dist"\nbinding = "ASSETS"\n\n[[d1_databases]]\nbinding = "DB"\ndatabase_name = "a-better-time"\ndatabase_id = "${databaseUuid}"\nmigrations_dir = "migrations"\n\n[vars]\nVALUE = "database_id = untouched"\n`;
    const expected = input
      .replace('main = "worker/index.js"', `main = ${JSON.stringify(path.join(sourceDirectory, "worker/index.js"))}`)
      .replace('directory = "dist"', `directory = ${JSON.stringify(path.join(sourceDirectory, "dist"))}`)
      .replace('migrations_dir = "migrations"', `migrations_dir = ${JSON.stringify(path.join(sourceDirectory, "migrations"))}`)
      .replace(databaseUuid, replacementDatabaseUuid);
    expect(renderWranglerConfig(input, replacementDatabaseUuid, sourceDirectory)).toBe(expected);
    const withUnrelatedId = `${input}\n[durable_objects]\ndatabase_id = \"not-d1\"\n`;
    expect(renderWranglerConfig(withUnrelatedId, replacementDatabaseUuid, sourceDirectory)).toBe(`${expected}\n[durable_objects]\ndatabase_id = \"not-d1\"\n`);
    expect(() => renderWranglerConfig("name = \"site\"\n", replacementDatabaseUuid, sourceDirectory)).toThrow(/exactly one/i);
    expect(() => renderWranglerConfig("database_id = \"one\"\ndatabase_id = \"two\"\n", replacementDatabaseUuid, sourceDirectory)).toThrow(/exactly one/i);
    expect(() => renderWranglerConfig(input, 'unsafe"\ndatabase_id = "injected', sourceDirectory)).toThrow(/invalid/i);
    expect(() => renderWranglerConfig(input, "not-a-standard-uuid", sourceDirectory)).toThrow(/UUID/i);
    expect(() => renderWranglerConfig(input.replace(databaseUuid, "malformed-existing-id"), replacementDatabaseUuid, sourceDirectory)).toThrow(/UUID/i);
    expect(() => renderWranglerConfig(input.replace('binding = "DB"', 'binding = "OTHER"'), replacementDatabaseUuid, sourceDirectory)).toThrow(/binding DB/i);
    expect(() => renderWranglerConfig(input.replace('binding = "DB"\n', ""), replacementDatabaseUuid, sourceDirectory)).toThrow(/binding DB/i);
  });

  test("rejects source or config paths that cannot be safely anchored", () => {
    expect(() => renderWranglerConfig(wranglerSource, replacementDatabaseUuid, "relative/source"))
      .toThrow(/source directory.*absolute/i);
    expect(() => renderWranglerConfig(
      wranglerSource.replace('main = "worker/index.js"', 'main = "../worker/index.js"'),
      replacementDatabaseUuid,
      "/checkout/apps/site"
    )).toThrow(/main.*outside/i);
    expect(() => renderWranglerConfig(
      wranglerSource.replace('directory = "dist"\n', ""),
      replacementDatabaseUuid,
      "/checkout/apps/site"
    )).toThrow(/assets.*directory/i);
  });

  test("generated temp config reaches fixture entry, assets, and migrations without network access", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "jdconley-wrangler-config-"));
    const checkout = path.join(root, 'checkout "quoted"');
    const generatedDirectory = path.join(root, "generated");
    const generatedConfig = path.join(generatedDirectory, "wrangler.toml");
    const generatedSecrets = path.join(generatedDirectory, "wrangler-secrets.json");
    const outDirectory = path.join(root, "dry-run-output");
    const localState = path.join(root, "local-state");
    try {
      await Promise.all([
        mkdir(path.join(checkout, "worker"), { recursive: true }),
        mkdir(path.join(checkout, "dist"), { recursive: true }),
        mkdir(path.join(checkout, "migrations"), { recursive: true }),
        mkdir(generatedDirectory, { recursive: true })
      ]);
      await Promise.all([
        writeFile(path.join(checkout, "worker/index.js"), 'export default { fetch() { return new Response("fixture"); } };\n'),
        writeFile(path.join(checkout, "dist/index.html"), "<!doctype html><title>fixture</title>\n"),
        writeFile(path.join(checkout, "migrations/0001_fixture.sql"), "CREATE TABLE fixture (id INTEGER PRIMARY KEY);\n")
      ]);
      await writeFile(
        generatedConfig,
        renderWranglerConfig(wranglerSource, replacementDatabaseUuid, checkout),
        { mode: 0o600 }
      );
      await writeFile(generatedSecrets, JSON.stringify({
        TURNSTILE_SECRET_KEY: "fixture-turnstile-secret",
        SUPPORT_IP_HMAC_SECRET: "fixture-support-hmac-secret-value"
      }), { mode: 0o600 });
      const env = {
        ...process.env,
        NO_COLOR: "1",
        WRANGLER_HIDE_BANNER: "true",
        WRANGLER_SEND_METRICS: "false",
        WRANGLER_SEND_ERROR_REPORTS: "false",
        XDG_CONFIG_HOME: path.join(root, "xdg-config"),
        XDG_CACHE_HOME: path.join(root, "xdg-cache")
      };
      delete env.CLOUDFLARE_API_TOKEN;
      delete env.CLOUDFLARE_ACCOUNT_ID;

      const dryRun = await execFileAsync("pnpm", [
        "exec", "wrangler", "deploy", "--dry-run", "--config", generatedConfig,
        "--secrets-file", generatedSecrets, "--outdir", outDirectory
      ], { cwd: appDirectory, env, timeout: 30_000 });
      await access(path.join(outDirectory, "index.js"));
      expect(`${dryRun.stdout}\n${dryRun.stderr}`).toContain("TURNSTILE_SECRET_KEY");
      expect(`${dryRun.stdout}\n${dryRun.stderr}`).toContain("SUPPORT_IP_HMAC_SECRET");

      const migrations = await execFileAsync("pnpm", [
        "exec", "wrangler", "d1", "migrations", "list", "a-better-time", "--local",
        "--config", generatedConfig, "--persist-to", localState
      ], { cwd: appDirectory, env, timeout: 30_000 });
      expect(`${migrations.stdout}\n${migrations.stderr}`).toContain("0001_fixture.sql");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  }, 40_000);

  test("imports locations unless checksum and every row count agree", () => {
    const manifest = { ndjsonSha256: "abc", outputRows: { total: 12 } };
    expect(needsLocationImport({ checksum: "abc", row_count: 12 }, manifest, 12)).toBe(false);
    expect(needsLocationImport(null, manifest, 12)).toBe(true);
    expect(needsLocationImport({ checksum: "different", row_count: 12 }, manifest, 12)).toBe(true);
    expect(needsLocationImport({ checksum: "abc", row_count: 11 }, manifest, 12)).toBe(true);
    expect(needsLocationImport({ checksum: "abc", row_count: 12 }, manifest, 11)).toBe(true);
  });

  test("selects one named Turnstile widget and compares managed domains as a sorted set", () => {
    const domains = ["jdconley.com", "www.jdconley.com", "jdconley-site.jd-conley.workers.dev"];
    const widget = { name: "A Better Time - jdconley.com", mode: "managed", domains: [...domains].reverse() };
    expect(selectTurnstileWidget([widget], widget.name)).toBe(widget);
    expect(selectTurnstileWidget([], widget.name)).toBeNull();
    expect(() => selectTurnstileWidget([widget, { ...widget }], widget.name)).toThrow(/multiple/i);
    expect(needsTurnstileUpdate(widget, domains)).toBe(false);
    expect(needsTurnstileUpdate(widget)).toBe(false);
    expect(needsTurnstileUpdate({ ...widget, mode: "non-interactive" }, domains)).toBe(true);
    expect(needsTurnstileUpdate({ ...widget, domains: ["jdconley.com"] }, domains)).toBe(true);
  });

  test("unwraps successful Cloudflare envelopes and sanitizes errors", () => {
    expect(assertCloudflareEnvelope({ success: true, result: { id: 1 } })).toEqual({ id: 1 });
    const token = "token-value-12345678901234567890";
    expect(() => assertCloudflareEnvelope({ success: false, errors: [{ message: `Bearer ${token}` }] })).toThrow("Bearer [REDACTED]");
    const sanitized = redactError(new Error(`CLOUDFLARE_API_TOKEN=${token}; Authorization: Bearer short-token`));
    expect(sanitized).not.toContain(token);
    expect(sanitized).not.toContain("short-token");
    expect(sanitized).toContain("[REDACTED]");
  });

  test("writes only single-line GitHub output keys and values", async () => {
    const writes = [];
    await writeGithubOutput(
      { GITHUB_OUTPUT: "/tmp/github-output" },
      "WRANGLER_CONFIG",
      "/tmp/config.toml",
      async (...args) => { writes.push(args); }
    );
    expect(writes).toEqual([["/tmp/github-output", "WRANGLER_CONFIG=/tmp/config.toml\n", "utf8"]]);
    for (const [key, value] of [
      ["BAD\nKEY", "safe"],
      ["SAFE", "bad\rvalue"],
      ["SAFE", "bad\u0000value"],
      ["SAFE", "bad\u007fvalue"]
    ]) {
      await expect(writeGithubOutput({ GITHUB_OUTPUT: "/tmp/github-output" }, key, value, async () => {}))
        .rejects.toThrow(/GitHub output/i);
    }
  });
});

describe("production reconciliation orchestration", () => {
  test("the location importer accepts one explicit Wrangler config", () => {
    expect(parseImportArguments(["--remote", "--config", "/tmp/production.toml"])).toEqual({
      mode: "--remote", fixtures: false, config: "/tmp/production.toml"
    });
    expect(() => parseImportArguments(["--remote", "--config"])).toThrow(/usage/i);
    expect(() => parseImportArguments(["--remote", "--config", "one", "--config", "two"])).toThrow(/usage/i);
    expect(() => parseImportArguments(["--remote", "--config", "x", "x"])).toThrow(/usage/i);
    expect(() => parseImportArguments(["--remote", "x", "--config", "x"])).toThrow(/usage/i);
    expect(() => parseImportArguments(["x", "--remote", "--config", "x"])).toThrow(/usage/i);
  });

  test("the location importer forwards the reconciled config and cleans temporary SQL after failure", async () => {
    let sqlPath;
    await expect(importLocations(["--remote", "--config", "/tmp/production.toml"], {
      load: async () => [],
      run: async (args) => {
        sqlPath = args[args.indexOf("--file") + 1];
        expect(args.slice(-2)).toEqual(["--config", "/tmp/production.toml"]);
        throw new Error("import failed");
      }
    })).rejects.toThrow("import failed");
    await expect(access(sqlPath)).rejects.toThrow();
  });

  test("exposes normal and dry-run package commands", async () => {
    const packageJson = JSON.parse(await readFile(fileURLToPath(new URL("../../package.json", import.meta.url)), "utf8"));
    expect(packageJson.scripts["production:reconcile"]).toBe("node ./scripts/reconcile-production-resources.mjs");
    expect(packageJson.scripts["production:reconcile:dry-run"]).toBe("pnpm run production:reconcile -- --dry-run");
    expect(packageJson.scripts["production:reconcile:cleanup"]).toBe("node ./scripts/reconcile-production-resources.mjs --cleanup");
  });

  test("exports a cleanup operation backed by an injected filesystem removal", async () => {
    const calls = [];
    await cleanupReconciledConfig(tempConfigPath, {
      tempRoot: "/runner-temp",
      remove: async (...args) => { calls.push(args); }
    });
    expect(calls).toEqual([[tempDirectory, { recursive: true, force: true }]]);
  });

  test("resolves the CI runner temp root and falls back to the operating system temp root", () => {
    expect(resolveReconciliationTempRoot({ RUNNER_TEMP: "/ci/runner-temp" }, { osTemp: () => "/os-temp" })).toBe("/ci/runner-temp");
    expect(resolveReconciliationTempRoot({}, { osTemp: () => "/os-temp" })).toBe("/os-temp");
  });

  test.each([
    ["relative/jdconley-production-a1B2c3/wrangler.toml"],
    ["/runner-temp/not-production-a1B2c3/wrangler.toml"],
    ["/runner-temp/jdconley-production-a1B2c3/not-wrangler.toml"],
    ["/runner-temp/jdconley-production-too-long/wrangler.toml"],
    ["/runner-temp/jdconley-production-a1B2c3/nested/wrangler.toml"],
    ["/runner-temp/jdconley-production-a1B2c3/../jdconley-production-d4E5f6/wrangler.toml"],
    ["/other-root/jdconley-production-a1B2c3/wrangler.toml"]
  ])("rejects unsafe reconciled config cleanup path %s without deleting", async (unsafePath) => {
    const calls = [];
    await expect(cleanupReconciledConfig(unsafePath, {
      tempRoot: "/runner-temp",
      remove: async (...args) => { calls.push(args); }
    })).rejects.toThrow(/unsafe|generated/i);
    expect(calls).toEqual([]);
  });

  test("validates all required environment before doing work", async () => {
    const { events, dependencies } = harness();
    await expect(reconcileProductionResources({ env: { ...validEnv, SITE_URL: "" } }, dependencies)).rejects.toThrow(/SITE_URL/);
    expect(events).toEqual([]);
  });

  test.each([
    ["CLOUDFLARE_ACCOUNT_ID", "f".repeat(31), /32.*hex/i],
    ["CLOUDFLARE_ACCOUNT_ID", "g".repeat(32), /32.*hex/i],
    ["SITE_URL", "https://example.com", /canonical.*jdconley\.com/i],
    ["SITE_URL", "https://jdconley.com/path", /canonical.*jdconley\.com/i],
    ["SITE_URL", "https://jdconley.com:443", /canonical.*jdconley\.com/i],
    ["SUPPORT_IP_HMAC_SECRET", "s".repeat(31), /32 bytes/i],
    ["SUPPORT_IP_HMAC_SECRET", `${"s".repeat(32)}\n`, /control/i]
  ])("rejects an invalid production %s contract", async (name, value, message) => {
    const { events, dependencies } = harness();
    await expect(reconcileProductionResources({ env: { ...validEnv, [name]: value } }, dependencies)).rejects.toThrow(message);
    expect(events).toEqual([]);
  });

  test("rejects a malformed discovered database UUID in dry-run", async () => {
    const { dependencies } = harness({ databases: [{ name: "a-better-time", uuid: "not-a-uuid" }] });
    await expect(reconcileProductionResources({ env: validEnv, dryRun: true }, dependencies)).rejects.toThrow(/UUID/i);
  });

  test("rejects an unsafe generated manifest before importing", async () => {
    const { events, dependencies } = harness({ generatedManifest: { ndjsonSha256: "not-a-checksum", outputRows: { total: 12 } } });
    await expect(reconcileProductionResources({ env: validEnv }, dependencies)).rejects.toThrow(/manifest/i);
    expect(events.some(([type, _command, args]) => type === "run" && args.includes("locations:import:remote"))).toBe(false);
  });

  test("creates missing resources, publishes outputs in order, and retains the config for deployment", async () => {
    const { events, dependencies } = harness({ databases: [], widgets: [], state: null, actualCount: 0 });
    const result = await reconcileProductionResources({ env: validEnv }, dependencies);

    expect(result).toEqual({
      wranglerConfigPath: tempConfigPath,
      wranglerSecretsFilePath: tempSecretsPath,
      turnstileSiteKey: "new-site-key"
    });
    expect(events.find(([type]) => type === "temp")).toEqual(["temp", "/runner-temp"]);
    const operations = events.map((event) => event[0] === "fetch" ? `${event[0]}:${event[1]}:${event[2].split("/").at(-1)}` : event[0] === "run" ? `${event[0]}:${event[2].join(" ")}` : event[0]);
    expect(operations).toEqual([
      "fetch:GET:database?per_page=1000&page=1", "fetch:POST:database", "fetch:GET:database?per_page=1000&page=1", "read", "temp", "write",
      expect.stringContaining("d1 migrations apply a-better-time --remote"),
      "run:run locations:build",
      "read",
      expect.stringContaining("SELECT checksum"),
      `run:run locations:import:remote -- --config ${tempConfigPath}`,
      expect.stringContaining("SELECT COUNT(*)"),
      expect.stringContaining("INSERT INTO production_resource_state"),
      "fetch:GET:widgets?per_page=1000&page=1", "fetch:POST:widgets",
      "write", "output", "output", "output"
    ]);
    const configWrite = events.find(([type]) => type === "write");
    expect(configWrite[2]).toContain(`database_id = "${createdDatabaseUuid}"`);
    expect(configWrite[2]).toContain(`main = ${JSON.stringify(path.join(appDirectory, "worker/index.js"))}`);
    expect(configWrite[2]).toContain(`directory = ${JSON.stringify(path.join(appDirectory, "dist"))}`);
    expect(configWrite[2]).toContain(`migrations_dir = ${JSON.stringify(path.join(appDirectory, "migrations"))}`);
    expect(configWrite[3]).toEqual({ mode: 0o600 });
    const migrationsRun = events.find(([type, _command, args]) => type === "run" && args.includes("migrations"));
    expect(migrationsRun[2].slice(-2)).toEqual(["--config", tempConfigPath]);
    expect(migrationsRun[3].cwd).toBe(appDirectory);
    const importRun = events.find(([type, _command, args]) => type === "run" && args.includes("locations:import:remote"));
    expect(importRun[2]).toEqual(["run", "locations:import:remote", "--", "--config", result.wranglerConfigPath]);
    expect(importRun[3].cwd).toBe(appDirectory);
    expect(events.some(([type, _command, args]) => type === "run" && args.includes("bulk"))).toBe(false);
    const secretsWrite = events.filter(([type]) => type === "write")[1];
    expect(secretsWrite[1]).toBe(tempSecretsPath);
    expect(secretsWrite[3]).toEqual({ mode: 0o600 });
    expect(JSON.parse(secretsWrite[2])).toEqual({
      TURNSTILE_SECRET_KEY: "new-widget-secret",
      SUPPORT_IP_HMAC_SECRET: "h".repeat(32)
    });
    expect(events.filter(([type]) => type === "output")).toEqual([
      ["output", "WRANGLER_CONFIG", tempConfigPath],
      ["output", "WRANGLER_SECRETS_FILE", tempSecretsPath],
      ["output", "TURNSTILE_SITE_KEY", "new-site-key"]
    ]);
    const logs = JSON.stringify(events.filter(([type]) => type === "log"));
    expect(logs).not.toContain("new-site-key");
    expect(logs).not.toContain("new-widget-secret");
    expect(logs).not.toContain("h".repeat(32));
    const stateWrite = events.find(([type, _command, args]) => type === "run" && args.some((argument) => argument.includes?.("INSERT INTO production_resource_state")));
    expect(stateWrite[2]).toContain("--yes");
    expect(events.some(([type]) => type === "remove")).toBe(false);
  });

  test("cleans the temporary Wrangler config when orchestration fails after creating it", async () => {
    const { events, dependencies } = harness();
    const originalRun = dependencies.run;
    dependencies.run = async (command, args, options) => {
      if (args.includes("migrations")) throw new Error("migration failed");
      return originalRun(command, args, options);
    };
    await expect(reconcileProductionResources({ env: validEnv }, dependencies)).rejects.toThrow("migration failed");
    expect(events.find(([type]) => type === "temp")).toEqual(["temp", "/runner-temp"]);
    expect(events.filter(([type]) => type === "remove")).toEqual([
      ["remove", tempDirectory, { recursive: true, force: true }]
    ]);
  });

  test("removes the staged secrets directory when publishing an output fails", async () => {
    const { events, dependencies } = harness();
    dependencies.output = async () => { throw new Error("output failed"); };
    await expect(reconcileProductionResources({ env: validEnv }, dependencies)).rejects.toThrow("output failed");
    expect(events.filter(([type]) => type === "write").map(([, file]) => file)).toEqual([
      tempConfigPath,
      tempSecretsPath
    ]);
    expect(events.filter(([type]) => type === "remove")).toEqual([
      ["remove", tempDirectory, { recursive: true, force: true }]
    ]);
  });

  test("uses one injected temp root for generation and failure cleanup", async () => {
    const injectedRoot = "/injected-temp";
    const injectedDirectory = `${injectedRoot}/jdconley-production-d4E5f6`;
    const injectedConfigPath = `${injectedDirectory}/wrangler.toml`;
    const { events, dependencies } = harness();
    dependencies.temp = async (root) => {
      events.push(["temp", root]);
      return injectedConfigPath;
    };
    dependencies.run = async () => { throw new Error("migration failed"); };

    await expect(reconcileProductionResources({ env: validEnv }, { ...dependencies, tempRoot: injectedRoot })).rejects.toThrow("migration failed");
    expect(events.find(([type]) => type === "temp")).toEqual(["temp", injectedRoot]);
    expect(events.filter(([type]) => type === "remove")).toEqual([
      ["remove", injectedDirectory, { recursive: true, force: true }]
    ]);
  });

  test("does not persist location state when post-import verification fails", async () => {
    const { events, dependencies } = harness({ verifiedCount: 11 });
    await expect(reconcileProductionResources({ env: validEnv }, dependencies)).rejects.toThrow(/expected 12, received 11/i);
    const commands = events.filter(([type]) => type === "run").map(([, , args]) => args.join(" "));
    expect(commands.some((command) => command.includes("INSERT INTO production_resource_state"))).toBe(false);
    expect(events.some(([type, , url]) => type === "fetch" && url.includes("/challenges/widgets"))).toBe(false);
  });

  test("skips location import and widget update when production already matches", async () => {
    const matchingWidget = { name: "A Better Time - jdconley.com", sitekey: "existing-site-key", mode: "managed", domains };
    const { events, dependencies } = harness({ widgets: [matchingWidget], state: { checksum: manifest.ndjsonSha256, row_count: 12 }, actualCount: 12 });
    const result = await reconcileProductionResources({ env: validEnv }, dependencies);
    expect(result.turnstileSiteKey).toBe("existing-site-key");
    expect(events.filter(([type, method]) => type === "fetch" && ["POST", "PUT"].includes(method))).toHaveLength(0);
    const commands = events.filter(([type]) => type === "run").map(([, , args]) => args.join(" "));
    expect(commands.some((command) => command.includes("locations:import:remote"))).toBe(false);
    expect(commands.some((command) => command.includes("INSERT INTO production_resource_state"))).toBe(false);
  });

  test("updates a mismatched widget without rotating its secret", async () => {
    const widget = { name: "A Better Time - jdconley.com", sitekey: "existing-site-key", mode: "invisible", domains: ["jdconley.com"] };
    const { events, dependencies } = harness({ widgets: [widget], state: { checksum: manifest.ndjsonSha256, row_count: 12 }, actualCount: 12 });
    await reconcileProductionResources({ env: validEnv }, dependencies);
    const update = events.find(([type, method]) => type === "fetch" && method === "PUT");
    expect(update[3]).toEqual({ name: widget.name, domains, mode: "managed" });
    expect(events.some(([type, method, url]) => type === "fetch" && method === "POST" && url.endsWith("/rotate_secret"))).toBe(false);
  });

  test("emits GitHub mask commands only inside GitHub Actions", async () => {
    const { events, dependencies } = harness({ state: { checksum: manifest.ndjsonSha256, row_count: 12 }, actualCount: 12 });
    await reconcileProductionResources({ env: { ...validEnv, GITHUB_ACTIONS: "true" } }, dependencies);
    expect(events.filter(([type]) => type === "log")).toEqual([
      ["log", "::add-mask::new-site-key"],
      ["log", "::add-mask::new-widget-secret"]
    ]);
  });

  test("rejects a malicious Turnstile site key before masking, staging secrets, or publishing outputs", async () => {
    const widget = {
      name: "A Better Time - jdconley.com",
      sitekey: "unsafe-site-key\nINJECTED=value",
      secret: "existing-widget-secret",
      mode: "managed",
      domains
    };
    const { events, dependencies } = harness({
      widgets: [widget],
      state: { checksum: manifest.ndjsonSha256, row_count: 12 },
      actualCount: 12
    });
    await expect(reconcileProductionResources({ env: { ...validEnv, GITHUB_ACTIONS: "true" } }, dependencies))
      .rejects.toThrow(/site key/i);
    expect(events.filter(([type]) => type === "write")).toHaveLength(1);
    expect(events.some(([type]) => type === "output" || type === "log")).toBe(false);
    expect(events.filter(([type]) => type === "remove")).toEqual([
      ["remove", tempDirectory, { recursive: true, force: true }]
    ]);
  });

  test("discovers D1 and Turnstile matches on later pages", async () => {
    const matchingWidget = { name: "A Better Time - jdconley.com", sitekey: "page-two-site-key", mode: "managed", domains };
    const { events, dependencies } = harness();
    const fallbackFetch = dependencies.fetch;
    dependencies.fetch = async (url, init = {}) => {
      const parsed = new URL(url);
      const page = Number(parsed.searchParams.get("page"));
      events.push(["fetch", init.method ?? "GET", url]);
      if ((init.method ?? "GET") === "GET" && parsed.pathname.endsWith("/d1/database")) {
        return cloudflareResponse(page === 2 ? [{ name: "a-better-time", uuid: databaseUuid }] : [{ name: "other" }], true, { current_page: page, total_pages: 2 });
      }
      if ((init.method ?? "GET") === "GET" && parsed.pathname.endsWith("/challenges/widgets")) {
        return cloudflareResponse(page === 2 ? [matchingWidget] : [{ name: "other" }], true, { current_page: page, total_pages: 2 });
      }
      return fallbackFetch(url, init);
    };
    const result = await reconcileProductionResources({ env: validEnv, dryRun: true }, dependencies);
    expect(result.turnstileSiteKey).toBe("page-two-site-key");
    expect(result.plannedMutations.join(" ")).not.toMatch(/Create D1|Create Turnstile/i);
    const listUrls = events.filter(([type, method]) => type === "fetch" && method === "GET").map(([, , url]) => url);
    expect(listUrls).toEqual(expect.arrayContaining([expect.stringContaining("page=1"), expect.stringContaining("page=2"), expect.stringContaining("per_page=")]));
  });

  test("rejects duplicate named resources spread across pages", async () => {
    const { dependencies } = harness();
    dependencies.fetch = async (url) => {
      const parsed = new URL(url);
      const page = Number(parsed.searchParams.get("page"));
      return cloudflareResponse([{ name: "a-better-time", uuid: `db-${page}` }], true, { page, total_pages: 2 });
    };
    await expect(reconcileProductionResources({ env: validEnv, dryRun: true }, dependencies)).rejects.toThrow(/multiple D1/i);
  });

  test("creates D1 only after every discovery page is empty, then rediscovers", async () => {
    const { events, dependencies } = harness({ state: { checksum: manifest.ndjsonSha256, row_count: 12 }, actualCount: 12 });
    const fallbackFetch = dependencies.fetch;
    let created = false;
    dependencies.fetch = async (url, init = {}) => {
      const parsed = new URL(url);
      const method = init.method ?? "GET";
      if (parsed.pathname.endsWith("/d1/database") && method === "POST") {
        created = true;
        events.push(["fetch", method, url, JSON.parse(init.body)]);
        return cloudflareResponse({ name: "a-better-time", uuid: createdDatabaseUuid });
      }
      if (parsed.pathname.endsWith("/d1/database") && method === "GET") {
        const page = Number(parsed.searchParams.get("page"));
        events.push(["fetch", method, url]);
        if (created) return cloudflareResponse([{ name: "a-better-time", uuid: createdDatabaseUuid }], true, { current_page: 1, total_pages: 1 });
        return cloudflareResponse([], true, { current_page: page, total_pages: 2 });
      }
      return fallbackFetch(url, init);
    };
    await reconcileProductionResources({ env: validEnv }, dependencies);
    const discovery = events.filter(([type, , url]) => type === "fetch" && url.includes("/d1/database"));
    expect(discovery.map(([, method, url]) => `${method}:${new URL(url).searchParams.get("page")}`)).toEqual(["GET:1", "GET:2", "POST:null", "GET:1"]);
  });

  test("dry-run discovers and reports planned mutations without local or remote writes", async () => {
    const { events, dependencies } = harness({ databases: [], widgets: [] });
    const result = await reconcileProductionResources({ env: validEnv, dryRun: true, ...dependencies });
    expect(result).toMatchObject({ dryRun: true, wranglerConfigPath: null, turnstileSiteKey: null });
    expect(result.plannedMutations).toEqual(expect.arrayContaining([expect.stringMatching(/create D1/i), expect.stringMatching(/create Turnstile/i)]));
    expect(events.filter(([type]) => ["run", "write", "temp", "output"].includes(type))).toHaveLength(0);
    expect(events.filter(([type, method]) => type === "fetch" && method !== "GET")).toHaveLength(0);
  });

  test("redacts dependency failures and does not expose secret values in logs", async () => {
    const secret = "very-secret-token-12345678901234567890";
    const { events, dependencies } = harness();
    dependencies.fetch = async () => { throw new Error(`Bearer ${secret}`); };
    await expect(reconcileProductionResources({ env: { ...validEnv, CLOUDFLARE_API_TOKEN: secret } }, dependencies)).rejects.toThrow("Bearer [REDACTED]");
    expect(JSON.stringify(events)).not.toContain(secret);
  });
});
