const SITE_KEY_META = '<meta name="turnstile-site-key" content="">';
import { parseState, serializeState } from "../js/a-better-time/core/url-state.js";
import { normalizeUsState } from "../js/a-better-time/us-state.js";
import { shareImageUrl } from "./share-image.js";

function escapeAttribute(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function replaceAttribute(html, selector, attribute, value) {
  const pattern = new RegExp(`(<${selector}[^>]*\\s${attribute}=")[^"]*(")`, "iu");
  return html.replace(pattern, (_match, prefix, suffix) =>
    `${prefix}${escapeAttribute(value)}${suffix}`
  );
}

export async function injectRuntimeConfig(response, env, requestUrl) {
  const contentType = response.headers.get("content-type") ?? "";
  if (!response.ok || !contentType.toLowerCase().includes("text/html")) return response;
  const html = await response.text();
  const siteKey = escapeAttribute(env.TURNSTILE_SITE_KEY);
  let configured = html.replace(
    SITE_KEY_META,
    () => `<meta name="turnstile-site-key" content="${siteKey}">`
  );
  if (requestUrl) {
    const url = new URL(requestUrl);
    const state = normalizeUsState(parseState(url.search)).state;
    const query = serializeState(state);
    const canonical = `https://jdconley.com/a-better-time?${query}`;
    const image = shareImageUrl(query);
    const title = `A Better Time for ${state.place}`;
    const description = `See how a gentler clock could follow the sun in ${state.place}.`;
    configured = configured.replace(
      /<title>[^<]*<\/title>/iu,
      () => `<title>${escapeAttribute(title)}</title>`
    );
    configured = replaceAttribute(configured, 'meta name="description"', "content", description);
    configured = replaceAttribute(configured, 'link rel="canonical"', "href", canonical);
    configured = replaceAttribute(configured, 'meta property="og:title"', "content", title);
    configured = replaceAttribute(configured, 'meta property="og:description"', "content", description);
    configured = replaceAttribute(configured, 'meta property="og:image"', "content", image);
    configured = replaceAttribute(configured, 'meta name="twitter:title"', "content", title);
    configured = replaceAttribute(configured, 'meta name="twitter:description"', "content", description);
    configured = replaceAttribute(configured, 'meta name="twitter:image"', "content", image);
  }
  const headers = new Headers(response.headers);
  headers.delete("content-length");
  headers.delete("etag");
  headers.delete("last-modified");
  headers.set("cache-control", requestUrl ? "private, max-age=60" : "no-store");
  return new Response(configured, { status: response.status, statusText: response.statusText, headers });
}
