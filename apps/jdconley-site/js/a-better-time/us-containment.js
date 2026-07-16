import { US_CONTAINMENT_POLYGONS } from "./us-containment-data.js";

function pointInRing(longitude, latitude, ring) {
  let inside = false;
  for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index, index += 1) {
    const [x, y] = ring[index];
    const [previousX, previousY] = ring[previous];
    if ((y > latitude) !== (previousY > latitude) &&
      longitude < ((previousX - x) * (latitude - y)) / (previousY - y) + x) inside = !inside;
  }
  return inside;
}

export function isIn50StatesAndDc(latitude, longitude) {
  return civilZoneAt(latitude, longitude) !== null;
}

const CANONICAL_ZONE = Object.freeze({
  Eastern: "America/New_York",
  Central: "America/Chicago",
  Mountain: "America/Denver",
  Pacific: "America/Los_Angeles",
  Alaska: "America/Anchorage",
  "Hawaii-Aleutian": "Pacific/Honolulu"
});
const RAW_STANDARD_ZONE = new Map([
  ["America/New_York", "Eastern"], ["America/Detroit", "Eastern"], ["America/Indiana/Indianapolis", "Eastern"],
  ["America/Indiana/Knox", "Central"], ["America/Chicago", "Central"], ["America/North_Dakota/Beulah", "Central"],
  ["America/North_Dakota/Center", "Central"], ["America/North_Dakota/New_Salem", "Central"],
  ["America/Denver", "Mountain"], ["America/Boise", "Mountain"], ["America/Phoenix", "Mountain"],
  ["America/Los_Angeles", "Pacific"], ["America/Anchorage", "Alaska"], ["America/Juneau", "Alaska"],
  ["America/Metlakatla", "Alaska"], ["America/Nome", "Alaska"], ["America/Sitka", "Alaska"],
  ["America/Yakutat", "Alaska"], ["America/Adak", "Hawaii-Aleutian"], ["Pacific/Honolulu", "Hawaii-Aleutian"]
]);

export function civilZoneAt(latitude, longitude) {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  const match = US_CONTAINMENT_POLYGONS.find(({ rings }) =>
    pointInRing(longitude, latitude, rings[0]) &&
    !rings.slice(1).some((hole) => pointInRing(longitude, latitude, hole))
  );
  return match?.zone ?? null;
}

export function resolveUsCivilTimeZone(latitude, longitude, rawTimeZone) {
  const civilZone = civilZoneAt(latitude, longitude);
  if (!civilZone) return null;
  if (rawTimeZone === "America/Phoenix" && civilZone === "Mountain") return rawTimeZone;
  if (RAW_STANDARD_ZONE.get(rawTimeZone) === civilZone) return rawTimeZone;
  return CANONICAL_ZONE[civilZone];
}
