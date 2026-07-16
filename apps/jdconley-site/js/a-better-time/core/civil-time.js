const offsetFormatterCache = new Map();

function getOffsetFormatter(timeZone) {
  let formatter = offsetFormatterCache.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      calendar: "gregory",
      numberingSystem: "latn",
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    });
    offsetFormatterCache.set(timeZone, formatter);
  }
  return formatter;
}

export function getOffsetMinutes(utcMs, timeZone) {
  if (!Number.isFinite(utcMs)) {
    throw new TypeError("utcMs must be a finite number");
  }
  if (typeof timeZone !== "string" || timeZone.length === 0) {
    throw new TypeError("timeZone must be a non-empty string");
  }

  const values = {};
  for (const { type, value } of getOffsetFormatter(timeZone).formatToParts(utcMs)) {
    if (type !== "literal") values[type] = Number(value);
  }

  // Some formatters can represent midnight as 24:00 for the same calendar day.
  const hour = values.hour === 24 ? 0 : values.hour;
  const localAsUtcMs = Date.UTC(
    values.year,
    values.month - 1,
    values.day,
    hour,
    values.minute,
    values.second
  );
  const utcWholeSecondMs = Math.floor(utcMs / 1000) * 1000;

  return (localAsUtcMs - utcWholeSecondMs) / 60_000;
}

export function getStandardOffsetMinutes(year, timeZone) {
  if (!Number.isInteger(year) || year < 1000 || year > 9999) {
    throw new RangeError("year must be an integer from 1000 through 9999");
  }

  return Math.min(
    ...Array.from({ length: 12 }, (_, month) =>
      getOffsetMinutes(Date.UTC(year, month, 15, 12), timeZone)
    )
  );
}
