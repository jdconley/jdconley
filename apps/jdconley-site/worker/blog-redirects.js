import redirects from "../data/blogger/redirects.json" with { type: "json" };

/** Exact, recorded legacy URLs; never guess destinations from publication dates. */
export function legacyBlogRedirect(url) {
  const legacyHost = url.hostname === "blog.jdconley.com";
  let path = Object.hasOwn(redirects, url.pathname) ? redirects[url.pathname] : null;
  const feed = ["/feeds/posts/default", "/feeds/posts/summary", "/atom.xml", "/rss.xml"].includes(url.pathname.replace(/\/$/, ""));
  if (feed) path = "/blog/feed.xml";
  if (legacyHost && ["/", "/index.html", "/search"].includes(url.pathname)) path = "/blog";
  if (path) {
    const destination = new URL(path, "https://jdconley.com");
    destination.search = url.search;
    destination.searchParams.delete("m");
    if (feed) for (const name of ["alt", "start-index", "max-results"]) destination.searchParams.delete(name);
    return Response.redirect(destination.href, 301);
  }
  if (legacyHost) return Response.redirect("https://jdconley.com/blog", 301);
  return null;
}
