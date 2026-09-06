import { it, expect } from "vitest";
import { legacyBlogRedirect } from "../../worker/blog-redirects.js";

it("redirects old Blogger paths exactly, including mobile queries", () => {
  const source = "https://blog.jdconley.com/2009/01/functional-optimistic-concurrency-in-c.html?m=1&utm_source=old";
  const response = legacyBlogRedirect(new URL(source));
  expect(response.status).toBe(301);
  expect(response.headers.get("location")).toBe("https://jdconley.com/blog/functional-optimistic-concurrency-in-c?utm_source=old");
});
it("redirects the blog hostname and feeds but leaves the main homepage alone", () => {
  expect(legacyBlogRedirect(new URL("https://blog.jdconley.com/")).headers.get("location")).toBe("https://jdconley.com/blog");
  expect(legacyBlogRedirect(new URL("https://blog.jdconley.com/feeds/posts/default?alt=rss")).headers.get("location")).toBe("https://jdconley.com/blog/feed.xml");
  expect(legacyBlogRedirect(new URL("https://jdconley.com/"))).toBeNull();
});
it("permanently redirects every unmatched old-host URL to the archive", () => {
  const response = legacyBlogRedirect(new URL("https://blog.jdconley.com/2005/01/missing.html"));
  expect(response.status).toBe(301);
  expect(response.headers.get("location")).toBe("https://jdconley.com/blog");
  expect(legacyBlogRedirect(new URL("https://jdconley.com/anything"))).toBeNull();
});
