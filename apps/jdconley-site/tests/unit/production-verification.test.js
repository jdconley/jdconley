import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

import { verifyProduction } from "../../scripts/verify-production.mjs";

const origin = "https://example.test";
const siteKey = "production-site-key";
const pngBytes = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13]);
const expectedLocation = {
  place: "96150, CA",
  lat: 38.87332,
  lon: -120.068481,
  tz: "America/Los_Angeles"
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" }
  });
}

function harness(overrides = {}) {
  const calls = [];
  let supporterRead = 0;
  const response = (name, fallback, context) => overrides[name]?.(context) ?? fallback();
  const fetchImpl = async (input, init = {}) => {
    const url = new URL(typeof input === "string" || input instanceof URL ? input : input.url);
    const method = init.method ?? "GET";
    calls.push({ url: url.href, init: { ...init, method } });

    if (url.hostname === "www.example.test") {
      return response("www", () => new Response(null, {
        status: 301,
        headers: { location: `${origin}${url.pathname}${url.search}` }
      }), { url, init });
    }
    if (url.pathname === "/") {
      return response("home", () => new Response("<!doctype html><title>Home</title>"), { url, init });
    }
    if (url.pathname === "/a-better-time" && method === "GET") {
      return response("tool", () => new Response(
        `<!doctype html><meta name="turnstile-site-key" content="${siteKey}"><main>A Better Time</main>`,
        { headers: { "content-type": "text/html; charset=utf-8" } }
      ), { url, init });
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
        headers: { location: `${origin}/a-better-time/share.png?year=2026&v=share-v1` }
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

describe("production verification", () => {
  test("exposes the production verification package command", async () => {
    const packageJson = JSON.parse(await readFile(
      fileURLToPath(new URL("../../package.json", import.meta.url)),
      "utf8"
    ));
    expect(packageJson.scripts["production:verify"]).toBe("node ./scripts/verify-production.mjs");
  });

  test("verifies public resources without ever creating a valid supporter", async () => {
    const { calls, fetchImpl } = harness();

    await expect(verifyProduction({ fetchImpl, origin, siteKey })).resolves.toEqual({
      supporterCount: 7,
      shareImageUrl: `${origin}/a-better-time/share.png?year=2026&v=share-v1`
    });

    expect(calls.map(({ url, init }) => `${init.method} ${url}`)).toEqual([
      `GET ${origin}/`,
      `GET ${origin}/a-better-time`,
      "GET https://www.example.test/a-better-time?production-verify=redirect%20path&sequence=1",
      `GET ${origin}/api/a-better-time/locations?q=96150`,
      `GET ${origin}/api/a-better-time/supporters`,
      `GET ${origin}/a-better-time/share.png?year=2026&v=production-verification-stale`,
      `GET ${origin}/a-better-time/share.png?year=2026&v=share-v1`,
      `POST ${origin}/api/a-better-time/supporters`,
      `GET ${origin}/api/a-better-time/supporters`
    ]);

    for (const index of [2, 5, 6]) expect(calls[index].init.redirect).toBe("manual");
    const post = calls[7];
    expect(new Headers(post.init.headers).get("origin")).toBe(origin);
    expect(new Headers(post.init.headers).get("content-type")).toBe("application/json");
    expect(JSON.parse(post.init.body)).toEqual({
      firstName: "Production",
      location: "Verification probe",
      consent: true,
      turnstileToken: "production-verification-intentionally-invalid"
    });
  });

  test.each([
    ["document", { home: () => new Response("unavailable", { status: 503 }) }, /document response.*\/.+200.+503/iu],
    ["redirect", { www: () => new Response(null, { status: 302, headers: { location: `${origin}/wrong` } }) }, /redirect response.*301.+302/iu],
    ["location JSON", { locations: () => new Response("{", { headers: { "content-type": "application/json" } }) }, /location response.*invalid JSON/iu],
    ["supporter JSON", { supporters: () => json({ count: "7", recent: [] }) }, /supporter response.*schema/iu],
    ["share image", { shareImage: () => new Response("not-png", { headers: { "content-type": "image/png" } }) }, /share image response.*PNG/iu]
  ])("reports concise %s response diagnostics", async (_family, overrides, message) => {
    const { fetchImpl } = harness(overrides);
    await expect(verifyProduction({ fetchImpl, origin, siteKey })).rejects.toThrow(message);
  });

  test("rejects a rendered tool with the wrong site key", async () => {
    const { fetchImpl } = harness({
      tool: () => new Response('<meta name="turnstile-site-key" content="wrong-site-key">')
    });
    await expect(verifyProduction({ fetchImpl, origin, siteKey })).rejects.toThrow(/document response.*site key/iu);
  });

  test("requires the invalid Turnstile probe to be rejected by Turnstile", async () => {
    const { fetchImpl } = harness({
      supporterPost: () => json({ error: "invalid_input" }, 403)
    });
    await expect(verifyProduction({ fetchImpl, origin, siteKey })).rejects.toThrow(/supporter mutation response.*turnstile_failed/iu);
  });

  test("fails if the public supporter count changes after the invalid probe", async () => {
    const { fetchImpl } = harness({
      supporters: ({ read }) => json({ count: read === 0 ? 7 : 8, recent: [] })
    });
    await expect(verifyProduction({ fetchImpl, origin, siteKey })).rejects.toThrow(/supporter state.*expected 7.+received 8/iu);
  });
});
