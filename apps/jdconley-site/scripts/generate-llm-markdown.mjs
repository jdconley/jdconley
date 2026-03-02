#!/usr/bin/env node

/**
 * Post-build script that generates LLM-friendly artifacts from the dist/ HTML:
 *   - *.html.md   — markdown version of each included page
 *   - sitemap.xml — XML sitemap for search engines
 *   - llms.txt    — curated index per llmstxt.org spec
 *   - llms-full.txt — all page content inlined for single-fetch consumption
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, extname, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import TurndownService from "turndown";
import { parseHTML } from "linkedom";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST = join(__dirname, "..", "dist");
const BASE_URL = (process.env.VITE_SITE_URL ?? "https://www.jdconley.com").replace(/\/+$/, "");

const INCLUDE_PAGES = new Set(["index.html", "how-this-is-built.html"]);

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

function parseHtmlFile(relPath) {
  const html = readFileSync(join(DIST, relPath), "utf-8");
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

function htmlToMarkdown(relPath) {
  const { document, title, description } = parseHtmlFile(relPath);
  const innerHtml = extractMainContent(document);
  let md = turndown.turndown(innerHtml);

  md = md
    .replace(/\n{3,}/g, "\n\n")
    .replace(/^\s+|\s+$/g, "");

  const canonicalUrl = `${BASE_URL}/${relPath.replace(/^index\.html$/, "")}`;
  const header = [
    `# ${title}`,
    "",
    description ? `> ${description}` : null,
    description ? "" : null,
    `URL: ${canonicalUrl}`,
    "",
    "---",
    "",
  ]
    .filter((line) => line !== null)
    .join("\n");

  return { markdown: header + md + "\n", title, description, canonicalUrl, document };
}

// ---------------------------------------------------------------------------
// Sitemap generation
// ---------------------------------------------------------------------------

function generateSitemap(pages) {
  const now = new Date().toISOString().split("T")[0];
  const urls = pages.map(
    (p) => `  <url>
    <loc>${p.canonicalUrl}</loc>
    <lastmod>${now}</lastmod>
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

function generateLlmsTxt(pages) {
  const homePage = pages.find((p) => p.relPath === "index.html");
  const description = homePage?.description ?? "";
  const keyInfo = homePage ? extractKeyInfo(homePage.document) : {};

  const pageLinks = pages
    .map((p) => `- [${p.title}](${BASE_URL}/${p.relPath}.md): ${p.description || "Page content"}`)
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

- [Full content version](${BASE_URL}/llms-full.txt): All page content expanded inline in a single file
- [Build logs manifest](${BASE_URL}/how-this-is-built/logs/index.json): JSON index of AI build log entries
- [Sitemap](${BASE_URL}/sitemap.xml): XML sitemap of all public pages
`;
}

// ---------------------------------------------------------------------------
// llms-full.txt generation
// ---------------------------------------------------------------------------

function generateLlmsFullTxt(pages) {
  const parts = pages.map(
    (p) => `<page url="${p.canonicalUrl}" title="${p.title}">
${p.markdown}
</page>`
  );

  return `# JD Conley — Full Site Content

> This file contains the full markdown content of all public pages on jdconley.com.
> It is intended for LLMs and AI agents that can consume a single large context.
> See also: ${BASE_URL}/llms.txt (curated index with links)

${parts.join("\n\n")}
`;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  const allHtml = collectHtmlFiles(DIST);
  const included = allHtml.filter(
    (f) => INCLUDE_PAGES.has(f) && !EXCLUDE_PAGES.has(f)
  );

  console.log(`[llm-markdown] Found ${allHtml.length} HTML files, including ${included.length} for LLM output`);

  const pages = [];

  for (const relPath of included) {
    const { markdown, title, description, canonicalUrl, document } = htmlToMarkdown(relPath);
    const mdPath = join(DIST, `${relPath}.md`);
    writeFileSync(mdPath, markdown, "utf-8");
    console.log(`[llm-markdown]   ${relPath}.md (${markdown.length} chars)`);
    pages.push({ relPath, markdown, title, description, canonicalUrl, document });
  }

  const sitemap = generateSitemap(pages);
  writeFileSync(join(DIST, "sitemap.xml"), sitemap, "utf-8");
  console.log(`[llm-markdown]   sitemap.xml (${pages.length} URLs)`);

  const llmsTxt = generateLlmsTxt(pages);
  writeFileSync(join(DIST, "llms.txt"), llmsTxt, "utf-8");
  console.log(`[llm-markdown]   llms.txt`);

  const llmsFullTxt = generateLlmsFullTxt(pages);
  writeFileSync(join(DIST, "llms-full.txt"), llmsFullTxt, "utf-8");
  console.log(`[llm-markdown]   llms-full.txt (${llmsFullTxt.length} chars)`);

  console.log("[llm-markdown] Done.");
}

main();
