import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = new URL("../../../../", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8");
const parse = (path) => JSON.parse(execFileSync("ruby", [
  "-ryaml", "-rjson", "-e",
  "document = YAML.safe_load(File.read(ARGV.fetch(0)), aliases: true); puts JSON.generate(document)",
  fileURLToPath(new URL(path, root))
], { encoding: "utf8" }));
const deploy = () => parse(".github/workflows/deploy.yml").jobs.deploy;
const stepMap = (job) => Object.fromEntries(job.steps.map((step) => [step.name, step]));

describe("production workflow contracts", () => {
  it("makes Wrangler E2E self-contained and pins the tested Wrangler runtime", () => {
    const packageJson = JSON.parse(read("apps/jdconley-site/package.json"));
    expect(packageJson.scripts["test:e2e:wrangler"]).toContain(
      "TURNSTILE_SITE_KEY=1x00000000000000000000AA"
    );
    expect(packageJson.devDependencies.wrangler).toBe("4.111.0");
  });

  it("grants read-only repository contents to CI and deploy", () => {
    for (const path of [".github/workflows/ci.yml", ".github/workflows/deploy.yml"]) {
      expect(read(path)).toMatch(/permissions:\s*\n\s+contents: read/u);
    }
  });

  it("parses the deploy workflow and validates every shell run block", () => {
    const job = deploy();
    expect(job.steps.length).toBeGreaterThan(0);
    for (const step of job.steps.filter(({ run }) => run)) {
      expect(() => execFileSync("bash", ["-n"], { input: step.run, encoding: "utf8" }), step.name).not.toThrow();
    }
  });

  it("deploys only a successful same-repository push for the current main commit", () => {
    const workflow = read(".github/workflows/deploy.yml");
    const job = deploy();
    expect(workflow).toContain("workflow_run:");
    expect(workflow).toContain('workflows: ["CI"]');
    expect(workflow).toContain("types: [completed]");
    expect(workflow).not.toContain("workflow_dispatch:");
    expect(workflow).not.toMatch(/\n\s+push:/u);
    expect(job.if).toContain("github.event.workflow_run.conclusion == 'success'");
    expect(job.if).toContain("github.event.workflow_run.head_branch == 'main'");
    expect(job.if).toContain("github.event.workflow_run.event == 'push'");
    expect(job.if).toContain("github.event.workflow_run.head_repository.full_name == github.repository");
    expect(workflow).toContain("ref: ${{ github.event.workflow_run.head_sha }}");
    expect(workflow).toContain("origin main:refs/remotes/origin/main");
    expect(workflow).toContain('git rev-parse "origin/main"');
    expect(workflow).toContain("github.event.workflow_run.head_sha");
  });

  it("serializes production and pins every action to an immutable reviewed commit", () => {
    const workflow = read(".github/workflows/deploy.yml");
    const actionSteps = deploy().steps.filter((step) => step.uses);
    expect(workflow).toMatch(/concurrency:\s*\n\s+group: production-worker-deploy\s*\n\s+cancel-in-progress: false/u);
    expect(actionSteps.map(({ uses }) => uses)).toEqual([
      "actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5",
      "pnpm/action-setup@b906affcce14559ad1aafd4ab0e942779e9f58b1",
      "actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020",
      "cloudflare/wrangler-action@9acf94ace14e7dc412b076f2c5c20b8ce93c79cd"
    ]);
    expect(actionSteps.every(({ uses }) => /@[0-9a-f]{40}$/u.test(uses))).toBe(true);
    expect(workflow).toContain("# v4.3.1");
    expect(workflow).toContain("# v4.3.0");
    expect(workflow).toContain("# v4.4.0");
    expect(workflow).toContain("# v3");
  });

  it("keeps frozen installation and the successful CI build/test gate ahead of delivery", () => {
    const workflow = read(".github/workflows/deploy.yml");
    expect(workflow).toContain("pnpm install --frozen-lockfile");
    expect(workflow).toContain("pnpm run build:site");
    expect(workflow.indexOf("pnpm install --frozen-lockfile")).toBeLessThan(
      workflow.indexOf("pnpm run build:site")
    );
    expect(workflow.indexOf("pnpm run build:site")).toBeLessThan(
      workflow.indexOf("pnpm run production:reconcile")
    );
  });

  it("scopes production secrets only to validation, reconciliation, and deploy inputs", () => {
    const job = deploy();
    const steps = stepMap(job);
    const secrets = {
      CLOUDFLARE_API_TOKEN: "${{ secrets.CLOUDFLARE_API_TOKEN }}",
      CLOUDFLARE_ACCOUNT_ID: "${{ secrets.CLOUDFLARE_ACCOUNT_ID }}",
      SUPPORT_IP_HMAC_SECRET: "${{ secrets.SUPPORT_IP_HMAC_SECRET }}"
    };
    expect(job.env).toEqual({
      SITE_URL: "${{ vars.SITE_URL || 'https://jdconley.com' }}",
      VITE_SITE_URL: "${{ vars.SITE_URL || 'https://jdconley.com' }}"
    });
    expect(steps["Validate production secrets"].env).toEqual(secrets);
    expect(steps["Reconcile production resources"].env).toEqual(secrets);
    expect(steps["Deploy Cloudflare Worker"].with.apiToken).toBe(secrets.CLOUDFLARE_API_TOKEN);
    expect(steps["Deploy Cloudflare Worker"].with.accountId).toBe(secrets.CLOUDFLARE_ACCOUNT_ID);
    for (const name of ["Checkout", "Setup pnpm", "Setup Node.js", "Install dependencies", "Build site", "Verify production", "Cleanup reconciled configuration"]) {
      expect(JSON.stringify(steps[name])).not.toContain("secrets.");
    }
  });

  it("reconciles, deploys the discovered configuration, verifies production, and always cleans up", () => {
    const workflow = read(".github/workflows/deploy.yml");
    const job = deploy();
    const steps = stepMap(job);
    const names = job.steps.map(({ name }) => name);
    const reconcile = names.indexOf("Reconcile production resources");
    const deployWorker = names.indexOf("Deploy Cloudflare Worker");
    expect(names[reconcile - 1]).toBe("Reject stale main before reconciliation");
    expect(names.slice(reconcile, deployWorker + 1)).toEqual([
      "Reconcile production resources",
      "Capture reconciliation outputs",
      "Deploy Cloudflare Worker"
    ]);
    expect(names.indexOf("Deploy Cloudflare Worker")).toBeLessThan(names.indexOf("Verify production"));
    expect(names.indexOf("Verify production")).toBeLessThan(names.indexOf("Cleanup reconciled configuration"));
    const staleGuards = job.steps.filter(({ run, env }) =>
      env?.EXPECTED_SHA === "${{ github.event.workflow_run.head_sha }}" &&
      run?.includes("origin main:refs/remotes/origin/main") &&
      run?.includes('git rev-parse "origin/main"')
    );
    expect(staleGuards.map(({ name }) => name)).toEqual([
      "Reject stale successful CI completion",
      "Reject stale main before reconciliation"
    ]);
    for (const name of staleGuards.map(({ name }) => name)) {
      expect(steps[name].run).toContain("origin main:refs/remotes/origin/main");
      expect(steps[name].run).toContain('git rev-parse "origin/main"');
      expect(steps[name].env.EXPECTED_SHA).toBe("${{ github.event.workflow_run.head_sha }}");
    }
    expect(steps["Capture reconciliation outputs"].run).toContain('config_path=$CONFIG_PATH');
    expect(steps["Capture reconciliation outputs"].run).toContain('secrets_file=$SECRETS_FILE');
    expect(steps["Capture reconciliation outputs"].run).toContain('turnstile_site_key=$TURNSTILE_SITE_KEY');
    expect(steps["Capture reconciliation outputs"].run).not.toContain("${{ steps.");
    expect(steps["Deploy Cloudflare Worker"].with.command).toContain('--secrets-file "${{ steps.production.outputs.secrets_file }}"');
    expect(workflow).toMatch(/command: >-\s+deploy\s+--config/u);
    expect(workflow).toMatch(/- name: Cleanup reconciled configuration\s+if: always\(\)/u);
    expect(workflow).toContain("continue-on-error: ${{ job.status != 'success' }}");
    expect(workflow).toContain(
      "CONFIG_PATH: ${{ steps.production.outputs.config_path || steps.reconcile.outputs.WRANGLER_CONFIG }}"
    );
    expect(workflow).toContain('[[ -n "$CONFIG_PATH" ]]');
    expect(workflow).toContain('pnpm run production:reconcile:cleanup "$CONFIG_PATH"');
    expect(workflow).not.toContain('production:reconcile:cleanup -- "$CONFIG_PATH"');
    expect(workflow).not.toMatch(/cloudflare\/pages-action|wrangler pages deploy|projectName:/u);
    expect(read("DEVELOPING.md")).not.toContain("Rechecks the triggering SHA before reconciliation and again before deployment");
  });
});
