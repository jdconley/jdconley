import { describe, expect, it } from "vitest";
import worker from "../../worker/index.js";
import { SHARE_CHANGE_COPY } from "../../worker/share-image.js";

const sourceHtml = `<!doctype html><html><head><title>A Better Time</title><meta name="description" content="old"><link rel="canonical" href="https://jdconley.com/a-better-time"><meta property="og:title" content="old"><meta property="og:description" content="old"><meta property="og:image" content="old"><meta name="twitter:title" content="old"><meta name="twitter:description" content="old"><meta name="twitter:image" content="old"><meta name="turnstile-site-key" content=""></head><body></body></html>`;
const env = {
  TURNSTILE_SITE_KEY: "test-site-key",
  ASSETS: { fetch: async () => new Response(sourceHtml, { headers: { "content-type": "text/html" } }) }
};

describe("personalized sharing", () => {
  it("uses local-font-safe clock change copy without a missing glyph", () => {
    expect(SHARE_CHANGE_COPY).toBe("Up to 1 minute daily jumps");
    expect(SHARE_CHANGE_COPY).not.toContain("≤");
  });
  it("normalizes canonical metadata and matching encoded image query", async () => {
    const response = await worker.fetch(new Request("https://jdconley.test/a-better-time?year=2026&place=Phoenix%2C+AZ&lat=33.4484&lon=-112.074&tz=America%2FPhoenix&bias=0&sleep=1320&wake=420"), env);
    const html = await response.text();
    const query = "lat=33.448&lon=-112.074&place=Phoenix%2C+AZ&tz=America%2FPhoenix&wake=420&sleep=1320&bias=0&year=2026";
    const escaped = query.replaceAll("&", "&amp;");
    expect(html).toContain(`rel="canonical" href="https://jdconley.com/a-better-time?${escaped}"`);
    expect(html).toContain(`property="og:image" content="https://jdconley.com/a-better-time/share.png?${escaped}"`);
    expect(html).toContain(`name="twitter:image" content="https://jdconley.com/a-better-time/share.png?${escaped}"`);
    expect(html).toContain("Phoenix, AZ");
    expect(response.headers.get("cache-control")).toBe("private, max-age=60");
  });

  it("normalizes invalid fields to canonical defaults before metadata", async () => {
    const response = await worker.fetch(new Request("https://jdconley.test/a-better-time?lat=nope&bias=500&year=2026"), env);
    const html = await response.text();
    expect(html).toContain("lat=38.940&amp;lon=-119.977");
    expect(html).toContain("bias=0&amp;year=2026");
    expect(html).not.toContain("nope");
  });

  it("renders a cached 1200x630 PNG with canonical ETag", async () => {
    const response = await worker.fetch(new Request("https://jdconley.test/a-better-time/share.png?year=2026&place=Phoenix%2C+AZ&lat=33.4484&lon=-112.074&tz=America%2FPhoenix"), env);
    const bytes = new Uint8Array(await response.arrayBuffer());
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(response.headers.get("cache-control")).toBe("public, max-age=31536000, immutable");
    expect(response.headers.get("etag")).toMatch(/^"[a-f0-9]{64}"$/);
    expect([...bytes.slice(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    expect(view.getUint32(16)).toBe(1200);
    expect(view.getUint32(20)).toBe(630);
  });
});
