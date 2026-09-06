# Writing on jdconley.com

The blog lives at `/blog`. Posts are plain Markdown in `apps/jdconley-site/content/blog/`. The site builds static HTML, an RSS feed, a sitemap, and Markdown mirrors from those files. Reading requires no JavaScript or external service.

## Write a post

From the repository root:

```sh
pnpm run blog:new:site "My next post"
pnpm run dev:site
```

Open `http://localhost:5173/blog` to preview. The new file is `apps/jdconley-site/content/blog/my-next-post.md`. Edits reload the page automatically. Drafts appear in local development with a visible notice; production builds exclude them from articles, the archive, RSS, the sitemap, and Markdown mirrors.

```markdown
---
title: My next post
date: 2026-09-05
slug: my-next-post
description: A short summary for the archive, RSS, and search results.
tags:
  - engineering
draft: true
---

Write paragraphs, **bold**, *italics*, [links](https://example.com),
lists, tables, and fenced code blocks here.
```

Dates accept `YYYY-MM-DD` or an ISO timestamp with a timezone. Optional `updated` records a substantive update. The `slug` fixes the public URL (`/blog/my-next-post`): keep it stable after publishing. Invalid dates, duplicate slugs, and invalid front matter fail the build with the offending filename. A blank description is generated from the article body.

Place new images in `apps/jdconley-site/public/blog-assets/` and reference them with a root-relative URL:

```markdown
![A useful description of the image](/blog-assets/my-image.jpg)
```

Code fences support language labels such as `js`, `sh`, and `csharp`; code is rendered with preserved whitespace. Tables and strikethrough are supported. A small subset of HTML is allowed for historical formatting; scripts, event handlers, and unsafe URLs are stripped.

## Publish

Set `draft: false`, preview the article, and run:

```sh
pnpm run build:site
pnpm run test:unit:site
pnpm run test:worker:site
pnpm run test:e2e:site
pnpm run test:e2e:wrangler:site
```

Publishing uses the existing site deployment workflow. A date is metadata, not a scheduler: setting a future date does not hold publication. Drafts remain the publication control.

RSS is `/blog/feed.xml`. Each published article has an HTML Markdown mirror at `/blog/<slug>.html.md` and appears in the sitemap and existing LLM discovery files. `VITE_SITE_URL` sets the canonical origin; production uses `https://jdconley.com`.

## Blogger migration

The initial migration contains 71 published posts from May 2006 through July 2013. It retains original titles, dates, update timestamps, labels, Blogger IDs, and permalinks. It preserves the historical wording, including old technical instructions.

- `apps/jdconley-site/data/blogger/posts.json`: full public source feed snapshot, outside served assets.
- `apps/jdconley-site/data/blogger/manifest.json`: source mappings, Markdown checksums, recovered assets, and failures.
- `apps/jdconley-site/data/blogger/redirects.json`: exact Blogger and verified earlier permalink mappings.
- `apps/jdconley-site/data/blogger/validation.json`: reproducible content and asset verification results.

Re-run the saved-source migration or explicitly refresh the public feed:

```sh
pnpm run blog:import:site
pnpm run blog:import:site --fetch
pnpm --filter @jdconley/jdconley-site exec node scripts/blog/import-validation.mjs
```

The importer verifies completeness before writing and refuses to overwrite Markdown that differs from its recorded checksum. Successful image downloads are cached by checksum. `--fetch` also retries previously unavailable media. Normal site builds never contact Blogger.

The import recovered 48 image URLs (including linked full-resolution versions) into 40 unique local files. Two original images remain unavailable: one Hive7 image in **Functional Optimistic Concurrency in C#**, and one Facebook image in **Friend Photosaver for Facebook**. Those articles show a readable unavailable-image notice linked to the original URL. The migration report preserves the failed requests for later recovery. Existing outbound links and downloads remain historical external references; they are not claimed to be archived. No comments are imported: the public post feed reports zero comments, and a separate historical comment-service export has not been established.

## Cut over the old hostname

The main-site Worker handles recorded legacy paths, including 16 verified pre-Blogger aliases. A separate small Worker configuration, `apps/jdconley-site/wrangler.blog.toml`, is prepared to redirect `blog.jdconley.com` without introducing runtime work on every main-site article request. It redirects old articles, the blog homepage, and feed endpoints; all other old paths permanently redirect to the new blog archive. Mobile `m=1` is removed, and other article query parameters are preserved.

The code does not itself change DNS or deploy the old-host Worker. After the main blog has been deployed and verified, a requested hostname cutover consists of:

1. Save Blogger's current custom-domain and DNS settings for rollback. Export a Blogger backup from the signed-in dashboard if retaining private drafts/comments is desired; the public migration contains published posts only.
2. Deploy the dedicated redirect Worker. Wrangler replaces the conflicting Blogger DNS record as part of attaching its Custom Domain:

   ```sh
   pnpm --filter @jdconley/jdconley-site exec wrangler deploy --config wrangler.blog.toml
   ```

3. Verify HTTP and HTTPS requests for the old homepage, an article whose permalink date differs from its publication date, a feed URL, a mobile URL, and an unknown article. Verify final article and RSS responses on the main site.
4. Keep the Blogger content and source snapshot for rollback. Reverting the hostname route/DNS to its saved Blogger settings restores the old blog.

Do not push to `main` or deploy merely to preview: the existing `main` delivery workflow performs a production deployment after its gates pass.

## Implementation verification

The September 5 implementation passed the production build, 214 unit tests, 76 Worker tests, 82 static browser checks, and 83 Wrangler browser checks. Environment-specific checks were skipped only in the opposite runtime (two static / one Wrangler). A temporary draft was absent from all 285 production files. All 87 redirect destinations resolve to published articles, and all 73 code blocks survived the production HTML pipeline unchanged. Both spec and code-quality reviews passed.

## Sharing and discovery

Every published article and the archive receive a generated 1200×630 PNG social preview, complete Open Graph and X card metadata, and canonical URLs. BlogPosting/Blog structured data identifies the author, dates, and image. RSS, sitemap.xml, robots.txt, llms.txt, llms-full.txt, and authored Markdown mirrors are generated together; production outputs exclude drafts. These make the content accessible to readers and crawlers; indexing and AI citations remain up to those services.
