import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import TurndownService from "turndown";
import { gfm } from "turndown-plugin-gfm";
import { parseHTML } from "linkedom";
import sharp from "sharp";
import MarkdownIt from "markdown-it";
import { stringify } from "yaml";

const sourceUrl = "https://blog.jdconley.com/feeds/posts/default?alt=json&max-results=500";
// Verified links present in the exported posts, predating the Blogger migration.
const legacyAliases = {
  "/blog/archive/2009/01/20/concurrency.-its-like-doing-the-dishes.aspx": "concurrency-its-like-doing-dishes",
  "/blog/archive/2009/01/19/dont-hire-a-programmer-if-they-dont-code-for-fun.aspx": "dont-hire-programmer-if-they-dont-code",
  "/blog/archive/2009/01/12/10-reasons-asp.net-webforms-suck.aspx": "10-reasons-aspnet-webforms-suck",
  "/blog/archive/2009/01/16/asp.net-mvc-sucks-and-so-does-jquery-and-php.aspx": "aspnet-mvc-sucks-and-so-does-jquery-and",
  "/blog/archive/2006/06/02/fun-installing-vista-beta-2-on-amd-x64.aspx": "fun-installing-vista-beta-2-on-amd-x64",
  "/blog/archive/2007/10/07/vista-rant.aspx": "vista-rant",
  "/blog/archive/2006/09/16/soapbox-platform-possibilities.aspx": "soapbox-platform-possibilities",
  "/blog/archive/2007/12/06/geeks-with-kids.aspx": "geeks-with-kids",
  "/blog/archive/2006/06/26/how-to-build-scalable-.net-server-applications-memory-management.aspx": "how-to-build-scalable-net-server",
  "/blog/archive/2007/04/10/building-reactive-user-interfaces-in-.net-isynchronizeinvoke-on-idle-time.aspx": "building-reactive-user-interfaces-in",
  "/blog/archive/2007/06/08/simpler-isnt-always-better---asyncoperationsmanager.aspx": "simpler-isnt-always-better",
  "/blog/archive/2007/09/28/asyncify-your-code-again.aspx": "asyncify-your-code",
  "/blog/archive/2007/11/27/photo-feeds-facebook-application.aspx": "photo-feeds-facebook-application",
  "/blog/archive/2007/12/05/async-facebook-library-teaser.aspx": "async-facebook-library-teaser",
  "/blog/archive/2007/09/19/asp.net-centric-extensions.aspx": "aspnet-centric-extensions",
  "/blog/archive/2007/08/28/clean-up-a-string-for-a-url.aspx": "clean-up-string-for-url"
};
const hash = value => createHash("sha256").update(value).digest("hex");
const documentFor = html => parseHTML(`<html><body>${html}</body></html>`).document;
const normalizeText = text => text.replace(/\s+/g, " ").trim();
const hasVisibleContent = html => {
  const document = documentFor(html);
  for (const hidden of document.querySelectorAll("script,style,template,[hidden]")) hidden.remove();
  return Boolean(normalizeText(document.body.textContent) || [...document.querySelectorAll("img[src]")].some(image => image.getAttribute("src").trim()));
};
const originalUrlFor = entry => entry.link?.find(link => link.rel === "alternate")?.href;
const slugFor = entry => new URL(originalUrlFor(entry)).pathname.split("/").pop().replace(/\.html$/, "");
const readJson = async (path, fallback) => {
  try { return JSON.parse(await readFile(path, "utf8")); } catch (error) { if (error.code === "ENOENT") return fallback; throw error; }
};

export function validateFeed(source) {
  const entries = source.feed?.entry;
  if (!Array.isArray(entries) || !entries.length) throw new Error("Feed contains no posts");
  if (Number(source.feed.openSearch$totalResults?.$t) !== entries.length) throw new Error("Partial feed: source count does not match entries");
  const ids = new Set(); const slugs = new Set(); const paths = new Set();
  for (const entry of entries) {
    if (!entry.id?.$t || !entry.title?.$t || typeof entry.content?.$t !== "string" || !originalUrlFor(entry) || !Number.isFinite(Date.parse(entry.published?.$t))) throw new Error("Post is missing required metadata or full content");
    if (!hasVisibleContent(entry.content.$t)) throw new Error(`Post has empty visible content: ${entry.title.$t}`);
    const slug = slugFor(entry); const path = new URL(originalUrlFor(entry)).pathname;
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new Error(`Invalid post slug: ${slug}`);
    if (ids.has(entry.id.$t) || slugs.has(slug) || paths.has(path)) throw new Error(`Duplicate post identity or destination: ${slug}`);
    ids.add(entry.id.$t); slugs.add(slug); paths.add(path);
  }
  return entries;
}

export function remapUrl(value, originalUrl, redirects = {}) {
  let url;
  try { url = new URL(value, originalUrl); } catch { return value; }
  if (!["blog.jdconley.com", "jdconley.blogspot.com", "jdconley.com", "www.jdconley.com"].includes(url.hostname) || !redirects[url.pathname]) return value;
  url.searchParams.delete("m");
  return `${redirects[url.pathname]}${url.search}${url.hash}`;
}

export function convertHtml(html, { originalUrl, redirects = {}, assets = [], bloggerId = "" } = {}) {
  const document = documentFor(html);
  const identity = bloggerId.match(/blog-(\d+)\.post-(\d+)$/);
  // These editor URLs came from Blogger's link editor. Rebind only verified local targets.
  for (const link of document.querySelectorAll("a[href]")) {
    let url; try { url = new URL(link.getAttribute("href"), originalUrl); } catch { continue; }
    if (!identity || !["www.blogger.com", "blogger.com"].includes(url.hostname) || !["/post-create.g", "/post-edit.g"].includes(url.pathname) || url.searchParams.get("blogID") !== identity[1] || (url.searchParams.has("postID") && url.searchParams.get("postID") !== identity[2]) || !url.hash) continue;
    let fragment; try { fragment = decodeURIComponent(url.hash.slice(1)); } catch { continue; }
    let target = [...document.querySelectorAll("[id],a[name]")].find(node => node.id === fragment || node.getAttribute("name") === fragment);
    if (!target) {
      const introduction = document.querySelector("h1,h2,h3,strong,b");
      if (fragment === "intro" && introduction && normalizeText(introduction.textContent) === normalizeText(link.textContent)) { introduction.id = fragment; target = introduction; }
    }
    if (target) link.setAttribute("href", url.hash);
  }
  for (const node of [...document.querySelectorAll("[id],a[name]")]) {
    for (const id of new Set([node.getAttribute("id"), node.getAttribute("name")].filter(Boolean))) {
      const marker = document.createElement("blog-import-anchor");
      marker.setAttribute("data-id", id); marker.textContent = "anchor";
      const location = node.closest("a") || node;
      location.before(marker);
    }
    node.removeAttribute("id"); node.removeAttribute("name");
  }
  const byUrl = new Map(assets.map(asset => [asset.url, asset]));
  for (const image of document.querySelectorAll("img")) {
    const url = new URL(image.getAttribute("src"), originalUrl).href;
    const asset = byUrl.get(url);
    if (asset?.path) image.setAttribute("src", asset.path);
    else if (asset?.error) {
      const notice = document.createElement("span");
      notice.textContent = `Image unavailable: ${image.getAttribute("alt") || "archived image"} (`;
      const link = document.createElement("a"); link.href = url; link.textContent = "original source";
      notice.append(link, document.createTextNode(")")); image.replaceWith(notice);
    }
  }
  for (const link of document.querySelectorAll("a[href]")) {
    const value = link.getAttribute("href");
    let absolute; try { absolute = new URL(value, originalUrl).href; } catch { continue; }
    link.setAttribute("href", byUrl.get(absolute)?.path || remapUrl(value, originalUrl, redirects));
  }
  // Blogger exports use TD for header rows; GFM requires an explicit header row.
  for (const table of document.querySelectorAll("table")) {
    const firstRow = table.querySelector("tr");
    if (firstRow && !firstRow.querySelector("th")) for (const cell of [...firstRow.children]) {
      const header = document.createElement("th"); header.innerHTML = cell.innerHTML; cell.replaceWith(header);
    }
  }
  const turndown = new TurndownService({ headingStyle: "atx", codeBlockStyle: "fenced", bulletListMarker: "-", emDelimiter: "*" });
  const escape = turndown.escape.bind(turndown);
  turndown.escape = text => escape(text).replace(/</g, "&lt;").replace(/>/g, "&gt;");
  turndown.use(gfm);
  turndown.addRule("preserveFragmentTargets", {
    filter: "blog-import-anchor",
    replacement: (_content, node) => {
      const id = node.getAttribute("data-id").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      return `\n\n<a id="${id}"></a>\n\n`;
    }
  });
  turndown.addRule("doubleTildeStrike", { filter: ["del", "s", "strike"], replacement: content => `~~${content}~~` });
  turndown.addRule("emphasisBoundaries", {
    filter: ["em", "i", "strong", "b"],
    replacement: (content, node) => {
      const marker = ["STRONG", "B"].includes(node.nodeName) ? "**" : "*";
      const before = node.previousSibling?.nodeType === 3 && /\S$/.test(node.previousSibling.textContent) ? " " : "";
      const after = node.nextSibling?.nodeType === 3 && /^\S/.test(node.nextSibling.textContent) ? " " : "";
      return content.trim() ? `${before}${content.match(/^\s*/)[0]}${marker}${content.trim()}${marker}${content.match(/\s*$/)[0]}${after}` : content;
    }
  });
  turndown.addRule("allPreformattedBlocks", {
    filter: "pre",
    replacement: (_content, node) => {
      const code = node.textContent;
      const length = Math.max(3, ...[...code.matchAll(/`+/g)].map(match => match[0].length + 1));
      const fence = "`".repeat(length);
      const language = (node.firstElementChild?.getAttribute("class") || "").match(/language-([\w+-]+)/)?.[1] || "";
      return `\n\n${fence}${language}\n${code}${code.endsWith("\n") ? "" : "\n"}${fence}\n\n`;
    }
  });
  return turndown.turndown(document.body.innerHTML).trim() + "\n";
}

function collectAssets(entries) {
  const urls = new Set();
  for (const entry of entries) {
    const document = documentFor(entry.content.$t);
    for (const image of document.querySelectorAll("img[src]")) {
      urls.add(new URL(image.getAttribute("src"), originalUrlFor(entry)).href);
      const link = image.closest("a[href]");
      if (link) {
        const url = new URL(link.getAttribute("href"), originalUrlFor(entry));
        if (/\.(?:png|jpe?g|gif|webp|avif|svg)(?:$)/i.test(url.pathname) || /(?:googleusercontent|blogspot)\.com$/.test(url.hostname)) urls.add(url.href);
      }
    }
  }
  return [...urls].sort();
}

async function recoverAsset(url, { root, fetchImpl }) {
  const attempts = url.startsWith("http:") ? [url.replace(/^http:/, "https:"), url] : [url];
  const errors = [];
  for (const candidate of attempts) {
    try {
      const response = await fetchImpl(candidate, { signal: AbortSignal.timeout(15000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const mime = response.headers.get("content-type")?.split(";")[0].trim().toLowerCase();
      if (!mime?.startsWith("image/")) throw new Error(`Unexpected media type ${mime || "missing"}`);
      const buffer = Buffer.from(await response.arrayBuffer());
      if (!buffer.length || buffer.length > 25 * 1024 * 1024) throw new Error("Invalid image size");
      const metadata = await sharp(buffer, { animated: true }).metadata();
      if (!metadata.width || !metadata.height || !["jpeg", "png", "gif", "webp", "avif"].includes(metadata.format)) throw new Error("Unsupported or invalid raster image");
      if (mime !== `image/${metadata.format}`) throw new Error(`Media type ${mime} does not match ${metadata.format} bytes`);
      await sharp(buffer, { animated: true }).stats();
      const checksum = hash(buffer); const extension = metadata.format === "jpeg" ? "jpg" : metadata.format;
      const path = `/blog-assets/imported/${checksum.slice(0, 24)}.${extension}`;
      await mkdir(join(root, "public/blog-assets/imported"), { recursive: true });
      await writeFile(join(root, "public", path), buffer);
      return { url, recoveredUrl: candidate, path, checksum, bytes: buffer.length, mime, width: metadata.width, height: metadata.height };
    } catch (error) { errors.push(`${candidate}: ${error.message}`); }
  }
  return { url, error: errors.join("; ") };
}

export async function importBlogger({ root, source, fetchImpl = fetch, retryFailed = false }) {
  const entries = validateFeed(source);
  const previous = await readJson(join(root, "data/blogger/manifest.json"), { posts: [], assets: [] });
  // Preflight every destination before downloads or writes so human edits are never replaced.
  for (const entry of entries) {
    const path = `content/blog/${slugFor(entry)}.md`;
    try {
      const existing = await readFile(join(root, path));
      const recorded = previous.posts.find(post => post.path === path);
      if (!recorded || recorded.checksum !== hash(existing)) throw new Error(`Refusing to overwrite manually edited Markdown: ${path}`);
    } catch (error) { if (error.code !== "ENOENT") throw error; }
  }
  const slugs = new Set(entries.map(slugFor));
  const redirects = Object.fromEntries([
    ...entries.map(entry => [new URL(originalUrlFor(entry)).pathname, `/blog/${slugFor(entry)}`]),
    ...Object.entries(legacyAliases).filter(([, slug]) => slugs.has(slug)).map(([path, slug]) => [path, `/blog/${slug}`])
  ].sort(([a], [b]) => a.localeCompare(b)));
  const urls = collectAssets(entries); const assets = new Array(urls.length); let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(6, urls.length) }, async () => {
    while (cursor < urls.length) {
      const index = cursor++; const url = urls[index];
      const saved = previous.assets.find(asset => asset.url === url);
      if (saved?.path) {
        try { if (hash(await readFile(join(root, "public", saved.path))) === saved.checksum) { assets[index] = saved; continue; } } catch (error) { if (error.code !== "ENOENT") throw error; }
      } else if (saved?.error && !retryFailed) { assets[index] = saved; continue; }
      assets[index] = await recoverAsset(url, { root, fetchImpl });
    }
  }));
  for (const asset of assets.filter(asset => asset.error)) {
    asset.posts = entries.filter(entry => collectAssets([entry]).includes(asset.url)).map(entry => ({ id: entry.id.$t, title: entry.title.$t, path: `content/blog/${slugFor(entry)}.md` }));
  }
  const posts = []; const pending = [];
  const renderer = new MarkdownIt({ html: true });
  for (const entry of entries) {
    const originalUrl = originalUrlFor(entry); const slug = slugFor(entry);
    const text = normalizeText(documentFor(entry.content.$t).body.textContent);
    const description = text.length > 180 ? `${text.slice(0, 177).replace(/\s+\S*$/, "")}…` : text;
    const metadata = { title: entry.title.$t, date: entry.published.$t, slug, description, tags: (entry.category || []).map(category => category.term).sort(), draft: false, updated: entry.updated?.$t || entry.published.$t, bloggerId: entry.id.$t, originalUrl };
    const body = convertHtml(entry.content.$t, { originalUrl, redirects, assets, bloggerId: entry.id.$t });
    if (!hasVisibleContent(renderer.render(body))) throw new Error(`Converted post has empty visible content: ${entry.title.$t}`);
    const markdown = `---\n${stringify(metadata, { lineWidth: 0 })}---\n\n${body}`;
    const path = `content/blog/${slug}.md`;
    pending.push({ path, markdown });
    posts.push({ id: entry.id.$t, path, originalPath: new URL(originalUrl).pathname, newPath: `/blog/${slug}`, checksum: hash(markdown) });
  }
  // Finish all conversions and checks before replacing any Markdown destination.
  for (const { path, markdown } of pending) {
    await mkdir(dirname(join(root, path)), { recursive: true });
    await writeFile(join(root, path), markdown);
  }
  const manifest = { sourceUrl, count: entries.length, posts: posts.sort((a, b) => a.path.localeCompare(b.path)), assets, failures: assets.filter(asset => asset.error) };
  await mkdir(join(root, "data/blogger"), { recursive: true });
  await writeFile(join(root, "data/blogger/posts.json"), JSON.stringify(source, null, 2) + "\n");
  await writeFile(join(root, "data/blogger/redirects.json"), JSON.stringify(redirects, null, 2) + "\n");
  await writeFile(join(root, "data/blogger/manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
  return manifest;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const args = process.argv.slice(2).filter(arg => arg !== "--");
  const unknown = args.filter((arg, index) => !["--source", "--fetch"].includes(arg) && args[index - 1] !== "--source");
  if (unknown.length || (args.includes("--source") && !args[args.indexOf("--source") + 1])) throw new Error("Usage: node scripts/import-blogger.mjs [--source path] [--fetch]");
  let source;
  if (args.includes("--fetch")) {
    const response = await fetch(sourceUrl, { signal: AbortSignal.timeout(30000) });
    if (!response.ok) throw new Error(`Feed request failed: ${response.status}`);
    source = await response.json();
  } else source = JSON.parse(await readFile(args.includes("--source") ? resolve(args[args.indexOf("--source") + 1]) : join(root, "data/blogger/posts.json"), "utf8"));
  const result = await importBlogger({ root, source, retryFailed: args.includes("--fetch") });
  console.log(`Imported ${result.count} posts; ${result.assets.filter(asset => asset.path).length} image URLs recovered (${new Set(result.assets.filter(asset => asset.path).map(asset => asset.path)).size} unique files); ${result.failures.length} unavailable images.`);
  for (const failure of result.failures) console.warn(`${failure.posts.map(post => post.title).join(", ")}: ${failure.error}`);
}
