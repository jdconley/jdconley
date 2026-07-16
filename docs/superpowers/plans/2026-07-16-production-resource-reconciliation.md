# Production Resource Reconciliation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reconcile all Cloudflare resources required by the production Worker after every successful current-`main` CI run, then deploy and smoke-test production.

**Architecture:** A focused Node reconciler exposes pure decision/configuration helpers and an injectable orchestration entry point. GitHub Actions supplies stable secrets, calls reconciliation before deploy, and verifies production after deploy; D1 stores the imported location checksum so the destructive import runs only when required.

**Tech Stack:** Node.js ESM, Vitest, Wrangler 4, Cloudflare REST API, D1, Turnstile, GitHub Actions, pnpm.

---

## File structure

- `apps/jdconley-site/migrations/0003_production_resource_state.sql`: durable checksum/row-count state for production data imports.
- `apps/jdconley-site/scripts/reconcile-production-resources.mjs`: pure reconciliation helpers plus injectable CLI orchestration.
- `apps/jdconley-site/scripts/verify-production.mjs`: production HTTP smoke verifier with injectable fetch.
- `apps/jdconley-site/tests/unit/production-reconciliation.test.js`: pure helper/orchestration tests.
- `apps/jdconley-site/tests/unit/production-verification.test.js`: smoke verifier tests.
- `apps/jdconley-site/tests/worker/locations.test.js`: migration-upgrade coverage for the state table.
- `.github/workflows/deploy.yml`: gated reconciliation, deploy, and verification sequence.
- `apps/jdconley-site/package.json`: named reconciliation and production verification commands.
- `DEVELOPING.md`, `.agents/skills/cloudflare-workers-ops/SKILL.md`, `apps/jdconley-site/.env.example`: operator documentation and secret contract.

### Task 1: Add durable location import state

**Files:**
- Create: `apps/jdconley-site/migrations/0003_production_resource_state.sql`
- Modify: `apps/jdconley-site/tests/worker/locations.test.js`

- [ ] **Step 1: Write the failing migration test**

Add a test that applies migrations 0001 and 0002, inserts one location and one supporter, applies 0003, then asserts `production_resource_state` exists while both rows remain.

- [ ] **Step 2: Run the Worker test and confirm red**

Run: `pnpm --filter @jdconley/jdconley-site run test:worker`

Expected: FAIL because migration 0003/state table does not exist.

- [ ] **Step 3: Add the migration**

```sql
CREATE TABLE production_resource_state (
  resource_name TEXT PRIMARY KEY,
  checksum TEXT NOT NULL CHECK(length(checksum) = 64),
  row_count INTEGER NOT NULL CHECK(row_count >= 0),
  updated_at TEXT NOT NULL
);
```

- [ ] **Step 4: Run Worker tests and confirm green**

Run: `pnpm --filter @jdconley/jdconley-site run test:worker`

Expected: all Worker tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/jdconley-site/migrations/0003_production_resource_state.sql apps/jdconley-site/tests/worker/locations.test.js
git commit -m "feat: track production resource state"
```

### Task 2: Build the idempotent Cloudflare reconciler

**Files:**
- Create: `apps/jdconley-site/scripts/reconcile-production-resources.mjs`
- Create: `apps/jdconley-site/tests/unit/production-reconciliation.test.js`
- Modify: `apps/jdconley-site/package.json`

- [ ] **Step 1: Write failing pure-helper tests**

Cover:

- selecting exactly one named D1 database and rejecting duplicates;
- replacing the D1 UUID in a temporary Wrangler config without changing other bindings;
- deciding to import when checksum/count differ and skip when both match;
- selecting or creating the named Turnstile widget;
- deciding to update mode/domains without rotating its secret;
- validating Cloudflare envelopes and redacting bearer/token-shaped values from errors.

- [ ] **Step 2: Run the unit tests and confirm red**

Run: `pnpm --filter @jdconley/jdconley-site run test:unit -- tests/unit/production-reconciliation.test.js`

Expected: FAIL because the reconciler module does not exist.

- [ ] **Step 3: Implement pure helpers**

Export `selectDatabase`, `renderWranglerConfig`, `needsLocationImport`, `selectTurnstileWidget`, `needsTurnstileUpdate`, `assertCloudflareEnvelope`, and `redactError` with strict validation and no environment access.

- [ ] **Step 4: Write failing orchestration tests**

Inject fake `fetch`, `run`, `readFile`, `writeFile`, and `setOutput` functions. Assert this order:

1. validate inputs;
2. discover/create D1;
3. write temporary config;
4. apply migrations;
5. build location index;
6. query state/count;
7. import and record state only when needed;
8. discover/create/update Turnstile;
9. bulk-upload both Worker secrets through stdin;
10. emit masked site key/config path outputs.

- [ ] **Step 5: Implement orchestration and CLI**

Use Cloudflare REST for D1/Turnstile discovery and Wrangler subprocesses for migrations, D1 execute/import, secret bulk, and deploy configuration. Create temporary files with `0600`, delete them in `finally`, emit `::add-mask::` for site/secret values under GitHub Actions, and support `--dry-run` that performs discovery/planning without writes.

- [ ] **Step 6: Run unit tests and confirm green**

Run: `pnpm --filter @jdconley/jdconley-site run test:unit`

Expected: all unit tests pass.

- [ ] **Step 7: Add scripts and commit**

Add `production:reconcile` and `production:reconcile:dry-run` package commands, then commit:

```bash
git add apps/jdconley-site/scripts/reconcile-production-resources.mjs apps/jdconley-site/tests/unit/production-reconciliation.test.js apps/jdconley-site/package.json
git commit -m "feat: reconcile Cloudflare production resources"
```

### Task 3: Add production smoke verification

**Files:**
- Create: `apps/jdconley-site/scripts/verify-production.mjs`
- Create: `apps/jdconley-site/tests/unit/production-verification.test.js`
- Modify: `apps/jdconley-site/package.json`

- [ ] **Step 1: Write failing verifier tests**

With an injected fake fetch, test successful apex/tool responses, exact `www` redirect preservation, ZIP result, supporter count, versioned PNG redirect/body, site-key injection, invalid Turnstile rejection, and unchanged supporter count. Add one failure case per response family with concise diagnostics.

- [ ] **Step 2: Run verifier tests and confirm red**

Run: `pnpm --filter @jdconley/jdconley-site run test:unit -- tests/unit/production-verification.test.js`

Expected: FAIL because the verifier module does not exist.

- [ ] **Step 3: Implement verifier**

Export `verifyProduction({ fetchImpl, origin, siteKey })`; do not create a supporter. The invalid token probe must use `Origin: <apex>`, expect `403`/`turnstile_failed`, and compare public counts before/after.

- [ ] **Step 4: Run unit tests and confirm green**

Run: `pnpm --filter @jdconley/jdconley-site run test:unit`

Expected: all unit tests pass.

- [ ] **Step 5: Add `production:verify` and commit**

```bash
git add apps/jdconley-site/scripts/verify-production.mjs apps/jdconley-site/tests/unit/production-verification.test.js apps/jdconley-site/package.json
git commit -m "test: verify production Worker resources"
```

### Task 4: Wire reconciliation into gated delivery

**Files:**
- Modify: `.github/workflows/deploy.yml`
- Modify: `apps/jdconley-site/tests/unit/workflows.test.js`

- [ ] **Step 1: Write failing workflow-contract tests**

Assert the workflow still uses `workflow_run`, success/current-main guards, serialized concurrency, frozen install, and read-only repository permissions. Add assertions for required GitHub secrets, reconciliation before deploy, discovered output use in deploy, and production verification after deploy.

- [ ] **Step 2: Run workflow tests and confirm red**

Run: `pnpm --filter @jdconley/jdconley-site run test:unit -- tests/unit/workflows.test.js`

Expected: FAIL because reconciliation/verification steps and the stable HMAC secret are absent.

- [ ] **Step 3: Update deploy workflow**

Set job-level `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, and `SUPPORT_IP_HMAC_SECRET` from GitHub secrets. Validate all three, run `production:reconcile`, deploy with the reconciler's temporary config/site-key outputs, and run `production:verify`. Keep the SHA guard before mutations.

- [ ] **Step 4: Validate workflow syntax and tests**

Run:

```bash
pnpm --filter @jdconley/jdconley-site run test:unit
pnpm dlx yaml-lint .github/workflows/deploy.yml
```

Expected: unit tests pass and workflow YAML parses successfully (use an available YAML parser if the package command differs).

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/deploy.yml apps/jdconley-site/tests/unit/workflows.test.js
git commit -m "ci: reconcile production resources before deploy"
```

### Task 5: Document, provision stable secret, and release

**Files:**
- Modify: `DEVELOPING.md`
- Modify: `.agents/skills/cloudflare-workers-ops/SKILL.md`
- Modify: `apps/jdconley-site/.env.example`

- [ ] **Step 1: Update operator documentation**

Document `SUPPORT_IP_HMAC_SECRET`, checksum-gated imports, dry-run/manual recovery, Cloudflare token permissions, and the prohibition on rotating the HMAC secret during routine deploys.

- [ ] **Step 2: Run the full local release gates**

```bash
pnpm install --frozen-lockfile
pnpm run build:site
pnpm run test:unit:site
pnpm run test:worker:site
pnpm run test:e2e:site
pnpm run test:e2e:wrangler:site
git diff --check
```

Expected: every command exits 0.

- [ ] **Step 3: Provision the stable GitHub secret**

The production supporter table is empty and the current Worker HMAC secret is write-only, so generate a new 32-byte value once, set GitHub `SUPPORT_IP_HMAC_SECRET`, and immediately bulk-upload the same value to the Worker. Never print it. Subsequent deployments must only reuse this GitHub secret and must never generate or rotate it automatically.

- [ ] **Step 4: Run a real dry-run reconciliation**

Execute `pnpm --filter @jdconley/jdconley-site run production:reconcile:dry-run` with Cloudflare credentials injected from 1Password. Expected plan: existing D1/widget/domains discovered, migrations safe, location import skipped when checksum/count match, no mutations.

- [ ] **Step 5: Commit docs, merge, and push**

```bash
git add DEVELOPING.md .agents/skills/cloudflare-workers-ops/SKILL.md apps/jdconley-site/.env.example
git commit -m "docs: explain automated production reconciliation"
```

Merge the verified branch to `main`, push, monitor CI and Deploy, and confirm the first recurring reconciliation succeeds against the current production resources.
