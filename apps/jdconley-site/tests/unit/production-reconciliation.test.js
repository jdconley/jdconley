import { access, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { importLocations, parseImportArguments } from "../../scripts/import-location-index.mjs";

import {
  assertCloudflareEnvelope,
  needsLocationImport,
  needsTurnstileUpdate,
  reconcileProductionResources,
  redactError,
  renderWranglerConfig,
  selectDatabase,
  selectTurnstileWidget
} from "../../scripts/reconcile-production-resources.mjs";

const validEnv = {
  CLOUDFLARE_API_TOKEN: "cloudflare-token-value",
  CLOUDFLARE_ACCOUNT_ID: "account-id",
  SUPPORT_IP_HMAC_SECRET: "stable-hmac-secret",
  SITE_URL: "https://jdconley.com"
};
const domains = ["jdconley.com", "www.jdconley.com", "jdconley-site.jd-conley.workers.dev"];
const wranglerSource = 'name = "jdconley-site"\n[[d1_databases]]\ndatabase_name = "a-better-time"\ndatabase_id = "old-id"\n';
const manifest = { ndjsonSha256: "a".repeat(64), outputRows: { total: 12 } };

function cloudflareResponse(result, success = true) {
  return { ok: true, json: async () => ({ success, result, ...(success ? {} : { errors: result }) }) };
}

function harness({ databases = [{ name: "a-better-time", uuid: "db-id" }], widgets = [], state = null, actualCount = 0, generatedManifest = manifest, verifiedCount = manifest.outputRows.total } = {}) {
  const events = [];
  let databaseLists = 0;
  const fetch = async (url, init = {}) => {
    const method = init.method ?? "GET";
    events.push(["fetch", method, url, init.body ? JSON.parse(init.body) : undefined]);
    if (url.endsWith("/d1/database") && method === "GET") {
      databaseLists += 1;
      return cloudflareResponse(databaseLists === 1 ? databases : [{ name: "a-better-time", uuid: "created-db-id" }]);
    }
    if (url.endsWith("/d1/database") && method === "POST") return cloudflareResponse({ name: "a-better-time", uuid: "created-db-id" });
    if (url.endsWith("/challenges/widgets") && method === "GET") return cloudflareResponse(widgets);
    if (url.endsWith("/challenges/widgets") && method === "POST") return cloudflareResponse({ name: "A Better Time - jdconley.com", sitekey: "new-site-key", secret: "new-widget-secret", domains, mode: "managed" });
    if (url.includes("/challenges/widgets/") && method === "PUT") return cloudflareResponse({ name: "A Better Time - jdconley.com", sitekey: "existing-site-key", secret: "existing-widget-secret", domains, mode: "managed" });
    if (url.includes("/challenges/widgets/") && method === "GET") return cloudflareResponse({ ...widgets[0], secret: "existing-widget-secret" });
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
  const temp = async () => { events.push(["temp"]); return "/runner-temp/wrangler.production.toml"; };
  const output = async (...args) => { events.push(["output", ...args]); };
  const log = (...args) => { events.push(["log", ...args]); };
  return { events, dependencies: { fetch, run, read, write, temp, output, log } };
}

describe("production reconciliation helpers", () => {
  test("selects one named database and rejects duplicates", () => {
    expect(selectDatabase([{ name: "other" }], "a-better-time")).toBeNull();
    expect(selectDatabase([{ name: "a-better-time", uuid: "db-id" }], "a-better-time")).toEqual({ name: "a-better-time", uuid: "db-id" });
    expect(() => selectDatabase([{ name: "a-better-time" }, { name: "a-better-time" }], "a-better-time")).toThrow(/multiple/i);
  });

  test("strictly replaces the sole D1 database id without changing other TOML", () => {
    const input = "name = \"site\"\n\n[[d1_databases]]\ndatabase_name = \"a-better-time\"\ndatabase_id = \"old-id\"\n\n[vars]\nVALUE = \"database_id = untouched\"\n";
    expect(renderWranglerConfig(input, "new-id")).toBe(input.replace('database_id = "old-id"', 'database_id = "new-id"'));
    const withUnrelatedId = `${input}\n[durable_objects]\ndatabase_id = \"not-d1\"\n`;
    expect(renderWranglerConfig(withUnrelatedId, "new-id")).toBe(withUnrelatedId.replace('database_id = "old-id"', 'database_id = "new-id"'));
    expect(() => renderWranglerConfig("name = \"site\"\n", "new-id")).toThrow(/exactly one/i);
    expect(() => renderWranglerConfig("database_id = \"one\"\ndatabase_id = \"two\"\n", "new-id")).toThrow(/exactly one/i);
    expect(() => renderWranglerConfig(input, 'unsafe"\ndatabase_id = "injected')).toThrow(/invalid/i);
  });

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
});

describe("production reconciliation orchestration", () => {
  test("the location importer accepts one explicit Wrangler config", () => {
    expect(parseImportArguments(["--remote", "--config", "/tmp/production.toml"])).toEqual({
      mode: "--remote", fixtures: false, config: "/tmp/production.toml"
    });
    expect(() => parseImportArguments(["--remote", "--config"])).toThrow(/usage/i);
    expect(() => parseImportArguments(["--remote", "--config", "one", "--config", "two"])).toThrow(/usage/i);
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
  });

  test("validates all required environment before doing work", async () => {
    const { events, dependencies } = harness();
    await expect(reconcileProductionResources({ env: { ...validEnv, SITE_URL: "" } }, dependencies)).rejects.toThrow(/SITE_URL/);
    expect(events).toEqual([]);
  });

  test("rejects an unsafe generated manifest before importing", async () => {
    const { events, dependencies } = harness({ generatedManifest: { ndjsonSha256: "not-a-checksum", outputRows: { total: 12 } } });
    await expect(reconcileProductionResources({ env: validEnv }, dependencies)).rejects.toThrow(/manifest/i);
    expect(events.some(([type, _command, args]) => type === "run" && args.includes("locations:import:remote"))).toBe(false);
  });

  test("creates missing resources, imports changed locations, persists state, and publishes outputs in order", async () => {
    const { events, dependencies } = harness({ databases: [], widgets: [], state: null, actualCount: 0 });
    const result = await reconcileProductionResources({ env: validEnv }, dependencies);

    expect(result).toEqual({ wranglerConfigPath: "/runner-temp/wrangler.production.toml", turnstileSiteKey: "new-site-key" });
    const operations = events.map((event) => event[0] === "fetch" ? `${event[0]}:${event[1]}:${event[2].split("/").at(-1)}` : event[0] === "run" ? `${event[0]}:${event[2].join(" ")}` : event[0]);
    expect(operations).toEqual([
      "fetch:GET:database", "fetch:POST:database", "fetch:GET:database", "read", "temp", "write",
      expect.stringContaining("d1 migrations apply a-better-time --remote"),
      "run:run locations:build",
      "read",
      expect.stringContaining("SELECT checksum"),
      "run:run locations:import:remote -- --config /runner-temp/wrangler.production.toml",
      expect.stringContaining("SELECT COUNT(*)"),
      expect.stringContaining("INSERT INTO production_resource_state"),
      "fetch:GET:widgets", "fetch:POST:widgets", "log", "log",
      expect.stringContaining("secret bulk"), "output", "output"
    ]);
    const configWrite = events.find(([type]) => type === "write");
    expect(configWrite[2]).toContain('database_id = "created-db-id"');
    expect(configWrite[3]).toEqual({ mode: 0o600 });
    const importRun = events.find(([type, _command, args]) => type === "run" && args.includes("locations:import:remote"));
    expect(importRun[2]).toEqual(["run", "locations:import:remote", "--", "--config", result.wranglerConfigPath]);
    const secretRun = events.find(([type, _command, args]) => type === "run" && args.includes("bulk"));
    expect(secretRun[3].input).toBe(JSON.stringify({ TURNSTILE_SECRET_KEY: "new-widget-secret", SUPPORT_IP_HMAC_SECRET: "stable-hmac-secret" }));
    expect(events.filter(([type]) => type === "log")).toEqual([
      ["log", "::add-mask::new-site-key"],
      ["log", "::add-mask::new-widget-secret"]
    ]);
    const stateWrite = events.find(([type, _command, args]) => type === "run" && args.some((argument) => argument.includes?.("INSERT INTO production_resource_state")));
    expect(stateWrite[2]).toContain("--yes");
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
