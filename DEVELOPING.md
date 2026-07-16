# Developing this repo

This repo powers my personal site and the “How This Is Built” logs.

## What this is

Static personal site export from Webflow, rebuilt as a monorepo app with Vite optimization, Playwright E2E, and a Cloudflare Worker with Static Assets and D1.

## Structure

- `apps/jdconley-site/`: Static site app and deployment/testing config
- `jdconley-com.webflow.zip`: Original Webflow export source artifact

## Prerequisites

- Node.js 20+ (22 recommended)
- pnpm 10+
- Cloudflare account (for production Worker provisioning/deploy)

## Install

```bash
pnpm install
```

If pnpm asks to approve build scripts, run:

```bash
pnpm approve-builds
```

Then approve `esbuild`, `sharp`, and `workerd`.

## Local Development

Run Vite dev server:

```bash
pnpm run dev:site
```

Build optimized production output:

```bash
pnpm run build:site
```

Preview optimized output:

```bash
pnpm run preview:site
```

## How This Is Built Logs

Generate publishable build logs (plan + Cursor transcripts):

```bash
pnpm run logs:sync:site
```

This command:

- Reads parent Cursor transcripts from `.cursor` project transcripts
- Reads the plan source used for this build
- Redacts obvious local paths and token-like values
- Writes time-ordered markdown logs to `apps/jdconley-site/public/how-this-is-built/logs/`
- Writes `index.json` manifest for the logs page

Published URLs after build/deploy:

- `/how-this-is-built`
- `/how-this-is-built/logs/<timestamped-file>.md`

## dotenvx Local Secrets

Create a local env file:

```bash
cp apps/jdconley-site/.env.example apps/jdconley-site/.env
```

Set values in `apps/jdconley-site/.env`:

- `VITE_SITE_URL` (example: `https://jdconley.com`)
- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`
- `TURNSTILE_SITE_KEY` (public site key; production deploys read this from a GitHub repository variable)
- `SUPPORT_ORIGIN` (defaults to `https://jdconley.com`)

Wrangler commands are wrapped with `dotenvx run` in pnpm scripts, so these values are loaded automatically.

`TURNSTILE_SECRET_KEY` and `SUPPORT_IP_HMAC_SECRET` are Worker secrets. Provision them with Wrangler; never store them in `.env.example`, workflow YAML, or git.

## Local Wrangler Testing

Run the Worker locally with its Static Assets, local D1, bindings, and request routing:

```bash
pnpm run preview:cf:site
```

Use `pnpm run preview:site` for a faster static preview. For deterministic local location data:

```bash
pnpm --filter @jdconley/jdconley-site run db:migrate:local
pnpm --filter @jdconley/jdconley-site run locations:import:local -- --fixtures
```

Worker tests use isolated local D1 databases and committed `data/location-fixtures.json`; CI never connects to production D1. CI also uses Cloudflare's always-pass Turnstile test site key.

## E2E Tests (Playwright)

Run smoke tests against Vite preview:

```bash
pnpm run test:e2e:site
```

Run smoke tests against local Wrangler runtime:

```bash
pnpm run test:e2e:wrangler:site
```

## Cloudflare Deploy (CLI)

First-time production provisioning:

```bash
pnpm --filter @jdconley/jdconley-site exec wrangler d1 create a-better-time
```

The D1 create command returns a production UUID. Immediately replace the all-zero `database_id` sentinel in `apps/jdconley-site/wrangler.toml` with that UUID and commit the config. Then continue:

```bash
pnpm --filter @jdconley/jdconley-site exec wrangler d1 migrations apply a-better-time --remote
pnpm --filter @jdconley/jdconley-site run locations:build
pnpm --filter @jdconley/jdconley-site run locations:import:remote
pnpm --filter @jdconley/jdconley-site exec wrangler secret put TURNSTILE_SECRET_KEY
pnpm --filter @jdconley/jdconley-site exec wrangler secret put SUPPORT_IP_HMAC_SECRET
pnpm run deploy:site
```

`locations:build` downloads the checksum-pinned public sources before import. Verify the remote migration/import row counts and a representative location query before deploying. Rotating `SUPPORT_IP_HMAC_SECRET` intentionally resets supporter duplicate identity because existing IP hashes can no longer match.

Create a Cloudflare Turnstile widget for `jdconley.com` (plus any intended preview hostname). Store its public key in the GitHub repository variable `TURNSTILE_SITE_KEY`; enter its secret only through the Wrangler command above. Cloudflare test keys are for CI/local testing only. The deploy workflow validates that the repository variable is non-empty and well formed before Wrangler runs.

First deploy and verify the Worker on its preview/`workers.dev` endpoint. Then attach `jdconley.com` as a Custom Domain for cutover. Preserve and verify the existing `www.jdconley.com` redirect to the canonical apex, including path and query. Keep the former Pages deployment available briefly for rollback, verify DNS/TLS and the Worker route, then smoke-test static assets, personalized metadata/image, location search, supporter count/submission, Turnstile, and the `SUPPORT_ORIGIN` binding on the production hostname.

For later deployments:

```bash
pnpm run logs:sync:site
pnpm run deploy:site
```

This executes:

- Vite production build
- Post-build image optimization
- `wrangler deploy` for `apps/jdconley-site/worker/index.js`, with `dist` served by the Worker Static Assets binding

## GitHub Actions CI/CD

- CI workflow: `.github/workflows/ci.yml`
  - Runs on PRs and pushes to `main`
  - Frozen install, build, unit tests, Worker tests, site E2E, then Wrangler E2E
  - Uses committed fixture locations, local D1, and the Turnstile test site key
- Deploy workflow: `.github/workflows/deploy.yml`
  - Runs on push to `main` (and manual dispatch)
  - Builds and deploys the Cloudflare Worker with Wrangler

Required GitHub configuration:

- **Repository Secrets**
  - `CLOUDFLARE_API_TOKEN`
  - `CLOUDFLARE_ACCOUNT_ID`
- **Repository Variables**
  - `TURNSTILE_SITE_KEY`
  - `SITE_URL` (optional but recommended)

`TURNSTILE_SECRET_KEY` and `SUPPORT_IP_HMAC_SECRET` must be provisioned directly as Worker secrets outside the workflow. The workflow never contains their values.

## Notes / Known limitations from Webflow export

- `401.html` contains Webflow password-protection form behavior (`/.wf_auth`) that is platform-specific and not functional as standalone static hosting authentication.
