---
name: cloudflare-pages-ops
description: Operates and troubleshoots Cloudflare Pages workflows for this repo, including local Wrangler preview, dotenvx secrets use, and production deployment via Wrangler and GitHub Actions.
---
# Cloudflare Pages Ops

## When to use
- User asks to deploy to Cloudflare Pages.
- User reports Wrangler or Pages preview/deploy issues.
- User asks about Cloudflare secrets, variables, or CI deploy setup.

## Primary paths
- App package: `apps/jdconley-site/package.json`
- Wrangler config: `apps/jdconley-site/wrangler.toml`
- Local env template: `apps/jdconley-site/.env.example`
- CI/CD workflows: `.github/workflows/ci.yml`, `.github/workflows/deploy.yml`

## Commands
- Local Vite preview: `pnpm run preview:site`
- Local Cloudflare-like preview: `pnpm run preview:cf:site`
- Deploy via Wrangler: `pnpm run deploy:site`

## Secrets and variables
- Local `.env` should be created from `.env.example` and never committed.
- Required values:
  - `CLOUDFLARE_API_TOKEN`
  - `CLOUDFLARE_ACCOUNT_ID`
  - `CLOUDFLARE_PAGES_PROJECT`
  - `VITE_SITE_URL`

## Workflow
1. Confirm build health: `pnpm run build:site`
2. Confirm local parity:
   - `pnpm run preview:site`
   - `pnpm run preview:cf:site`
3. Deploy via `pnpm run deploy:site` or GitHub Actions on `main`.

## Verification checklist
- `dist/` exists and contains expected static assets/pages.
- Wrangler local preview serves successfully.
- Deploy command targets `dist` and correct project name.
