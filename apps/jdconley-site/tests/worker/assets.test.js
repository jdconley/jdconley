import { describe, expect, it } from "vitest";
import worker from "../../worker/index.js";

describe("Worker assets", () => {
  it("delegates unrelated routes to the static-assets binding", async () => {
    const requested = [];
    const assetResponse = new Response("<h1>Hi, I’m JD</h1>", { status: 200 });
    const env = {
      ASSETS: {
        fetch: async (request) => {
          requested.push(new URL(request.url).pathname);
          return assetResponse;
        }
      }
    };

    const response = await worker.fetch(new Request("https://jdconley.test/"), env);

    expect(requested).toEqual(["/"]);
    expect(response).toBe(assetResponse);
    expect(await response.text()).toContain("Hi, I’m JD");
  });

  it("injects an escaped Turnstile site key only into A Better Time HTML", async () => {
    const html = '<meta name="turnstile-site-key" content=""><main>A Better Time</main>';
    const env = {
      TURNSTILE_SITE_KEY: 'site-key"><script>alert(1)</script>',
      ASSETS: { fetch: async () => new Response(html, { headers: {
        "content-type": "text/html; charset=utf-8",
        etag: '"stale"',
        "last-modified": "Wed, 01 Jan 2025 00:00:00 GMT",
        "content-length": String(html.length),
        "cache-control": "public, max-age=86400"
      } }) }
    };
    const response = await worker.fetch(new Request("https://jdconley.test/a-better-time"), env);
    const body = await response.text();
    expect(body).toContain('content="site-key&quot;&gt;&lt;script&gt;alert(1)&lt;/script&gt;"');
    expect(body).not.toContain("<script>alert(1)</script>");
    expect(response.headers.get("content-type")).toContain("text/html");
    expect(response.headers.get("etag")).toBeNull();
    expect(response.headers.get("last-modified")).toBeNull();
    expect(response.headers.get("content-length")).toBeNull();
    expect(response.headers.get("cache-control")).toBe("no-store");

    const unrelated = await worker.fetch(new Request("https://jdconley.test/"), env);
    expect(await unrelated.text()).toBe(html);
  });
});
