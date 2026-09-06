import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, expect, test } from "vitest";
import { stringify } from "yaml";
import { generateDiscovery } from "../../scripts/generate-llm-markdown.mjs";

const temporary = [];
afterEach(async () => Promise.all(temporary.splice(0).map(path => rm(path, { recursive: true, force: true }))));
const origin = "https://preview.example.test";
const body = 'A source introduction.\n\n~~~~csharp\n  Table<T> value;\n\treturn "```";\n~~~~\n\n| Name | Value |\n| --- | --- |\n| A | B |\n\n<a id="results"></a>\n\nThe original conclusion.';
const xmlEscape = text => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "blog-discovery-")); temporary.push(root);
  const dist = join(root, "dist"), contentDirectory = join(root, "content/blog");
  await mkdir(join(dist, "blog"), { recursive: true }); await mkdir(contentDirectory, { recursive: true });
  for (const [file, path] of [["index.html", "/"], ["how-this-is-built.html", "/how-this-is-built"], ["a-better-time.html", "/a-better-time"], ["blog.html", "/blog"], ["blog/published.html", "/blog/published"], ["blog/draft.html", "/blog/draft"]]) {
    await writeFile(join(dist, file), `<html><head><title>${xmlEscape(file)}</title><link rel="canonical" href="${origin}${path}"><meta name="description" content="Page description"></head><body><main><h1>Rendered page</h1><p>HTML body intentionally differs from authored Markdown.</p></main></body></html>`);
  }
  const metadata = { title: 'A "quoted" & <typed> [title]', date: "2025-02-03T12:15:00-08:00", slug: "published", description: "Published example", draft: false };
  await writeFile(join(contentDirectory, "published.md"), `---\n${stringify(metadata)}---\n\n${body}\n`);
  await writeFile(join(contentDirectory, "draft.md"), `---\n${stringify({ ...metadata, slug: "draft", draft: true, title: "Private draft title" })}---\n\nPrivate draft body.\n`);
  await writeFile(join(dist, "blog/draft.html.md"), "Stale private draft content");
  const robotsTemplate = join(root, "robots.txt");
  await writeFile(robotsTemplate, "User-agent: *\nAllow: /\nDisallow: /401.html\nSitemap: https://www.jdconley.com/sitemap.xml\n");
  return { dist, contentDirectory, robotsTemplate, baseUrl: origin, log: () => {} };
}

test("mirrors exact authored Markdown with publication metadata and excludes drafts everywhere", async () => {
  const options = await fixture();
  await generateDiscovery(options);
  const mirror = await readFile(join(options.dist, "blog/published.html.md"), "utf8");
  expect(mirror).toContain(body);
  expect(mirror).toContain("Published: 2025-02-03T12:15:00-08:00");
  expect(mirror).toContain(`URL: ${origin}/blog/published`);
  expect(mirror).not.toContain("HTML body intentionally differs");
  await expect(readFile(join(options.dist, "blog/draft.html.md"), "utf8")).rejects.toThrow(/ENOENT/);
  for (const name of ["llms.txt", "llms-full.txt", "sitemap.xml"]) expect(await readFile(join(options.dist, name), "utf8")).not.toMatch(/Private draft|\/blog\/draft/);
  const full = await readFile(join(options.dist, "llms-full.txt"), "utf8");
  expect(full).toContain('title="A &quot;quoted&quot; &amp; &lt;typed&gt; [title]"');
});

test("lists every active page using exact canonical URLs and emits matching robots sitemap", async () => {
  const options = await fixture();
  const pages = await generateDiscovery(options);
  const urls = pages.map(page => page.canonicalUrl).sort();
  expect(urls).toEqual(["/", "/how-this-is-built", "/a-better-time", "/blog", "/blog/published"].map(path => origin + path).sort());
  const sitemap = await readFile(join(options.dist, "sitemap.xml"), "utf8");
  expect([...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map(match => match[1]).sort()).toEqual(urls);
  const robots = await readFile(join(options.dist, "robots.txt"), "utf8");
  expect(robots).toContain(`Sitemap: ${origin}/sitemap.xml`);
  expect(robots).toContain("Disallow: /401.html");
  expect(robots).not.toContain("www.jdconley.com");
  const index = await readFile(join(options.dist, "llms.txt"), "utf8");
  for (const page of pages) {
    expect(index).toContain(`(${origin}/${page.relPath}.md)`);
    expect((await readFile(join(options.dist, `${page.relPath}.md`), "utf8")).length).toBeGreaterThan(0);
  }
});
