---
name: webflow-static-site-refresh
description: Refreshes the static site from a Webflow export ZIP, then re-validates canonical metadata, build output, tests, and deploy readiness. Use when updating site content from Webflow.
---
# Webflow Static Site Refresh

## When to use
- User provides a new Webflow export zip.
- User asks to sync latest Webflow changes into this repo.
- Any task says "refresh/replace site export".

## Primary paths
- Source zip: `jdconley-com.webflow.zip`
- Site app: `apps/jdconley-site/`
- Home page: `apps/jdconley-site/index.html`
- Info pages: `apps/jdconley-site/info/*.html`

## Workflow
1. Extract the export into the app directory:
   - `mkdir -p apps/jdconley-site`
   - `unzip -o "jdconley-com.webflow.zip" -d "apps/jdconley-site"`
2. Re-apply project-specific metadata expectations:
   - Canonical and social links should use `%VITE_SITE_URL%` where configured.
   - Nested `/info/*` pages should keep correct relative paths (`../css/...`, `../js/...`, `../images/...`).
3. Rebuild and validate:
   - `pnpm run build:site`
   - `pnpm run test:e2e:site`
4. If publishing process docs are in scope, refresh logs:
   - `pnpm run logs:sync:site`

## Verification checklist
- Site builds without errors.
- E2E smoke tests pass.
- `dist/` includes all expected pages and assets.
- `js/webflow.js` is present in output runtime path.

## Repo gotchas
- Vite MPA build includes all `.html` under `apps/jdconley-site/` except ignored folders.
- Legacy pages (`old-home`, `home-version-*`) are still part of output unless explicitly removed.
