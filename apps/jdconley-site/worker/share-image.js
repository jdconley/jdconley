import satori, { init as initSatori } from "satori/standalone";
import yogaWasm from "satori/yoga.wasm";
import { Resvg, initWasm } from "@resvg/resvg-wasm";
import wasm from "@resvg/resvg-wasm/index_bg.wasm";
import interRegular from "../node_modules/@fontsource/inter/files/inter-latin-400-normal.woff";
import interBold from "../node_modules/@fontsource/inter/files/inter-latin-600-normal.woff";

import { parseState, serializeState } from "../js/a-better-time/core/url-state.js";
import { buildSolarYear } from "../js/a-better-time/core/solar.js";
import { optimizeYear } from "../js/a-better-time/core/optimizer.js";
import { SHARE_IMAGE_VERSION } from "../js/a-better-time/share-image-version.js";

let wasmReady;
const inFlightRenders = new Map();
const MAX_CONCURRENT_RENDERS = 6;
const ready = () => (wasmReady ??= Promise.all([initSatori(yogaWasm), initWasm(wasm)]));
const el = (type, style, children, props = {}) => ({ type, props: { ...props, style, children } });
export const SHARE_CHANGE_COPY = "Up to 1 minute daily jumps";
export { SHARE_IMAGE_VERSION };

export function shareImageUrl(query, version = SHARE_IMAGE_VERSION) {
  return `https://jdconley.com/a-better-time/share.png?${query}&v=${encodeURIComponent(version)}`;
}

function biasLabel(value) { return value < -10 ? "Morning light" : value > 10 ? "Evening light" : "Balanced light"; }
function clock(minutes) { const h = Math.floor(minutes / 60), m = minutes % 60; return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`; }

export async function shareImageEtag(query, version = SHARE_IMAGE_VERSION) {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${version}\n${query}`));
  return `"${[...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, "0")).join("")}"`;
}

function matchesEtag(header, etag) {
  if (!header) return false;
  return header.split(",").some((candidate) => {
    const value = candidate.trim();
    return value === "*" || value === etag || value === `W/${etag}`;
  });
}

async function renderShareImage(state) {
  const result = optimizeYear({ solarYear: buildSolarYear({ year: state.year, lat: state.lat, lon: state.lon }), timeZone: state.tz, wake: state.wake, sleep: state.sleep, bias: state.bias });
  const chart = result.days.filter((_, index) => index % 12 === 0).map((day, index, rows) => {
    const x = 45 + index / (rows.length - 1) * 1010;
    const y = 405 - (day.proposedOffsetSeconds / 60 + 180) / 360 * 135;
    return `${index ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(" ");
  const tree = el("div", { width: 1200, height: 630, display: "flex", flexDirection: "column", padding: "54px 68px", background: "#f7f8fa", color: "#111318", fontFamily: "Inter" }, [
    el("div", { display: "flex", justifyContent: "space-between", alignItems: "center" }, [el("div", { fontSize: 24, fontWeight: 600 }, "A Better Time"), el("div", { fontSize: 18, color: "#59616e" }, "jdconley.com")]),
    el("div", { display: "flex", marginTop: 56, justifyContent: "space-between", alignItems: "flex-end" }, [
      el("div", { display: "flex", flexDirection: "column", width: 700 }, [el("div", { fontSize: 26, color: "#315eea", marginBottom: 14 }, state.place), el("div", { fontSize: 64, lineHeight: 1.02, fontWeight: 600, letterSpacing: "-3px" }, `${result.gainedHoursRounded >= 0 ? "+" : ""}${result.gainedHoursRounded} hours`), el("div", { fontSize: 22, color: "#59616e", marginTop: 14 }, "of useful daylight across your waking year")]),
      el("div", { display: "flex", flexDirection: "column", alignItems: "flex-end", fontSize: 19, color: "#59616e" }, [el("div", {}, `${clock(state.wake)} – ${clock(state.sleep)}`), el("div", { marginTop: 8 }, biasLabel(state.bias)), el("div", { marginTop: 8 }, SHARE_CHANGE_COPY)])
    ]),
    el("svg", { width: 1064, height: 180, marginTop: 38, background: "#fff", borderRadius: 18 }, [
      { type: "path", props: { d: chart, fill: "none", stroke: "#315eea", strokeWidth: 5, strokeLinecap: "round" } },
      { type: "line", props: { x1: 45, x2: 1055, y1: 337, y2: 337, stroke: "#ff9f0a", strokeWidth: 2, strokeDasharray: "6 8" } }
    ], { viewBox: "0 250 1100 180" })
  ]);
  await ready();
  const svg = await satori(tree, { width: 1200, height: 630, fonts: [
    { name: "Inter", data: interRegular, weight: 400, style: "normal" },
    { name: "Inter", data: interBold, weight: 600, style: "normal" }
  ] });
  return new Resvg(svg, { fitTo: { mode: "width", value: 1200 } }).render().asPng();
}

export function createShareImageHandler({
  render = renderShareImage,
  version = SHARE_IMAGE_VERSION,
  cache,
  maxConcurrentRenders = MAX_CONCURRENT_RENDERS
} = {}) {
  return async function handleVersionedShareImage(request) {
    if (request.method !== "GET") {
      return new Response(null, { status: 405, headers: { allow: "GET" } });
    }

    const requestUrl = new URL(request.url);
    const state = parseState(requestUrl.search).state;
    const query = serializeState(state);
    const requestedVersions = requestUrl.searchParams.getAll("v");
    if (requestedVersions.length !== 1 || requestedVersions[0] !== version) {
      return new Response(null, {
        status: 302,
        headers: {
          location: shareImageUrl(query, version),
          "cache-control": "no-store"
        }
      });
    }
    const etag = await shareImageEtag(query, version);
    const responseHeaders = {
      "content-type": "image/png",
      "cache-control": "public, max-age=31536000, immutable",
      etag
    };

    if (matchesEtag(request.headers.get("if-none-match"), etag)) {
      return new Response(null, { status: 304, headers: responseHeaders });
    }

    const edgeCache = cache ?? caches.default;
    const cacheKey = new Request(shareImageUrl(query, version));
    let cached;
    try {
      cached = await edgeCache.match(cacheKey);
    } catch {
      cached = undefined;
    }
    if (cached) return cached;

    const flightKey = `${version}\n${query}`;
    let flight = inFlightRenders.get(flightKey);
    if (!flight) {
      if (inFlightRenders.size >= maxConcurrentRenders) {
        return new Response("Share image rendering is busy. Try again shortly.", {
          status: 503,
          headers: {
            "content-type": "text/plain; charset=utf-8",
            "cache-control": "no-store",
            "retry-after": "1"
          }
        });
      }
      const renderAndCache = async () => {
        const png = await render(state);
        const response = new Response(png, { headers: responseHeaders });
        try {
          await edgeCache.put(cacheKey, response.clone());
        } catch {
          // Edge caching is an optimization; a rendered image remains usable.
        }
        return response;
      };
      flight = renderAndCache();
      inFlightRenders.set(flightKey, flight);
      flight.finally(() => {
        if (inFlightRenders.get(flightKey) === flight) inFlightRenders.delete(flightKey);
      }).catch(() => {});
    }
    return (await flight).clone();
  };
}

export const handleShareImage = createShareImageHandler();
