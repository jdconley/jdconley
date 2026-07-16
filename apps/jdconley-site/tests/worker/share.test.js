import { describe, expect, it, vi } from "vitest";
import worker from "../../worker/index.js";
import { SHARE_CHANGE_COPY } from "../../worker/share-image.js";
import * as shareImage from "../../worker/share-image.js";
import { parseHTML } from "linkedom";

const sourceHtml = `<!doctype html><html><head><title>A Better Time</title><meta name="description" content="old"><link rel="canonical" href="https://jdconley.com/a-better-time"><meta property="og:title" content="old"><meta property="og:description" content="old"><meta property="og:image" content="old"><meta name="twitter:title" content="old"><meta name="twitter:description" content="old"><meta name="twitter:image" content="old"><meta name="turnstile-site-key" content=""></head><body></body></html>`;
const env = {
  TURNSTILE_SITE_KEY: "test-site-key",
  ASSETS: { fetch: async () => new Response(sourceHtml, { headers: { "content-type": "text/html" } }) }
};

describe("personalized sharing", () => {
  it("single-flights concurrent normalized cache misses", async () => {
    let releaseRender;
    const renderGate = new Promise((resolve) => { releaseRender = resolve; });
    const render = vi.fn(async () => {
      await renderGate;
      return new Uint8Array([10, 11]);
    });
    const cache = {
      match: vi.fn().mockResolvedValue(undefined),
      put: vi.fn().mockResolvedValue(undefined)
    };
    const version = "test-single-flight-v1";
    const handler = shareImage.createShareImageHandler({ render, cache, version });
    const first = handler(new Request(`https://example.test/a-better-time/share.png?year=2026&lat=nope&v=${version}`));
    const second = handler(new Request(`https://other.test/a-better-time/share.png?unused=1&lat=also-nope&year=2026&v=${version}`));
    await vi.waitFor(() => expect(render).toHaveBeenCalledTimes(1));
    releaseRender();

    const [firstResponse, secondResponse] = await Promise.all([first, second]);
    expect(new Uint8Array(await firstResponse.arrayBuffer())).toEqual(new Uint8Array([10, 11]));
    expect(new Uint8Array(await secondResponse.arrayBuffer())).toEqual(new Uint8Array([10, 11]));
    expect(cache.put).toHaveBeenCalledTimes(1);
  });

  it("cleans up failed single-flights so the next request retries", async () => {
    let rejectRender;
    const failedRender = new Promise((_resolve, reject) => { rejectRender = reject; });
    const render = vi.fn()
      .mockImplementationOnce(() => failedRender)
      .mockResolvedValueOnce(new Uint8Array([12]));
    const cache = {
      match: vi.fn().mockResolvedValue(undefined),
      put: vi.fn().mockResolvedValue(undefined)
    };
    const version = "test-single-flight-retry-v1";
    const handler = shareImage.createShareImageHandler({ render, cache, version });
    const request = () => new Request(`https://example.test/a-better-time/share.png?year=2026&v=${version}`);

    const attempts = [handler(request()), handler(request())];
    await vi.waitFor(() => expect(render).toHaveBeenCalledTimes(1));
    rejectRender(new Error("first render failed"));
    const failures = await Promise.allSettled(attempts);
    expect(failures.map(({ status }) => status)).toEqual(["rejected", "rejected"]);
    expect(render).toHaveBeenCalledTimes(1);
    expect((await handler(request())).status).toBe(200);
    expect(render).toHaveBeenCalledTimes(2);
  });

  it.each([
    ["missing", ""],
    ["stale", "&v=old-renderer"],
    ["extraneous", `&v=${shareImage.SHARE_IMAGE_VERSION}&v=extra`]
  ])("redirects %s renderer versions to the exact canonical image URL", async (_label, versionQuery) => {
    const requestUrl = `https://jdconley.test/a-better-time/share.png?year=2026${versionQuery}`;
    const response = await worker.fetch(new Request(requestUrl), env);
    const canonicalQuery = "lat=38.940&lon=-119.977&place=South+Lake+Tahoe%2C+CA&tz=America%2FLos_Angeles&wake=420&sleep=1320&bias=0&year=2026";
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(shareImage.shareImageUrl(canonicalQuery));
    expect(response.headers.get("cache-control")).not.toContain("immutable");
  });

  it("exposes a versioned share-image cache contract", () => {
    expect(shareImage.SHARE_IMAGE_VERSION).toMatch(/^[a-z0-9._-]+$/u);
    expect(shareImage.createShareImageHandler).toBeTypeOf("function");
    expect(shareImage.shareImageUrl).toBeTypeOf("function");
    expect(shareImage.shareImageEtag).toBeTypeOf("function");
  });

  it("normalizes equivalent requests into one edge-cached render", async () => {
    const render = vi.fn(async () => new Uint8Array([1, 2, 3]));
    const handler = shareImage.createShareImageHandler({
      render,
      version: "test-normalization-v1"
    });
    const first = await handler(new Request("https://example.test/a-better-time/share.png?year=2026&lat=nope&bias=500&unused=first&v=test-normalization-v1"));
    const second = await handler(new Request("https://other.test/a-better-time/share.png?unused=second&bias=oops&lat=also-nope&year=2026&v=test-normalization-v1"));

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(new Uint8Array(await second.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]));
    expect(second.headers.get("etag")).toBe(first.headers.get("etag"));
    expect(render).toHaveBeenCalledTimes(1);
  });

  it("returns a conditional 304 before rendering", async () => {
    const render = vi.fn(async () => new Uint8Array([4, 5, 6]));
    const version = "test-conditional-v1";
    const handler = shareImage.createShareImageHandler({ render, version });
    const url = `https://example.test/a-better-time/share.png?year=2026&lat=nope&v=${version}`;
    const initial = await handler(new Request(url));
    const etag = initial.headers.get("etag");
    const conditional = await handler(new Request(url, {
      headers: { "if-none-match": `"unrelated", ${etag}` }
    }));

    expect(conditional.status).toBe(304);
    expect(conditional.headers.get("etag")).toBe(etag);
    expect(await conditional.text()).toBe("");
    expect(render).toHaveBeenCalledTimes(1);
  });

  it("changes canonical URL, cache entry, and validator with renderer version", async () => {
    const query = "lat=38.940&year=2026";
    const firstVersion = "test-assets-v1";
    const secondVersion = "test-assets-v2";
    expect(shareImage.shareImageUrl(query, firstVersion)).toContain("&v=test-assets-v1");
    expect(shareImage.shareImageUrl(query, secondVersion)).toContain("&v=test-assets-v2");
    expect(await shareImage.shareImageEtag(query, firstVersion)).not.toBe(
      await shareImage.shareImageEtag(query, secondVersion)
    );

    const render = vi.fn(async () => new Uint8Array([7]));
    const first = await shareImage.createShareImageHandler({ render, version: firstVersion })(
      new Request(`https://example.test/a-better-time/share.png?${query}&v=${firstVersion}`)
    );
    const second = await shareImage.createShareImageHandler({ render, version: secondVersion })(
      new Request(`https://example.test/a-better-time/share.png?${query}&v=${secondVersion}`)
    );
    expect(first.headers.get("etag")).not.toBe(second.headers.get("etag"));
    expect(render).toHaveBeenCalledTimes(2);
  });

  it("does not cache renderer failures", async () => {
    const render = vi.fn()
      .mockRejectedValueOnce(new Error("render failed"))
      .mockResolvedValueOnce(new Uint8Array([8]));
    const handler = shareImage.createShareImageHandler({
      render,
      version: "test-error-v1"
    });
    const request = () => new Request("https://example.test/a-better-time/share.png?year=2026&v=test-error-v1");

    await expect(handler(request())).rejects.toThrow("render failed");
    expect((await handler(request())).status).toBe(200);
    expect(render).toHaveBeenCalledTimes(2);
  });

  it("serves rendered images when edge cache reads or writes fail", async () => {
    const render = vi.fn(async () => new Uint8Array([9]));
    const readFailure = shareImage.createShareImageHandler({
      render,
      version: "test-cache-read-error-v1",
      cache: {
        match: vi.fn().mockRejectedValue(new Error("cache read failed")),
        put: vi.fn().mockResolvedValue(undefined)
      }
    });
    const writeFailure = shareImage.createShareImageHandler({
      render,
      version: "test-cache-write-error-v1",
      cache: {
        match: vi.fn().mockResolvedValue(undefined),
        put: vi.fn().mockRejectedValue(new Error("cache write failed"))
      }
    });
    const request = (version) => new Request(`https://example.test/a-better-time/share.png?year=2026&v=${version}`);

    expect((await readFailure(request("test-cache-read-error-v1"))).status).toBe(200);
    expect((await writeFailure(request("test-cache-write-error-v1"))).status).toBe(200);
    expect(render).toHaveBeenCalledTimes(2);
  });

  it("uses local-font-safe clock change copy without a missing glyph", () => {
    expect(SHARE_CHANGE_COPY).toBe("Up to 1 minute daily jumps");
    expect(SHARE_CHANGE_COPY).not.toContain("≤");
  });
  it("normalizes canonical metadata and matching encoded image query", async () => {
    const response = await worker.fetch(new Request("https://jdconley.test/a-better-time?year=2026&place=Phoenix%2C+AZ&lat=33.4484&lon=-112.074&tz=America%2FPhoenix&bias=0&sleep=1320&wake=420"), env);
    const html = await response.text();
    const query = "lat=33.448&lon=-112.074&place=Phoenix%2C+AZ&tz=America%2FPhoenix&wake=420&sleep=1320&bias=0&year=2026";
    const escaped = query.replaceAll("&", "&amp;");
    const versionedImage = `${escaped}&amp;v=${shareImage.SHARE_IMAGE_VERSION}`;
    expect(html).toContain(`rel="canonical" href="https://jdconley.com/a-better-time?${escaped}"`);
    expect(html).toContain(`property="og:image" content="https://jdconley.com/a-better-time/share.png?${versionedImage}"`);
    expect(html).toContain(`name="twitter:image" content="https://jdconley.com/a-better-time/share.png?${versionedImage}"`);
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

  it("preserves replacement tokens, quotes, ampersands, and markup-like place text exactly", async () => {
    const place = 'Cash $& Carry "$1" <sun> & Friends';
    const response = await worker.fetch(new Request(`https://jdconley.test/a-better-time?place=${encodeURIComponent(place)}&year=2026`), env);
    const html = await response.text();
    const { document } = parseHTML(html);
    const expectedTitle = `A Better Time for ${place}`;
    const expectedDescription = `See how a gentler clock could follow the sun in ${place}.`;
    expect(document.title).toBe(expectedTitle);
    expect(document.querySelector('meta[name="description"]').getAttribute("content")).toBe(expectedDescription);
    expect(document.querySelector('meta[property="og:title"]').getAttribute("content")).toBe(expectedTitle);
    expect(document.querySelector('meta[property="og:description"]').getAttribute("content")).toBe(expectedDescription);
    expect(document.querySelector('meta[name="twitter:title"]').getAttribute("content")).toBe(expectedTitle);
    expect(document.querySelector('meta[name="twitter:description"]').getAttribute("content")).toBe(expectedDescription);
    expect(document.querySelector('meta[name="turnstile-site-key"]').getAttribute("content")).toBe("test-site-key");
    const canonical = new URL(
      document.querySelector('link[rel="canonical"]').getAttribute("href")
    );
    expect(canonical.searchParams.get("place")).toBe(place);
  });

  it("renders a cached 1200x630 PNG with canonical ETag", async () => {
    const response = await worker.fetch(new Request(`https://jdconley.test/a-better-time/share.png?year=2026&place=Phoenix%2C+AZ&lat=33.4484&lon=-112.074&tz=America%2FPhoenix&v=${shareImage.SHARE_IMAGE_VERSION}`), env);
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
