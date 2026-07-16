import { hmacIp, verifyTurnstile } from "./security.js";

const JSON_HEADERS = Object.freeze({
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store"
});
const MAX_BODY_BYTES = 2048;
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/u;

function json(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), { status, headers: { ...JSON_HEADERS, ...headers } });
}

function normalizePublicText(value, minimum, maximum) {
  if (typeof value !== "string") return null;
  const normalized = value.normalize("NFC").replace(/\s+/gu, " ").trim();
  const length = Array.from(normalized).length;
  if (length < minimum || length > maximum || CONTROL_CHARACTERS.test(normalized)) return null;
  return normalized;
}

async function countSupporters(db) {
  const row = await db.prepare("SELECT COUNT(*) AS count FROM supporters").first();
  return Number(row?.count ?? 0);
}

async function getSupporters(env) {
  const [count, rows] = await Promise.all([
    countSupporters(env.DB),
    env.DB.prepare(`
      SELECT first_name, display_location
      FROM supporters
      ORDER BY created_at DESC, id DESC
      LIMIT 12
    `).all()
  ]);
  return json({
    count,
    recent: rows.results.map((row) => ({ firstName: row.first_name, location: row.display_location }))
  });
}

async function postSupporter(request, env, fetchImpl) {
  const expectedOrigin = env.SUPPORT_ORIGIN;
  if (!expectedOrigin || request.headers.get("origin") !== expectedOrigin) return json({ error: "invalid_origin" }, 403);
  const contentType = request.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase();
  if (contentType !== "application/json") return json({ error: "invalid_content_type" }, 415);
  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength >= MAX_BODY_BYTES) return json({ error: "body_too_large" }, 413);

  const rawBody = await request.text();
  if (new TextEncoder().encode(rawBody).byteLength >= MAX_BODY_BYTES) return json({ error: "body_too_large" }, 413);
  let body;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return json({ error: "invalid_json" }, 400);
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) return json({ error: "invalid_json" }, 400);
  if (body.consent !== true) return json({ error: "consent_required" }, 400);

  const firstName = normalizePublicText(body.firstName, 2, 40);
  const displayLocation = normalizePublicText(body.location, 2, 60);
  const token = typeof body.turnstileToken === "string" ? body.turnstileToken.trim() : "";
  if (!firstName || !displayLocation || !token || token.length > 2048) return json({ error: "invalid_input" }, 400);

  const ip = request.headers.get("CF-Connecting-IP")?.trim();
  if (!ip) return json({ error: "invalid_request" }, 400);
  let ipHmac;
  try {
    ipHmac = await hmacIp(ip, env.SUPPORT_IP_HMAC_SECRET);
  } catch {
    return json({ error: "internal_error" }, 500);
  }
  if (!env.SUPPORT_RATE_LIMITER?.limit) return json({ error: "internal_error" }, 500);
  try {
    const rateLimit = await env.SUPPORT_RATE_LIMITER.limit({ key: ipHmac });
    if (!rateLimit.success) return json({ error: "rate_limited" }, 429, { "retry-after": "60" });
  } catch {
    return json({ error: "internal_error" }, 500);
  }
  if (!await verifyTurnstile(token, ip, env, fetchImpl)) return json({ error: "turnstile_failed" }, 403);

  try {
    await env.DB.prepare(`
      INSERT INTO supporters(first_name, display_location, ip_hmac, created_at)
      VALUES(?1, ?2, ?3, ?4)
    `).bind(firstName, displayLocation, ipHmac, new Date().toISOString()).run();
    return json({ status: "created", count: await countSupporters(env.DB) }, 201);
  } catch {
    try {
      const existing = await env.DB.prepare("SELECT 1 AS found FROM supporters WHERE ip_hmac = ?1 LIMIT 1").bind(ipHmac).first();
      if (existing?.found === 1) return json({ status: "duplicate", count: await countSupporters(env.DB) });
    } catch {
      // Deliberately collapse storage and configuration failures below.
    }
    return json({ error: "internal_error" }, 500);
  }
}

export async function handleSupporters(request, env, fetchImpl = fetch) {
  if (request.method === "GET") return getSupporters(env);
  if (request.method === "POST") return postSupporter(request, env, fetchImpl);
  return json({ error: "method_not_allowed" }, 405, { allow: "GET, POST" });
}
