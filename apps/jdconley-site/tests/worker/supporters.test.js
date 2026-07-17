import { applyD1Migrations, env } from "cloudflare:test";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import worker from "../../worker/index.js";
import { handleSupporters } from "../../worker/supporters.js";
import { hmacIp, verifyTurnstile } from "../../worker/security.js";

const rateLimiter = { limit: vi.fn(async () => ({ success: true })) };
const bindings = () => ({ ...env, SUPPORT_IP_HMAC_SECRET: "test-hmac-secret", TURNSTILE_SECRET_KEY: "test-turnstile-secret", SUPPORT_ORIGIN: "https://jdconley.test", SUPPORT_RATE_LIMITER: rateLimiter });
const successVerification = vi.fn(async () => new Response(JSON.stringify({ success: true }), { headers: { "content-type": "application/json" } }));

beforeAll(async () => applyD1Migrations(env.DB, env.TEST_MIGRATIONS));
beforeEach(async () => {
  await env.DB.exec("DELETE FROM supporters;");
  successVerification.mockClear();
  rateLimiter.limit.mockClear();
});

function post(body, headers = {}, fetchImpl = successVerification) {
  const request = new Request("https://jdconley.test/api/a-better-time/supporters", {
    method: "POST",
    headers: { origin: "https://jdconley.test", "content-type": "application/json", "CF-Connecting-IP": "203.0.113.9", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body)
  });
  return handleSupporters(request, bindings(), fetchImpl);
}

const valid = { firstName: "Maya", location: "Portland, OR", consent: true, turnstileToken: "valid-token" };

describe("supporter security helpers", () => {
  it("normalizes IPs before stable HMAC-SHA-256 hashing", async () => {
    const first = await hmacIp(" 2001:DB8::1 ", "secret");
    expect(first).toMatch(/^[a-f0-9]{64}$/);
    expect(await hmacIp("2001:db8::1", "secret")).toBe(first);
    expect(first).not.toContain("2001");
  });

  it("verifies Turnstile with the secret, token, and raw IP only in the outbound body", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ success: true })));
    await expect(verifyTurnstile("token", "203.0.113.9", bindings(), fetchImpl)).resolves.toBe(true);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe("https://challenges.cloudflare.com/turnstile/v0/siteverify");
    expect(new URLSearchParams(init.body)).toEqual(new URLSearchParams({ secret: "test-turnstile-secret", response: "token", remoteip: "203.0.113.9" }));
  });
});

describe("GET /api/a-better-time/supporters", () => {
  it("returns an empty public state with no-store caching", async () => {
    const response = await worker.fetch(new Request("https://jdconley.test/api/a-better-time/supporters"), bindings());
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ count: 0, recent: [] });
  });

  it("returns twelve most recent public text entries only in descending order", async () => {
    const statement = env.DB.prepare("INSERT INTO supporters(first_name,display_location,ip_hmac,created_at) VALUES(?,?,?,?)");
    await env.DB.batch(Array.from({ length: 14 }, (_, index) => statement.bind(
      `Name ${index}`, `Place ${index}`, index.toString(16).padStart(64, "0"), `2026-01-${String(index + 1).padStart(2, "0")}T00:00:00.000Z`
    )));
    const response = await worker.fetch(new Request("https://jdconley.test/api/a-better-time/supporters"), bindings());
    const body = await response.json();
    expect(body.count).toBe(14);
    expect(body.recent).toHaveLength(12);
    expect(body.recent[0]).toEqual({ firstName: "Name 13", location: "Place 13" });
    expect(body.recent.at(-1)).toEqual({ firstName: "Name 2", location: "Place 2" });
    expect(JSON.stringify(body)).not.toMatch(/ip|created|id/i);
  });
});

describe("supporter migration upgrades", () => {
  it("applies 0002 after an already-recorded 0001 and creates supporters", async () => {
    await env.UPGRADE_DB.exec("DROP TABLE IF EXISTS supporters; DROP TABLE IF EXISTS d1_migrations;");
    await applyD1Migrations(env.UPGRADE_DB, [env.TEST_MIGRATIONS[0]]);
    await expect(env.UPGRADE_DB.prepare("SELECT COUNT(*) FROM supporters").first()).rejects.toThrow();
    await applyD1Migrations(env.UPGRADE_DB, env.TEST_MIGRATIONS);
    const columns = await env.UPGRADE_DB.prepare("PRAGMA table_info(supporters)").all();
    expect(columns.results.map(({ name }) => name)).toEqual(["id", "first_name", "display_location", "ip_hmac", "created_at"]);
  });
});

describe("POST /api/a-better-time/supporters", () => {
  it("accepts a valid submission without a third-party challenge", async () => {
    const { turnstileToken: _turnstileToken, ...withoutTurnstile } = valid;
    const response = await post(withoutTurnstile);

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ status: "created", count: 1 });
    expect(successVerification).not.toHaveBeenCalled();
  });

  it("normalizes Unicode text and stores only an IP HMAC", async () => {
    const response = await post({ ...valid, firstName: "  Jose\u0301  ", location: "  San   Jose\u0301, CA " });
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ status: "created", count: 1 });
    const row = await env.DB.prepare("SELECT first_name,display_location,ip_hmac,created_at FROM supporters").first();
    expect(row.first_name).toBe("José");
    expect(row.display_location).toBe("San José, CA");
    expect(row.ip_hmac).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(row)).not.toContain("203.0.113.9");
    expect(successVerification).toHaveBeenCalledOnce();
  });

  it("returns a generic duplicate with current count for the same normalized IP", async () => {
    expect((await post(valid)).status).toBe(201);
    const response = await post({ ...valid, firstName: "Other", location: "Elsewhere" }, { "CF-Connecting-IP": " 203.0.113.9 " });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "duplicate", count: 1 });
    expect((await env.DB.prepare("SELECT COUNT(*) count FROM supporters").first()).count).toBe(1);
  });

  it("returns generic 429 before Turnstile or storage when the coarse limiter rejects", async () => {
    rateLimiter.limit.mockResolvedValueOnce({ success: false });
    const response = await post(valid);
    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("60");
    expect(await response.json()).toEqual({ error: "rate_limited" });
    const limiterKey = rateLimiter.limit.mock.calls[0][0].key;
    expect(limiterKey).toMatch(/^[a-f0-9]{64}$/);
    expect(limiterKey).not.toContain("203.0.113.9");
    expect(successVerification).not.toHaveBeenCalled();
    expect((await env.DB.prepare("SELECT COUNT(*) count FROM supporters").first()).count).toBe(0);
  });

  it.each([
    [{ ...valid, consent: false }, 400, "consent_required"],
    [{ ...valid, firstName: "A" }, 400, "invalid_input"],
    [{ ...valid, firstName: "x".repeat(41) }, 400, "invalid_input"],
    [{ ...valid, location: "x".repeat(61) }, 400, "invalid_input"],
    [{ ...valid, turnstileToken: 123 }, 400, "invalid_input"]
  ])("rejects invalid fields without verification: %#", async (body, status, code) => {
    const response = await post(body);
    expect(response.status).toBe(status);
    expect(await response.json()).toEqual({ error: code });
    expect(successVerification).not.toHaveBeenCalled();
  });

  it.each([
    ["missing origin", {}, { origin: "" }, 403, "invalid_origin"],
    ["foreign origin", {}, { origin: "https://evil.example" }, 403, "invalid_origin"],
    ["wrong content type", {}, { "content-type": "text/plain" }, 415, "invalid_content_type"],
    ["missing IP", {}, { "CF-Connecting-IP": "" }, 400, "invalid_request"]
  ])("rejects %s", async (_name, body, headers, status, code) => {
    const response = await post({ ...valid, ...body }, headers);
    expect(response.status).toBe(status);
    expect(await response.json()).toEqual({ error: code });
  });

  it("rejects malformed JSON and bodies at or above 2KB", async () => {
    let response = await post("{");
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "invalid_json" });
    response = await post(JSON.stringify({ padding: "x".repeat(2048) }));
    expect(response.status).toBe(413);
    expect(await response.json()).toEqual({ error: "body_too_large" });
  });

  it("bounds a no-content-length stream and cancels as soon as it crosses 2KB", async () => {
    let chunksRead = 0;
    let cancelled = false;
    const body = new ReadableStream({
      pull(controller) {
        chunksRead += 1;
        controller.enqueue(new Uint8Array(1024));
        if (chunksRead === 10) controller.close();
      },
      cancel() { cancelled = true; }
    });
    const request = new Request("https://jdconley.test/api/a-better-time/supporters", {
      method: "POST",
      headers: { origin: "https://jdconley.test", "content-type": "application/json", "CF-Connecting-IP": "203.0.113.9" },
      body,
      duplex: "half"
    });
    const response = await handleSupporters(request, bindings(), successVerification);
    expect(response.status).toBe(413);
    expect(await response.json()).toEqual({ error: "body_too_large" });
    expect(chunksRead).toBeLessThan(10);
    expect(cancelled).toBe(true);
    expect(rateLimiter.limit).toHaveBeenCalledOnce();
  });

  it("ignores a misleading small Content-Length and enforces streamed bytes", async () => {
    let cancelled = false;
    const request = new Request("https://jdconley.test/api/a-better-time/supporters", {
      method: "POST",
      headers: { origin: "https://jdconley.test", "content-type": "application/json", "content-length": "1", "CF-Connecting-IP": "203.0.113.9" },
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(new Uint8Array(2048));
          controller.enqueue(new Uint8Array(2048));
        },
        cancel() { cancelled = true; }
      }),
      duplex: "half"
    });
    const response = await handleSupporters(request, bindings(), successVerification);
    expect(response.status).toBe(413);
    expect(cancelled).toBe(true);
    expect(successVerification).not.toHaveBeenCalled();
  });

  it("still rejects oversized input when underlying stream cancellation fails", async () => {
    const request = new Request("https://jdconley.test/api/a-better-time/supporters", {
      method: "POST",
      headers: { origin: "https://jdconley.test", "content-type": "application/json", "CF-Connecting-IP": "203.0.113.9" },
      body: new ReadableStream({
        start(controller) { controller.enqueue(new Uint8Array(2048)); },
        cancel() { throw new Error("cancel failed"); }
      }),
      duplex: "half"
    });
    const response = await handleSupporters(request, bindings(), successVerification);
    expect(response.status).toBe(413);
    expect(await response.json()).toEqual({ error: "body_too_large" });
  });

  it("rate limits malformed floods before reading or parsing their bodies", async () => {
    let pulls = 0;
    let cancelled = false;
    rateLimiter.limit.mockResolvedValueOnce({ success: false });
    const request = new Request("https://jdconley.test/api/a-better-time/supporters", {
      method: "POST",
      headers: { origin: "https://jdconley.test", "content-type": "application/json", "CF-Connecting-IP": "203.0.113.9" },
      body: new ReadableStream({ pull(controller) { pulls += 1; controller.enqueue(new TextEncoder().encode("{")); }, cancel() { cancelled = true; } }),
      duplex: "half"
    });
    const response = await handleSupporters(request, bindings(), successVerification);
    expect(response.status).toBe(429);
    expect(pulls).toBeLessThanOrEqual(1);
    expect(cancelled).toBe(true);
    expect(successVerification).not.toHaveBeenCalled();
  });

  it("rejects failed or unavailable Turnstile without inserting", async () => {
    for (const fetchImpl of [
      vi.fn(async () => new Response(JSON.stringify({ success: false }))),
      vi.fn(async () => new Response("unavailable", { status: 503 })),
      vi.fn(async () => { throw new Error("network"); })
    ]) {
      const response = await post(valid, {}, fetchImpl);
      expect(response.status).toBe(403);
      expect(await response.json()).toEqual({ error: "turnstile_failed" });
    }
    expect((await env.DB.prepare("SELECT COUNT(*) count FROM supporters").first()).count).toBe(0);
  });

  it("does not expose secret, IP, or database details in errors", async () => {
    const response = await handleSupporters(new Request("https://jdconley.test/api/a-better-time/supporters", {
      method: "POST", headers: { origin: "https://jdconley.test", "content-type": "application/json", "CF-Connecting-IP": "203.0.113.9" }, body: JSON.stringify(valid)
    }), { ...bindings(), SUPPORT_IP_HMAC_SECRET: "" }, successVerification);
    const text = await response.text();
    expect(response.status).toBe(500);
    expect(text).not.toMatch(/203\.0\.113\.9|test-turnstile-secret|SQL|D1/i);
  });

  it("rejects unsupported methods with an allow header", async () => {
    const response = await handleSupporters(new Request("https://jdconley.test/api/a-better-time/supporters", { method: "PUT" }), bindings(), successVerification);
    expect(response.status).toBe(405);
    expect(response.headers.get("allow")).toBe("GET, POST");
  });
});
