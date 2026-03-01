# Developing this repo

This repo powers my personal site and the “How This Is Built” logs.

## What this is

Static personal site export from Webflow, rebuilt as a monorepo app with Vite optimization, Playwright E2E, and Cloudflare Pages deployment.

## Structure

- `apps/jdconley-site/`: Static site app and deployment/testing config
- `jdconley-com.webflow.zip`: Original Webflow export source artifact

## Prerequisites

- Node.js 20+ (22 recommended)
- pnpm 10+
- Cloudflare account + Pages project (for deploy)

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
- `CLOUDFLARE_PAGES_PROJECT` (Cloudflare Pages project name)
- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`

Wrangler commands are wrapped with `dotenvx run` in pnpm scripts, so these values are loaded automatically.

## Local Wrangler Testing (Cloudflare-like)

Run a local Cloudflare Pages preview from built `dist`:

```bash
pnpm run preview:cf:site
```

Use this when you want to validate Cloudflare Pages behavior. Use `pnpm run preview:site` for faster local preview.

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

Deploy optimized `dist` from local CLI:

```bash
pnpm run logs:sync:site
pnpm run deploy:site
```

This executes:

- Vite production build
- Post-build image optimization
- `wrangler pages deploy` from `apps/jdconley-site/dist`

## GitHub Actions CI/CD

- CI workflow: `.github/workflows/ci.yml`
  - Runs on PRs and pushes to `main`
  - Installs dependencies, builds site, runs Playwright tests
- Deploy workflow: `.github/workflows/deploy.yml`
  - Runs on push to `main` (and manual dispatch)
  - Builds and deploys to Cloudflare Pages

Required GitHub configuration:

- **Repository Secrets**
  - `CLOUDFLARE_API_TOKEN`
  - `CLOUDFLARE_ACCOUNT_ID`
- **Repository Variables**
  - `CLOUDFLARE_PAGES_PROJECT`
  - `SITE_URL` (optional but recommended)

## Notes / Known limitations from Webflow export

- `401.html` contains Webflow password-protection form behavior (`/.wf_auth`) that is platform-specific and not functional as standalone static hosting authentication.

