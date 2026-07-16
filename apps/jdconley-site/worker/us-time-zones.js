// Reviewed civil zones used in the 50 states and DC. tz-lookup follows polygon
// geometry, which can return a neighboring country's zone near an international
// boundary. Valid special U.S. zones are preserved; only disallowed results are
// corrected with deterministic state/longitude rules below.
export const US_STATE_TIME_ZONES = Object.freeze({
  AL: ["America/Chicago"], AK: ["America/Adak", "America/Anchorage", "America/Juneau", "America/Metlakatla", "America/Nome", "America/Sitka", "America/Yakutat", "America/Los_Angeles"],
  AZ: ["America/Phoenix", "America/Denver"], AR: ["America/Chicago"], CA: ["America/Los_Angeles"], CO: ["America/Denver"], CT: ["America/New_York"],
  DE: ["America/New_York"], DC: ["America/New_York"], FL: ["America/New_York", "America/Chicago"], GA: ["America/New_York"], HI: ["Pacific/Honolulu"],
  ID: ["America/Boise", "America/Los_Angeles"], IL: ["America/Chicago"],
  IN: ["America/Chicago", "America/Indiana/Indianapolis", "America/Indiana/Knox", "America/Indiana/Marengo", "America/Indiana/Petersburg", "America/Indiana/Tell_City", "America/Indiana/Vevay", "America/Indiana/Vincennes", "America/Indiana/Winamac"],
  IA: ["America/Chicago"], KS: ["America/Chicago", "America/Denver"],
  KY: ["America/New_York", "America/Chicago", "America/Kentucky/Louisville", "America/Kentucky/Monticello"], LA: ["America/Chicago"], ME: ["America/New_York"],
  MD: ["America/New_York"], MA: ["America/New_York"], MI: ["America/Detroit", "America/Menominee"], MN: ["America/Chicago"], MS: ["America/Chicago"],
  MO: ["America/Chicago"], MT: ["America/Denver"], NE: ["America/Chicago", "America/Denver"], NV: ["America/Los_Angeles", "America/Denver"],
  NH: ["America/New_York"], NJ: ["America/New_York"], NM: ["America/Denver"], NY: ["America/New_York"], NC: ["America/New_York"],
  ND: ["America/Chicago", "America/Denver", "America/North_Dakota/Beulah", "America/North_Dakota/Center", "America/North_Dakota/New_Salem"],
  OH: ["America/New_York"], OK: ["America/Chicago"], OR: ["America/Los_Angeles", "America/Boise"], PA: ["America/New_York"], RI: ["America/New_York"],
  SC: ["America/New_York"], SD: ["America/Chicago", "America/Denver"], TN: ["America/Chicago", "America/New_York"],
  TX: ["America/Chicago", "America/Denver"], UT: ["America/Denver"], VT: ["America/New_York"], VA: ["America/New_York"], WA: ["America/Los_Angeles"],
  WV: ["America/New_York"], WI: ["America/Chicago"], WY: ["America/Denver"]
});

const IANA_STANDARD_ZONE = new Map([
  ["America/New_York", "Eastern"], ["America/Detroit", "Eastern"], ["America/Indiana/Indianapolis", "Eastern"], ["America/Indiana/Marengo", "Eastern"],
  ["America/Indiana/Petersburg", "Eastern"], ["America/Indiana/Vevay", "Eastern"], ["America/Indiana/Vincennes", "Eastern"], ["America/Indiana/Winamac", "Eastern"],
  ["America/Kentucky/Louisville", "Eastern"], ["America/Kentucky/Monticello", "Eastern"],
  ["America/Chicago", "Central"], ["America/Menominee", "Central"], ["America/Indiana/Knox", "Central"], ["America/Indiana/Tell_City", "Central"],
  ["America/North_Dakota/Beulah", "Central"], ["America/North_Dakota/Center", "Central"], ["America/North_Dakota/New_Salem", "Central"],
  ["America/Denver", "Mountain"], ["America/Boise", "Mountain"], ["America/Phoenix", "Mountain"], ["America/Los_Angeles", "Pacific"],
  ["America/Anchorage", "Alaska"], ["America/Juneau", "Alaska"], ["America/Metlakatla", "Alaska"], ["America/Nome", "Alaska"], ["America/Sitka", "Alaska"], ["America/Yakutat", "Alaska"],
  ["America/Adak", "Hawaii-Aleutian"], ["Pacific/Honolulu", "Hawaii-Aleutian"]
]);
const CANONICAL_ZONE = { Eastern: "America/New_York", Central: "America/Chicago", Mountain: "America/Denver", Pacific: "America/Los_Angeles", Alaska: "America/Anchorage", "Hawaii-Aleutian": "Pacific/Honolulu" };

function pointInRing([x, y], ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function createDotTimeZoneLookup(featureCollection) {
  const polygons = featureCollection.features.flatMap((feature) => {
    const coordinates = feature.geometry.type === "Polygon" ? [feature.geometry.coordinates] : feature.geometry.coordinates;
    return coordinates.map((polygon) => {
      const bounds = polygon[0].reduce(([minX, minY, maxX, maxY], [x, y]) => [Math.min(minX, x), Math.min(minY, y), Math.max(maxX, x), Math.max(maxY, y)], [Infinity, Infinity, -Infinity, -Infinity]);
      return { zone: feature.properties.zone, polygon, bounds };
    });
  });
  return (latitude, longitude) => {
    for (const { zone, polygon, bounds } of polygons) if (longitude >= bounds[0] && latitude >= bounds[1] && longitude <= bounds[2] && latitude <= bounds[3] && pointInRing([longitude, latitude], polygon[0]) && !polygon.slice(1).some((hole) => pointInRing([longitude, latitude], hole))) return zone;
    throw new Error(`DOT time-zone boundary has no polygon for ${latitude},${longitude}`);
  };
}

export function resolveUsTimeZone(state, latitude, longitude, lookup, dotLookup) {
  const allowed = US_STATE_TIME_ZONES[state];
  if (!allowed) throw new Error(`Unsupported U.S. state code: ${state}`);
  const lookedUp = lookup(latitude, longitude);
  const standardZone = dotLookup ? dotLookup(latitude, longitude) : IANA_STANDARD_ZONE.get(lookedUp);
  if (allowed.includes(lookedUp) && IANA_STANDARD_ZONE.get(lookedUp) === standardZone) return lookedUp;
  if (state === "AZ" && standardZone === "Mountain") return "America/Phoenix";
  if (state === "HI") return "Pacific/Honolulu";
  if (state === "AK" && standardZone === "Hawaii-Aleutian") return "America/Adak";
  return CANONICAL_ZONE[standardZone];
}
