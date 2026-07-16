import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

import {
  verifyProduction,
  verifyProductionCli
} from "../../scripts/verify-production.mjs";

const origin = "https://example.test";
const productionOrigin = "https://jdconley.com";
const siteKey = "production-site-key";
const marker = "probe-marker-123456";
const personalizedQuery = "lat=38.940&lon=-119.977&place=South+Lake+Tahoe%2C+CA&tz=America%2FLos_Angeles&wake=420&sleep=1320&bias=15&year=2026";
const pngBytes = Uint8Array.from(Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64"
));
const expectedLocation = {
  place: "96150, CA",
  lat: 38.87332,
  lon: -120.068481,
  tz: "America/Los_Angeles"
};

function json(body, status = 200, contentType = "application/json; charset=utf-8") {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": contentType } });
}

function html(body, status = 200, contentType = "text/html; charset=utf-8") {
  return new Response(body, { status, headers: { "content-type": contentType } });
}

function homeHtml() {
  return "<!doctype html><html lang=\"en\"><head><title>JD Conley</title></head><body><main class=\"sections\"><h1>JD Conley</h1><p>Designer, developer, and product leader.</p></main></body></html>";
}

function toolHtml(key = siteKey) {
  return `<!doctype html><html lang="en"><head><title>A Better Time</title><meta name="turnstile-site-key" content="${key}"></head><body><main id="main"><h1>A Better Time</h1><p>What if the clock followed the sun?</p></main></body></html>`;
}

function harness(overrides = {}, baseOrigin = origin) {
  const calls = [];
  let supporterRead = 0;
  const apexHostname = new URL(baseOrigin).hostname;
  const response = (name, fallback, context) => overrides[name]?.(context) ?? fallback();
  const fetchImpl = async (input, init = {}) => {
    const url = new URL(typeof input === "string" || input instanceof URL ? input : input.url);
    const method = init.method ?? "GET";
    calls.push({ url: url.href, init: { ...init, method } });

    if (url.hostname === `www.${apexHostname}`) {
      return response("www", () => new Response(null, {
        status: 301,
        headers: { location: `${baseOrigin}${url.pathname}${url.search}` }
      }), { url, init });
    }
    if (url.pathname === "/") {
      return response("home", () => html(homeHtml()), { url, init });
    }
    if (url.pathname === "/a-better-time" && method === "GET") {
      return response("tool", () => html(toolHtml()), { url, init });
    }
    if (url.pathname === "/api/a-better-time/locations") {
      return response("locations", () => json({ results: [expectedLocation] }), { url, init });
    }
    if (url.pathname === "/api/a-better-time/supporters" && method === "GET") {
      const read = supporterRead++;
      return response("supporters", () => json({
        count: 7,
        recent: [{ firstName: "Jamie", location: "South Lake Tahoe, CA" }]
      }), { url, init, read });
    }
    if (url.pathname === "/api/a-better-time/supporters" && method === "POST") {
      return response("supporterPost", () => json({ error: "turnstile_failed" }, 403), { url, init });
    }
    if (url.pathname === "/a-better-time/share.png" && url.searchParams.get("v") === "production-verification-stale") {
      return response("shareRedirect", () => new Response(null, {
        status: 302,
        headers: { location: `${baseOrigin}/a-better-time/share.png?${personalizedQuery}&v=share-v1` }
      }), { url, init });
    }
    if (url.pathname === "/a-better-time/share.png") {
      return response("shareImage", () => new Response(pngBytes, {
        headers: { "content-type": "image/png" }
      }), { url, init });
    }
    throw new Error(`Unexpected request: ${method} ${url.href}`);
  };
  return { calls, fetchImpl };
}

const options = (fetchImpl, extra = {}) => ({ fetchImpl, origin, siteKey, marker, ...extra });

describe("production verification", () => {
  test("exposes the production verification package command", async () => {
    const packageJson = JSON.parse(await readFile(
      fileURLToPath(new URL("../../package.json", import.meta.url)),
      "utf8"
    ));
    expect(packageJson.scripts["production:verify"]).toBe("node ./scripts/verify-production.mjs");
  });

  test("verifies production-shaped resources with manual redirects and an invalid unique probe", async () => {
    const { calls, fetchImpl } = harness();

    await expect(verifyProduction(options(fetchImpl))).resolves.toEqual({
      supporterCount: 7,
      shareImageUrl: `${origin}/a-better-time/share.png?${personalizedQuery}&v=share-v1`
    });

    expect(calls.map(({ url, init }) => `${init.method} ${url}`)).toEqual([
      `GET ${origin}/`,
      `GET ${origin}/a-better-time`,
      "GET https://www.example.test/a-better-time?production-verify=redirect%20path&sequence=1",
      `GET ${origin}/api/a-better-time/locations?q=96150`,
      `GET ${origin}/api/a-better-time/supporters`,
      `GET ${origin}/a-better-time/share.png?${personalizedQuery}&v=production-verification-stale`,
      `GET ${origin}/a-better-time/share.png?${personalizedQuery}&v=share-v1`,
      `POST ${origin}/api/a-better-time/supporters`,
      `GET ${origin}/api/a-better-time/supporters`
    ]);
    expect(calls.every(({ init }) => init.redirect === "manual")).toBe(true);
    expect(calls.every(({ init }) => init.signal instanceof AbortSignal)).toBe(true);

    const post = calls[7];
    expect(new Headers(post.init.headers).get("origin")).toBe(origin);
    expect(new Headers(post.init.headers).get("content-type")).toBe("application/json");
    expect(JSON.parse(post.init.body)).toEqual({
      firstName: "Production",
      location: `Verification ${marker}`,
      consent: true,
      turnstileToken: "production-verification-intentionally-invalid"
    });
  });

  test("times out a fetch that never resolves even when it ignores abort", async () => {
    const started = Date.now();
    await expect(verifyProduction(options(() => new Promise(() => {}), { timeoutMs: 15 })))
      .rejects.toThrow(/Document response.*timed out after 15ms/iu);
    expect(Date.now() - started).toBeLessThan(500);
  });

  test("times out stalled body consumption", async () => {
    let cancellations = 0;
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode("<!doctype html><html><body>"));
      },
      cancel() {
        cancellations += 1;
      }
    });
    const stalledResponse = new Response(stream, { headers: { "content-type": "text/html" } });
    const { fetchImpl } = harness({
      home: () => stalledResponse
    });
    await expect(verifyProduction(options(fetchImpl, { timeoutMs: 15 })))
      .rejects.toThrow(/Document response.*timed out after 15ms/iu);
    expect(cancellations).toBe(1);
    expect(stalledResponse.body.locked).toBe(false);
  });

  test("fails an oversized stream early, cancels its source, and releases its lock", async () => {
    let cancellations = 0;
    const oversizedBytes = new TextEncoder().encode(`${homeHtml()}${"x".repeat(2048)}`);
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(oversizedBytes);
      },
      cancel() {
        cancellations += 1;
      }
    });
    const oversizedResponse = new Response(stream, { headers: { "content-type": "text/html" } });
    const { fetchImpl } = harness({ home: () => oversizedResponse });
    const started = Date.now();
    await expect(verifyProduction(options(fetchImpl, {
      timeoutMs: 250,
      byteCaps: { html: 64 }
    }))).rejects.toThrow(/Document response.*exceeds 64 byte cap/iu);
    expect(Date.now() - started).toBeLessThan(150);
    expect(cancellations).toBe(1);
    expect(oversizedResponse.body.locked).toBe(false);
  });

  test.each([
    ["JSON", { json: 16 }, {}, /Location response.*exceeds 16 byte cap/iu],
    ["PNG", { png: 32 }, {}, /Share image response.*exceeds 32 byte cap/iu]
  ])("enforces the configurable %s response byte cap", async (_family, byteCaps, overrides, message) => {
    const { fetchImpl } = harness(overrides);
    await expect(verifyProduction(options(fetchImpl, { byteCaps }))).rejects.toThrow(message);
  });

  test("releases the owned reader after successful body validation", async () => {
    let cancellations = 0;
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(homeHtml()));
        controller.close();
      },
      cancel() {
        cancellations += 1;
      }
    });
    const successfulResponse = new Response(stream, {
      headers: { "content-type": "text/html" }
    });
    const { fetchImpl } = harness({
      home: () => successfulResponse
    });
    await expect(verifyProduction(options(fetchImpl))).resolves.toMatchObject({ supporterCount: 7 });
    expect(cancellations).toBe(0);
    expect(successfulResponse.body.locked).toBe(false);
  });

  test("rejects invalid UTF-8 without exposing decoded response content", async () => {
    const prefix = new TextEncoder().encode(homeHtml());
    const bytes = new Uint8Array(prefix.length + 2);
    bytes.set(prefix);
    bytes.set([0xc3, 0x28], prefix.length);
    const { fetchImpl } = harness({
      home: () => new Response(bytes, { headers: { "content-type": "text/html" } })
    });
    await expect(verifyProduction(options(fetchImpl))).rejects.toThrow(/Document response.*invalid UTF-8/iu);
  });

  test("uses one explicitly owned stream reader instead of convenience body buffering", async () => {
    const source = await readFile(fileURLToPath(new URL("../../scripts/verify-production.mjs", import.meta.url)), "utf8");
    expect(source).toContain(".getReader()");
    expect(source).not.toMatch(/response\.(?:text|json|arrayBuffer)\s*\(/u);
  });

  test.each([
    ["document", { home: () => html("redirect", 302) }, /Document response.*expected status 200.+302/iu],
    ["location", { locations: () => json({}, 302) }, /Location response.*expected status 200.+302/iu],
    ["supporter read", { supporters: () => json({}, 307) }, /Supporter response.*expected status 200.+307/iu],
    ["share image", { shareImage: () => new Response(null, { status: 302, headers: { location: `${origin}/other.png` } }) }, /Share image response.*expected status 200.+302/iu],
    ["supporter mutation", { supporterPost: () => new Response(null, { status: 307, headers: { location: `${origin}/replayed` } }) }, /Supporter mutation response.*expected status 403.+307/iu]
  ])("rejects an unexpected %s redirect without following it", async (_family, overrides, message) => {
    const { calls, fetchImpl } = harness(overrides);
    await expect(verifyProduction(options(fetchImpl))).rejects.toThrow(message);
    expect(calls.every(({ init }) => init.redirect === "manual")).toBe(true);
    if (_family === "supporter mutation") {
      expect(calls.filter(({ init }) => init.method === "POST")).toHaveLength(1);
      expect(calls.some(({ url }) => url.endsWith("/replayed"))).toBe(false);
    }
  });

  test.each([
    ["apex HTML", { home: () => html(homeHtml(), 200, "text/plain") }, /Document response.*text\/html/iu],
    ["tool HTML", { tool: () => html(toolHtml(), 200, "application/octet-stream") }, /Document response.*text\/html/iu],
    ["location JSON", { locations: () => json({ results: [expectedLocation] }, 200, "text/html") }, /Location response.*application\/json/iu],
    ["supporter JSON", { supporters: () => json({ count: 7, recent: [] }, 200, "text/plain") }, /Supporter response.*application\/json/iu],
    ["mutation JSON", { supporterPost: () => json({ error: "turnstile_failed" }, 403, "text/html") }, /Supporter mutation response.*application\/json/iu],
    ["PNG", { shareImage: () => new Response(pngBytes, { headers: { "content-type": "application/octet-stream" } }) }, /Share image response.*image\/png/iu]
  ])("rejects the wrong %s content type", async (_family, overrides, message) => {
    const { fetchImpl } = harness(overrides);
    await expect(verifyProduction(options(fetchImpl))).rejects.toThrow(message);
  });

  test("requires meaningful apex and tool HTML with the expected tool marker", async () => {
    const tiny = harness({ home: () => html("<html><body></body></html>") });
    await expect(verifyProduction(options(tiny.fetchImpl))).rejects.toThrow(/Document response.*meaningful apex HTML/iu);

    const missingMarker = harness({
      tool: () => html(toolHtml().replace('<main id="main">', '<main id="other">'))
    });
    await expect(verifyProduction(options(missingMarker.fetchImpl))).rejects.toThrow(/Document response.*tool marker/iu);
  });

  test("rejects a rendered tool with the wrong site key", async () => {
    const { fetchImpl } = harness({ tool: () => html(toolHtml("wrong-site-key")) });
    await expect(verifyProduction(options(fetchImpl))).rejects.toThrow(/Document response.*site key/iu);
  });

  test("rejects malformed JSON without including response bodies in diagnostics", async () => {
    const secret = "response-secret-must-not-appear";
    const { fetchImpl } = harness({
      locations: () => new Response(`{${secret}`, { headers: { "content-type": "application/json" } })
    });
    const error = await verifyProduction(options(fetchImpl)).catch((caught) => caught);
    expect(error.message).toMatch(/Location response.*invalid JSON/iu);
    expect(error.message).not.toContain(secret);
  });

  test.each([
    ["signature only", Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10])],
    ["truncated chunk", pngBytes.slice(0, 40)],
    ["invalid signature", Uint8Array.from([0, ...pngBytes.slice(1)])]
  ])("rejects a structurally invalid PNG: %s", async (_case, bytes) => {
    const { fetchImpl } = harness({
      shareImage: () => new Response(bytes, { headers: { "content-type": "image/png" } })
    });
    await expect(verifyProduction(options(fetchImpl))).rejects.toThrow(/Share image response.*valid PNG/iu);
  });

  test("requires the share redirect to preserve the normalized personalized query", async () => {
    const mutated = new URLSearchParams(personalizedQuery);
    mutated.set("bias", "99");
    const { fetchImpl } = harness({
      shareRedirect: () => new Response(null, {
        status: 302,
        headers: { location: `${origin}/a-better-time/share.png?${mutated}&v=share-v1` }
      })
    });
    await expect(verifyProduction(options(fetchImpl))).rejects.toThrow(/Share image response.*preserve.*personalized query/iu);
  });

  test("allows legitimate concurrent supporter growth while requiring the marker to stay absent", async () => {
    const { fetchImpl } = harness({
      supporters: ({ read }) => read === 0
        ? json({ count: 7, recent: [] })
        : json({ count: 8, recent: [{ firstName: "Alex", location: "Reno, NV" }] })
    });
    await expect(verifyProduction(options(fetchImpl))).resolves.toMatchObject({ supporterCount: 8 });
  });

  test("rejects a decreased count or a recent supporter containing the unique marker", async () => {
    const decreased = harness({
      supporters: ({ read }) => json({ count: read === 0 ? 7 : 6, recent: [] })
    });
    await expect(verifyProduction(options(decreased.fetchImpl))).rejects.toThrow(/Supporter state.*decreased/iu);

    const created = harness({
      supporters: ({ read }) => json({
        count: read === 0 ? 7 : 8,
        recent: read === 0 ? [] : [{ firstName: "Production", location: `Verification ${marker}` }]
      })
    });
    await expect(verifyProduction(options(created.fetchImpl))).rejects.toThrow(/Supporter state.*probe marker/iu);
  });

  test("requires the invalid Turnstile probe to return JSON turnstile_failed", async () => {
    const { fetchImpl } = harness({ supporterPost: () => json({ error: "invalid_input" }, 403) });
    await expect(verifyProduction(options(fetchImpl))).rejects.toThrow(/Supporter mutation response.*turnstile_failed/iu);
  });

  test("gates CLI origins unless the explicit non-production override is enabled", async () => {
    const blocked = harness();
    await expect(verifyProductionCli({
      env: { SITE_URL: origin, TURNSTILE_SITE_KEY: siteKey },
      fetchImpl: blocked.fetchImpl,
      marker,
      log: () => {}
    })).rejects.toThrow(/CLI origin must be exactly https:\/\/jdconley\.com/iu);
    expect(blocked.calls).toHaveLength(0);

    const trailingSlash = harness({}, productionOrigin);
    await expect(verifyProductionCli({
      env: { SITE_URL: `${productionOrigin}/`, TURNSTILE_SITE_KEY: siteKey },
      fetchImpl: trailingSlash.fetchImpl,
      marker,
      log: () => {}
    })).rejects.toThrow(/CLI origin must be exactly/iu);

    const allowed = harness();
    await expect(verifyProductionCli({
      env: {
        SITE_URL: origin,
        TURNSTILE_SITE_KEY: siteKey,
        ALLOW_NON_PRODUCTION_VERIFY_ORIGIN: "true"
      },
      fetchImpl: allowed.fetchImpl,
      marker,
      log: () => {}
    })).resolves.toMatchObject({ supporterCount: 7 });

    const production = harness({}, productionOrigin);
    await expect(verifyProductionCli({
      env: { SITE_URL: productionOrigin, TURNSTILE_SITE_KEY: siteKey },
      fetchImpl: production.fetchImpl,
      marker,
      log: () => {}
    })).resolves.toMatchObject({ supporterCount: 7 });
  });
});
