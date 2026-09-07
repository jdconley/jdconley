import { readFile, writeFile } from "node:fs/promises";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import MarkdownIt from "markdown-it";
import { parseHTML } from "linkedom";
import { parse } from "yaml";
import sharp from "sharp";
import { validateFeed, remapUrl } from "../import-blogger.mjs";

const documentFor = html => parseHTML(`<html><body>${html}</body></html>`).document;
const textCharacters = node => node.textContent.replace(/\s/g, "");
const markdown = new MarkdownIt({ html: true });

export async function verifyImportedArchive({ root }) {
  if (root instanceof URL) root = fileURLToPath(root);
  const source = JSON.parse(await readFile(join(root, "data/blogger/posts.json"), "utf8"));
  const manifest = JSON.parse(await readFile(join(root, "data/blogger/manifest.json"), "utf8"));
  const redirects = JSON.parse(await readFile(join(root, "data/blogger/redirects.json"), "utf8"));
  const entries = validateFeed(source);
  const report = { posts: entries.length, codeBlocks: 0, tables: 0, images: 0, fragmentTargets: 0, repairedEditorLinks: 0, recoveredImageUrls: manifest.assets.filter(asset => asset.path).length, uniqueImageFiles: new Set(manifest.assets.filter(asset => asset.path).map(asset => asset.path)).size, unavailableImageUrls: manifest.failures.length, redirects: Object.keys(redirects).length, failures: [] };
  for (const entry of entries) {
    const item = manifest.posts.find(post => post.id === entry.id.$t);
    const fail = message => report.failures.push({ title: entry.title.$t, message });
    if (!item) { fail("Missing manifest entry"); continue; }
    const content = await readFile(join(root, item.path), "utf8");
    const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    if (!match) { fail("Missing YAML frontmatter"); continue; }
    const metadata = parse(match[1]);
    const originalUrl = entry.link.find(link => link.rel === "alternate").href;
    if (metadata.title !== entry.title.$t || metadata.date !== entry.published.$t || metadata.updated !== (entry.updated?.$t || entry.published.$t) || metadata.bloggerId !== entry.id.$t || metadata.originalUrl !== originalUrl || metadata.draft !== false || !metadata.description || `/blog/${metadata.slug}` !== item.newPath || JSON.stringify(metadata.tags) !== JSON.stringify((entry.category || []).map(category => category.term).sort())) fail("Metadata does not match source");
    if (createHash("sha256").update(content).digest("hex") !== item.checksum) fail("Markdown checksum differs from manifest");
    const before = documentFor(entry.content.$t); const after = documentFor(markdown.render(match[2]));
    for (const node of before.querySelectorAll("[id],a[name]")) {
      for (const id of new Set([node.getAttribute("id"), node.getAttribute("name")].filter(Boolean))) {
        report.fragmentTargets++;
        if (!after.getElementById(id)) fail(`Missing original fragment target: ${id}`);
      }
    }
    for (const link of before.querySelectorAll("a[href]")) {
      const url = new URL(link.getAttribute("href"), originalUrl);
      if (!["blogger.com", "www.blogger.com"].includes(url.hostname) || !["/post-create.g", "/post-edit.g"].includes(url.pathname) || !url.hash) continue;
      const target = after.getElementById(decodeURIComponent(url.hash.slice(1)));
      if (!target) { fail(`Missing target for archived editor TOC link: ${url.hash}`); continue; }
      const repaired = [...after.querySelectorAll("a[href]")].some(anchor => [url.hash, `${item.newPath}${url.hash}`].includes(anchor.getAttribute("href")) && textCharacters(anchor) === textCharacters(link));
      if (!repaired) fail(`Unconverted archived editor TOC link: ${url.href}`);
      else report.repairedEditorLinks++;
    }
    report.images += before.querySelectorAll("img").length;
    // Failed source images have a deliberate readable replacement; account for its added text.
    for (const image of before.querySelectorAll("img[src]")) {
      const url = new URL(image.getAttribute("src"), originalUrl).href;
      if (manifest.failures.some(asset => asset.url === url)) image.replaceWith(before.createTextNode(`Image unavailable: ${image.getAttribute("alt") || "archived image"} (original source)`));
    }
    if (textCharacters(before.body) !== textCharacters(after.body)) fail("Visible text characters changed (ignoring layout whitespace)");
    const codes = [...before.querySelectorAll("pre")].map(node => {
      // Compare against rendered source line breaks, not textContent's flattened BRs.
      for (const br of node.querySelectorAll("br")) br.replaceWith(before.createTextNode("\n"));
      return node.textContent.replace(/\n?$/, "\n");
    });
    report.codeBlocks += codes.length;
    if (JSON.stringify(codes) !== JSON.stringify([...after.querySelectorAll("pre")].map(node => node.textContent))) fail("Code block content or whitespace changed");
    const tables = before.querySelectorAll("table").length; report.tables += tables;
    if (tables !== after.querySelectorAll("table").length) fail("Table count changed");
    for (const image of after.querySelectorAll("img")) if (!image.getAttribute("src")?.startsWith("/blog-assets/imported/")) fail("An image still uses a remote URL");
    for (const link of after.querySelectorAll("a[href]")) if (remapUrl(link.getAttribute("href"), originalUrl, redirects) !== link.getAttribute("href")) fail(`Unconverted internal link: ${link.getAttribute("href")}`);
  }
  for (const asset of manifest.assets.filter(asset => asset.path)) {
    const bytes = await readFile(join(root, "public", asset.path));
    if (createHash("sha256").update(bytes).digest("hex") !== asset.checksum) report.failures.push({ asset: asset.path, message: "Asset checksum mismatch" });
    const metadata = await sharp(bytes, { animated: true }).metadata();
    if (asset.mime !== `image/${metadata.format}`) report.failures.push({ asset: asset.path, message: "Asset media type mismatch" });
    await sharp(bytes, { animated: true }).stats();
  }
  return report;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
  const report = await verifyImportedArchive({ root });
  await writeFile(join(root, "data/blogger/validation.json"), JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify(report, null, 2));
  if (report.failures.length) process.exitCode = 1;
}
