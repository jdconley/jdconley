import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import MarkdownIt from "markdown-it";
import { parse } from "yaml";
import sanitizeHtml from "sanitize-html";
import { parseHTML } from "linkedom";
import hljs from "highlight.js";

const markdown = new MarkdownIt({
  html: true, linkify: false, typographer: false,
  highlight(code, language) {
    // Unlabelled output and unknown languages stay escaped, preformatted text.
    if (!language || !hljs.getLanguage(language)) return "";
    return hljs.highlight(code, { language, ignoreIllegals: true }).value;
  }
});
export const validSlug = slug => typeof slug === "string" && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) && !["feed", "index"].includes(slug);
export const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);

export function renderMarkdown(body) {
  return sanitizeHtml(markdown.render(body), {
    allowedTags: [...sanitizeHtml.defaults.allowedTags, "img", "figure", "figcaption", "s", "del", "u"],
    allowedAttributes: {
      a: ["href", "title", "id", "name"], img: ["src", "alt", "title", "width", "height"],
      pre: ["tabindex"], code: ["class"], span: ["class"], th: ["colspan", "rowspan", "scope"], td: ["colspan", "rowspan"],
      "*": ["id"]
    },
    allowedClasses: { span: [/^hljs-[\w-]+$/, /^[\w-]+_+$/] },
    allowedSchemes: ["http", "https", "mailto"],
    allowedSchemesByTag: { img: ["https"] },
    allowProtocolRelative: false,
    transformTags: {
      img: (tagName, attribs) => ({ tagName, attribs: { ...attribs, alt: attribs.alt ?? "", loading: "lazy", decoding: "async" } }),
      pre: (tagName, attribs) => ({ tagName, attribs: { ...attribs, tabindex: "0" } })
    },
  });
}

function validateDate(value, field) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2}))?$/.test(value)) throw new Error(`Invalid ${field}: use an ISO date or timestamp`);
  const day = new Date(`${value.slice(0, 10)}T00:00:00Z`);
  if (!Number.isFinite(Date.parse(value)) || !Number.isFinite(+day) || day.toISOString().slice(0, 10) !== value.slice(0, 10)) throw new Error(`Invalid ${field}: ${value}`);
  return value;
}

export function parsePost(source, filename) {
  try {
    const front = source.replace(/^\uFEFF/, "").match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)([\s\S]*)$/);
    if (!front) throw new Error("Missing YAML front matter");
    const meta = parse(front[1]);
    if (!meta || typeof meta !== "object" || Array.isArray(meta)) throw new Error("Invalid front matter");
    if (typeof meta.title !== "string" || !meta.title.trim()) throw new Error("Missing title");
    if (!validSlug(meta.slug)) throw new Error("Invalid or reserved slug");
    validateDate(meta.date, "date");
    if (meta.updated !== undefined) validateDate(meta.updated, "updated");
    if (meta.draft !== undefined && typeof meta.draft !== "boolean") throw new Error("draft must be a boolean");
    if (meta.description !== undefined && typeof meta.description !== "string") throw new Error("description must be text");
    if (meta.tags !== undefined && (!Array.isArray(meta.tags) || meta.tags.some(tag => typeof tag !== "string" || !tag.trim()))) throw new Error("tags must be an array of nonempty strings");
    for (const field of ["originalUrl", "bloggerId"]) if (meta[field] !== undefined && typeof meta[field] !== "string") throw new Error(`${field} must be text`);
    const body = front[2].trim();
    if (!body) throw new Error("Post body is empty");
    const html = renderMarkdown(body);
    const { document } = parseHTML(`<html><body>${html}</body></html>`);
    const text = document.body.textContent.replace(/\s+/g, " ").trim();
    const excerpt = meta.description?.trim() || (text.length > 180 ? `${text.slice(0, 177).replace(/\s+\S*$/, "")}…` : text);
    return { ...meta, title: meta.title.trim(), draft: meta.draft ?? false, tags: meta.tags ?? [], description: excerpt, body, html, filename, minutes: Math.max(1, Math.ceil(text.split(/\s+/).length / 220)) };
  } catch (error) { throw new Error(`${filename}: ${error.message}`, { cause: error }); }
}

export async function loadPosts(directory, { includeDrafts = false } = {}) {
  let files;
  try { files = await readdir(directory, { withFileTypes: true }); }
  catch (error) { if (error.code === "ENOENT") return []; throw error; }
  const posts = await Promise.all(files.filter(file => file.isFile() && file.name.endsWith(".md")).sort((a, b) => a.name.localeCompare(b.name)).map(async file => parsePost(await readFile(join(directory, file.name), "utf8"), file.name)));
  const slugs = new Set(); const ids = new Set();
  for (const post of posts) {
    if (slugs.has(post.slug)) throw new Error(`Duplicate slug: ${post.slug} (${post.filename})`);
    slugs.add(post.slug);
    if (post.bloggerId && ids.has(post.bloggerId)) throw new Error(`Duplicate Blogger ID: ${post.bloggerId}`);
    if (post.bloggerId) ids.add(post.bloggerId);
  }
  return posts.filter(post => includeDrafts || !post.draft).sort((a, b) => Date.parse(b.date) - Date.parse(a.date) || a.slug.localeCompare(b.slug));
}
