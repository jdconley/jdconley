# Markdown Blog Implementation Plan

> Execute using superpowers:subagent-driven-development with isolated importer work and independent review; use test-driven development for content and routing behavior.

**Goal:** Publish the approved reader-oriented blog from Markdown and migrate all 71 Blogger posts.

**Architecture:** A Vite plugin emits static blog HTML and RSS directly into the build and renders the same content on development requests. Markdown, migration source snapshots, and recovered assets are versioned. A manifest supplies exact legacy redirects for the main-site Worker and a separate optional old-host Worker.

**Tech stack:** Existing Vite/Worker, markdown-it, YAML, sanitize-html, Turndown, Vitest, Playwright.

## Tasks

- [x] Content and tests: add `scripts/blog/content.mjs` and `tests/unit/blog.test.js`. Validate required title/date/slug, unique IDs and slugs, date validity, boolean drafts, and strings in tags. Render fenced code/tables safely, preserve dates, exclude drafts unless explicitly previewing. Test empty/invalid dates, unsafe HTML, and draft exclusion.
- [x] Importer: add `scripts/import-blogger.mjs`, conversion helpers, `tests/unit/blogger-import.test.js`, `data/blogger/` snapshot/manifest/report, `content/blog/*.md`, and `public/blog-assets/imported/`. Verify exactly 71 unique entries, preserve metadata and code/table/text content, rewrite internal links through recorded permalinks, recover referenced images and full-resolution links, report failures, and refuse to overwrite edited posts on repeat imports.
- [x] Pages and preview: add `scripts/blog/render.mjs`, `scripts/blog/vite-plugin.mjs`, and `public/blog-assets/blog.css`; integrate plugin in `vite.config.mjs`. Emit `blog.html`, `blog/<slug>.html`, and `blog/feed.xml`; share renderers between dev and build. Serve drafts only through local dev with visible notice and noindex. Watch Markdown changes for reload. Self-host Inter. Use the approved slim header, 680px article column, serif prose, metadata, and next-story link.
- [x] Authoring: add `scripts/new-blog-post.mjs`; root/app `blog:new` and `blog:import` commands. A scaffold uses exclusive creation and a validated slug. Document front matter, images, drafts, preview, and publishing in `BLOGGING.md`.
- [x] Discovery and routing: extend `scripts/generate-llm-markdown.mjs` to include published blog pages and their canonical paths and timestamps. Add Blog navigation to current homepage and build-log page. Add `worker/blog-redirects.js`, exact legacy path manifest, Worker coverage, and a separate legacy-host Worker. Prepare legacy host routing behavior without changing production DNS/routes.
- [x] Verification: run `pnpm run build:site`, `pnpm run test:unit:site`, `pnpm run test:worker:site`, `pnpm run test:e2e:site`, and `pnpm run test:e2e:wrangler:site`. Install browser runtime and seed deterministic local Worker fixtures as CI does. Inspect prose, code, tables, and images at desktop/mobile widths. Test Markdown edit reload, scaffold/publish, missing article 404, RSS, sitemap, local links, draft omission, and all redirect destinations.
- [x] Review: perform separate spec and quality reviews, fix actionable issues, rerun affected checks, and deliver the local preview, migration report, and cutover instructions. Do not deploy or change DNS without a deployment request.

## Output contracts

Post front matter: `title`, `date` (ISO date or timestamp), `slug` (lowercase hyphenated), `description`, `tags` (string array), `draft` (boolean); optional `updated`, `bloggerId`, `originalUrl`. Filename: `<slug>.md`. Article URL: `/blog/<slug>`.

Importer manifest: `data/blogger/manifest.json` records original IDs, paths, new paths and file checksums. `data/blogger/redirects.json` is a plain object mapping legacy pathname to `/blog/<slug>`, imported by the Worker. Import source `data/blogger/posts.json` is never placed in public assets.

Failures in content validation fail the build with a filename. Missing external migration media are retained in the report with original URLs and human-readable placeholders in posts. No network is used by normal builds. Drafts are absent from every production output.
