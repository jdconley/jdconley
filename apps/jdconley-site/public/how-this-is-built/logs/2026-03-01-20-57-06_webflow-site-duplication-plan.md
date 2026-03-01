---
title: "Webflow Site Duplication Plan"
sourceType: plan
sourcePath: "[REDACTED_LOCAL_PATH]"
timestampSortable: "2026-03-01-20-57-06"
timestampIOS: "Mar 1, 2026 at 12:57 PM"
---

# Webflow Site Duplication Plan

- Source: [REDACTED_LOCAL_PATH]
- Timestamp (iOS): Mar 1, 2026 at 12:57 PM

## Plan Content

---
name: Webflow Site Duplication
overview: Duplicate the Webflow export into a monorepo subdirectory, add Vite optimization, Playwright E2E, dotenvx-managed secrets, and GitHub Actions CI/CD for Cloudflare deployment.
todos:
  - id: scaffold-monorepo
    content: Create monorepo layout and place site under `apps/jdconley-site/`
    status: completed
  - id: normalize-static-pages
    content: Adjust canonical/metadata links and document 401/Webflow-specific limitations
    status: completed
  - id: setup-vite-optimization
    content: Configure Vite multi-page production build and asset optimization outputting to `dist/`
    status: completed
  - id: setup-playwright-e2e
    content: Add Playwright E2E tests for critical pages and core user-visible content
    status: completed
  - id: setup-dotenvx-secrets
    content: Add dotenvx-based local secret management for Wrangler and local test commands
    status: completed
  - id: setup-local-wrangler-testing
    content: Add local Wrangler Pages dev/testing workflow integrated with app scripts
    status: completed
  - id: setup-github-actions-ci-cd
    content: Add GitHub Actions workflows for build/test CI and Cloudflare Pages CD
    status: completed
  - id: setup-cloudflare-cli
    content: Add Wrangler-based Cloudflare Pages deployment scripts/configuration
    status: completed
  - id: docs-and-hosting
    content: Update README with monorepo usage, local run, GitHub, and Cloudflare CLI deploy steps
    status: completed
  - id: parity-check
    content: Run local verification and compare key sections with live site
    status: completed
  - id: git-handoff
    content: Prepare commit-ready state and GitHub push handoff
    status: completed
isProject: false
---

# Duplicate Webflow Site Into GitHub-Ready Static Repo

## Scope and assumptions

- Source of truth: `[jdconley-com.webflow.zip](jdconley-com.webflow.zip)`
- Target: static clone only (no Webflow CMS/forms/e-commerce behavior)
- Monorepo layout default: site lives in `[apps/jdconley-site/](apps/jdconley-site/)`
- Build system: Vite (or equivalent modern static bundler) with optimized production output
- Keep visual/HTML parity with `https://jdconley.com` while removing Webflow-only coupling where practical

## Implementation plan

- Create a monorepo scaffold at repo root:
  - Add root `[package.json](package.json)` with workspace config (default `apps/*`).
  - Add site app folder at `[apps/jdconley-site/](apps/jdconley-site/)`.
  - Unpack Webflow export contents into `[apps/jdconley-site/](apps/jdconley-site/)`.
- Normalize exported pages for independent hosting:
  - Update canonical URLs from `https://www.jdconley.com` to domain-neutral or configurable values.
  - Replace hardcoded Webflow-hosted OG image URLs with local assets when available.
  - Review `401.html` behavior (Webflow password flow is platform-specific) and keep as a static page with clear limitation notes.
- Add Vite optimization pipeline in `[apps/jdconley-site/](apps/jdconley-site/)`:
  - Configure multi-page input for exported HTML files (`index`, `404`, and additional static pages).
  - Enable production optimization (minified HTML/CSS/JS, generated sourcemaps disabled for production).
  - Add image optimization step (lossless/near-lossless compression during build where safe).
  - Emit optimized output to `dist/` for deployment.
- Add Playwright E2E coverage:
  - Configure Playwright for the site app with a local preview server against production build output.
  - Add smoke tests for `index` and `404`, key sections/headlines, and critical external/contact links presence.
  - Add stable assertions to avoid flaky UI animation timing issues.
  - Add scripts in `[apps/jdconley-site/package.json](apps/jdconley-site/package.json)` for `test:e2e` and CI mode.
- Add dotenvx for local secrets=[REDACTED] Add dotenvx files and conventions for local-only secret values (for example Cloudflare account/project settings used by local commands).
  - Use dotenvx-wrapped scripts in `[apps/jdconley-site/package.json](apps/jdconley-site/package.json)` so local deploy/test commands do not require manually exported env vars.
  - Add `.gitignore`/example env patterns to avoid committing sensitive secret material.
- Add local Wrangler testing workflow:
  - Add a script for `wrangler pages dev dist` (or equivalent) to simulate Cloudflare Pages locally.
  - Ensure this local Wrangler flow is documented and optionally targeted by a Playwright profile for Cloudflare-parity checks.
  - Keep local Vite preview and local Wrangler preview both available for debugging build vs edge/runtime behavior.
- Add GitHub Actions CI/CD:
  - Add CI workflow in `[.github/workflows/ci.yml](.github/workflows/ci.yml)` to run on pull requests and pushes:
    - install dependencies, run Vite build, run Playwright tests, and upload Playwright report/artifacts on failure.
  - Add CD workflow in `[.github/workflows/deploy.yml](.github/workflows/deploy.yml)` for pushes to `main` (plus optional manual dispatch):
    - build optimized `dist` and deploy to Cloudflare Pages via Wrangler/Cloudflare action.
  - Document required GitHub secrets/variables (for example Cloudflare API token, account ID, Pages project name).
- Add Cloudflare Pages CLI deployment setup:
  - Add `[apps/jdconley-site/package.json](apps/jdconley-site/package.json)` scripts for `dev`, `build`, `preview`, and `deploy`.
  - Add Wrangler config (`[apps/jdconley-site/wrangler.toml](apps/jdconley-site/wrangler.toml)` or JSON equivalent) with Pages build output directory set to `dist`.
  - Add root script aliases (optional) for `dev:site`, `build:site`, `deploy:site`.
- Add project documentation in `[README.md](README.md)`:
  - Monorepo structure and where to add future content/apps.
  - Local preview commands (`vite dev` / `vite preview`).
  - Local Wrangler test command and when to use it vs Vite preview.
  - dotenvx setup and secret bootstrapping for contributors.
  - Cloudflare auth/setup (`wrangler login`, project name, deploy command from `dist`).
  - Optimization notes (what is automated in build vs. what remains manual content tuning).
  - GitHub repo setup steps.
- Run a parity and quality check:
  - Verify dev and production parity (`vite dev` vs `vite build && vite preview`).
  - Verify core pages/assets load (`index`, `404`, key images/CSS/JS) from built `dist`.
  - Confirm optimized output characteristics (reduced asset size, cache-friendly static assets).
  - Run Playwright smoke suite locally and in CI to confirm regression coverage on core pages.
  - Spot-check major sections against live `https://jdconley.com` content.
- Finalize for GitHub:
  - Ensure clean file layout and expected tracked files.
  - Prepare an initial commit message and handoff for push to your GitHub remote.

## Deliverables

- Host-ready static site under `[apps/jdconley-site/](apps/jdconley-site/)`
- Monorepo root config in `[package.json](package.json)`
- Vite config/build pipeline in `[apps/jdconley-site/vite.config.*](apps/jdconley-site/vite.config.*)` and related scripts
- Playwright test setup and smoke tests in `[apps/jdconley-site/playwright.config.](apps/jdconley-site/playwright.config.*)*` and `[apps/jdconley-site/tests/](apps/jdconley-site/tests/)`
- dotenvx local secret setup in `[apps/jdconley-site/.env.example](apps/jdconley-site/.env.example)` and related scripts
- GitHub Actions CI/CD workflows in `[.github/workflows/ci.yml](.github/workflows/ci.yml)` and `[.github/workflows/deploy.yml](.github/workflows/deploy.yml)`
- Cloudflare Pages CLI config/scripts in `[apps/jdconley-site/package.json](apps/jdconley-site/package.json)` and Wrangler config
- Updated `[README.md](README.md)` with monorepo + deploy steps
- Optional notes on limitations inherited from Webflow export (password page/form behavior)


