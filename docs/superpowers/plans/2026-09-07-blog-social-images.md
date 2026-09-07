# Bespoke blog sharing images

Goal: Give all 72 published posts and the archive a bespoke, illustrated sharing image. The user selected entirely bespoke artwork per post, with short catchy text and a YouTube thumbnail style.

Architecture: Keep the Markdown/Vite pipeline. Add optional `ogImage` and `ogImageAlt` front matter; accept local public blog assets, normalize them into static 1200×630 PNGs, and use stable image filenames with content-version queries in Open Graph, Twitter cards, and article schema. Existing title-card generation remains the automatic fallback for new posts. All rendering is offline at build time. Image generation is an editorial operation, never a build dependency.

- [x] Add failing tests for front matter validation, image decoding, missing assets, and consistent escaped metadata.
- [x] Implement configurable sources, image normalization, content-versioned URLs, and development/build parity in `scripts/blog/`.
- [x] Generate 73 independent images with the built-in image tool, save optimized source assets in `public/blog-assets/og/`, record prompts outside public assets, and configure every post.
- [x] Inspect all artwork in contact sheets and verify every built HTML image reference resolves to a correctly sized, decodable PNG.
- [x] Document authoring, regeneration, and social cache refresh in `BLOGGING.md`; run build, unit, Worker, browser, and Wrangler browser checks.

Live diagnosis: The shared article and existing PNG both return HTTP 200 to a Twitterbot user agent. The page already has `summary_large_image` and complete OG metadata. This does not establish why X rendered an empty card, nor prove access from X's network. Robots permits blog and image paths. New image URLs avoid reusing cached image bytes; social platforms may still require a page re-scrape.

Deployment is outside this change until requested, per repository instructions.


## Verified result

- 72 posts plus archive: 73 bespoke images, all unique. Built images are 1200×630 PNGs; maximum served size is 470,716 bytes.
- Build passed. Unit tests: 242 passed. Worker tests: 76 passed. Vite browser tests: 86 passed, 2 intentionally skipped. Wrangler browser tests: 87 passed, 1 intentionally skipped.
- All 72 Markdown diffs contain only `ogImage` and `ogImageAlt`; historical archive validation passes for 71 imported posts, 73 code blocks, and two tables.
- Live pre-change audit: 219 successful page/image checks covering all 73 URLs and three social-crawler user agents. This does not prove access from the platforms’ networks or invalidate their page caches.
- Code review findings were fixed: version hashes use query parameters on stable asset paths, preserving old cached URLs and avoiding ambiguous slug suffix parsing. A temporary Vite HTTP server verified source replacement, old/new version queries, and a slug ending in twelve hex characters.
- Artwork was generated with the built-in image tool and reviewed in contact sheets. Twenty-four covers were revised for shorter headlines or more accurate imagery. Prompts and source checksums are in `apps/jdconley-site/data/blog/social-images.json`; the local review gallery is `docs/blog-social-preview.html`.
- Production deployment remains pending an explicit request, per AGENTS.md.

## Approved author portrait extension

The user approved the circular gold-ring profile badge. All 73 final covers now composite the exact existing author photograph at build time. Six covers use a corner override to preserve headlines, author text, or key technology symbols. The original generated artwork remains untouched; all 73 source checksums still match the provenance manifest.

- [x] Add regression tests proving the photo is present, pixels outside the badge are unchanged, and photo changes update the image URL version.
- [x] Add the author portrait to Open Graph and X image descriptions.
- [x] Review all covers and the six adjusted placements; update the gallery to show final built PNGs.
- [x] Audit all 73 final images: unique versioned URLs, 1200×630 PNGs, maximum 456,646 bytes. Historical archive audit passes.
- [x] Production build, 243 unit tests, 76 Worker tests, and 86 static browser tests pass (2 environment-specific skips).
- [x] Wrangler browser tests: 87 passed, 1 environment-specific skip. No production deployment performed.
