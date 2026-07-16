import { handleLocations } from "./locations.js";
import { handleSupporters } from "./supporters.js";
import { injectRuntimeConfig } from "./html.js";
import { handleShareImage } from "./share-image.js";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.hostname === "www.jdconley.com") {
      url.hostname = "jdconley.com";
      url.protocol = "https:";
      url.port = "";
      return Response.redirect(url, 301);
    }
    if (url.pathname === "/api/a-better-time/locations") return handleLocations(request, env);
    if (url.pathname === "/api/a-better-time/supporters") return handleSupporters(request, env);
    if (url.pathname === "/a-better-time/share.png") return handleShareImage(request, env);
    const asset = await env.ASSETS.fetch(request);
    if (url.pathname === "/a-better-time" || url.pathname === "/a-better-time.html") {
      return injectRuntimeConfig(asset, env, request.url);
    }
    return asset;
  }
};
