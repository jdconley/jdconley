import { legacyBlogRedirect } from "./blog-redirects.js";

export default { fetch(request) {
  return legacyBlogRedirect(new URL(request.url)) || new Response("Not found", { status: 404 });
} };
