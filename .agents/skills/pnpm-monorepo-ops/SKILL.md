---
name: pnpm-monorepo-ops
description: Maintains pnpm workspace health for this monorepo, including dependency changes, lockfile correctness, CI install expectations, and build script approval handling.
---
# pnpm Monorepo Ops

## When to use
- User asks to add/update dependencies.
- CI fails on install or lockfile mismatch.
- User asks to migrate npm commands to pnpm.
- Build script approvals or `pnpm approve-builds` questions appear.

## Primary paths
- Root package: `package.json`
- Workspace config: `pnpm-workspace.yaml`
- Lockfile: `pnpm-lock.yaml`
- Site app package: `apps/jdconley-site/package.json`

## Standard commands
- Install: `pnpm install`
- Filtered app command: `pnpm --filter @jdconley/jdconley-site run <script>`
- Frozen install (CI): `pnpm install --frozen-lockfile`

## Workflow
1. Apply dependency changes with pnpm (never npm).
2. Regenerate/update `pnpm-lock.yaml`.
3. Run target scripts through root wrappers or `--filter`.
4. Verify CI assumptions remain valid.

## Build script approvals
- If pnpm blocks build scripts, run `pnpm approve-builds`.
- Approve required build dependencies used by this repo.
- Keep README instructions aligned with current behavior.

## Verification checklist
- No npm commands remain in scripts/docs/workflows unless intentional.
- `pnpm-lock.yaml` is present and current.
- Key repo commands succeed:
  - `pnpm run build:site`
  - `pnpm run test:e2e:site`
