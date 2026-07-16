const FIELD_ORDER = [
  "lat",
  "lon",
  "place",
  "tz",
  "wake",
  "sleep",
  "bias",
  "year"
];

// Defaults use the same three-decimal coordinate precision as shared URLs.
export const DEFAULT_STATE = Object.freeze({
  lat: 38.94,
  lon: -119.977,
  place: "South Lake Tahoe, CA",
  tz: "America/Los_Angeles",
  wake: 420,
  sleep: 1320,
  bias: 0,
  year: new Date().getFullYear()
});

function roundCoordinate(value) {
  const rounded = Math.round((value + Number.EPSILON) * 1000) / 1000;
  return Object.is(rounded, -0) ? 0 : rounded;
}

function validCoordinate(value, minimum, maximum) {
  return typeof value === "number" && Number.isFinite(value) && value >= minimum && value <= maximum;
}

function normalizePlace(value) {
  if (typeof value !== "string") return null;
  const compact = value.normalize("NFC").replace(/\s+/gu, " ").trim();
  if (!compact) return null;
  return Array.from(compact).slice(0, 60).join("");
}

function validTimeZone(value) {
  if (typeof value !== "string" || !value) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format(0);
    return true;
  } catch {
    return false;
  }
}

function validInteger(value, minimum, maximum) {
  return Number.isInteger(value) && value >= minimum && value <= maximum;
}

function wakingDuration(wake, sleep) {
  return (sleep - wake + 1440) % 1440;
}

function validWakingWindow(wake, sleep) {
  const duration = wakingDuration(wake, sleep);
  return duration >= 480 && duration <= 1200;
}

function normalizedState(input = {}) {
  const state = {
    lat: validCoordinate(input.lat, -90, 90)
      ? roundCoordinate(input.lat)
      : DEFAULT_STATE.lat,
    lon: validCoordinate(input.lon, -180, 180)
      ? roundCoordinate(input.lon)
      : DEFAULT_STATE.lon,
    place: normalizePlace(input.place) ?? DEFAULT_STATE.place,
    tz: validTimeZone(input.tz) ? input.tz : DEFAULT_STATE.tz,
    wake: validInteger(input.wake, 0, 1439) ? input.wake : DEFAULT_STATE.wake,
    sleep: validInteger(input.sleep, 0, 1439)
      ? input.sleep
      : DEFAULT_STATE.sleep,
    bias: validInteger(input.bias, -100, 100) ? input.bias : DEFAULT_STATE.bias,
    year: validInteger(input.year, 1000, 9999) ? input.year : DEFAULT_STATE.year
  };

  if (!validWakingWindow(state.wake, state.sleep)) {
    state.wake = DEFAULT_STATE.wake;
    state.sleep = DEFAULT_STATE.sleep;
  }

  return state;
}

/**
 * Serializes every canonical field. Malformed values normalize independently to
 * defaults; an invalid wake/sleep relationship normalizes both endpoints.
 */
export function serializeState(input) {
  const state = normalizedState(input);
  const params = new URLSearchParams();

  params.set("lat", state.lat.toFixed(3));
  params.set("lon", state.lon.toFixed(3));
  params.set("place", state.place);
  params.set("tz", state.tz);
  params.set("wake", String(state.wake));
  params.set("sleep", String(state.sleep));
  params.set("bias", String(state.bias));
  params.set("year", String(state.year));

  return params.toString();
}

function lastValue(params, field) {
  const values = params.getAll(field);
  return values.at(-1);
}

function parseDecimal(value, minimum, maximum) {
  if (value === undefined || value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= minimum && parsed <= maximum
    ? roundCoordinate(parsed)
    : null;
}

function parseInteger(value, minimum, maximum) {
  if (value === undefined || !/^-?(?:0|[1-9]\d*)$/u.test(value)) return null;
  const parsed = Number(value);
  return validInteger(parsed, minimum, maximum) ? parsed : null;
}

/**
 * Parses known fields only. Duplicate keys use the last value. Present malformed
 * fields fall back independently and are reported in canonical field order.
 */
export function parseState(query = "") {
  const params =
    query instanceof URLSearchParams
      ? query
      : new URLSearchParams(
          typeof query === "string" && query.startsWith("?")
            ? query.slice(1)
            : query
        );
  const state = { ...DEFAULT_STATE };
  const reset = new Set();
  const has = (field) => params.has(field);

  if (has("lat")) {
    const value = parseDecimal(lastValue(params, "lat"), -90, 90);
    if (value === null) reset.add("lat");
    else state.lat = value;
  }
  if (has("lon")) {
    const value = parseDecimal(lastValue(params, "lon"), -180, 180);
    if (value === null) reset.add("lon");
    else state.lon = value;
  }
  if (has("place")) {
    const value = normalizePlace(lastValue(params, "place"));
    if (value === null) reset.add("place");
    else state.place = value;
  }
  if (has("tz")) {
    const value = lastValue(params, "tz");
    if (!validTimeZone(value)) reset.add("tz");
    else state.tz = value;
  }

  const parsedWake = has("wake")
    ? parseInteger(lastValue(params, "wake"), 0, 1439)
    : undefined;
  const parsedSleep = has("sleep")
    ? parseInteger(lastValue(params, "sleep"), 0, 1439)
    : undefined;
  if (has("wake")) {
    if (parsedWake === null) reset.add("wake");
    else state.wake = parsedWake;
  }
  if (has("sleep")) {
    if (parsedSleep === null) reset.add("sleep");
    else state.sleep = parsedSleep;
  }
  if (
    parsedWake !== undefined &&
    parsedWake !== null &&
    parsedSleep !== undefined &&
    parsedSleep !== null &&
    !validWakingWindow(parsedWake, parsedSleep)
  ) {
    state.wake = DEFAULT_STATE.wake;
    state.sleep = DEFAULT_STATE.sleep;
    reset.add("wake");
    reset.add("sleep");
  }

  if (has("bias")) {
    const value = parseInteger(lastValue(params, "bias"), -100, 100);
    if (value === null) reset.add("bias");
    else state.bias = value;
  }
  if (has("year")) {
    const value = parseInteger(lastValue(params, "year"), 1000, 9999);
    if (value === null) reset.add("year");
    else state.year = value;
  }

  return {
    state,
    resetFields: FIELD_ORDER.filter((field) => reset.has(field))
  };
}
