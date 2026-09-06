import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadPosts, renderMarkdown } from "../../scripts/blog/content.mjs";
import { buildBlog } from "../../scripts/blog/render.mjs";

const dirs = [];
async function fixture(files) {
  const dir = await mkdtemp(join(tmpdir(), "jd-blog-test-")); dirs.push(dir);
  for (const [name, text] of Object.entries(files)) await writeFile(join(dir, name), text);
  return dir;
}
afterEach(async () => { await Promise.all(dirs.splice(0).map(dir => rm(dir, { recursive: true, force: true }))); });
const post = (slug, extra = "", body = "Hello, **world**.") => `---\ntitle: A post\ndate: 2026-09-05\nslug: ${slug}\n${extra}---\n\n${body}\n`;

describe("Markdown blog", () => {
  it("sorts posts, validates dates, and excludes drafts from the public collection", async () => {
    const dir = await fixture({ "a.md": post("one", "date: 2026-09-04\n"), "b.md": post("draft", "draft: true\n") });
    // Duplicate YAML keys must fail rather than silently choosing one value.
    await expect(loadPosts(dir)).rejects.toThrow(/a.md/);
    await writeFile(join(dir, "a.md"), post("one"));
    expect((await loadPosts(dir)).map(p => p.slug)).toEqual(["one"]);
    expect(await loadPosts(dir, { includeDrafts: true })).toHaveLength(2);
  });
  it.each(["2026-02-30", "September 5", "2026-99-99"])("rejects invalid date %s", async date => {
    const dir = await fixture({ "bad.md": post("bad").replace("2026-09-05", date) });
    await expect(loadPosts(dir)).rejects.toThrow(/date/);
  });
  it("rejects duplicate and reserved slugs, path traversal, and nonboolean drafts", async () => {
    const dir = await fixture({ "a.md": post("same"), "b.md": post("same") });
    await expect(loadPosts(dir)).rejects.toThrow(/Duplicate slug/);
    await rm(join(dir, "b.md"));
    for (const slug of ["../escape", "feed", "index", "UPPER"]) {
      await writeFile(join(dir, "a.md"), post(slug));
      await expect(loadPosts(dir)).rejects.toThrow(/slug/);
    }
    await writeFile(join(dir, "a.md"), post("good", 'draft: "false"\n'));
    await expect(loadPosts(dir)).rejects.toThrow(/draft/);
  });
  it("renders code and tables while removing executable HTML and unsafe URLs", () => {
    const html = renderMarkdown('```js\nif (a < b) {\n  work();\n}\n```\n\n| A | B |\n| - | - |\n| 1 | 2 |\n\n<script>alert(1)</script><img src="x" onerror="alert(1)"><a href="javascript:alert(1)">link</a>');
    expect(html).toContain('if (a &lt; b) {\n  work();\n}');
    expect(html).toContain("<table>");
    expect(html).not.toMatch(/<script|onerror|javascript:/);
  });
  it("emits only published pages and RSS, including when handed a development collection", async () => {
    const dir = await fixture({ "public.md": post("public"), "secret.md": post("secret", "draft: true\n", "SECRET-DRAFT-BODY") });
    const posts = await loadPosts(dir, { includeDrafts: true });
    const files = buildBlog(posts, "https://jdconley.com");
    expect([...files.keys()]).toEqual(["blog.html", "blog/public.html", "blog/feed.xml"]);
    expect([...files.values()].join("")).not.toContain("SECRET-DRAFT-BODY");
    expect(files.get("blog/public.html")).toContain('href="https://jdconley.com/blog/public" rel="canonical"');
    expect(files.get("blog/feed.xml")).toContain("https://jdconley.com/blog/public");
    expect(files.get("blog/public.html")).toContain('href="/blog"');
  });
});
