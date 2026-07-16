import * as SunCalc from "suncalc";

const SECONDS_PER_DAY = 86_400;
const MS_PER_MINUTE = 60_000;
const SUNRISE_ALTITUDE_DEGREES = -0.833;

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

function inferPolarState(dayUtcMs, lat, lon, events) {
  if (events.alwaysUp === true && events.alwaysDown !== true) {
    return "polar-day";
  }
  if (events.alwaysDown === true && events.alwaysUp !== true) {
    return "polar-night";
  }

  const solarNoonUtcMs = dayUtcMs + 12 * 60 * MS_PER_MINUTE - lon * 4 * MS_PER_MINUTE;
  const solarMidnightUtcMs = solarNoonUtcMs - 12 * 60 * MS_PER_MINUTE;
  const noonAltitude = SunCalc.getPosition(new Date(solarNoonUtcMs), lat, lon).altitude;
  const midnightAltitude = SunCalc.getPosition(
    new Date(solarMidnightUtcMs),
    lat,
    lon
  ).altitude;

  const noonMargin = noonAltitude - SUNRISE_ALTITUDE_DEGREES;
  const midnightMargin = midnightAltitude - SUNRISE_ALTITUDE_DEGREES;

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

    if (
      events.alwaysUp !== true &&
      events.alwaysDown !== true &&
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
