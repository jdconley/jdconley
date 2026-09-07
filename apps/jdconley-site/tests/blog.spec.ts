import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { fileURLToPath } from "node:url";
import { loadPosts } from "../scripts/blog/content.mjs";

let publishedPosts: Array<{ slug: string }>;
test.beforeAll(async () => {
  publishedPosts = await loadPosts(fileURLToPath(new URL("../content/blog/", import.meta.url)));
});

test("blog has dedicated navigation and opens articles without JavaScript", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto(process.env.E2E_SERVER === "wrangler" ? "http://127.0.0.1:8788/blog" : "http://127.0.0.1:4173/blog");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Starin’ at the Wall.");
  await expect(page.locator(".story")).toHaveCount(publishedPosts.length);
  const articleLinks = await page.locator(".story h2 a").evaluateAll(links => links.map(link => link.getAttribute("href")));
  expect(articleLinks).toEqual(publishedPosts.map(post => `/blog/${post.slug}`));
  await expect(page.getByRole("navigation", { name: "Blog navigation" })).toBeVisible();
  await expect(page.getByRole("link", { name: "About JD" })).toHaveAttribute("href", "/");
  await page.getByRole("heading", { name: "Put down the abstract factory and get something done" }).getByRole("link").click();
  await expect(page.locator(".prose")).toContainText("shipping your product");
  await expect(page.locator(".prose")).toHaveCSS("font-family", /Georgia/);
  await expect(page.getByRole("link", { name: "All writing" })).toHaveAttribute("href", "/blog");
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", "https://jdconley.com/blog/put-down-abstract-factory-and-get");
  await context.close();
});

test("historical code, tables, and recovered images render on narrow screens", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/blog/install-nodejs-in-10-seconds-or-less");
  await expect(page.locator(".prose pre")).toContainText("#!/bin/sh");
  await page.goto("/blog/iodrive-changing-way-you-code");
  await expect(page.locator(".prose table")).toHaveCount(2);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.goto("/blog/worry-less-do-more-be-fearless");
  const images = page.locator(".prose img");
  expect(await images.count()).toBeGreaterThan(0);
  for (const image of await images.all()) {
    await image.scrollIntoViewIfNeeded();
    await expect(image).toHaveAttribute("src", /^\/blog-assets\/imported\//);
    await expect.poll(() => image.evaluate((node: HTMLImageElement) => node.complete && node.naturalWidth > 0)).toBe(true);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("blog pages meet automated accessibility checks in both color schemes", async ({ page }) => {
  for (const scheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto("/blog/put-down-abstract-factory-and-get");
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
    expect(results.violations).toEqual([]);
  }
});

test("migrated C# code preserves lines and highlighting without JavaScript in both themes", async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, baseURL });
  const page = await context.newPage();
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 900 });
    for (const colorScheme of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme });
      await page.goto("/blog/sorted-affair-history-of-c-sort");
      const blocks = page.locator(".prose pre code");
      await expect(blocks).toHaveCount(6);
      expect(await blocks.first().textContent()).toContain("public class Person\n{\n  public string FirstName");
      expect(await blocks.nth(4).textContent()).toBe("public IEnumerable<Person> SortCS3(IEnumerable<Person> people)\n{\n  return people.OrderBy(p => p.FirstName);\n}\n");
      await expect(blocks.first()).toHaveAttribute("class", "language-csharp");
      await expect(page.locator(".prose pre").first()).toHaveCSS("white-space", "pre");
      const keywordColor = await blocks.first().locator(".hljs-keyword").first().evaluate(node => getComputedStyle(node).color);
      const textColor = await blocks.first().evaluate(node => getComputedStyle(node).color);
      expect(keywordColor).not.toBe(textColor);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      if (width === 390) {
        const firstBlock = page.locator(".prose pre").first();
        await firstBlock.focus();
        await expect(firstBlock).toBeFocused();
        await page.keyboard.press("ArrowRight");
        await expect.poll(() => firstBlock.evaluate(node => node.scrollLeft)).toBeGreaterThan(0);
      }
    }
  }
  await context.close();
});

test("highlighted code has accessible contrast in both color schemes", async ({ page }) => {
  for (const colorScheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme });
    await page.goto("/blog/sorted-affair-history-of-c-sort");
    const results = await new AxeBuilder({ page }).include(".prose pre").withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
    expect(results.violations).toEqual([]);
  }
});

test("RSS, sitemap, Markdown mirrors and absent-post status are correct", async ({ request }) => {
  const feed = await request.get("/blog/feed.xml");
  expect(feed.ok()).toBe(true);
  const xml = await feed.text();
  expect((xml.match(/<item>/g) || [])).toHaveLength(publishedPosts.length);
  for (const post of publishedPosts) expect(xml).toContain(`<link>https://jdconley.com/blog/${post.slug}</link>`);
  expect(xml).toContain("https://jdconley.com/blog/worry-less-do-more-be-fearless");
  expect(xml).toContain("https://jdconley.com/blog-assets/imported/");
  const sitemap = await (await request.get("/sitemap.xml")).text();
  expect(sitemap).toContain("<loc>https://jdconley.com/blog/put-down-abstract-factory-and-get</loc>");
  expect((await request.get("/blog/put-down-abstract-factory-and-get.html.md")).ok()).toBe(true);
  expect((await request.get("/blog/a-post-that-does-not-exist")).status()).toBe(404);
});

test("legacy permalinks redirect through the Worker", async ({ request }) => {
  test.skip(process.env.E2E_SERVER !== "wrangler", "Worker routing only");
  const response = await request.get("/2009/01/functional-optimistic-concurrency-in-c.html?m=1&utm_source=archive", { maxRedirects: 0 });
  expect(response.status()).toBe(301);
  // Wrangler rewrites same-site Location origins to its local preview origin.
  // The unit test verifies the production origin; here verify routing and query handling.
  const destination = new URL(response.headers().location);
  expect(destination.pathname + destination.search).toBe("/blog/functional-optimistic-concurrency-in-c?utm_source=archive");
  expect((await request.get(destination.pathname + destination.search)).status()).toBe(200);
});

test("published blog header, author portraits, and favicon load as images", async ({ page, request }) => {
  for (const path of ["/blog", "/blog/put-down-abstract-factory-and-get"]) {
    await page.goto(path);
    const portraits = page.locator(".brand img, .author img, .author-end img");
    expect(await portraits.count()).toBe(path === "/blog" ? 1 : 3);
    for (const portrait of await portraits.all()) {
      await expect.poll(() => portrait.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true);
    }
    const favicon = await page.locator('link[rel="icon"]').getAttribute("href");
    const response = await request.get(favicon!);
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("image/");
  }
});
