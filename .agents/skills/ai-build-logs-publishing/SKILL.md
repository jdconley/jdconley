---
name: ai-build-logs-publishing
description: Publishes the "How This Is Built" logs by exporting plan and Cursor parent transcripts into redacted, chronological markdown files and validating page links.
---
# AI Build Logs Publishing

## When to use
- User asks to publish plans/transcripts/logs.
- User asks to update "How This Is Built" content.
- User asks to regenerate transcript markdown or manifest files.

## Primary paths
- Export script: `apps/jdconley-site/scripts/export-ai-build-logs.mjs`
- Public logs output: `apps/jdconley-site/public/how-this-is-built/logs/`
- Dedicated page: `apps/jdconley-site/how-this-is-built.html`
- Home section: `apps/jdconley-site/index.html`

## Commands
- Regenerate logs: `pnpm run logs:sync:site`
- Verify packaged output: `pnpm run build:site`

## Workflow
1. Run `pnpm run logs:sync:site`.
2. Confirm `index.json` and timestamped markdown files were generated.
3. Validate redaction:
   - no raw `/Users/...` paths
   - no obvious token-like values
4. Build and verify links:
   - `pnpm run build:site`
   - confirm `/how-this-is-built` references `/how-this-is-built/logs/index.json`.

## Verification checklist
- Log filenames are sortable (`YYYY-MM-DD-HH-mm-ss_<slug>.md`).
- iOS-style timestamps are present in metadata/body.
- Manifest item order matches chronological order.
- Dist output includes `dist/how-this-is-built/logs/*`.
