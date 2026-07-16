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
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return false;
  return US_CONTAINMENT_POLYGONS.some((polygon) =>
    pointInRing(longitude, latitude, polygon[0]) &&
    !polygon.slice(1).some((hole) => pointInRing(longitude, latitude, hole))
  );
}
