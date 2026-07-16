import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const SOURCE = Object.freeze({
  url: "https://services.arcgis.com/xOi1kZaI0eWDREZv/arcgis/rest/services/NTAD_Time_Zones/FeatureServer/0/query?where=1%3D1&outFields=*&returnGeometry=true&outSR=4326&f=geojson",
  sha256: "23fd76af3f675ae4c30718ceee2fe4e24fdea8122b64b72210ac40bb2abbb2dd"
});
const INCLUDED_ZONES = new Set(["Eastern", "Central", "Mountain", "Pacific", "Alaska", "Hawaii-Aleutian"]);
const TOLERANCE = 0.002;

function perpendicularDistance(point, start, end) {
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  const denominator = dx * dx + dy * dy;
  const amount = denominator
    ? Math.max(0, Math.min(1, ((point[0] - start[0]) * dx + (point[1] - start[1]) * dy) / denominator))
    : 0;
  const x = start[0] + amount * dx;
  const y = start[1] + amount * dy;
  return Math.hypot(point[0] - x, point[1] - y);
}

function simplify(points, tolerance = TOLERANCE) {
  if (points.length < 3) return points;
  let farthestIndex = 0;
  let farthestDistance = 0;
  for (let index = 1; index < points.length - 1; index += 1) {
    const distance = perpendicularDistance(points[index], points[0], points.at(-1));
    if (distance > farthestDistance) {
      farthestDistance = distance;
      farthestIndex = index;
    }
  }
  if (farthestDistance <= tolerance) return [points[0], points.at(-1)];
  return [
    ...simplify(points.slice(0, farthestIndex + 1), tolerance).slice(0, -1),
    ...simplify(points.slice(farthestIndex), tolerance)
  ];
}

export function buildContainmentPolygons(featureCollection) {
  return featureCollection.features
    .filter((feature) => INCLUDED_ZONES.has(feature.properties.zone))
    .flatMap((feature) => feature.geometry.type === "Polygon" ? [feature.geometry.coordinates] : feature.geometry.coordinates)
    .map((polygon) => polygon.map((ring) => simplify(ring).map(([longitude, latitude]) => [
      Number(longitude.toFixed(4)), Number(latitude.toFixed(4))
    ])));
}

export async function generateContainmentModule({ fetcher = fetch } = {}) {
  const response = await fetcher(SOURCE.url);
  if (!response.ok) throw new Error(`Boundary download failed (${response.status})`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  const checksum = createHash("sha256").update(bytes).digest("hex");
  if (checksum !== SOURCE.sha256) throw new Error(`Boundary checksum mismatch: ${checksum}`);
  const polygons = buildContainmentPolygons(JSON.parse(new TextDecoder().decode(bytes)));
  return `// Generated from U.S. DOT/BTS NTAD time-zone boundaries (verified representation of 49 CFR Part 71).\n// Source SHA-256: ${SOURCE.sha256}; excluded zones: Atlantic, Samoa, Chamorro; simplification: ${TOLERANCE}°.\nexport const US_CONTAINMENT_POLYGONS=${JSON.stringify(polygons)};\n`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const output = fileURLToPath(new URL("../js/a-better-time/us-containment-data.js", import.meta.url));
  await writeFile(output, await generateContainmentModule());
  console.log(`Wrote ${output}`);
}
