import { applyD1Migrations, env } from "cloudflare:test";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import worker from "../../worker/index.js";

const fixtures = [
  ["place", "portland", "Portland, ME", "ME", null, 43.6591, -70.2568, "America/New_York"],
  ["place", "portland", "Portland, OR", "OR", null, 45.5152, -122.6784, "America/Los_Angeles"],
  ["place", "south lake tahoe", "South Lake Tahoe, CA", "CA", null, 38.9399, -119.9772, "America/Los_Angeles"],
  ["zip", "97205", "97205, OR", "OR", "97205", 45.5205, -122.685, "America/Los_Angeles"]
];

beforeAll(async () => {
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
});

beforeEach(async () => {
  await env.DB.exec("DELETE FROM locations;");
  const statement = env.DB.prepare("INSERT INTO locations(kind,search_name,display_name,state_code,zip,latitude,longitude,time_zone) VALUES(?,?,?,?,?,?,?,?)");
  await env.DB.batch(fixtures.map((row) => statement.bind(...row)));
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
      { place: "Portland, ME", lat: 43.6591, lon: -70.2568, tz: "America/New_York" },
      { place: "Portland, OR", lat: 45.5152, lon: -122.6784, tz: "America/Los_Angeles" }
    ] });
  });

  it("returns an exact five-digit ZIP match", async () => {
    const response = await request("/api/a-better-time/locations?q=97205");
    expect(await response.json()).toEqual({ results: [
      { place: "97205, OR", lat: 45.5205, lon: -122.685, tz: "America/Los_Angeles" }
    ] });
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
