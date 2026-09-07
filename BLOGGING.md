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

Code fences support language labels such as `js`, `sh`, and `csharp`; code is rendered with preserved whitespace and build-time syntax highlighting in light and dark mode. Unlabelled or unknown languages remain plain preformatted text. No browser JavaScript or external highlighting service is needed.

````markdown
```csharp
public IEnumerable<Person> Sort(IEnumerable<Person> people)
{
    return people.OrderBy(p => p.FirstName);
}
```
````

Tables and strikethrough are supported. A small subset of HTML is allowed for historical formatting; scripts, event handlers, and unsafe URLs are stripped.

## Social sharing images

Each post can choose its own sharing artwork through Markdown front matter:

```yaml
ogImage: /blog-assets/og/my-next-post-v1.jpg
ogImageAlt: A short description of the artwork and its headline.
```

Save the file under `apps/jdconley-site/public/blog-assets/`. `ogImage` accepts local PNG, JPG/JPEG, or WebP files with simple letters, digits, hyphens, and underscores in their paths. Remote URLs and SVG are intentionally unsupported: publishing a local raster image makes availability and decoding verifiable during the build. `ogImageAlt` is optional; it falls back to the article title and author. Omit both fields to use the automatic title-card fallback for a new post. Do not set `ogImage` to an empty string.

The build crops artwork to 1200×630, converts it to PNG, and rejects missing, unreadable, or oversized images. Design at 1.91:1 and keep lettering/focal subjects well away from the edges. The HTML includes absolute HTTPS Open Graph and Twitter large-card image URLs, image dimensions, MIME type, alt text, and the same image in article structured data. No JavaScript or image-generation API runs when a crawler visits.

Published image URLs include a content hash in a `?v=` query parameter, so changing the source bytes gives the next build a new URL automatically. The `/blog-assets/social/<slug>.png` file remains available with or without any older version query, so previously scraped metadata does not point to a deleted file after replacement. The blog archive cover is configured by `archiveSocial` in `apps/jdconley-site/scripts/blog/share-image.mjs`.

The September 2026 artwork set contains one bespoke generated image for each of the 72 published posts plus the archive. Optimized source files live in `public/blog-assets/og/`; generation prompts and provenance live in `data/blog/social-images.json` outside publicly served files. These are editorial assets checked into the repository, so normal builds remain reproducible and offline. To replace one, generate a new image using its recorded prompt (adjust the concept or exact headline as needed), save the selected output as a new versioned source file, update the post's `ogImage` and `ogImageAlt`, then preview and build. Run `pnpm --filter @jdconley/jdconley-site exec node scripts/blog/verify-sharing.mjs` to audit every published page and image in the built output. Prefer 2–4 headline words and one article-specific visual idea; inspect spelling, subject accuracy, and small-size readability before publishing.

After deployment, inspect the canonical article URL with [LinkedIn Post Inspector](https://www.linkedin.com/post-inspector/) and [Facebook Sharing Debugger](https://developers.facebook.com/tools/debug/) to refresh their page caches. X may retain previously scraped cards; a new image URL does not force existing posts to refresh immediately. Check the exact URL that was shared, including legacy redirects. A local request using a bot user agent verifies this server's response to that header, but cannot guarantee access from the platform's own network or its final card rendering.

The chosen dimensions and file-size ceiling meet [LinkedIn's published sharing requirements](https://www.linkedin.com/help/linkedin/answer/a521928/making-your-website-shareable-on-linkedin?lang=en). The same public raster image is exposed through Open Graph for Facebook and `summary_large_image` metadata for X.

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

The importer verifies completeness before writing and refuses to overwrite Markdown that differs from its recorded checksum. The bespoke sharing metadata now counts as an editorial change, so a reimport intentionally stops before overwriting these posts. The historical archive audit excludes only `ogImage` and `ogImageAlt` from its original checksum comparison; article content and all original metadata remain protected. Successful image downloads are cached by checksum. `--fetch` also retries previously unavailable media. Normal site builds never contact Blogger.

The import recovered 48 image URLs (including linked full-resolution versions) into 40 unique local files. Two original images remain unavailable: one Hive7 image in **Functional Optimistic Concurrency in C#**, and one Facebook image in **Friend Photosaver for Facebook**. Those articles show a readable unavailable-image notice linked to the original URL. The migration report preserves the failed requests for later recovery. Existing outbound links and downloads remain historical external references; they are not claimed to be archived. No comments are imported: the public post feed reports zero comments, and a separate historical comment-service export has not been established.

## Cut over the old hostname

The main-site Worker handles recorded legacy paths, including 16 verified pre-Blogger aliases. A separate small Worker configuration, `apps/jdconley-site/wrangler.blog.toml`, redirects `blog.jdconley.com` without introducing runtime work on every main-site article request. It redirects old articles, the blog homepage, and feed endpoints; all other old paths permanently redirect to the new blog archive. Mobile `m=1` is removed, and other article query parameters are preserved.

The code does not itself change DNS or deploy the old-host Worker. After the main blog has been deployed and verified, a requested hostname cutover consists of:

1. Keep the existing Blogger DNS record proxied through Cloudflare. The public migration contains published posts only; the Blogger content remains intact.
2. Deploy the dedicated redirect Worker. It attaches the `blog.jdconley.com/*` Worker route to the existing proxied hostname:

   ```sh
   pnpm --filter @jdconley/jdconley-site exec wrangler deploy --config wrangler.blog.toml
   ```

3. Verify HTTP and HTTPS requests for the old homepage (Cloudflare upgrades HTTP to HTTPS before the Worker redirects to the root domain), an article whose permalink date differs from its publication date, a feed URL, a mobile URL, and an unknown article. Verify final article and RSS responses on the main site.
4. Keep the Blogger content and source snapshot for rollback. Removing only the `blog.jdconley.com/*` Worker route restores Blogger traffic through the unchanged DNS record.

Do not push to `main` or deploy merely to preview: the existing `main` delivery workflow performs a production deployment after its gates pass.

## Implementation verification

The September 5 implementation passed the production build, 214 unit tests, 76 Worker tests, 82 static browser checks, and 83 Wrangler browser checks. Environment-specific checks were skipped only in the opposite runtime (two static / one Wrangler). A temporary draft was absent from all 285 production files. All 87 redirect destinations resolve to published articles, and all 73 code blocks survived the production HTML pipeline unchanged. Both spec and code-quality reviews passed.

## Sharing and discovery

Every published article and the archive receive a generated 1200×630 PNG social preview, complete Open Graph and X card metadata, and canonical URLs. BlogPosting/Blog structured data identifies the author, dates, and image. RSS, sitemap.xml, robots.txt, llms.txt, llms-full.txt, and authored Markdown mirrors are generated together; production outputs exclude drafts. These make the content accessible to readers and crawlers; indexing and AI citations remain up to those services.

## Production release

Released September 5, 2026 (Pacific time). Main-site commit `eb6e7c5` passed GitHub CI and deployment verification. The location-source service returned one transient HTTP 504; the deployment retry succeeded. The live archive and 71 articles, all 72 social PNGs, authored Markdown mirrors, sitemap, RSS, and crawler responses passed verification.

The legacy Worker version is `343dff35-66a9-402f-bdf4-fceaedc26cd6`, attached through the Cloudflare route `blog.jdconley.com/*`. Custom Domains could not replace the externally managed Blogger DNS record, so the route preserves that record and its existing TLS/proxy configuration.

All 92 live redirect checks passed: 87 article mappings plus homepage, HTTP upgrade, feed, mobile query, and unknown-path cases. X, LinkedIn, Facebook, Google, and OpenAI crawler user agents received the expected article redirects.

## Author portrait on sharing images

Every final sharing PNG includes the exact author photo from `apps/jdconley-site/images/headshot-256x256.png` in a circular gold-ring badge. `scripts/blog/author-portrait.mjs` configures the source photo, badge size, inset, colors, and per-slug corner overrides. Most covers use the bottom-right corner; selected covers move the badge to keep headlines and key imagery visible. The automatic title-card fallback uses the top-right corner.

The badge is composited at build time, preserving the original generated JPG artwork. Changing the photo or its placement changes the final image URL version automatically. Open Graph and X image descriptions include the author portrait. After `pnpm run build:site`, open `docs/blog-social-preview.html` to review all 73 final PNGs with portraits. The gallery references local build output and is not published with the site.
