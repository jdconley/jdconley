#!/usr/bin/env node

/**
 * Post-build script that generates LLM-friendly artifacts from the dist/ HTML:
 *   - *.html.md   — markdown version of each included page
 *   - sitemap.xml — XML sitemap for search engines
 *   - llms.txt    — curated index per llmstxt.org spec
 *   - llms-full.txt — all page content inlined for single-fetch consumption
 */

import { readFileSync, writeFileSync, readdirSync, statSync, existsSync, rmSync } from "node:fs";
import { join, relative, extname, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import TurndownService from "turndown";
import { parseHTML } from "linkedom";
import { loadPosts, escapeHtml } from "./blog/content.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST = join(__dirname, "..", "dist");
const BASE_URL = (process.env.VITE_SITE_URL ?? "https://jdconley.com").replace(/\/+$/, "");

const INCLUDE_PAGES = new Set(["index.html", "how-this-is-built.html", "a-better-time.html", "blog.html"]);
const escapeMarkdownLabel = value => String(value).replace(/\\/g, "\\\\").replace(/[\[\]]/g, "\\$&").replace(/\s+/g, " ");

const EXCLUDE_PAGES = new Set([
  "401.html",
  "404.html",
  "home-version-2.html",
  "home-version-3.html",
  "old-home.html",
  "info/changelog.html",
  "info/licenses.html",
  "info/style-guide.html",
]);

// ---------------------------------------------------------------------------
// Turndown setup
// ---------------------------------------------------------------------------

const turndown = new TurndownService({
  headingStyle: "atx",
  bulletListMarker: "-",
  codeBlockStyle: "fenced",
  emDelimiter: "*",
});

turndown.remove(["script", "style", "nav", "noscript", "iframe"]);

turndown.addRule("skipImages", {
  filter: "img",
  replacement(_content, node) {
    const alt = node.getAttribute("alt");
    return alt ? `[image: ${alt}]` : "";
  },
});

turndown.addRule("cleanLinks", {
  filter(node) {
    return node.nodeName === "A" && node.getAttribute("href");
  },
  replacement(content, node) {
    const href = node.getAttribute("href");
    const text = content.replace(/\n+/g, " ").replace(/\s+/g, " ").trim();
    if (!text) return "";
    return `[${text}](${href})`;
  },
});

// ---------------------------------------------------------------------------
// HTML helpers
// ---------------------------------------------------------------------------

function collectHtmlFiles(dir, base = dir) {
  const results = [];
  for (const entry of readdirSync(dir)) {
    const abs = join(dir, entry);
    const stat = statSync(abs);
    if (stat.isDirectory()) {
      results.push(...collectHtmlFiles(abs, base));
    } else if (extname(entry) === ".html") {
      results.push(relative(base, abs).replace(/\\/g, "/"));
    }
  }
  return results.sort();
}

function parseHtmlFile(relPath, dist) {
  const html = readFileSync(join(dist, relPath), "utf-8");
  const { document } = parseHTML(html);
  const title =
    document.querySelector("title")?.textContent?.trim() ?? relPath;
  const description =
    document
      .querySelector('meta[name="description"]')
      ?.getAttribute("content")
      ?.trim() ?? "";
  return { document, title, description, html };
}

function extractMainContent(document) {
  const clone = document.documentElement.cloneNode(true);

  for (const sel of ["nav", ".navbar", "script", "style", "noscript", "link", "meta", "head"]) {
    for (const el of clone.querySelectorAll(sel)) el.remove();
  }

  const main = clone.querySelector("main") ?? clone.querySelector("body") ?? clone;
  return main.innerHTML;
}

// ---------------------------------------------------------------------------
// Markdown generation for a single page
// ---------------------------------------------------------------------------

function htmlToMarkdown(relPath, { dist, baseUrl, post }) {
  const parsed = parseHtmlFile(relPath, dist);
  const { document } = parsed;
  const title = post?.title || parsed.title;
  const description = post?.description || parsed.description;
  const innerHtml = extractMainContent(document);
  let md = post ? post.body : turndown.turndown(innerHtml);

  if (!post) md = md
    .replace(/\n{3,}/g, "\n\n")
    .replace(/^\s+|\s+$/g, "");

  const canonicalUrl = document.querySelector('link[rel="canonical"]')?.getAttribute("href") || `${baseUrl}/${relPath.replace(/^index\.html$/, "").replace(/\.html$/, "")}`;
  const header = [
    `# ${title}`,
    "",
    description ? `> ${description}` : null,
    description ? "" : null,
    `URL: ${canonicalUrl}`,
    post ? `Published: ${post.date}` : null,
    post?.updated ? `Updated: ${post.updated}` : null,
    "",
    "---",
    "",
  ]
    .filter((line) => line !== null)
    .join("\n");

  return { markdown: header + md + "\n", title, description, canonicalUrl, document, modified: post?.updated || post?.date || document.querySelector('meta[property="article:modified_time"]')?.getAttribute("content") };
}

// ---------------------------------------------------------------------------
// Sitemap generation
// ---------------------------------------------------------------------------

function generateSitemap(pages) {
  const urls = pages.map(
    (p) => `  <url>
    <loc>${escapeHtml(p.canonicalUrl)}</loc>${p.modified ? `\n    <lastmod>${escapeHtml(p.modified)}</lastmod>` : ""}
  </url>`
  );

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join("\n")}
</urlset>
`;
}

// ---------------------------------------------------------------------------
// llms.txt generation
// ---------------------------------------------------------------------------

function extractKeyInfo(document) {
  const info = {};

  const contactLinks = document.querySelectorAll("#contact a");
  for (const a of contactLinks) {
    const href = a.getAttribute("href") ?? "";
    const text = a.textContent.trim();
    if (href.startsWith("mailto:")) info.email = text;
    else if (href.startsWith("tel:")) info.phone = text;
    else if (href.includes("twitter.com")) info.twitter = text;
    else if (href.includes("maps")) info.location = text;
  }

  const projectSections = document.querySelectorAll(".projects-link");
  info.projects = [];
  for (const proj of projectSections) {
    const title = proj.querySelector(".projects-title")?.textContent?.trim();
    const descEl = proj.querySelector(".projects-info");
    let desc = "";
    if (descEl) {
      desc = descEl.innerHTML
        .replace(/<br\s*\/?>/gi, " | ")
        .replace(/<[^>]+>/g, "")
        .replace(/&#\d+;/g, " ")
        .replace(/&nbsp;/g, " ")
        .replace(/\s+/g, " ")
        .replace(/\|\s*$/g, "")
        .trim();
    }
    if (title) info.projects.push({ title, desc });
  }

  const currentRole = document.querySelector("#current-role .last-project-copy");
  if (currentRole) {
    const text = currentRole.textContent.trim().split(/\.\s/)[0];
    info.currentRole = text.length > 200 ? text.slice(0, 200) + "..." : text + ".";
  }

  return info;
}

function generateLlmsTxt(pages, { baseUrl, dist }) {
  const homePage = pages.find((p) => p.relPath === "index.html");
  const description = homePage?.description ?? "";
  const keyInfo = homePage ? extractKeyInfo(homePage.document) : {};

  const pageLinks = pages
    .map((p) => `- [${escapeMarkdownLabel(p.title)}](${baseUrl}/${p.relPath}.md): ${(p.description || "Page content").replace(/\s+/g, " ")}`)
    .join("\n");

  const projectLines = (keyInfo.projects ?? [])
    .map((p) => `- ${p.title}: ${p.desc}`)
    .join("\n");

  return `# JD Conley

> ${description}

## Pages

${pageLinks}

## Key Information

- Current Role: ${keyInfo.currentRole ?? "See homepage for details"}
- Email: ${keyInfo.email ?? ""}
- Twitter: ${keyInfo.twitter ?? ""}
- Phone: ${keyInfo.phone ?? ""}
- Location: ${keyInfo.location ?? ""}

### Projects

${projectLines}

## Optional

- [Full content version](${baseUrl}/llms-full.txt): All page content expanded inline in a single file
${existsSync(join(dist, "how-this-is-built/logs/index.json")) ? `- [Build logs manifest](${baseUrl}/how-this-is-built/logs/index.json): JSON index of AI build log entries\n` : ""}- [Sitemap](${baseUrl}/sitemap.xml): XML sitemap of all public pages
`;
}

// ---------------------------------------------------------------------------
// llms-full.txt generation
// ---------------------------------------------------------------------------

function generateLlmsFullTxt(pages, baseUrl) {
  const parts = pages.map(
    (p) => `<page url="${escapeHtml(p.canonicalUrl)}" title="${escapeHtml(p.title)}">
${p.markdown}
</page>`
  );

  return `# JD Conley — Full Site Content

> This file contains the full markdown content of all public pages on jdconley.com.
> It is intended for LLMs and AI agents that can consume a single large context.
> See also: ${baseUrl}/llms.txt (curated index with links)

${parts.join("\n\n")}
`;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

export async function generateDiscovery({ dist = DIST, contentDirectory = join(__dirname, "../content/blog"), baseUrl = BASE_URL, robotsTemplate = join(__dirname, "../public/robots.txt"), log = console.log } = {}) {
  baseUrl = baseUrl.replace(/\/+$/, "");
  const posts = await loadPosts(contentDirectory);
  const published = new Map(posts.map(post => [`blog/${post.slug}.html`, post]));
  const allHtml = collectHtmlFiles(dist);
  const included = allHtml.filter(
    (f) => (INCLUDE_PAGES.has(f) || published.has(f)) && !EXCLUDE_PAGES.has(f)
  );
  // A post changed to a draft must not leave a previously generated public mirror behind.
  if (existsSync(join(dist, "blog"))) for (const name of readdirSync(join(dist, "blog"))) {
    if (name.endsWith(".html.md") && !published.has(`blog/${name.slice(0, -3)}`)) rmSync(join(dist, "blog", name));
  }

  log(`[llm-markdown] Found ${allHtml.length} HTML files, including ${included.length} for LLM output`);

  const pages = [];

  for (const relPath of included) {
    const page = htmlToMarkdown(relPath, { dist, baseUrl, post: published.get(relPath) });
    writeFileSync(join(dist, `${relPath}.md`), page.markdown, "utf-8");
    log(`[llm-markdown]   ${relPath}.md (${page.markdown.length} chars)`);
    pages.push({ relPath, ...page });
  }

  const sitemap = generateSitemap(pages);
  writeFileSync(join(dist, "sitemap.xml"), sitemap, "utf-8");
  log(`[llm-markdown]   sitemap.xml (${pages.length} URLs)`);

  const llmsTxt = generateLlmsTxt(pages, { baseUrl, dist });
  writeFileSync(join(dist, "llms.txt"), llmsTxt, "utf-8");
  log(`[llm-markdown]   llms.txt`);

  const llmsFullTxt = generateLlmsFullTxt(pages, baseUrl);
  writeFileSync(join(dist, "llms-full.txt"), llmsFullTxt, "utf-8");
  log(`[llm-markdown]   llms-full.txt (${llmsFullTxt.length} chars)`);
  const template = readFileSync(robotsTemplate, "utf8");
  const robots = template.replace(/^Sitemap:.*(?:\r?\n|$)/gmi, "").trimEnd() + `\n\nSitemap: ${baseUrl}/sitemap.xml\n`;
  writeFileSync(join(dist, "robots.txt"), robots, "utf8");

  log("[llm-markdown] Done.");
  return pages;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await generateDiscovery();
