import * as SunCalc from "suncalc";

const SECONDS_PER_DAY = 86_400;
const MS_PER_MINUTE = 60_000;
const MS_PER_DAY = SECONDS_PER_DAY * 1000;
const CROSSING_SAMPLE_MS = 5 * MS_PER_MINUTE;
const GEOMETRIC_SUNRISE_ALTITUDE_DEGREES = -0.833;
// SunCalc 2 clamps negative geometric altitudes to zero when calculating its
// Meeus refraction correction. This is the apparent-altitude equivalent of its
// geometric -0.833-degree sunrise threshold: about -0.3490404 degrees.
const HORIZON_REFRACTION_RADIANS =
  0.0002967 / Math.tan(0.00312536 / 0.08901179);
const APPARENT_SUNRISE_ALTITUDE_DEGREES =
  GEOMETRIC_SUNRISE_ALTITUDE_DEGREES +
  (HORIZON_REFRACTION_RADIANS * 180) / Math.PI;

function assertSolarInputs({ year, lat, lon }) {
  if (!Number.isInteger(year) || year < 1000 || year > 9999) {
    throw new RangeError("year must be an integer from 1000 through 9999");
  }
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
    throw new RangeError("lat must be a finite number from -90 through 90");
  }
  if (!Number.isFinite(lon) || lon < -180 || lon > 180) {
    throw new RangeError("lon must be a finite number from -180 through 180");
  }
}

function isValidDate(value) {
  return value instanceof Date && Number.isFinite(value.getTime());
}

function getExplicitPolarState(events) {
  if (events.alwaysUp === true && events.alwaysDown !== true) {
    return "polar-day";
  }
  if (events.alwaysDown === true && events.alwaysUp !== true) {
    return "polar-night";
  }
  return null;
}

function altitudeMargin(utcMs, lat, lon) {
  return (
    SunCalc.getPosition(new Date(utcMs), lat, lon).altitude -
    APPARENT_SUNRISE_ALTITUDE_DEGREES
  );
}

function refineHorizonCrossing(aboveUtcMs, belowUtcMs, lat, lon) {
  let above = aboveUtcMs;
  let below = belowUtcMs;

  for (let iteration = 0; iteration < 32; iteration += 1) {
    const midpoint = (above + below) / 2;
    if (altitudeMargin(midpoint, lat, lon) > 0) {
      above = midpoint;
    } else {
      below = midpoint;
    }
  }

  return Math.round((above + below) / 2);
}

function findDaylightEdge(solarNoonUtcMs, windowEdgeUtcMs, lat, lon) {
  const direction = windowEdgeUtcMs < solarNoonUtcMs ? -1 : 1;
  let aboveUtcMs = solarNoonUtcMs;

  while (aboveUtcMs !== windowEdgeUtcMs) {
    const candidateUtcMs =
      direction < 0
        ? Math.max(windowEdgeUtcMs, aboveUtcMs - CROSSING_SAMPLE_MS)
        : Math.min(windowEdgeUtcMs, aboveUtcMs + CROSSING_SAMPLE_MS);

    if (altitudeMargin(candidateUtcMs, lat, lon) <= 0) {
      return {
        utcMs: refineHorizonCrossing(aboveUtcMs, candidateUtcMs, lat, lon),
        crossed: true
      };
    }
    aboveUtcMs = candidateUtcMs;
  }

  return { utcMs: windowEdgeUtcMs, crossed: false };
}

function deriveBoundedNormalEvents(events, lat, lon) {
  if (!isValidDate(events.solarNoon)) return null;

  const solarNoonUtcMs = events.solarNoon.getTime();
  if (altitudeMargin(solarNoonUtcMs, lat, lon) <= 0) return null;

  const windowStartUtcMs = solarNoonUtcMs - MS_PER_DAY / 2;
  const windowEndUtcMs = solarNoonUtcMs + MS_PER_DAY / 2;
  const sunrise = findDaylightEdge(solarNoonUtcMs, windowStartUtcMs, lat, lon);
  const sunset = findDaylightEdge(solarNoonUtcMs, windowEndUtcMs, lat, lon);

  if (!sunrise.crossed && !sunset.crossed) return null;

  const daylightSeconds = (sunset.utcMs - sunrise.utcMs) / 1000;
  if (daylightSeconds <= 0 || daylightSeconds >= SECONDS_PER_DAY) return null;

  return {
    sunriseUtcMs: sunrise.utcMs,
    sunsetUtcMs: sunset.utcMs,
    daylightSeconds
  };
}

function inferPolarState(dayUtcMs, lat, lon, events) {
  const explicitState = getExplicitPolarState(events);
  if (explicitState) return explicitState;

  const solarNoonUtcMs = isValidDate(events.solarNoon)
    ? events.solarNoon.getTime()
    : dayUtcMs + 12 * 60 * MS_PER_MINUTE - lon * 4 * MS_PER_MINUTE;
  const solarMidnightUtcMs = isValidDate(events.nadir)
    ? events.nadir.getTime()
    : solarNoonUtcMs - 12 * 60 * MS_PER_MINUTE;
  const noonMargin = altitudeMargin(solarNoonUtcMs, lat, lon);
  const midnightMargin = altitudeMargin(solarMidnightUtcMs, lat, lon);

  if (noonMargin > 0 && midnightMargin > 0) return "polar-day";
  if (noonMargin <= 0 && midnightMargin <= 0) return "polar-night";

  return noonMargin + midnightMargin > 0 ? "polar-day" : "polar-night";
}

function formatUtcDate(utcMs) {
  return new Date(utcMs).toISOString().slice(0, 10);
}

export function buildSolarYear({ year, lat, lon }) {
  assertSolarInputs({ year, lat, lon });

  const startUtcMs = Date.UTC(year, 0, 1);
  const endUtcMs = Date.UTC(year + 1, 0, 1);
  const days = [];

  for (
    let dayUtcMs = startUtcMs;
    dayUtcMs < endUtcMs;
    dayUtcMs += SECONDS_PER_DAY * 1000
  ) {
    const date = formatUtcDate(dayUtcMs);
    const events = SunCalc.getTimes(
      new Date(dayUtcMs + 12 * 60 * MS_PER_MINUTE),
      lat,
      lon
    );
    const sunriseUtcMs = events.sunrise?.getTime();
    const sunsetUtcMs = events.sunset?.getTime();
    const daylightSeconds = (sunsetUtcMs - sunriseUtcMs) / 1000;
    const explicitPolarState = getExplicitPolarState(events);

    if (explicitPolarState) {
      days.push({
        date,
        state: explicitPolarState,
        sunriseUtcMs: null,
        sunsetUtcMs: null,
        daylightSeconds:
          explicitPolarState === "polar-day" ? SECONDS_PER_DAY : 0
      });
      continue;
    }

    if (
      isValidDate(events.sunrise) &&
      isValidDate(events.sunset) &&
      daylightSeconds > 0 &&
      daylightSeconds <= SECONDS_PER_DAY
    ) {
      days.push({
        date,
        state: "normal",
        sunriseUtcMs,
        sunsetUtcMs,
        daylightSeconds
      });
      continue;
    }

    const boundedEvents = deriveBoundedNormalEvents(events, lat, lon);
    if (boundedEvents) {
      days.push({ date, state: "normal", ...boundedEvents });
      continue;
    }

    const state = inferPolarState(dayUtcMs, lat, lon, events);
    days.push({
      date,
      state,
      sunriseUtcMs: null,
      sunsetUtcMs: null,
      daylightSeconds: state === "polar-day" ? SECONDS_PER_DAY : 0
    });
  }

  return days;
}
