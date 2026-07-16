---
name: cloudflare-workers-ops
description: Use when operating or troubleshooting this repository's Cloudflare Worker, Wrangler previews or deploys, D1 data, Turnstile configuration, bindings, secrets, or CI delivery.
---
# Cloudflare Workers Ops

## When to use
- Worker or Static Assets preview/deploy work.
- Wrangler, D1, Turnstile, bindings, variables, or secrets work.
- CI/CD delivery or production provisioning work.

## Primary paths
- App package: `apps/jdconley-site/package.json`
- Wrangler config: `apps/jdconley-site/wrangler.toml`
- Local env template: `apps/jdconley-site/.env.example`
- CI/CD workflows: `.github/workflows/ci.yml`, `.github/workflows/deploy.yml`

## Commands
- Local Vite preview: `pnpm run preview:site`
- Local Worker preview: `pnpm run preview:cf:site`
- Local Worker E2E: `pnpm run test:e2e:wrangler:site`
- Direct local Worker deploy without reconciliation: `pnpm run deploy:site`
- Production delivery: merge a fully gated commit to `main`; `.github/workflows/deploy.yml` reconciles, deploys, verifies, and cleans up.

## Secrets and variables
- Local `.env` should be created from `.env.example` and never committed.
- Production reconciliation inputs:
  - `CLOUDFLARE_API_TOKEN`
  - `CLOUDFLARE_ACCOUNT_ID`
  - `SUPPORT_IP_HMAC_SECRET` (stable, at least 32 characters; prefer random ASCII/base64 with no control characters)
  - `SITE_URL=https://jdconley.com`
- Build input: `VITE_SITE_URL`; local Worker input: `TURNSTILE_SITE_KEY` plus `SUPPORT_ORIGIN`.
- GitHub secrets: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `SUPPORT_IP_HMAC_SECRET`.
- GitHub variable: optional `SITE_URL`, defaulting to `https://jdconley.com`.
- The reconciler reads the Turnstile secret from Cloudflare and stages it with the stable HMAC secret for `wrangler deploy --secrets-file`. Do not rotate the HMAC secret or run routine `wrangler secret put`; rotation breaks continuity with stored supporter IP HMACs.
- Never place secret values in git, workflow YAML, or `.env.example`. Prefer `op run` with `op://` references for manual commands.

## Cloudflare token scope
- Restrict the token to the production account.
- D1 Edit / `D1 Write`: list/create D1, apply migrations, query/import, and update reconciliation state.
- Turnstile Edit / `Turnstile Sites Write`: list/read/create/update the widget; secret rotation is not used.
- Workers Scripts Edit / `Workers Scripts Write`: deploy Worker code/assets, bindings, secrets, and Custom Domains.
- Do not add Pages, KV, R2, DNS, Workers Routes, Account Settings, or user permissions for the current workflow.

## Workflow
1. Build and run unit, Worker, site E2E, and Wrangler E2E gates.
2. Preview with `pnpm run preview:cf:site`; the Worker serves `dist` through `ASSETS` and runs first for configured tool/API paths.
3. A successful same-repository `main` push triggers deploy only after CI; the workflow checks the triggering SHA against current `origin/main` before reconciliation and before deploy.
4. Reconciliation discovers/creates D1, writes a temporary config, migrates, checksum/count-gates the location import through `production_resource_state`, reconciles Turnstile, and writes a mode-`0600` secrets file.
5. Deploy that config and secrets file atomically, run `production:verify`, then always run `production:reconcile:cleanup`. Cloudflare Pages is obsolete for this site.

## Manual recovery commands
- Run `op whoami` before `op run`. Use desktop integration directly without tmux; for standalone sign-in, apply `eval "$(op signin --account <account>)"` and keep that authenticated shell/session alive through reconcile, deploy, verify, and cleanup.
- Build current canonical assets first: `VITE_SITE_URL="$SITE_URL" pnpm run build:site`.
- Plan only: `pnpm --filter @jdconley/jdconley-site run production:reconcile:dry-run`.
- Reconcile: `pnpm --filter @jdconley/jdconley-site run production:reconcile` (set `GITHUB_OUTPUT` to a protected temp file to capture config/secrets/site-key paths).
- Verify: `pnpm --filter @jdconley/jdconley-site run production:verify` with `SITE_URL` and `TURNSTILE_SITE_KEY`.
- Cleanup: `pnpm --filter @jdconley/jdconley-site run production:reconcile:cleanup <absolute-generated-wrangler-path>`.
- Install an EXIT/signal trap immediately after creating the output file; it must recover the config path when available, run the cleanup command quietly, and delete the output file on deploy/verify failure or interruption. Explicitly clean and disarm the trap only after a successful verification.
- Reconciliation failure cleans generated files, but earlier D1/widget mutations can persist; fix and rerun. Worker rollback does not reverse D1 migrations or imports.

## Verification checklist
- `dist/` exists and contains expected static assets/pages.
- Wrangler local preview serves successfully.
- `wrangler.toml` names the Worker and binds Static Assets, D1, rate limiting, and runtime variables.
- Production reconciliation selects exactly one named D1 resource and keeps generated config/secrets files under the runner/OS temp root with mode `0600`.
- CI uses committed location fixtures/local D1 and Cloudflare's Turnstile test site key, never production D1.
- GitHub has all three required secrets and the API token has only the three production permissions above.
- Location state checksum, recorded row count, and actual row count agree after reconciliation.
- Production secrets are supplied through GitHub secret storage and the generated deploy secrets file, never workflow source.
- After deploy, verify DNS/TLS, static assets, location search, personalized sharing, supporter/Turnstile flows, and `SUPPORT_ORIGIN` on the production hostname.
