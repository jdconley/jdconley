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
});
