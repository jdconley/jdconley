import { it, expect } from "vitest";
import { parseHTML } from "linkedom";
import sharp from "sharp";
import { resolve } from "node:path";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { parsePost } from "../../scripts/blog/content.mjs";
import { buildBlog } from "../../scripts/blog/render.mjs";
import { renderShareImage } from "../../scripts/blog/share-image.mjs";

it("provides crawlable large social cards and valid article and archive schema", () => {
  const post = parsePost('---\ntitle: A <great> title\ndate: 2026-09-05\nslug: sharing\n---\n\nHello.', 'sharing.md');
  const files = buildBlog([post], "https://jdconley.com");
  for (const path of ["blog.html", "blog/sharing.html"]) {
    const { document } = parseHTML(files.get(path));
    expect(document.querySelector('[name="twitter:card"]').content).toBe("summary_large_image");
    expect(document.querySelector('[property="og:image:width"]').content).toBe("1200");
    expect(document.querySelector('[property="og:image:height"]').content).toBe("630");
    expect(document.querySelector('[property="og:image"]').content).toMatch(/^https:\/\/jdconley.com\/blog-assets\/social\//);
    expect(document.querySelector('[name="twitter:image"]').content).toBe(document.querySelector('[property="og:image"]').content);
    expect(JSON.parse(document.querySelector('[type="application/ld+json"]').textContent)).toHaveProperty("@type", path === "blog.html" ? "Blog" : "BlogPosting");
  }
  const { document } = parseHTML(files.get("blog/sharing.html"));
  expect(JSON.parse(document.querySelector('[type="application/ld+json"]').textContent).headline).toBe(post.title);
});

it("renders a real 1200 by 630 PNG using bundled fonts", async () => {
  const png = await renderShareImage({ title: "Put down the abstract factory and get something done", date: "2009-01-26", root: resolve(".") });
  const meta = await sharp(png).metadata();
  expect([meta.format, meta.width, meta.height]).toEqual(["png", 1200, 630]);
  expect(png.length).toBeLessThan(1_000_000);
});

it.each(["https://example.com/image.png", "/blog-assets/../private.png", "/blog-assets/a.svg", "//example.com/a.png", 42, ""])("rejects unsupported sharing image sources: %s", ogImage => {
  expect(() => parsePost(`---\ntitle: Test\ndate: 2026-09-07\nslug: test\nogImage: ${JSON.stringify(ogImage)}\n---\nBody`, "test.md")).toThrow(/ogImage/);
});

it("validates sharing image descriptions", () => {
  expect(() => parsePost('---\ntitle: Test\ndate: 2026-09-07\nslug: test\nogImageAlt: 123\n---\nBody', 'test.md')).toThrow(/ogImageAlt/);
});

it("uses the prepared image URL and escaped custom alt consistently", () => {
  const post = parsePost('---\ntitle: Test\ndate: 2026-09-07\nslug: test\nogImage: /blog-assets/og/test.jpg\nogImageAlt: A "bright" idea & a spark\n---\nBody', 'test.md');
  const files = buildBlog([post], "https://jdconley.com", { shareImages: { test: "/blog-assets/social/test.png?v=abcdef123456" } });
  const { document } = parseHTML(files.get("blog/test.html"));
  const url = "https://jdconley.com/blog-assets/social/test.png?v=abcdef123456";
  for (const selector of ['[property="og:image"]', '[property="og:image:secure_url"]', '[name="twitter:image"]']) expect(document.querySelector(selector).content).toBe(url);
  for (const selector of ['[property="og:image:alt"]', '[name="twitter:image:alt"]']) expect(document.querySelector(selector).content).toBe('A "bright" idea & a spark Author portrait of JD Conley.');
  expect(JSON.parse(document.querySelector('[type="application/ld+json"]').textContent).image.url).toBe(url);
});

it("normalizes configured artwork and fails for missing or invalid image bytes", async () => {
  const root = await mkdtemp(resolve(tmpdir(), "blog-og-"));
  try {
    await mkdir(resolve(root, "public/blog-assets"), { recursive: true });
    await writeFile(resolve(root, "public/blog-assets/test.jpg"), await sharp({ create: { width: 800, height: 800, channels: 3, background: "#ff9900" } }).jpeg().toBuffer());
    const result = await renderShareImage({ title: "Test", root, ogImage: "/blog-assets/test.jpg" });
    const meta = await sharp(result).metadata();
    expect([meta.format, meta.width, meta.height]).toEqual(["png", 1200, 630]);
    await expect(renderShareImage({ title: "Test", root, ogImage: "/blog-assets/missing.jpg" })).rejects.toThrow(/missing.jpg/);
    await writeFile(resolve(root, "public/blog-assets/invalid.jpg"), "not an image");
    await expect(renderShareImage({ title: "Test", root, ogImage: "/blog-assets/invalid.jpg" })).rejects.toThrow();
  } finally { await rm(root, { recursive: true, force: true }); }
});

it("versions image URLs when artwork or the author photo changes", async () => {
  const { prepareShareImage } = await import("../../scripts/blog/share-image.mjs");
  const root = await mkdtemp(resolve(tmpdir(), "blog-og-hash-"));
  try {
    await mkdir(resolve(root, "public/blog-assets"), { recursive: true });
    await mkdir(resolve(root, "images"));
    const portraitPath = resolve(root, "images/headshot-256x256.png");
    await writeFile(portraitPath, await sharp({ create: { width: 256, height: 256, channels: 3, background: "green" } }).png().toBuffer());
    const path = resolve(root, "public/blog-assets/test.png");
    const post = { slug: "test", title: "Test", ogImage: "/blog-assets/test.png" };
    await writeFile(path, await sharp({ create: { width: 1200, height: 630, channels: 3, background: "red" } }).png().toBuffer());
    const first = await prepareShareImage(post, root);
    expect(first.path).toMatch(/^\/blog-assets\/social\/test\.png\?v=[a-f0-9]{12}$/);
    expect((await prepareShareImage(post, root)).path).toBe(first.path);
    await writeFile(path, await sharp({ create: { width: 1200, height: 630, channels: 3, background: "blue" } }).png().toBuffer());
    const second = await prepareShareImage(post, root);
    expect(second.path).not.toBe(first.path);
    await writeFile(portraitPath, await sharp({ create: { width: 256, height: 256, channels: 3, background: "yellow" } }).png().toBuffer());
    expect((await prepareShareImage(post, root)).path).not.toBe(second.path);
  } finally { await rm(root, { recursive: true, force: true }); }
});


it("superimposes the exact author photo while preserving artwork outside the badge", async () => {
  const { prepareShareImage } = await import("../../scripts/blog/share-image.mjs");
  const root = await mkdtemp(resolve(tmpdir(), "blog-og-portrait-"));
  try {
    await mkdir(resolve(root, "public/blog-assets"), { recursive: true });
    await mkdir(resolve(root, "images"));
    await writeFile(resolve(root, "public/blog-assets/test.png"), await sharp({ create: { width: 1200, height: 630, channels: 3, background: "#ff0000" } }).png().toBuffer());
    await writeFile(resolve(root, "images/headshot-256x256.png"), await sharp({ create: { width: 256, height: 256, channels: 3, background: "#00ff00" } }).png().toBuffer());
    const { source } = await prepareShareImage({ slug: "portrait-test", title: "Test", ogImage: "/blog-assets/test.png" }, root);
    const pixel = async (left, top) => [...await sharp(source).extract({ left, top, width: 1, height: 1 }).removeAlpha().raw().toBuffer()];
    expect(await pixel(1092, 522)).toEqual([0, 255, 0]);
    expect(await pixel(50, 50)).toEqual([255, 0, 0]);
    expect(await pixel(1012, 442)).toEqual([255, 0, 0]); // Outside the circular mask.
    const before = await sharp(resolve(root, "public/blog-assets/test.png")).extract({ left: 0, top: 0, width: 1000, height: 630 }).removeAlpha().raw().toBuffer();
    const after = await sharp(source).extract({ left: 0, top: 0, width: 1000, height: 630 }).removeAlpha().raw().toBuffer();
    expect(after.equals(before)).toBe(true);
  } finally { await rm(root, { recursive: true, force: true }); }
});
