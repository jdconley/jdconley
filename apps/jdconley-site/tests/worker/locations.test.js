import { applyD1Migrations, env } from "cloudflare:test";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import worker from "../../worker/index.js";
import fixtures from "../../data/location-fixtures.json";

beforeAll(async () => {
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
});

beforeEach(async () => {
  await env.DB.exec("DELETE FROM locations;");
  const statement = env.DB.prepare("INSERT INTO locations(kind,search_name,display_name,state_code,zip,latitude,longitude,time_zone) VALUES(?,?,?,?,?,?,?,?)");
  await env.DB.batch(fixtures.map((row) => statement.bind(
    row.kind, row.search_name, row.display_name, row.state_code, row.zip,
    row.latitude, row.longitude, row.time_zone
  )));
});

async function request(path, init) {
  return worker.fetch(new Request(`https://jdconley.test${path}`, init), env);
}

describe("GET /api/a-better-time/locations", () => {
  it("supports U.S. locations across the antimeridian", async () => {
    await expect(env.DB.prepare("INSERT INTO locations(kind,search_name,display_name,state_code,zip,latitude,longitude,time_zone) VALUES('place','attu','Attu, AK','AK',NULL,52.84,173.18,'America/Adak')").run()).resolves.toBeTruthy();
  });

  it("normalizes Unicode, whitespace, and case and ranks duplicate names deterministically", async () => {
    const response = await request("/api/a-better-time/locations?q=%20%20PoRtLaNd%20%20");
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(response.headers.get("cache-control")).toBe("public, max-age=300");
    expect(await response.json()).toEqual({ results: [
      { place: "Portland, ME", lat: 43.633157, lon: -70.185305, tz: "America/New_York" },
      { place: "Portland, OR", lat: 45.536951, lon: -122.649971, tz: "America/Los_Angeles" }
    ] });
  });

  it.each([
    ["96150", "96150, CA", 38.87332, -120.068481, "America/Los_Angeles"],
    ["97205", "97205, OR", 45.52009, -122.702169, "America/Los_Angeles"],
    ["85001", "85001, AZ", 33.4484, -112.074, "America/Phoenix"]
  ])("returns exact ZIP %s", async (zip, place, lat, lon, tz) => {
    const response = await request(`/api/a-better-time/locations?q=${zip}`);
    expect(await response.json()).toEqual({ results: [{ place, lat, lon, tz }] });
  });

  it.each([
    ["south lake", "South Lake Tahoe, CA", "America/Los_Angeles"],
    ["phoenix", "Phoenix, AZ", "America/Phoenix"],
    ["honolulu", "Honolulu, HI", "Pacific/Honolulu"],
    ["anchorage", "Anchorage, AK", "America/Anchorage"]
  ])("searches committed fixture %s", async (query, place, tz) => {
    const response = await request(`/api/a-better-time/locations?q=${encodeURIComponent(query)}`);
    expect((await response.json()).results[0]).toMatchObject({ place, tz });
  });

  it.each(["", "a", "x".repeat(101)])("rejects malformed query %j", async (query) => {
    const response = await request(`/api/a-better-time/locations?q=${encodeURIComponent(query)}`);
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ results: [], error: "Query must be between 2 and 100 characters." });
  });

  it.each([`portland'`, `portland*`, `portland OR NOT maine`, `" OR 1=1 --`])("treats FTS syntax as text without error: %s", async (query) => {
    const response = await request(`/api/a-better-time/locations?q=${encodeURIComponent(query)}`);
    expect(response.status).toBe(200);
    expect((await response.json()).results).toBeInstanceOf(Array);
  });

  it("caps prefix results at eight and returns stable empty JSON", async () => {
    const statement = env.DB.prepare("INSERT INTO locations(kind,search_name,display_name,state_code,zip,latitude,longitude,time_zone) VALUES('place',?,?,?,?,?,?,?)");
    await env.DB.batch(["CA", "CO", "FL", "IL", "MA", "MO", "NJ", "OH", "VA"].map((state) =>
      statement.bind("springfield", `Springfield, ${state}`, state, null, 39, -90, "America/Chicago")));
    const capped = await request("/api/a-better-time/locations?q=spring");
    expect((await capped.json()).results).toHaveLength(8);

    const empty = await request("/api/a-better-time/locations?q=zz");
    expect(await empty.json()).toEqual({ results: [] });
  });

  it("returns 405 for non-GET methods", async () => {
    const response = await request("/api/a-better-time/locations?q=po", { method: "POST" });
    expect(response.status).toBe(405);
    expect(response.headers.get("allow")).toBe("GET");
  });
});
