# Markdown blog and Blogger migration

Status: reader design approved September 5, 2026; implemented and locally verified. Production deployment and old-host cutover remain separate, requested actions.

Implementation is in the `codex/markdown-blog` worktree at `/Users/jd/src/jdconley/.worktrees/markdown-blog`. See `BLOGGING.md` there for writing and cutover instructions.

## Goal

Add a blog to jdconley.com, migrate the existing published Blogger posts, and support writing future posts as Markdown files in this repository.

## Findings

- The site is a static HTML site built with Vite and served by a Cloudflare Worker. Extend that build and reuse its visual style.
- The public Blogger JSON feed reports 71 posts and returns all 71 full HTML bodies with no next page. Published dates span May 8, 2006 through July 18, 2013. Source: https://blog.jdconley.com/feeds/posts/default?alt=json&max-results=500
- The feed preserves IDs, titles, publication and update timestamps, labels, and original permalinks.
- Some permalink year/month values differ from publication dates. Preserve original paths explicitly rather than reconstructing them from dates.
- The archive contains 73 preformatted code blocks, two tables, and 30 distinct image URLs. Images include old Facebook and Hive7 hosts as well as Blogger storage.
- Initial HEAD requests returned successful image responses for 28 URLs. Requests failed for a Hive7 image in “Functional Optimistic Concurrency in C#” and a Facebook image in “Friend Photosaver for Facebook.” Retry and investigate during import before declaring either unrecoverable.
- The existing post-build script generates a sitemap and Markdown mirrors, but currently includes only the homepage and build-log page. Blog integration must extend this intentionally.
- The Worker redirects www to the apex domain, while the default build URL is currently www. Blog canonicals and generated feeds must use the configured production origin consistently; verify that origin during implementation.

## Approaches

1. **Extend the existing Vite build with Markdown pages (recommended).** Fits this site, keeps content in Git, and uses the existing publishing pipeline. Requires a small content loader, renderer, and development integration.
2. **Move the site to a content framework such as Astro.** Could provide a larger publishing foundation, but adds a whole-site migration to this request.
3. **Add a browser CMS backed by Markdown.** Adds browser authoring, but also authentication, service configuration, and operational work. Reconsider if browser editing is required.

The proposed workflow is Markdown files in the repository, local preview, and the existing deployment process.

## Reader experience

- Add a Blog link to the active site navigation.
- Serve a newest-first archive at `/blog`, with title, original publication date, and a short excerpt. Use the approved compact editorial list, with excerpts and dates, so all 71 posts remain easy to browse without requiring client-side JavaScript.
- Serve articles at `/blog/<slug>`. Give the blog dedicated navigation and a reading experience distinct from the main portfolio, per the user's September 5 design feedback.
- Replace the portfolio sidebar on blog pages with a slim header: JD Conley / Writing, All writing, RSS, and About JD linking back to the main site. The blog archive and articles share this header.
- Center articles in a roughly 680px reading column with generous margins, Inter headings, and larger serif body text. Retain the site's restrained colors and blue link accent. Use responsive images and horizontally scrollable code blocks and tables.
- End articles with a brief author introduction and a link to another article. Keep the surrounding navigation quiet so the article is the main focus. The revised interactive comp defaults to an article and exposes the archive through All writing.
- Show title, date, optional updated date, labels, and article body, plus a return link to the archive.
- Generate an RSS feed at `/blog/feed.xml`, article metadata, canonical links, and sitemap entries. Include published blog pages in the existing Markdown discovery artifacts.
- Preserve historical wording and dates. Do not rewrite old technical guidance during migration.

## Markdown authoring

Store one file per post in `apps/jdconley-site/content/blog/`. Use YAML front matter for `title`, `date`, `slug`, `description`, `tags`, optional `updated`, and `draft`. Imported posts additionally retain `bloggerId` and `originalUrl`.

Support normal Markdown plus fenced code blocks, tables, and strikethrough. Keep code text and whitespace intact. Use explicitly supported HTML only where an imported structure cannot be represented faithfully in Markdown; remove scripts and unsafe URLs.

Provide a documented `pnpm` command to scaffold a draft. Markdown edits should appear through the existing local development command. Drafts must be excluded from production HTML, archives, feeds, sitemaps, and Markdown mirrors; local preview should mark them clearly.

Publishing consists of editing a post, setting `draft: false`, previewing, and using the existing deployment workflow. Scheduled publishing and a browser editor are outside the proposed initial scope.

## Migration

1. Save a reproducible source snapshot and manifest outside publicly served assets. Validate entry count, unique IDs, required full bodies, and pagination completeness before conversion.
2. Convert each published entry to a Markdown file. Preserve timestamps, labels, original URL, headings, links, lists, blockquotes, code blocks, and tables. Use stable slugs derived from original permalinks; fail on collisions.
3. Download recoverable images and linked full-resolution versions into local blog assets. Deduplicate by source URL and retain an asset mapping. Check response status and actual media type; do not save an HTML error page as an image.
4. Report unavailable images or attachments with the affected post and original URL. Preserve provenance and a readable unavailable-media indication where needed; never silently erase missing material or claim complete asset recovery.
5. Rewrite links between imported posts using the manifest. Preserve fragments and meaningful queries.
6. Make import repeatable and prevent accidental overwrites of edited Markdown. Normal builds must work offline from checked-in content and assets.

The published post feed reports zero comments on each entry, but that does not establish whether a separate historical comment service existed. This migration covers posts and their assets; comment recovery would require separately confirming a source.

## Legacy URLs and production cutover

Prepare permanent redirects from every recorded legacy permalink to its new article. Include the old blog homepage and feed endpoints, preserving reader access and subscriptions. Handle known Blogger mobile query variants. Per the approved production cutover request, all other paths on the legacy hostname permanently redirect to the blog archive. Unknown article paths on the main domain remain 404.

Redirecting requests on `blog.jdconley.com` requires moving that hostname's traffic from Blogger to Cloudflare routing. Prepare and test the redirect logic and document the hostname cutover. The repository instruction permits deployment only when requested: production deployment and DNS changes are a separate final step after local validation and user authorization.

## Implementation boundaries

- Content loader: parse and validate front matter, enforce unique slugs, filter drafts, and sort posts deterministically.
- Renderer and Vite integration: generate archive, article pages, feed, and development previews from the same content model; remove stale generated output after deletions or draft changes.
- Importer: convert the saved Blogger source and fetch assets only when explicitly run; produce a manifest and recovery report.
- Redirect map: derive destinations from recorded legacy URLs, using the site's canonical origin.
- Discovery integration: extend sitemap and Markdown mirrors without breaking the existing homepage and build-log outputs.

Keep generated HTML separate from authored source and ensure Vite's recursive HTML discovery does not ingest source snapshots, templates, or stale generated pages.

## Validation and acceptance

- Exactly 71 imported articles match the feed's IDs and required metadata; no duplicate or missing destinations.
- Compare source and converted content for text, links, code blocks, tables, and images. Review representative prose, code-heavy, table, and image-heavy articles visually on desktop and mobile.
- Test malformed metadata, duplicate slugs, draft exclusion across every output, deterministic generation, and legacy redirect behavior.
- Verify a newly scaffolded Markdown draft can be previewed and then published by changing its metadata.
- Run the repository build, unit, Worker, browser, and Wrangler browser checks. Confirm direct article loads, navigation, RSS, canonical URLs, sitemap inclusion, and mobile layout.
- Record all unrecovered external assets in the migration report. A source that is already unavailable is reported as a limitation, not counted as recovered.
- Deliver authoring and cutover documentation with the verified implementation.
