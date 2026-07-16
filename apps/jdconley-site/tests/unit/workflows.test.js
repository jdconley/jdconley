import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const root = new URL("../../../../", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8");

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

  it("deploys only the successful current main commit from CI", () => {
    const workflow = read(".github/workflows/deploy.yml");
    expect(workflow).toContain("workflow_run:");
    expect(workflow).toContain('workflows: ["CI"]');
    expect(workflow).toContain("types: [completed]");
    expect(workflow).not.toContain("workflow_dispatch:");
    expect(workflow).not.toMatch(/\n\s+push:/u);
    expect(workflow).toContain("github.event.workflow_run.conclusion == 'success'");
    expect(workflow).toContain("github.event.workflow_run.head_branch == 'main'");
    expect(workflow).toContain("ref: ${{ github.event.workflow_run.head_sha }}");
    expect(workflow).toContain("origin main:refs/remotes/origin/main");
    expect(workflow).toContain('git rev-parse "origin/main"');
    expect(workflow).toContain("github.event.workflow_run.head_sha");
  });

  it("serializes production and pins the reviewed Wrangler action commit", () => {
    const workflow = read(".github/workflows/deploy.yml");
    expect(workflow).toMatch(/concurrency:\s*\n\s+group: production-worker-deploy\s*\n\s+cancel-in-progress: false/u);
    expect(workflow).toContain(
      "cloudflare/wrangler-action@9acf94ace14e7dc412b076f2c5c20b8ce93c79cd # v3"
    );
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

  it("validates every production secret before reconciliation can mutate Cloudflare", () => {
    const workflow = read(".github/workflows/deploy.yml");
    for (const name of [
      "CLOUDFLARE_API_TOKEN",
      "CLOUDFLARE_ACCOUNT_ID",
      "SUPPORT_IP_HMAC_SECRET"
    ]) {
      expect(workflow).toContain(`${name}: \${{ secrets.${name} }}`);
      expect(workflow).toContain(`\"${name}\"`);
    }

    expect(workflow.indexOf("Reject stale successful CI completion")).toBeLessThan(
      workflow.indexOf("Validate production secrets")
    );
    expect(workflow.indexOf("Validate production secrets")).toBeLessThan(
      workflow.indexOf("pnpm run production:reconcile")
    );
  });

  it("reconciles, deploys the discovered configuration, verifies production, and always cleans up", () => {
    const workflow = read(".github/workflows/deploy.yml");
    const reconcile = workflow.indexOf("pnpm run production:reconcile");
    const deploy = workflow.indexOf("- name: Deploy Cloudflare Worker");
    const verify = workflow.indexOf("pnpm run production:verify");
    const cleanup = workflow.indexOf("pnpm run production:reconcile:cleanup");

    expect(reconcile).toBeGreaterThan(-1);
    expect(reconcile).toBeLessThan(deploy);
    expect(deploy).toBeLessThan(verify);
    expect(verify).toBeLessThan(cleanup);
    expect(workflow).toContain("config_path=${{ steps.reconcile.outputs.WRANGLER_CONFIG }}");
    expect(workflow).toContain("turnstile_site_key=${{ steps.reconcile.outputs.TURNSTILE_SITE_KEY }}");
    expect(workflow).toContain("${{ steps.production.outputs.config_path }}");
    expect(workflow).toContain("${{ steps.production.outputs.turnstile_site_key }}");
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
  });
});
