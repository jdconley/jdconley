const JSON_HEADERS = Object.freeze({
  "content-type": "application/json; charset=utf-8",
  "cache-control": "public, max-age=300"
});

function json(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), { status, headers: { ...JSON_HEADERS, ...headers } });
}

export function normalizeLocationQuery(value) {
  return String(value ?? "").normalize("NFC").replace(/\s+/gu, " ").trim().toLocaleLowerCase("en-US");
}

function toResult(row) {
  return { place: row.display_name, lat: row.latitude, lon: row.longitude, tz: row.time_zone };
}

function ftsPrefixQuery(query) {
  const tokens = query.match(/[\p{L}\p{N}]+/gu) ?? [];
  if (tokens.length === 0) return null;
  // Each token is quoted before adding the prefix marker. User-provided FTS
  // syntax therefore remains ordinary text and the complete expression is bound.
  return tokens.map((token) => `"${token.replaceAll('"', '""')}"*`).join(" AND ");
}

export async function handleLocations(request, env) {
  if (request.method !== "GET") return json({ results: [] }, 405, { allow: "GET" });

  const query = normalizeLocationQuery(new URL(request.url).searchParams.get("q"));
  if (query.length < 2 || query.length > 100) {
    return json({ results: [], error: "Query must be between 2 and 100 characters." }, 400, { "cache-control": "no-store" });
  }

  let rows;
  if (/^[0-9]{5}$/u.test(query)) {
    rows = await env.DB.prepare(`
      SELECT display_name, latitude, longitude, time_zone
      FROM locations WHERE kind = 'zip' AND zip = ?1
      ORDER BY state_code, display_name LIMIT 8
    `).bind(query).all();
  } else {
    const match = ftsPrefixQuery(query);
    if (!match) return json({ results: [] });
    rows = await env.DB.prepare(`
      SELECT l.display_name, l.latitude, l.longitude, l.time_zone
      FROM locations_fts AS f JOIN locations AS l ON l.id = f.rowid
      WHERE locations_fts MATCH ?1
      ORDER BY CASE WHEN l.search_name = ?2 THEN 0 ELSE 1 END,
               l.search_name, l.state_code, l.kind, COALESCE(l.zip, ''), l.display_name
      LIMIT 8
    `).bind(match, query).all();
  }

  return json({ results: rows.results.map(toResult) });
}
