# Production Resource Reconciliation Design

## Goal

After CI succeeds for the current `main` commit, reconcile every Cloudflare resource required by `jdconley.com`, deploy the Worker, and verify production. The workflow must be safe to run after every merge, recover from a partially provisioned account, and avoid rotating stable identity secrets or rewriting the location database when nothing changed.

## Delivery gate

The existing `workflow_run` delivery model remains authoritative:

- Deployment runs only after the `CI` workflow succeeds for `main`.
- The workflow checks out the CI commit SHA and refuses to deploy it if `origin/main` has advanced.
- Production deployments remain serialized with `cancel-in-progress: false`.
- A provisioning or smoke-test failure fails the deployment and prevents a misleading success state.

## Inputs and secret boundaries

GitHub Actions supplies:

- Secret `CLOUDFLARE_API_TOKEN` with account access for Workers, D1, Turnstile, and the `jdconley.com` zone.
- Secret `CLOUDFLARE_ACCOUNT_ID`.
- Secret `SUPPORT_IP_HMAC_SECRET`, generated once and retained across deployments so duplicate identities remain stable.
- Variable `SITE_URL`, defaulting to `https://jdconley.com`.

The workflow must never print secret values. `TURNSTILE_SITE_KEY` is public configuration and may remain a repository variable for visibility, but it is no longer a deployment input. The reconciler treats Cloudflare as the source of truth, discovers or creates the widget, masks its public site key and private secret in Actions logs, passes the site key between steps through a protected job output, and sends the private secret directly to Wrangler.

The deployment workflow retains read-only repository permissions: `actions: read` to inspect its triggering CI run and `contents: read` for checkout. Production resource writes are authenticated exclusively with the scoped Cloudflare token.

## Reconciler architecture

Add a focused Node script under `apps/jdconley-site/scripts/` with small exported units and a CLI entry point. The script owns Cloudflare API discovery and reconciliation; the workflow remains declarative and calls the script in ordered phases.

The reconciler will:

1. Validate the Cloudflare account ID, token, production hostname, Wrangler configuration, and stable HMAC secret.
2. Discover D1 database `a-better-time`.
   - Create it in western North America if absent.
   - Use the discovered UUID as the runtime source of truth.
   - Fail if multiple conflicting resources or an unexpected binding are found.
3. Produce a temporary Wrangler configuration containing the discovered D1 UUID. The committed UUID remains a useful production declaration, while CI can recover if the account was reprovisioned without requiring a broken deploy first.
4. Apply all D1 migrations remotely and non-interactively.
5. Build the checksum-pinned location dataset.
6. Compare its SHA-256 checksum to a migration-backed `production_resource_state` row in D1.
   - Import the full dataset only when the checksum differs or the locations table is empty/incomplete.
   - Record the checksum and row count only after a successful import and verification.
   - Leave supporter rows untouched.
7. Discover Turnstile widget `A Better Time - jdconley.com`.
   - Create it in managed mode if absent.
   - Reconcile authorized hostnames to `jdconley.com`, `www.jdconley.com`, and the intended Worker preview hostname.
   - Preserve an existing widget secret; never rotate it during ordinary reconciliation.
8. Upload `TURNSTILE_SECRET_KEY` and the stable GitHub `SUPPORT_IP_HMAC_SECRET` using Wrangler secret bulk input from memory/stdin.
9. Deploy the Worker with the resolved site key, support origin, temporary Wrangler config, D1 binding, rate limiter, assets, and both Custom Domains.
10. Verify Cloudflare reports both Custom Domains enabled for the production Worker.

## Database state tracking

Add migration `0003_production_resource_state.sql`:

- Table `production_resource_state` keyed by a short resource name.
- Columns for checksum, row count, and updated timestamp.
- The location import state uses key `locations`.

The state row is written only after the remote location table count matches the generated manifest. If import fails after deletion, the deployment fails; the next run sees a missing/mismatched state row and retries the complete import.

## Production verification

After deployment, the workflow verifies:

- `/` and `/a-better-time` return 200 on the apex.
- `www` returns a permanent redirect to the apex while preserving path and query.
- `/api/a-better-time/locations?q=96150` returns the expected ZIP result.
- `/api/a-better-time/supporters` returns a numeric public count.
- A personalized share-image request follows its version redirect and returns a non-empty PNG.
- The rendered tool contains the reconciled Turnstile site key.
- An intentionally invalid Turnstile submission returns `403 turnstile_failed` and does not change the supporter count.
- D1 contains the manifest's location count and the recorded checksum.

The former Pages project is not modified by recurring deploys. It may remain at its `pages.dev` hostname for rollback until intentionally retired.

## Failure and recovery behavior

- Missing GitHub secrets or malformed variables fail before any mutation.
- Cloudflare API responses are checked for `success: true`; error bodies are summarized without credentials.
- Resource creation is followed by fresh discovery rather than trusting parsed human CLI output.
- A stale successful CI run is rejected before reconciliation.
- Stable secrets are never generated inside the recurring workflow.
- Turnstile secrets are not rotated automatically.
- Location imports are checksum-gated and never run concurrently because the deploy concurrency group is serialized.
- Custom Domain conflicts fail with actionable diagnostics; the workflow does not delete arbitrary DNS records or Pages domains during routine reconciliation.

## Testing

Use test-driven development for the reconciler:

- Unit tests for D1 discovery/create decisions, UUID/config substitution, Turnstile discovery/update/create behavior, checksum decisions, response validation, and redaction.
- Unit tests for the production smoke verifier using stubbed fetch responses.
- Migration tests confirming `0003` upgrades an existing database without touching locations or supporters.
- Existing unit, Worker, Vite E2E, and Wrangler E2E gates remain required.
- A workflow syntax check and a dry-run mode exercise discovery/planning without mutating Cloudflare.

## Documentation

Update `DEVELOPING.md`, the Cloudflare Worker operations skill, and `.env.example` to describe the GitHub secrets, reconciliation behavior, manual recovery command, and the rule that the HMAC secret must remain stable.
