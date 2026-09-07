import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, test } from "vitest";
import MarkdownIt from "markdown-it";
import { parseHTML } from "linkedom";
import { convertHtml, validateFeed, remapUrl, importBlogger } from "../../scripts/import-blogger.mjs";
import { verifyImportedArchive } from "../../scripts/blog/import-validation.mjs";

const directories = [];
afterEach(async () => { await Promise.all(directories.splice(0).map(path => rm(path, { recursive: true, force: true }))); });
const entry = (id, slug, html = "<p>Hello world</p>") => ({ id: { $t: id }, title: { $t: "A & B" }, published: { $t: "2010-01-02T10:00:00-08:00" }, updated: { $t: "2010-02-03T10:00:00-08:00" }, link: [{ rel: "alternate", href: `https://blog.jdconley.com/2010/02/${slug}.html` }], content: { $t: html }, category: [{ term: "code" }] });
const feed = entries => ({ feed: { openSearch$totalResults: { $t: String(entries.length) }, entry: entries } });

test("rejects partial feeds and duplicate identities or destinations", () => {
  const source = feed([entry("1", "first")]);
  source.feed.openSearch$totalResults.$t = "2";
  expect(() => validateFeed(source)).toThrow(/count|partial/i);
  expect(() => validateFeed(feed([entry("1", "first"), entry("1", "second")]))).toThrow(/duplicate/i);
  expect(() => validateFeed(feed([entry("1", "first"), entry("2", "first")]))).toThrow(/duplicate/i);
});

test("rejects empty visible source content before changing any existing posts", async () => {
  for (const html of ["", "   ", "<p>&nbsp; </p>", "<!-- nothing --><style>body {color:red}</style>"]) {
    expect(() => validateFeed(feed([entry("1", "first", html)]))).toThrow(/empty|visible content/i);
  }
  const root = await mkdtemp(join(tmpdir(), "blogger-test-")); directories.push(root);
  await importBlogger({ root, source: feed([entry("1", "first"), entry("2", "second")]) });
  const before = await readFile(join(root, "content/blog/first.md"), "utf8");
  await expect(importBlogger({ root, source: feed([entry("1", "first", "<p>Changed</p>"), entry("2", "second", "<p> </p>")]) })).rejects.toThrow(/empty|visible content/i);
  expect(await readFile(join(root, "content/blog/first.md"), "utf8")).toBe(before);
});

test("preserves named and ID anchors safely and fixes verified same-post Blogger editor TOC links", () => {
  const html = '<strong>Introduction</strong><p>Intro text</p><a href="http://www.blogger.com/post-create.g?blogID=123#intro">Introduction</a><a href="http://www.blogger.com/post-create.g?blogID=123#results">Results</a><a href="http://www.blogger.com/post-create.g?blogID=999#results">Another blog</a><a href="http://www.blogger.com/post-edit.g?blogID=123&postID=other#results">Another post</a><a name="results"></a><h2>Results</h2><p id="safe&amp;&quot;id">Done</p>';
  const converted = convertHtml(html, { originalUrl: "https://blog.jdconley.com/2010/02/first.html", bloggerId: "tag:blogger.com,1999:blog-123.post-456" });
  const { document } = parseHTML(`<html><body>${new MarkdownIt({ html: true }).render(converted)}</body></html>`);
  expect(document.getElementById("results")).not.toBeNull();
  expect(document.getElementById('safe&"id')).not.toBeNull();
  expect(document.getElementById("intro")).not.toBeNull();
  const hrefs = [...document.querySelectorAll("a[href]")].map(node => node.getAttribute("href"));
  expect(hrefs).toContain("#results");
  expect(hrefs).toContain("#intro");
  expect(hrefs).toContain("http://www.blogger.com/post-create.g?blogID=999#results");
  expect(hrefs).toContain("http://www.blogger.com/post-edit.g?blogID=123&postID=other#results");
});

test("converts bare PRE, nested code whitespace, tables and strike without losing text", () => {
  const source = '<p>A &amp; B <strike>old</strike></p><pre>  a &lt; b\n\treturn "```";\n</pre><pre><code> x\n  y</code></pre><table><tbody><tr><td>Name</td><td>Value</td></tr><tr><td>A</td><td>B</td></tr></tbody></table>';
  const markdown = convertHtml(source, { originalUrl: "https://blog.jdconley.com/2010/02/first.html" });
  const rendered = new MarkdownIt().render(markdown);
  const { document } = parseHTML(`<html><body>${rendered}</body></html>`);
  expect(markdown).toContain("~~old~~");
  expect(document.querySelectorAll("table")).toHaveLength(1);
  expect([...document.querySelectorAll("pre")].map(node => node.textContent)).toEqual(['  a < b\n\treturn "```";\n', ' x\n  y\n']);
  expect(document.body.textContent).toContain("A & B old");
});

test("preserves Blogger BR line breaks, blank lines, indentation and literal markup in code", () => {
  const html = '<pre class="brush: c-sharp;">public class Person<br>{<br><br>  // &lt;br&gt; is literal\n\tstring name = "```";<BR />}</pre>';
  const converted = convertHtml(html);
  const { document } = parseHTML(`<html><body>${new MarkdownIt().render(converted)}</body></html>`);
  expect(document.querySelector("pre code").textContent).toBe('public class Person\n{\n\n  // <br> is literal\n\tstring name = "```";\n}\n');
  expect(document.querySelector("code").getAttribute("class")).toBe("language-csharp");
});

test.each([
  ['class="brush: as3"', "actionscript"],
  ['class="brush: xslt;"', "xml"],
  ['class="brush: shell"', "bash"],
  ['class="brush: sql;"', "sql"],
  ['class="language-js"', "js"],
])("retains language metadata from PRE %s", (attributes, language) => {
  expect(convertHtml(`<pre ${attributes}>sample</pre>`)).toContain(`\`\`\`${language}\nsample\n`);
});

test("retains modern nested code language labels", () => {
  expect(convertHtml('<pre><code class="language-typescript">const x = 1;</code></pre>')).toContain("```typescript\n");
});

test("preserves leading and trailing blank lines encoded as BRs", () => {
  const converted = convertHtml('<pre><br><br>  first<br>\tsecond<br><br></pre>');
  expect(converted).toBe("```\n\n\n  first\n\tsecond\n\n```\n");
});

test("remaps actual Blogger permalink preserving query and fragment except mobile flag", () => {
  const redirects = { "/2008/02/second.html": "/blog/second" };
  expect(remapUrl("http://blog.jdconley.com/2008/02/second.html?m=1&x=2#code", "https://blog.jdconley.com/2010/02/first.html", redirects)).toBe("/blog/second?x=2#code");
  expect(remapUrl("../../2008/02/second.html#code", "https://blog.jdconley.com/2010/02/first.html", redirects)).toBe("/blog/second#code");
  expect(remapUrl("https://example.com/2008/02/second.html", "https://blog.jdconley.com", redirects)).toBe("https://example.com/2008/02/second.html");
  expect(remapUrl("http://www.jdconley.com/blog/archive/2007/12/06/geeks-with-kids.aspx#128", "https://blog.jdconley.com", { "/blog/archive/2007/12/06/geeks-with-kids.aspx": "/blog/geeks-with-kids" })).toBe("/blog/geeks-with-kids#128");
});

test("all saved source posts retain metadata, text, code and tables in the migrated Markdown", async () => {
  const report = await verifyImportedArchive({ root: new URL("../../", import.meta.url) });
  expect(report.posts).toBe(71);
  expect(report.codeBlocks).toBe(73);
  expect(report.tables).toBe(2);
  expect(report.fragmentTargets).toBeGreaterThanOrEqual(5);
  expect(report.repairedEditorLinks).toBe(6);
  expect(report.failures).toEqual([]);
});

test("preserves generic type literals and emphasis beside text or starting with a break", () => {
  const html = '<i>Update:</i>I use Table&lt;T&gt;.<br><strong><br>Setting up your page</strong>';
  const markdown = convertHtml(html, { originalUrl: "https://blog.jdconley.com/a.html" });
  const { document } = parseHTML(`<html><body>${new MarkdownIt({ html: true }).render(markdown)}</body></html>`);
  expect(document.querySelector("em")?.textContent).toBe("Update:");
  expect(document.querySelector("strong")?.textContent).toBe("Setting up your page");
  expect(document.body.textContent).toContain("Table<T>");
});

test("keeps nested lists as lists when a list item begins with emphasis", () => {
  const markdown = convertHtml('<ul><li><strong>First</strong><p>Details</p><ol><li>One</li><li>Two</li></ol></li></ul>');
  const { document } = parseHTML(`<html><body>${new MarkdownIt().render(markdown)}</body></html>`);
  expect(document.querySelectorAll("pre")).toHaveLength(0);
  expect(document.querySelectorAll("ul ol li")).toHaveLength(2);
});

test("imports repeatably, records actual path, and refuses to overwrite human edits", async () => {
  const root = await mkdtemp(join(tmpdir(), "blogger-test-")); directories.push(root);
  const source = feed([entry("1", "first")]);
  await importBlogger({ root, source });
  const path = join(root, "content/blog/first.md");
  const first = await readFile(path, "utf8");
  expect(first).toContain('date: 2010-01-02T10:00:00-08:00');
  expect(JSON.parse(await readFile(join(root, "data/blogger/redirects.json"), "utf8"))).toEqual({ "/2010/02/first.html": "/blog/first" });
  await importBlogger({ root, source });
  expect(await readFile(path, "utf8")).toBe(first);
  await writeFile(path, `${first}\nHuman correction\n`);
  await expect(importBlogger({ root, source })).rejects.toThrow(/manually edited|modified/i);
  expect(await readFile(path, "utf8")).toContain("Human correction");
});

test("downloads and deduplicates validated images and their linked originals, reports failed media", async () => {
  const root = await mkdtemp(join(tmpdir(), "blogger-test-")); directories.push(root);
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64");
  const requests = [];
  const fetchImpl = async url => { requests.push(String(url)); return String(url).includes("missing") ? new Response("not image", { headers: { "content-type": "text/html" } }) : new Response(png, { headers: { "content-type": "image/png" } }); };
  const source = feed([entry("1", "first", '<a href="http://images.example/large.png"><img src="http://images.example/small.png" alt="My image"></a><img src="http://images.example/missing.gif" alt="Old image">')]);
  const result = await importBlogger({ root, source, fetchImpl });
  const markdown = await readFile(join(root, "content/blog/first.md"), "utf8");
  expect(result.assets.filter(asset => asset.path)).toHaveLength(2);
  expect(new Set(result.assets.filter(asset => asset.path).map(asset => asset.path)).size).toBe(1);
  expect(markdown).toContain("/blog-assets/imported/");
  expect(markdown).toContain("Image unavailable: Old image");
  expect(markdown).toContain("http://images.example/missing.gif");
  expect(requests).toContain("https://images.example/missing.gif");
  expect(result.failures).toHaveLength(1);
  expect(result.failures[0].posts).toEqual([{ id: "1", title: "A & B", path: "content/blog/first.md" }]);
  await importBlogger({ root, source, fetchImpl: () => { throw new Error("repeat import must use saved assets"); } });
});

test("rejects failed HTTP responses, corrupt raster data and MIME mismatches", async () => {
  const root = await mkdtemp(join(tmpdir(), "blogger-test-")); directories.push(root);
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64");
  const source = feed([entry("1", "first", '<img src="http://images.example/http.png"><img src="http://images.example/corrupt.png"><img src="http://images.example/mismatch.png">')]);
  const fetchImpl = async url => String(url).includes("http.png") ? new Response(png, { status: 404, headers: { "content-type": "image/png" } }) : String(url).includes("corrupt") ? new Response(png.subarray(0, 40), { headers: { "content-type": "image/png" } }) : new Response(png, { headers: { "content-type": "image/jpeg" } });
  const result = await importBlogger({ root, source, fetchImpl });
  expect(result.failures).toHaveLength(3);
  expect(result.assets.every(asset => !asset.path)).toBe(true);
});

test("archive validation permits sharing metadata while retaining content and reimport protection", async () => {
  const root = await mkdtemp(join(tmpdir(), "blogger-social-")); directories.push(root);
  const source = feed([entry("1", "first")]);
  await importBlogger({ root, source });
  const path = join(root, "content/blog/first.md");
  const original = await readFile(path, "utf8");
  const customized = original.replace("\n---\n", '\nogImage: /blog-assets/og/first.jpg\nogImageAlt: >-\n  A bright\n  illustration.\n---\n');
  await writeFile(path, customized);
  expect((await verifyImportedArchive({ root })).failures).toEqual([]);
  await expect(importBlogger({ root, source })).rejects.toThrow(/manually edited|modified/i);
  await writeFile(path, customized + "\n<!-- editorial change -->\n");
  expect((await verifyImportedArchive({ root })).failures).toContainEqual(expect.objectContaining({ message: "Markdown checksum differs from manifest" }));
});
