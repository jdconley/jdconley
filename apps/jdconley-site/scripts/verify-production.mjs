import { randomUUID } from "node:crypto";
import path from "node:path";
import { pathToFileURL } from "node:url";

const PRODUCTION_ORIGIN = "https://jdconley.com";
const DEFAULT_TIMEOUT_MS = 10_000;
const PERSONALIZED_QUERY = "lat=38.940&lon=-119.977&place=South+Lake+Tahoe%2C+CA&tz=America%2FLos_Angeles&wake=420&sleep=1320&bias=15&year=2026";
const LOCATION = Object.freeze({
  place: "96150, CA",
  lat: 38.87332,
  lon: -120.068481,
  tz: "America/Los_Angeles"
});
const PNG_SIGNATURE = Object.freeze([137, 80, 78, 71, 13, 10, 26, 10]);
const INVALID_TURNSTILE_TOKEN = "production-verification-intentionally-invalid";
const STALE_SHARE_VERSION = "production-verification-stale";

class VerificationError extends Error {}

function fail(family, detail) {
  throw new VerificationError(`${family} response verification failed: ${detail}`);
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

function validateTimeout(timeoutMs) {
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 300_000) {
    throw new Error("Production verification timeoutMs must be an integer from 1 to 300000");
  }
  return timeoutMs;
}

async function request(fetchImpl, url, init, family, timeoutMs, inspect) {
  const controller = new AbortController();
  let response;
  let timedOut = false;
  const timeoutError = () => new VerificationError(
    `${family} response verification failed: timed out after ${timeoutMs}ms`
  );
  let timer;
  const deadline = new Promise((_, reject) => {
    timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
      Promise.resolve(response?.body?.cancel()).catch(() => {});
      reject(timeoutError());
    }, timeoutMs);
  });
  const operation = (async () => {
    try {
      response = await fetchImpl(url, {
        ...init,
        redirect: "manual",
        signal: controller.signal
      });
      return await inspect(response);
    } catch (error) {
      if (timedOut) throw timeoutError();
      if (error instanceof VerificationError) throw error;
      fail(family, "request or body read failed");
    }
  })();
  try {
    return await Promise.race([operation, deadline]);
  } finally {
    clearTimeout(timer);
  }
}

function expectStatus(response, expected, family, label) {
  if (response?.status !== expected) {
    fail(family, `${label} expected status ${expected}, received ${response?.status ?? "unknown"}`);
  }
}

function expectContentType(response, expected, family) {
  const actual = response.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase();
  if (actual !== expected) fail(family, `expected ${expected} content type, received ${actual ?? "missing"}`);
}

async function readJson(response, family) {
  expectContentType(response, "application/json", family);
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
  return payload;
}

async function supporterSnapshot(fetchImpl, base, timeoutMs) {
  return request(fetchImpl, `${base}/api/a-better-time/supporters`, {}, "Supporter", timeoutMs, async (response) => {
    expectStatus(response, 200, "Supporter", "GET /api/a-better-time/supporters");
    return validateSupporters(await readJson(response, "Supporter"));
  });
}

function hasSiteKey(html, siteKey) {
  const escaped = siteKey.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  return new RegExp(
    `<meta\\b(?=[^>]*\\bname=["']turnstile-site-key["'])(?=[^>]*\\bcontent=["']${escaped}["'])[^>]*>`,
    "iu"
  ).test(html);
}

function meaningfulHtml(html) {
  return html.length >= 100 && /<!doctype\s+html/iu.test(html) && /<html\b/iu.test(html) &&
    /<head\b/iu.test(html) && /<title\b[^>]*>[^<]+<\/title>/iu.test(html) &&
    /<body\b/iu.test(html) && /<main\b/iu.test(html);
}

function readUint32(bytes, offset) {
  return bytes[offset] * 0x1000000 + (bytes[offset + 1] << 16) + (bytes[offset + 2] << 8) + bytes[offset + 3];
}

function validPng(bytes) {
  if (bytes.length < 57 || PNG_SIGNATURE.some((byte, index) => bytes[index] !== byte)) return false;
  let offset = PNG_SIGNATURE.length;
  let chunkIndex = 0;
  let sawIhdr = false;
  let sawIdat = false;
  let sawIend = false;
  while (offset < bytes.length) {
    if (bytes.length - offset < 12) return false;
    const length = readUint32(bytes, offset);
    if (length > bytes.length - offset - 12) return false;
    const type = String.fromCharCode(...bytes.slice(offset + 4, offset + 8));
    if (!/^[A-Za-z]{4}$/u.test(type)) return false;
    const dataOffset = offset + 8;
    const end = offset + 12 + length;
    if (chunkIndex === 0 && type !== "IHDR") return false;
    if (type === "IHDR") {
      if (sawIhdr || length !== 13) return false;
      const width = readUint32(bytes, dataOffset);
      const height = readUint32(bytes, dataOffset + 4);
      const bitDepth = bytes[dataOffset + 8];
      const colorType = bytes[dataOffset + 9];
      if (!width || !height || ![1, 2, 4, 8, 16].includes(bitDepth) ||
        ![0, 2, 3, 4, 6].includes(colorType) || bytes[dataOffset + 10] !== 0 ||
        bytes[dataOffset + 11] !== 0 || ![0, 1].includes(bytes[dataOffset + 12])) return false;
      sawIhdr = true;
    } else if (type === "IDAT") {
      if (!sawIhdr || sawIend || length === 0) return false;
      sawIdat = true;
    } else if (type === "IEND") {
      if (!sawIhdr || !sawIdat || sawIend || length !== 0 || end !== bytes.length) return false;
      sawIend = true;
    } else if (sawIend) {
      return false;
    }
    offset = end;
    chunkIndex += 1;
  }
  return sawIhdr && sawIdat && sawIend && offset === bytes.length;
}

function markerIsRecent(snapshot, marker) {
  return snapshot.recent.some((entry) => entry.firstName.includes(marker) || entry.location.includes(marker));
}

export async function verifyProduction({
  fetchImpl = globalThis.fetch,
  origin,
  siteKey,
  marker = randomUUID(),
  timeoutMs = DEFAULT_TIMEOUT_MS
} = {}) {
  if (typeof fetchImpl !== "function") throw new Error("Production verification fetch implementation is required");
  const base = canonicalOrigin(origin);
  const deadline = validateTimeout(timeoutMs);
  if (!/^[A-Za-z0-9_-]{10,}$/u.test(siteKey ?? "")) {
    throw new Error("Production verification site key is missing or malformed");
  }
  if (!/^[A-Za-z0-9_-]{8,40}$/u.test(marker ?? "")) {
    throw new Error("Production verification marker is missing or malformed");
  }

  await request(fetchImpl, `${base}/`, {}, "Document", deadline, async (response) => {
    expectStatus(response, 200, "Document", "GET /");
    expectContentType(response, "text/html", "Document");
    const body = await response.text();
    if (!meaningfulHtml(body)) fail("Document", "expected meaningful apex HTML");
  });

  await request(fetchImpl, `${base}/a-better-time`, {}, "Document", deadline, async (response) => {
    expectStatus(response, 200, "Document", "GET /a-better-time");
    expectContentType(response, "text/html", "Document");
    const body = await response.text();
    if (!meaningfulHtml(body) || !/<main\b[^>]*\bid=["']main["'][^>]*>/iu.test(body) || !/A Better Time/iu.test(body)) {
      fail("Document", "rendered tool does not contain the expected tool marker");
    }
    if (!hasSiteKey(body, siteKey)) fail("Document", "rendered tool does not contain the expected Turnstile site key");
  });

  const redirectPath = "/a-better-time?production-verify=redirect%20path&sequence=1";
  const wwwUrl = new URL(redirectPath, base);
  wwwUrl.hostname = `www.${wwwUrl.hostname}`;
  const canonicalUrl = new URL(redirectPath, base).href;
  await request(fetchImpl, wwwUrl.href, {}, "Redirect", deadline, async (response) => {
    expectStatus(response, 301, "Redirect", "GET www path/query");
    if (response.headers.get("location") !== canonicalUrl) {
      fail("Redirect", `expected location ${canonicalUrl}, received ${response.headers.get("location") ?? "missing"}`);
    }
  });

  await request(fetchImpl, `${base}/api/a-better-time/locations?q=96150`, {}, "Location", deadline, async (response) => {
    expectStatus(response, 200, "Location", "GET ZIP 96150");
    validateLocation(await readJson(response, "Location"));
  });

  const before = await supporterSnapshot(fetchImpl, base, deadline);

  const staleShareUrl = `${base}/a-better-time/share.png?${PERSONALIZED_QUERY}&v=${STALE_SHARE_VERSION}`;
  const shareImageUrl = await request(fetchImpl, staleShareUrl, {}, "Share image", deadline, async (response) => {
    expectStatus(response, 302, "Share image", "GET stale version");
    let redirected;
    try {
      redirected = new URL(response.headers.get("location"));
    } catch {
      fail("Share image", "redirect location is missing or invalid");
    }
    const versions = redirected.searchParams.getAll("v");
    if (redirected.origin !== base || redirected.pathname !== "/a-better-time/share.png" || redirected.hash ||
      versions.length !== 1 || !versions[0] || versions[0] === STALE_SHARE_VERSION) {
      fail("Share image", "redirect did not identify one current versioned PNG URL on the apex origin");
    }
    const expectedQuery = `${PERSONALIZED_QUERY}&v=${encodeURIComponent(versions[0])}`;
    if (redirected.search.slice(1) !== expectedQuery) {
      fail("Share image", "redirect did not preserve the normalized personalized query");
    }
    return redirected;
  });

  await request(fetchImpl, shareImageUrl.href, {}, "Share image", deadline, async (response) => {
    expectStatus(response, 200, "Share image", "GET current version");
    expectContentType(response, "image/png", "Share image");
    const imageBytes = new Uint8Array(await response.arrayBuffer());
    if (!validPng(imageBytes)) fail("Share image", "body is not a structurally valid PNG");
  });

  await request(fetchImpl, `${base}/api/a-better-time/supporters`, {
    method: "POST",
    headers: { "content-type": "application/json", Origin: base },
    body: JSON.stringify({
      firstName: "Production",
      location: `Verification ${marker}`,
      consent: true,
      turnstileToken: INVALID_TURNSTILE_TOKEN
    })
  }, "Supporter mutation", deadline, async (response) => {
    expectStatus(response, 403, "Supporter mutation", "POST invalid Turnstile token");
    const rejection = await readJson(response, "Supporter mutation");
    if (!hasExactKeys(rejection, ["error"]) || rejection.error !== "turnstile_failed") {
      fail("Supporter mutation", "expected error turnstile_failed");
    }
  });

  const after = await supporterSnapshot(fetchImpl, base, deadline);
  if (after.count < before.count) {
    throw new Error(`Supporter state verification failed: public count decreased from ${before.count} to ${after.count}`);
  }
  if (markerIsRecent(after, marker)) {
    throw new Error("Supporter state verification failed: invalid probe marker appeared in recent supporters");
  }

  return { supporterCount: after.count, shareImageUrl: shareImageUrl.href };
}

export async function verifyProductionCli({
  env = process.env,
  fetchImpl = globalThis.fetch,
  marker,
  timeoutMs,
  log = console.log
} = {}) {
  const origin = env.SITE_URL;
  if (origin !== PRODUCTION_ORIGIN && env.ALLOW_NON_PRODUCTION_VERIFY_ORIGIN !== "true") {
    throw new Error(`Production verification CLI origin must be exactly ${PRODUCTION_ORIGIN}; set ALLOW_NON_PRODUCTION_VERIFY_ORIGIN=true only for an intentional non-production check`);
  }
  const result = await verifyProduction({
    fetchImpl,
    origin,
    siteKey: env.TURNSTILE_SITE_KEY,
    marker,
    timeoutMs: timeoutMs ?? DEFAULT_TIMEOUT_MS
  });
  log(`Production verification passed with ${result.supporterCount} public supporters.`);
  return result;
}

const isCli = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isCli) {
  const unknown = process.argv.slice(2);
  if (unknown.length) throw new Error("Usage: verify-production.mjs");
  await verifyProductionCli();
}
