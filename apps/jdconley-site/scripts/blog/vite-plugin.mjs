import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { loadPosts } from "./content.mjs";
import { buildBlog, renderArchive, renderArticle, renderFeed } from "./render.mjs";
import { renderShareImage } from "./share-image.mjs";

export function blogPlugin(root) {
  const directory = resolve(root, "content/blog");
  const origin = (process.env.VITE_SITE_URL || "https://jdconley.com").replace(/\/+$/, "");
  const fontFiles = ["inter-latin-400-normal.woff2", "inter-latin-500-normal.woff2", "inter-latin-600-normal.woff2"];
  const fontPath = name => resolve(root, "node_modules/@fontsource/inter/files", name);
  return {
    name: "markdown-blog",
    async generateBundle() {
      const posts = await loadPosts(directory);
      for (const [fileName, source] of buildBlog(posts, origin)) this.emitFile({ type: "asset", fileName, source });
      for (const name of fontFiles) this.emitFile({ type: "asset", fileName: `blog-assets/${name}`, source: await readFile(fontPath(name)) });
      for (const post of [{ slug: "index", title: "Starin’ at the Wall" }, ...posts]) this.emitFile({ type: "asset", fileName: `blog-assets/social/${post.slug}.png`, source: await renderShareImage({ ...post, root }) });
    },
    configurePreviewServer(server) {
      // Vite defaults to SPA fallback; blog pages must retain static-host 404 semantics.
      server.middlewares.use(async (req, res, next) => {
        const path = new URL(req.url, "http://localhost").pathname;
        if (!path.startsWith("/blog/")) return next();
        if (path === "/blog/") { res.statusCode = 301; res.setHeader("Location", "/blog"); res.end(); return; }
        const file = path.includes(".") ? path : `${path}.html`;
        try { await access(resolve(server.config.root, server.config.build.outDir, `.${file}`)); return next(); }
        catch { res.statusCode = 404; res.setHeader("Content-Type", "text/html; charset=utf-8"); res.end('<h1>Post not found</h1><a href="/blog">All writing</a>'); }
      });
    },
    configureServer(server) {
      server.watcher.add(directory);
      const reload = file => { if (file.startsWith(directory) && file.endsWith(".md")) server.ws.send({ type: "full-reload", path: "*" }); };
      for (const event of ["add", "change", "unlink"]) server.watcher.on(event, reload);
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url, "http://localhost");
        const name = url.pathname.slice("/blog-assets/".length);
        if (/^\/blog-assets\/social\/[a-z0-9-]+\.png$/.test(url.pathname)) {
          const slug = url.pathname.split("/").pop().replace(/\.png$/, "");
          const post = slug === "index" ? { title: "Starin’ at the Wall" } : (await loadPosts(directory, { includeDrafts: true })).find(p => p.slug === slug);
          if (!post) { res.statusCode = 404; res.end(); return; }
          res.setHeader("Content-Type", "image/png"); res.end(await renderShareImage({ ...post, root })); return;
        }
        if (url.pathname.startsWith("/blog-assets/") && fontFiles.includes(name)) {
          res.setHeader("Content-Type", "font/woff2"); res.end(await readFile(fontPath(name))); return;
        }
        if (!["/blog", "/blog/", "/blog.html"].includes(url.pathname) && !url.pathname.startsWith("/blog/")) return next();
        try {
          if (url.pathname === "/blog/" || url.pathname === "/blog.html" || /\/blog\/[^/]+\.html$/.test(url.pathname)) {
            res.statusCode = 301; res.setHeader("Location", url.pathname.replace(/\.html$/, "").replace(/\/$/, "") + url.search); res.end(); return;
          }
          const posts = await loadPosts(directory, { includeDrafts: true });
          if (url.pathname === "/blog/feed.xml") { res.setHeader("Content-Type", "application/rss+xml; charset=utf-8"); res.end(renderFeed(posts, origin)); return; }
          const slug = url.pathname.slice("/blog/".length);
          const post = posts.find(item => item.slug === slug);
          if (url.pathname !== "/blog" && !post) { res.statusCode = 404; res.setHeader("Content-Type", "text/html; charset=utf-8"); res.end('<h1>Post not found</h1><a href="/blog">All writing</a>'); return; }
          const html = post ? renderArticle(post, posts, origin) : renderArchive(posts, origin, { preview: true });
          res.setHeader("Content-Type", "text/html; charset=utf-8"); res.setHeader("Cache-Control", "no-store");
          res.end(await server.transformIndexHtml(url.pathname, html));
        } catch (error) { server.config.logger.error(error.stack); next(error); }
      });
    }
  };
}
