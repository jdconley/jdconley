import path from "node:path";
import { pathToFileURL } from "node:url";

const LOCATION = Object.freeze({
  place: "96150, CA",
  lat: 38.87332,
  lon: -120.068481,
  tz: "America/Los_Angeles"
});
const PNG_SIGNATURE = Object.freeze([137, 80, 78, 71, 13, 10, 26, 10]);
const INVALID_TURNSTILE_TOKEN = "production-verification-intentionally-invalid";
const STALE_SHARE_VERSION = "production-verification-stale";

function fail(family, detail) {
  throw new Error(`${family} response verification failed: ${detail}`);
}

function canonicalOrigin(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Production verification origin must be an HTTPS apex origin");
  }
  const supplied = String(value).replace(/\/$/u, "");
  if (url.protocol !== "https:" || url.origin !== supplied || url.pathname !== "/" ||
    url.search || url.hash || url.username || url.password || url.hostname.startsWith("www.")) {
    throw new Error("Production verification origin must be an HTTPS apex origin");
  }
  return url.origin;
}

async function request(fetchImpl, url, init, family) {
  try {
    return await fetchImpl(url, init);
  } catch (error) {
    fail(family, `request failed (${error?.message ?? "unknown error"})`);
  }
}

function expectStatus(response, expected, family, label) {
  if (response?.status !== expected) {
    fail(family, `${label} expected status ${expected}, received ${response?.status ?? "unknown"}`);
  }
}

async function readJson(response, family) {
  try {
    return await response.json();
  } catch {
    fail(family, "invalid JSON");
  }
}

function hasExactKeys(value, keys) {
  return value && typeof value === "object" && !Array.isArray(value) &&
    Object.keys(value).sort().join("\n") === [...keys].sort().join("\n");
}

function validateLocation(payload) {
  if (!hasExactKeys(payload, ["results"]) || !Array.isArray(payload.results) || payload.results.length !== 1 ||
    !hasExactKeys(payload.results[0], ["place", "lat", "lon", "tz"])) {
    fail("Location", "expected one result with place/lat/lon/tz schema");
  }
  for (const [key, expected] of Object.entries(LOCATION)) {
    if (payload.results[0][key] !== expected) {
      fail("Location", `ZIP 96150 ${key} expected ${expected}, received ${payload.results[0][key]}`);
    }
  }
}

function validateSupporters(payload) {
  if (!hasExactKeys(payload, ["count", "recent"]) || !Number.isSafeInteger(payload.count) || payload.count < 0 ||
    !Array.isArray(payload.recent) || payload.recent.some((entry) =>
      !hasExactKeys(entry, ["firstName", "location"]) ||
      typeof entry.firstName !== "string" || typeof entry.location !== "string")) {
    fail("Supporter", "public count payload does not match the expected schema");
  }
  return payload.count;
}

async function supporterCount(fetchImpl, base) {
  const response = await request(fetchImpl, `${base}/api/a-better-time/supporters`, {}, "Supporter");
  expectStatus(response, 200, "Supporter", "GET /api/a-better-time/supporters");
  return validateSupporters(await readJson(response, "Supporter"));
}

function hasSiteKey(html, siteKey) {
  const escaped = siteKey.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  return new RegExp(
    `<meta\\b(?=[^>]*\\bname=["']turnstile-site-key["'])(?=[^>]*\\bcontent=["']${escaped}["'])[^>]*>`,
    "iu"
  ).test(html);
}

export async function verifyProduction({ fetchImpl = globalThis.fetch, origin, siteKey } = {}) {
  if (typeof fetchImpl !== "function") throw new Error("Production verification fetch implementation is required");
  const base = canonicalOrigin(origin);
  if (!/^[A-Za-z0-9_-]{10,}$/u.test(siteKey ?? "")) {
    throw new Error("Production verification site key is missing or malformed");
  }

  const home = await request(fetchImpl, `${base}/`, {}, "Document");
  expectStatus(home, 200, "Document", "GET /");

  const tool = await request(fetchImpl, `${base}/a-better-time`, {}, "Document");
  expectStatus(tool, 200, "Document", "GET /a-better-time");
  if (!hasSiteKey(await tool.text(), siteKey)) fail("Document", "rendered tool does not contain the expected Turnstile site key");

  const redirectPath = "/a-better-time?production-verify=redirect%20path&sequence=1";
  const wwwUrl = new URL(redirectPath, base);
  wwwUrl.hostname = `www.${wwwUrl.hostname}`;
  const canonicalUrl = new URL(redirectPath, base).href;
  const redirected = await request(fetchImpl, wwwUrl.href, { redirect: "manual" }, "Redirect");
  expectStatus(redirected, 301, "Redirect", "GET www path/query");
  if (redirected.headers.get("location") !== canonicalUrl) {
    fail("Redirect", `expected location ${canonicalUrl}, received ${redirected.headers.get("location") ?? "missing"}`);
  }

  const locations = await request(fetchImpl, `${base}/api/a-better-time/locations?q=96150`, {}, "Location");
  expectStatus(locations, 200, "Location", "GET ZIP 96150");
  validateLocation(await readJson(locations, "Location"));

  const countBefore = await supporterCount(fetchImpl, base);

  const staleShareUrl = `${base}/a-better-time/share.png?year=2026&v=${STALE_SHARE_VERSION}`;
  const shareRedirect = await request(fetchImpl, staleShareUrl, { redirect: "manual" }, "Share image");
  expectStatus(shareRedirect, 302, "Share image", "GET stale version");
  const location = shareRedirect.headers.get("location");
  let shareImageUrl;
  try {
    shareImageUrl = new URL(location);
  } catch {
    fail("Share image", "redirect location is missing or invalid");
  }
  const versions = shareImageUrl.searchParams.getAll("v");
  if (shareImageUrl.origin !== base || shareImageUrl.pathname !== "/a-better-time/share.png" ||
    versions.length !== 1 || !versions[0] || versions[0] === STALE_SHARE_VERSION) {
    fail("Share image", "redirect did not identify one current versioned PNG URL on the apex origin");
  }

  const image = await request(fetchImpl, shareImageUrl.href, { redirect: "manual" }, "Share image");
  expectStatus(image, 200, "Share image", "GET current version");
  if (image.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase() !== "image/png") {
    fail("Share image", `expected image/png, received ${image.headers.get("content-type") ?? "missing"}`);
  }
  const imageBytes = new Uint8Array(await image.arrayBuffer());
  if (PNG_SIGNATURE.some((byte, index) => imageBytes[index] !== byte)) {
    fail("Share image", "body does not have a PNG signature");
  }

  const supporterProbe = await request(fetchImpl, `${base}/api/a-better-time/supporters`, {
    method: "POST",
    headers: { "content-type": "application/json", Origin: base },
    body: JSON.stringify({
      firstName: "Production",
      location: "Verification probe",
      consent: true,
      turnstileToken: INVALID_TURNSTILE_TOKEN
    })
  }, "Supporter mutation");
  expectStatus(supporterProbe, 403, "Supporter mutation", "POST invalid Turnstile token");
  const rejection = await readJson(supporterProbe, "Supporter mutation");
  if (!hasExactKeys(rejection, ["error"]) || rejection.error !== "turnstile_failed") {
    fail("Supporter mutation", "expected error turnstile_failed");
  }

  const countAfter = await supporterCount(fetchImpl, base);
  if (countAfter !== countBefore) {
    throw new Error(`Supporter state verification failed: expected ${countBefore} after invalid probe, received ${countAfter}`);
  }

  return { supporterCount: countAfter, shareImageUrl: shareImageUrl.href };
}

const isCli = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isCli) {
  const unknown = process.argv.slice(2);
  if (unknown.length) throw new Error("Usage: verify-production.mjs");
  const result = await verifyProduction({
    origin: process.env.SITE_URL,
    siteKey: process.env.TURNSTILE_SITE_KEY
  });
  console.log(`Production verification passed with ${result.supporterCount} public supporters.`);
}
