# Agent Operating Guide

Use this guide when working in this repository. Prefer reusing project skills instead of re-deriving workflows from scratch.

## Skill Routing

- **Webflow refresh / export sync**
  - Use: `.agents/skills/webflow-static-site-refresh/SKILL.md`
  - Trigger phrases: "new Webflow zip", "refresh export", "sync Webflow site"
- **Cloudflare deploy / Wrangler parity**
  - Use: `.agents/skills/cloudflare-pages-ops/SKILL.md`
  - Trigger phrases: "Cloudflare Pages", "Wrangler", "deploy", "dotenvx"
- **How-this-is-built logs publishing**
  - Use: `.agents/skills/ai-build-logs-publishing/SKILL.md`
  - Trigger phrases: "publish logs", "Cursor transcripts", "how this is built"
- **pnpm / workspace dependency operations**
  - Use: `.agents/skills/pnpm-monorepo-ops/SKILL.md`
  - Trigger phrases: "pnpm", "lockfile", "install issues", "dependency update"
- **Install existing skills via skills.sh**
  - Use: `.agents/skills/skills-sh-skill-finder/SKILL.md`
  - Trigger phrases: "skills.sh", "add existing skill", "install skill", "skill finder"
- **Create local skills (conversation-seeded)**
  - Use: `.agents/skills/local-skill-scaffolder/SKILL.md`
  - Trigger phrases: "create skill", "new local skill", "skill from conversation", "scaffold skill"
- **Web design guideline reviews**
  - Use: `.agents/skills/web-design-guidelines/SKILL.md`
  - Trigger phrases: "web design", "UI audit", "review UX", "check accessibility"

## Skill Layout (skills.sh Defaults)

- Canonical project skills live in `.agents/skills/<skill-name>/SKILL.md`.
- Keep `.cursor/skills/<skill-name>` as a symlink to `../../.agents/skills/<skill-name>` for editor compatibility.
- Install third-party skills with defaults: `pnpm dlx skills add <owner/repo> --skill <skill-name> --agent cursor -y`.
- For new custom skills:
  1. `pnpm dlx skills init .agents/skills/<skill-name>`
  2. `ln -s ../../.agents/skills/<skill-name> .cursor/skills/<skill-name>`
  3. `pnpm dlx skills ls` (verify the skill is visible through the default `.agents/skills` path)
- Do not run `skills add` against `.agents/skills/<skill-name>` for local custom skills; use `skills add` for third-party sources.

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
