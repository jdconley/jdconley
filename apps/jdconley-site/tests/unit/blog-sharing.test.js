import { it, expect } from "vitest";
import { parseHTML } from "linkedom";
import sharp from "sharp";
import { resolve } from "node:path";
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
