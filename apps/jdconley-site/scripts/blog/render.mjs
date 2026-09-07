import { parseHTML } from "linkedom";
import { escapeHtml as e } from "./content.mjs";

const blogName = "Starin’ at the Wall";
const dateLabel = value => new Intl.DateTimeFormat("en-US", { dateStyle: "long", timeZone: "UTC" }).format(new Date(`${value.slice(0, 10)}T12:00:00Z`));
const urlFor = post => `/blog/${post.slug}`;
const metadata = post => `<time datetime="${e(post.date)}">${dateLabel(post.date)}</time><span>${post.minutes} min read</span>`;

function shell({ title, description, path, content, origin, post }) {
  const canonical = `${origin}${path}`;
  const image = `${origin}/blog-assets/social/${post ? post.slug : "index"}.png`;
  const author = { "@type": "Person", "@id": `${origin}/#jd-conley`, name: "JD Conley", url: origin, sameAs: ["https://www.linkedin.com/in/jdconley/", "https://x.com/wackie", "https://github.com/jdconley"] };
  const schema = post ? { "@context": "https://schema.org", "@type": "BlogPosting", "@id": `${canonical}#article`, headline: post.title, description, datePublished: post.date, dateModified: post.updated || post.date, mainEntityOfPage: canonical, author, publisher: author, inLanguage: "en-US", isAccessibleForFree: true, keywords: post.tags, image: { "@type": "ImageObject", url: image, width: 1200, height: 630 } } : { "@context": "https://schema.org", "@type": "Blog", "@id": canonical, url: canonical, name: blogName, description, author, inLanguage: "en-US", image };
  const structured = `<script type="application/ld+json">${JSON.stringify(schema).replace(/</g, "\\u003c")}</script>`;
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${e(title)} — JD Conley</title><meta name="description" content="${e(description)}">
<link href="${e(canonical)}" rel="canonical"><link rel="alternate" type="application/rss+xml" title="${e(blogName)}" href="${origin}/blog/feed.xml">
<link rel="alternate" type="text/markdown" href="${path}.html.md"><link rel="icon" href="/images/favicon.png">
<meta name="author" content="JD Conley"><meta name="robots" content="${post?.draft ? "noindex,nofollow" : "index,follow,max-image-preview:large"}">
<meta property="og:type" content="${post ? "article" : "website"}"><meta property="og:title" content="${e(title)}"><meta property="og:description" content="${e(description)}"><meta property="og:url" content="${e(canonical)}"><meta property="og:site_name" content="JD Conley — Writing"><meta property="og:locale" content="en_US"><meta property="og:image" content="${image}"><meta property="og:image:secure_url" content="${image}"><meta property="og:image:type" content="image/png"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:image:alt" content="${e(title)} — JD Conley">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:site" content="@wackie"><meta name="twitter:creator" content="@wackie"><meta name="twitter:title" content="${e(title)}"><meta name="twitter:description" content="${e(description)}"><meta name="twitter:image" content="${image}"><meta name="twitter:image:alt" content="${e(title)} — JD Conley">
${post ? `<meta property="article:published_time" content="${e(post.date)}"><meta property="article:modified_time" content="${e(post.updated || post.date)}">` : ""}
<link rel="stylesheet" href="/blog-assets/blog.css">${structured}</head><body>
<a class="skip-link" href="#main">Skip to content</a>
<header class="blog-header"><a class="brand" href="/blog" aria-label="JD Conley writing home"><img src="/images/headshot-256x256.png" alt="" width="32" height="32"><span>JD Conley</span><small>Writing</small></a><nav aria-label="Blog navigation"><a href="/blog"${!post ? ' aria-current="page"' : ""}>All writing</a><a href="/blog/feed.xml">RSS</a><a class="about-link" href="/">About JD <span aria-hidden="true">↗</span></a></nav></header>
<main id="main">${content}</main><footer class="blog-footer"><span>© ${new Date().getUTCFullYear()} JD Conley</span><a href="/">Back to jdconley.com <span aria-hidden="true">↗</span></a></footer></body></html>`;
}

function story(post, featured = false) {
  return `<article class="story${featured ? " featured" : ""}">${featured ? `<div class="post-meta">${metadata(post)}</div>` : ""}<h2><a href="${urlFor(post)}">${e(post.title)}</a></h2><p>${e(post.description)}</p>${featured ? `<a class="read-story" href="${urlFor(post)}">Read the story <span aria-hidden="true">↗</span></a>` : `<div class="post-meta">${metadata(post)}${post.draft ? '<span class="draft-label">Draft preview</span>' : ""}</div>`}</article>`;
}

export function renderArchive(posts, origin, { preview = false } = {}) {
  const first = posts[0];
  return shell({ title: blogName, description: "Sometimes you just gotta take a step back and stare at the wall. Software, startups, and life by JD Conley.", path: "/blog", origin, content: `<section class="archive"><p class="kicker">Software. Startups. Life.</p><h1>Starin’ at the Wall.</h1><p class="intro">Sometimes you just gotta take a step back<br>and stare at the wall.</p>${preview && posts.some(p => p.draft) ? '<p class="draft-notice">Local preview includes drafts. Drafts are excluded from the production build and RSS.</p>' : ""}<div class="list-heading"><span>All writing</span><span>${posts.length} ${posts.length === 1 ? "story" : "stories"} · newest first</span></div>${first ? story(first, true) : '<p>No posts yet.</p>'}${posts.slice(1).map(p => story(p)).join("\n")}</section>` });
}

export function renderArticle(post, posts, origin) {
  const index = posts.findIndex(item => item.slug === post.slug);
  const next = posts.length > 1 ? posts[(index + 1) % posts.length] : null;
  return shell({ title: post.title, description: post.description, path: urlFor(post), origin, post, content: `<article class="reading">${post.draft ? '<p class="draft-notice">Draft preview — this article will not be published.</p>' : ""}${post.tags.length ? `<p class="kicker">${e(post.tags.join(" / "))}</p>` : ""}<h1>${e(post.title)}</h1><div class="author"><img src="/images/headshot-256x256.png" alt="" width="42" height="42"><div><a href="/">JD Conley</a><div class="post-meta">${metadata(post)}</div>${post.updated && post.updated.slice(0, 10) !== post.date.slice(0, 10) ? `<div class="updated">Updated ${dateLabel(post.updated)}</div>` : ""}</div></div><div class="prose">${post.html}</div><div class="endmark" aria-hidden="true">· · ·</div><div class="author-end"><img src="/images/headshot-256x256.png" alt="" width="50" height="50"><div><a href="/">Written by JD Conley <span aria-hidden="true">↗</span></a><p>I build software people want.<br>Based in South Lake Tahoe.</p></div></div>${next ? `<aside class="next-story" aria-label="More articles"><p class="kicker">Keep reading</p><h2><a href="${urlFor(next)}">${e(next.title)} <span aria-hidden="true">↗</span></a></h2><div class="post-meta">${metadata(next)}</div></aside>` : ""}</article>` });
}

export function renderFeed(posts, origin) {
  const published = posts.filter(p => !p.draft);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/"><channel><title>${e(blogName)}</title><link>${origin}/blog</link><description>Software, startups, and life by JD Conley.</description><language>en-us</language><atom:link href="${origin}/blog/feed.xml" rel="self" type="application/rss+xml"/>${published.map(post => {
    const { document } = parseHTML(`<html><body>${post.html}</body></html>`);
    for (const node of document.querySelectorAll("[href],[src]")) for (const attr of ["href", "src"]) if (node.hasAttribute(attr)) node.setAttribute(attr, new URL(node.getAttribute(attr), `${origin}${urlFor(post)}`).href);
    return `<item><title>${e(post.title)}</title><link>${origin}${urlFor(post)}</link><guid isPermaLink="false">${e(post.bloggerId || `${origin}${urlFor(post)}`)}</guid><pubDate>${new Date(post.date).toUTCString()}</pubDate><description>${e(post.description)}</description><content:encoded>${e(document.body.innerHTML)}</content:encoded>${post.tags.map(tag => `<category>${e(tag)}</category>`).join("")}</item>`;
  }).join("\n")}</channel></rss>\n`;
}

export function buildBlog(posts, origin) {
  const published = posts.filter(post => !post.draft);
  const files = new Map([["blog.html", renderArchive(published, origin)]]);
  for (const post of published) files.set(`blog/${post.slug}.html`, renderArticle(post, published, origin));
  files.set("blog/feed.xml", renderFeed(published, origin));
  return files;
}
