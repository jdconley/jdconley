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
- Deploy via Wrangler: `pnpm run deploy:site`

## Secrets and variables
- Local `.env` should be created from `.env.example` and never committed.
- Required values:
  - `CLOUDFLARE_API_TOKEN`
  - `CLOUDFLARE_ACCOUNT_ID`
  - `VITE_SITE_URL`
- GitHub repository variable: `TURNSTILE_SITE_KEY` (public site key).
- Provision separately with `wrangler secret put`: `TURNSTILE_SECRET_KEY` and `SUPPORT_IP_HMAC_SECRET`.
- Never place Worker secret values in git, workflow YAML, or `.env.example`.

## Workflow
1. Build and run unit, Worker, site E2E, and Wrangler E2E gates.
2. Preview with `pnpm run preview:cf:site`; the Worker serves `dist` through its `ASSETS` binding.
3. Before first production deploy: create D1; immediately replace the all-zero UUID; migrate; run `locations:build`; import/verify locations; create the hostname-restricted Turnstile widget; and provision both Worker secrets.
4. Deploy only when explicitly requested. Verify the preview/`workers.dev` endpoint, then attach the apex Custom Domain and preserve the `www` path/query redirect. Keep the old Pages deployment briefly for rollback during cutover.

## Verification checklist
- `dist/` exists and contains expected static assets/pages.
- Wrangler local preview serves successfully.
- `wrangler.toml` names the Worker and binds Static Assets, D1, rate limiting, and runtime variables.
- Production D1 UUID is not the all-zero local sentinel.
- CI uses committed location fixtures/local D1 and Cloudflare's Turnstile test site key, never production D1.
- Production secrets are provisioned outside GitHub workflow source.
- After deploy, verify DNS/TLS, static assets, location search, personalized sharing, supporter/Turnstile flows, and `SUPPORT_ORIGIN` on the production hostname.
