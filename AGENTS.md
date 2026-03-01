# Agent Operating Guide

Use this guide when working in this repository. Prefer reusing project skills instead of re-deriving workflows from scratch.

## Skill Routing

- **Webflow refresh / export sync**
  - Use: `.cursor/skills/webflow-static-site-refresh/SKILL.md`
  - Trigger phrases: "new Webflow zip", "refresh export", "sync Webflow site"
- **Cloudflare deploy / Wrangler parity**
  - Use: `.cursor/skills/cloudflare-pages-ops/SKILL.md`
  - Trigger phrases: "Cloudflare Pages", "Wrangler", "deploy", "dotenvx"
- **How-this-is-built logs publishing**
  - Use: `.cursor/skills/ai-build-logs-publishing/SKILL.md`
  - Trigger phrases: "publish logs", "Cursor transcripts", "how this is built"
- **pnpm / workspace dependency operations**
  - Use: `.cursor/skills/pnpm-monorepo-ops/SKILL.md`
  - Trigger phrases: "pnpm", "lockfile", "install issues", "dependency update"

## Default Workflow Order

1. Sync publishable AI logs when relevant:
   - `pnpm run logs:sync:site`
2. Build:
   - `pnpm run build:site`
3. Test:
   - `pnpm run test:e2e:site`
4. Deploy (only when requested):
   - `pnpm run deploy:site`

## Safety Rules

- Never commit `.env` files, tokens, or secret values.
- Redaction checks are required before publishing transcript logs.
- Prefer editing existing pages/components before creating new ones.
- Keep generated log files time-ordered and reproducible through `logs:sync`.
- Use pnpm commands only (avoid npm/yarn unless explicitly requested).

## Quick Commands

```bash
# Sync AI build logs
pnpm run logs:sync:site

# Local development
pnpm run dev:site
pnpm run preview:site
pnpm run preview:cf:site

# Build and test
pnpm run build:site
pnpm run test:e2e:site
pnpm run test:e2e:wrangler:site

# Deploy
pnpm run deploy:site
```
