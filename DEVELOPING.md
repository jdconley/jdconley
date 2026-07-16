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
- `SITE_URL` (the canonical production origin; reconciliation requires exactly `https://jdconley.com`)
- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`
- `SUPPORT_IP_HMAC_SECRET` (at least 32 characters, ideally randomly generated ASCII/base64 with no control characters; required only for production reconciliation)
- `TURNSTILE_SITE_KEY` (public site key for local preview/testing; production reconciliation discovers it)
- `SUPPORT_ORIGIN` (defaults to `https://jdconley.com`)

The local preview and direct deploy scripts use `dotenvx`. The production reconciliation commands intentionally require explicit environment injection; use `op run` as shown below.

`TURNSTILE_SECRET_KEY` and `SUPPORT_IP_HMAC_SECRET` are Worker secrets. `.env.example` names the HMAC variable but contains no value. Never commit either value; prefer the 1Password injection pattern below over storing production credentials in `.env`.

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

## Cloudflare Production Delivery

Production is Worker-first. `apps/jdconley-site/wrangler.toml` deploys the Worker, Static Assets, D1 and rate-limit bindings, plus the apex and `www` Custom Domains. The Worker runs first for the tool/API paths declared in `assets.run_worker_first`; Cloudflare Pages and `CLOUDFLARE_PAGES_PROJECT` are obsolete, and the deploy token does not need Pages access.

Create one custom Cloudflare API token, restricted to the target account, with only these account permissions (dashboard/API names):

- D1 Edit / `D1 Write`: discover or create `a-better-time`, apply migrations, query state, import locations, and record reconciliation state.
- Turnstile Edit / `Turnstile Sites Write`: list, read, create, and update the hostname-restricted managed widget. Reconciliation never calls the secret-rotation endpoint.
- Workers Scripts Edit / `Workers Scripts Write`: upload the Worker and Static Assets, bind D1/rate limiting, deploy secrets, and maintain the configured Worker Custom Domains.

The current flow does not require Pages, KV, R2, DNS, Workers Routes, broad Account Settings, or user-level permissions. Cloudflare's permission labels can change; confirm the token still has the three capabilities above when replacing it.

The reconciler discovers the named D1 database and writes its UUID only to a generated Wrangler config. It applies committed migrations, builds the checksum-pinned location index, and compares the generated NDJSON checksum and manifest count with both `production_resource_state` and `COUNT(*) FROM locations`. It skips the destructive import only when checksum, recorded count, and actual count all match. Otherwise it validates the generated data, replaces the locations, verifies the final count, and only then upserts the state row.

The same run discovers or creates the Turnstile widget and stages `TURNSTILE_SECRET_KEY` plus the stable `SUPPORT_IP_HMAC_SECRET` in one mode-`0600` secrets file. `wrangler deploy --secrets-file` uploads both with the Worker deployment; do not run routine `wrangler secret put` commands before it. Never rotate `SUPPORT_IP_HMAC_SECRET` during a normal deploy. A rotation does not delete supporter rows, but old IP HMACs can no longer match, so duplicate identity continuity is lost and previous visitors can appear new.

### Manual reconciliation and recovery

Inject production credentials from 1Password without putting values in shell history or a file. With desktop app integration, keep the app unlocked and run `op` directly in this shell; do not wrap it in tmux. With standalone sign-in, run `eval "$(op signin --account <account>)"` and keep this same shell (or persistent shell session) alive through reconcile, deploy, verification, and cleanup. In either mode, `op whoami` must pass before the first `op run`. Replace only the generic `op://` references below:

```bash
op whoami
export CLOUDFLARE_API_TOKEN='op://<vault>/<item>/CLOUDFLARE_API_TOKEN'
export CLOUDFLARE_ACCOUNT_ID='op://<vault>/<item>/CLOUDFLARE_ACCOUNT_ID'
export SUPPORT_IP_HMAC_SECRET='op://<vault>/<item>/SUPPORT_IP_HMAC_SECRET'
export SITE_URL=https://jdconley.com

op run -- pnpm --filter @jdconley/jdconley-site run production:reconcile:dry-run
```

The dry run validates inputs, discovers D1 and Turnstile resources, and reports planned stages without writing files or mutating Cloudflare. It does not apply migrations, build/query the location index, or prove that an import will be skipped.

GitHub Actions is the normal deployment path. For a deliberate manual recovery, capture the reconciler outputs, deploy them together, verify, and clean up:

```bash
set -euo pipefail
VITE_SITE_URL="$SITE_URL" pnpm run build:site

config_path=
output_file=
cleanup_reconciliation_files() {
  candidate="${config_path:-}"
  if [[ -z "$candidate" && -n "${output_file:-}" && -f "$output_file" ]]; then
    candidate="$(sed -n 's/^WRANGLER_CONFIG=//p' "$output_file" 2>/dev/null || true)"
  fi
  if [[ -n "$candidate" ]]; then
    pnpm --filter @jdconley/jdconley-site run production:reconcile:cleanup "$candidate" >/dev/null 2>&1 || true
  fi
  if [[ -n "${output_file:-}" ]]; then
    rm -f -- "$output_file" >/dev/null 2>&1 || true
  fi
}
output_file="$(mktemp)"
trap cleanup_reconciliation_files EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
chmod 600 "$output_file"

GITHUB_OUTPUT="$output_file" op run -- pnpm --filter @jdconley/jdconley-site run production:reconcile
config_path="$(sed -n 's/^WRANGLER_CONFIG=//p' "$output_file")"
secrets_file="$(sed -n 's/^WRANGLER_SECRETS_FILE=//p' "$output_file")"
site_key="$(sed -n 's/^TURNSTILE_SITE_KEY=//p' "$output_file")"
if [[ -z "$config_path" || -z "$secrets_file" || -z "$site_key" ]]; then
  echo "Reconciliation did not emit every required deploy output." >&2
  exit 1
fi

op run -- pnpm --filter @jdconley/jdconley-site exec wrangler deploy \
  --config "$config_path" --secrets-file "$secrets_file" \
  --var "TURNSTILE_SITE_KEY:$site_key" --var "SUPPORT_ORIGIN:$SITE_URL"
SITE_URL="$SITE_URL" TURNSTILE_SITE_KEY="$site_key" \
  pnpm --filter @jdconley/jdconley-site run production:verify
pnpm --filter @jdconley/jdconley-site run production:reconcile:cleanup "$config_path"
config_path=
rm -f -- "$output_file"
trap - EXIT INT TERM
```

The manual sequence builds `dist` with the same canonical site URL before any production mutation. Its EXIT/signal traps are installed as soon as the protected output file exists; they remove the generated directory (including the secrets file) and output file after a deploy/verification error or interruption without printing their contents. The happy path cleans explicitly, clears the path, removes the output file, and then disarms the traps.

Reconciliation creates `jdconley-production-*` under `$RUNNER_TEMP` (or the OS temp directory), with mode-`0600` Wrangler and secrets files. An internal failure removes that directory; after successful reconciliation the workflow's final cleanup removes it even if deploy or verification fails. The location importer likewise deletes its generated mode-`0600` SQL directory in `finally`.

Migrations, a completed location import, and Turnstile configuration changes may persist if a later stage fails; they are intentionally idempotent, so fix the cause and rerun reconciliation. The location state row is not advanced until the imported count verifies. A deploy or smoke-test failure does not automatically roll back the Worker or D1. If production must be restored immediately, roll back the Worker version in Cloudflare, then run `production:verify`; D1 migrations/imports are forward-only and need a separate, reviewed data recovery plan.

## GitHub Actions CI/CD

Before merging a release to `main`, run the local gates in CI order:

```bash
pnpm install --frozen-lockfile
pnpm run build:site
pnpm run test:unit:site
pnpm run test:worker:site
pnpm run test:e2e:site
pnpm run test:e2e:wrangler:site
```

- CI workflow: `.github/workflows/ci.yml`
  - Runs on PRs and pushes to `main`
  - Frozen install, build, unit tests, Worker tests, site E2E, then Wrangler E2E
  - Uses committed fixture locations, local D1, and the Turnstile test site key
- Deploy workflow: `.github/workflows/deploy.yml`
  - Runs only after the `CI` workflow succeeds for `main`; there is no manual bypass
  - Accepts only a successful push to `main` whose `workflow_run.head_repository.full_name` equals `github.repository`, checks out that CI commit, and rejects it if `origin/main` has advanced
  - Serializes production deploys without cancelling an in-progress deploy; the stale-head guard prevents an older queued completion from deploying afterward
  - Rechecks the triggering SHA before reconciliation and again before deployment
  - Runs frozen install, build, reconciliation, atomic secrets-file Worker deploy, production verification, and cleanup in that order

Required GitHub configuration:

- **Repository Secrets**
  - `CLOUDFLARE_API_TOKEN`
  - `CLOUDFLARE_ACCOUNT_ID`
  - `SUPPORT_IP_HMAC_SECRET`
- **Repository Variables**
  - `SITE_URL` (optional; defaults to and must resolve to `https://jdconley.com` for production reconciliation)

Create `SUPPORT_IP_HMAC_SECRET` once with at least 32 characters and store it as the GitHub secret above. Prefer a randomly generated ASCII/base64 value with no control characters so the workflow's character-count gate and the reconciler's UTF-8 byte gate agree. The reconciler reuses it on every deployment and obtains the existing Turnstile secret from Cloudflare; neither value belongs in workflow YAML or git. Merging to `main` is the release trigger only after the branch has passed the local gates in this document. The deploy workflow's event-provenance and repeated current-SHA checks prevent a PR run, fork run, manual run, or stale successful CI completion from mutating production.

## Notes / Known limitations from Webflow export

- `401.html` contains Webflow password-protection form behavior (`/.wf_auth`) that is platform-specific and not functional as standalone static hosting authentication.
