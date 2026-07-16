import {
  getOffsetMinutes,
  getStandardOffsetMinutes
} from "./civil-time.js";

const MINUTES_PER_DAY = 1440;
const SECONDS_PER_DAY = 86_400;
const MS_PER_MINUTE = 60_000;

function requireFinite(name, value) {
  if (!Number.isFinite(value)) {
    throw new TypeError(`${name} must be a finite number`);
  }
}

export function chooseIdealSunrise({ wake, sleep, daylightMinutes, bias }) {
  requireFinite("wake", wake);
  requireFinite("sleep", sleep);
  requireFinite("daylightMinutes", daylightMinutes);
  requireFinite("bias", bias);
  if (wake < 0 || wake >= MINUTES_PER_DAY) {
    throw new RangeError("wake must be a minute from 0 through 1439");
  }
  if (sleep < 0 || sleep >= MINUTES_PER_DAY) {
    throw new RangeError("sleep must be a minute from 0 through 1439");
  }
  if (daylightMinutes < 0 || daylightMinutes > 1440) {
    throw new RangeError("daylightMinutes must be between 0 and 1440");
  }

  const end = sleep <= wake ? sleep + 1440 : sleep;
  const daylightAlignedSunrise = end - daylightMinutes;
  const lower = Math.min(wake, daylightAlignedSunrise);
  const upper = Math.max(wake, daylightAlignedSunrise);
  const t = (Math.max(-100, Math.min(100, bias)) + 100) / 200;
  return lower + (upper - lower) * t;
}

function roundOffset(value) {
  const magnitude = Math.abs(value);
  const floor = Math.floor(magnitude);
  const roundedMagnitude = magnitude - floor <= 0.5 ? floor : floor + 1;
  return Math.sign(value) * roundedMagnitude;
}

function hasValidCircularChanges(offsets, maximum) {
  return offsets.every((offset, day) => {
    const previous = offsets[(day - 1 + offsets.length) % offsets.length];
    return Math.abs(offset - previous) <= maximum;
  });
}

function compareSchedules(left, right, ideals) {
  const leftError = left.reduce(
    (sum, value, index) => sum + (value - ideals[index]) ** 2,
    0
  );
  const rightError = right.reduce(
    (sum, value, index) => sum + (value - ideals[index]) ** 2,
    0
  );
  if (Math.abs(leftError - rightError) > 1e-9) return leftError - rightError;
  const leftMagnitude = left.reduce((sum, value) => sum + Math.abs(value), 0);
  const rightMagnitude = right.reduce(
    (sum, value) => sum + Math.abs(value),
    0
  );
  if (leftMagnitude !== rightMagnitude) return leftMagnitude - rightMagnitude;
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return left[index] - right[index];
  }
  return 0;
}

function optimizeIntegerOffsets(continuous, ideals, cap) {
  // Integral difference-bound polyhedra have the proximity property for
  // separable convex objectives: an integer optimum is found by choosing a
  // floor or ceiling of each continuous optimum coordinate. The two-state
  // circular dynamic program makes that choice globally, including tie-breaks.
  const candidates = Array.from(continuous, (value) => {
    const lower = Math.floor(value) || 0;
    const upper = Math.ceil(value) || 0;
    return lower === upper ? [lower] : [lower, upper];
  });
  let best = null;

  for (const first of candidates[0]) {
    let paths = new Map([[first, [first]]]);
    for (let day = 1; day < candidates.length; day += 1) {
      const nextPaths = new Map();
      for (const value of candidates[day]) {
        for (const [previous, path] of paths) {
          if (Math.abs(value - previous) > cap) continue;
          const candidate = [...path, value];
          const incumbent = nextPaths.get(value);
          if (!incumbent || compareSchedules(candidate, incumbent, ideals) < 0) {
            nextPaths.set(value, candidate);
          }
        }
      }
      paths = nextPaths;
    }
    for (const path of paths.values()) {
      if (Math.abs(path.at(-1) - first) > cap) continue;
      if (!best || compareSchedules(path, best, ideals) < 0) best = path;
    }
  }
  if (!best) {
    throw new Error("could not produce a valid integer circular schedule");
  }
  return best;
}

export function constrainCircularOffsets(ideals, maxDailyChangeSeconds = 60) {
  if (!Array.isArray(ideals) || ideals.length === 0) {
    throw new TypeError("ideals must be a non-empty array");
  }
  if (!ideals.every(Number.isFinite)) {
    throw new TypeError("every ideal offset must be finite");
  }
  if (!Number.isInteger(maxDailyChangeSeconds) || maxDailyChangeSeconds <= 0) {
    throw new RangeError(
      "maxDailyChangeSeconds must be a positive integer"
    );
  }
  if (ideals.length === 1) return [roundOffset(ideals[0])];

  // The slight sub-second margin makes nearest-integer rounding preserve the
  // public integer cap even when neighboring coordinates round apart.
  const projectionCap = maxDailyChangeSeconds - 0.001;
  // A deterministic accelerated dual pass supplies a close starting point;
  // Dykstra below remains the convergence authority and final projection.
  const length = ideals.length;
  let dual = new Float64Array(length);
  let nextDual = new Float64Array(length);
  const momentum = new Float64Array(length);
  const dualTranspose = new Float64Array(length);
  const idealChanges = new Float64Array(length);
  let momentumScale = 1;
  for (let day = 0; day < length; day += 1) {
    idealChanges[day] = ideals[day] - ideals[(day - 1 + length) % length];
  }
  for (let iteration = 0; iteration < 50_000; iteration += 1) {
    for (let day = 0; day < length; day += 1) {
      dualTranspose[day] = momentum[day] - momentum[(day + 1) % length];
    }
    let dualChange = 0;
    for (let edge = 0; edge < length; edge += 1) {
      const gradient =
        dualTranspose[edge] -
        dualTranspose[(edge - 1 + length) % length] -
        idealChanges[edge];
      const stepped = momentum[edge] - gradient / 4;
      const magnitude = Math.max(0, Math.abs(stepped) - projectionCap / 4);
      const value = Math.sign(stepped) * magnitude;
      nextDual[edge] = value;
      dualChange = Math.max(dualChange, Math.abs(value - dual[edge]));
    }
    const nextScale = (1 + Math.sqrt(1 + 4 * momentumScale ** 2)) / 2;
    const momentumWeight = (momentumScale - 1) / nextScale;
    for (let edge = 0; edge < length; edge += 1) {
      momentum[edge] =
        nextDual[edge] + momentumWeight * (nextDual[edge] - dual[edge]);
    }
    const reusable = dual;
    dual = nextDual;
    nextDual = reusable;
    momentumScale = nextScale;
    if (dualChange < 1e-11) break;
    if ((iteration + 1) % 1000 === 0) {
      momentum.set(dual);
      momentumScale = 1;
    }
  }
  const offsets = new Float64Array(length);
  for (let day = 0; day < length; day += 1) {
    dualTranspose[day] = dual[day] - dual[(day + 1) % length];
    offsets[day] = ideals[day] - dualTranspose[day];
  }

  // Warm-start Dykstra with a feasible primal point and matching dual
  // corrections. This preserves the original least-squares target while
  // avoiding slow propagation around long active stretches of the cycle.
  const corrections = dual.slice();
  const before = new Float64Array(length);

  let converged = false;
  let finalCoordinateChange = Infinity;
  for (let sweep = 0; sweep < 20_000; sweep += 1) {
    before.set(offsets);
    for (let current = 0; current < length; current += 1) {
      const previous = (current - 1 + length) % length;
      const currentInput = offsets[current] + corrections[current];
      const previousInput = offsets[previous] - corrections[current];
      const difference = currentInput - previousInput;
      const violation = Math.abs(difference) - projectionCap;
      const adjustment = violation > 0 ? violation / 2 : 0;
      const direction = Math.sign(difference);
      const projectedCurrent = currentInput - direction * adjustment;
      const projectedPrevious = previousInput + direction * adjustment;

      offsets[current] = projectedCurrent;
      offsets[previous] = projectedPrevious;
      corrections[current] = currentInput - projectedCurrent;
    }

    let maxCoordinateChange = 0;
    for (let day = 0; day < length; day += 1) {
      maxCoordinateChange = Math.max(
        maxCoordinateChange,
        Math.abs(offsets[day] - before[day])
      );
    }
    finalCoordinateChange = maxCoordinateChange;
    if (maxCoordinateChange < 1e-7) {
      converged = true;
      break;
    }
  }

  if (!converged) {
    throw new Error(
      `circular least-squares projection did not converge (${finalCoordinateChange})`
    );
  }

  const integerCap = maxDailyChangeSeconds;
  const integerOffsets = offsets.map(roundOffset);

  // Normally the projection margin makes these no-ops. They are kept as a
  // deterministic guard against floating-point edge cases at integer ties.
  for (let pass = 0; pass < 2; pass += 1) {
    const days =
      pass === 0
        ? Array.from({ length: integerOffsets.length }, (_, day) => day)
        : Array.from(
            { length: integerOffsets.length },
            (_, day) => integerOffsets.length - 1 - day
          );
    for (const day of days) {
      const previous = (day - 1 + integerOffsets.length) % integerOffsets.length;
      const difference = integerOffsets[day] - integerOffsets[previous];
      if (Math.abs(difference) > integerCap) {
        integerOffsets[day] =
          integerOffsets[previous] + Math.sign(difference) * integerCap;
      }
    }
  }

  // The repaired rounding is deliberately not returned: the exact discrete
  // optimization is authoritative, while these passes guard the specified
  // deterministic rounding path against floating-point boundary behavior.
  const optimizedIntegers = optimizeIntegerOffsets(offsets, ideals, integerCap);
  if (!hasValidCircularChanges(optimizedIntegers, integerCap)) {
    throw new Error("could not produce a valid integer circular schedule");
  }
  return optimizedIntegers;
}

function parseDateUtc(date) {
  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new TypeError("each solar row date must use YYYY-MM-DD");
  }
  const utcMs = Date.parse(`${date}T00:00:00Z`);
  if (
    !Number.isFinite(utcMs) ||
    new Date(utcMs).toISOString().slice(0, 10) !== date
  ) {
    throw new RangeError(`invalid solar row date: ${date}`);
  }
  return utcMs;
}

function wakingDurationSeconds(wake, sleep) {
  const end = sleep <= wake ? sleep + MINUTES_PER_DAY : sleep;
  return (end - wake) * 60;
}

function intersectSeconds(startA, endA, startB, endB) {
  return Math.max(0, Math.min(endA, endB) - Math.max(startA, startB)) / 1000;
}

function localClockUtcMs(localUtcMs, timeZone) {
  let utcMs = localUtcMs - getOffsetMinutes(localUtcMs, timeZone) * MS_PER_MINUTE;
  for (let iteration = 0; iteration < 4; iteration += 1) {
    const next =
      localUtcMs - getOffsetMinutes(utcMs, timeZone) * MS_PER_MINUTE;
    if (next === utcMs) break;
    utcMs = next;
  }
  return utcMs;
}

function currentOverlapSeconds(row, dateUtcMs, timeZone, wake, sleep) {
  let overlap = 0;
  const sleepMinute = sleep <= wake ? sleep + MINUTES_PER_DAY : sleep;
  for (const dayShift of [-1, 0, 1]) {
    const localMidnight = dateUtcMs + dayShift * SECONDS_PER_DAY * 1000;
    const wakeUtcMs = localClockUtcMs(
      localMidnight + wake * MS_PER_MINUTE,
      timeZone
    );
    const sleepUtcMs = localClockUtcMs(
      localMidnight + sleepMinute * MS_PER_MINUTE,
      timeZone
    );
    overlap += intersectSeconds(
      row.sunriseUtcMs,
      row.sunsetUtcMs,
      wakeUtcMs,
      sleepUtcMs
    );
  }
  return overlap;
}

function proposedOverlapSeconds(
  row,
  dateUtcMs,
  standardOffsetMinutes,
  proposedOffsetSeconds,
  wake,
  sleep
) {
  let overlap = 0;
  const sleepMinute = sleep <= wake ? sleep + MINUTES_PER_DAY : sleep;
  const clockShiftMs =
    standardOffsetMinutes * MS_PER_MINUTE + proposedOffsetSeconds * 1000;
  for (const dayShift of [-1, 0, 1]) {
    const clockMidnight = dateUtcMs + dayShift * SECONDS_PER_DAY * 1000;
    const wakeUtcMs = clockMidnight + wake * MS_PER_MINUTE - clockShiftMs;
    const sleepUtcMs =
      clockMidnight + sleepMinute * MS_PER_MINUTE - clockShiftMs;
    overlap += intersectSeconds(
      row.sunriseUtcMs,
      row.sunsetUtcMs,
      wakeUtcMs,
      sleepUtcMs
    );
  }
  return overlap;
}

function interpolateMissingCircular(values) {
  const result = values.slice();
  const known = values.flatMap((value, index) =>
    Number.isFinite(value) ? [index] : []
  );
  if (known.length === 0) return result.fill(0);

  for (let index = 0; index < result.length; index += 1) {
    if (Number.isFinite(result[index])) continue;
    let before = index;
    let after = index;
    do before = (before - 1 + result.length) % result.length;
    while (!Number.isFinite(values[before]));
    do after = (after + 1) % result.length;
    while (!Number.isFinite(values[after]));
    const distanceBefore = (index - before + result.length) % result.length;
    const distanceAfter = (after - index + result.length) % result.length;
    result[index] =
      (values[before] * distanceAfter + values[after] * distanceBefore) /
      (distanceBefore + distanceAfter);
  }
  return result;
}

/**
 * Optimizes one buildSolarYear() result for a stable, DST-free proposed clock.
 * Clock inputs are civil minutes after midnight; offsets and gains are seconds.
 * Sunrise and sunset output minutes remain relative to the source date and may
 * be below 0 or above 1440; consumers can clip them without losing day identity.
 */
export function optimizeYear({ solarYear, timeZone, wake, sleep, bias }) {
  if (!Array.isArray(solarYear) || solarYear.length === 0) {
    throw new TypeError("solarYear must be a non-empty array");
  }
  requireFinite("wake", wake);
  requireFinite("sleep", sleep);
  requireFinite("bias", bias);
  if (
    wake < 0 ||
    wake >= MINUTES_PER_DAY ||
    sleep < 0 ||
    sleep >= MINUTES_PER_DAY
  ) {
    throw new RangeError("wake and sleep must be minutes from 0 through 1439");
  }
  if (typeof timeZone !== "string" || timeZone.length === 0) {
    throw new TypeError("timeZone must be a non-empty IANA zone name");
  }

  const dateUtcValues = solarYear.map(({ date }) => parseDateUtc(date));
  for (const { state } of solarYear) {
    if (!["normal", "polar-day", "polar-night"].includes(state)) {
      throw new RangeError(`unknown solar state: ${state}`);
    }
  }
  for (let index = 1; index < dateUtcValues.length; index += 1) {
    if (
      dateUtcValues[index] - dateUtcValues[index - 1] !==
      SECONDS_PER_DAY * 1000
    ) {
      throw new RangeError("solarYear dates must be consecutive and ordered");
    }
  }
  const year = Number(solarYear[0].date.slice(0, 4));
  const standardUtcOffsetMinutes = getStandardOffsetMinutes(year, timeZone);

  let ideals = solarYear.map((row, day) => {
    if (row.state !== "normal") return null;
    if (
      !Number.isFinite(row.sunriseUtcMs) ||
      !Number.isFinite(row.sunsetUtcMs) ||
      !Number.isFinite(row.daylightSeconds)
    ) {
      throw new TypeError(
        `normal solar row ${row.date} must contain finite events`
      );
    }
    const eventDaylightSeconds =
      (row.sunsetUtcMs - row.sunriseUtcMs) / 1000;
    if (
      eventDaylightSeconds <= 0 ||
      eventDaylightSeconds > SECONDS_PER_DAY ||
      Math.abs(eventDaylightSeconds - row.daylightSeconds) > 1e-6
    ) {
      throw new RangeError(
        `normal solar row ${row.date} must have ordered events and consistent bounded daylight`
      );
    }
    const standardSunriseMinute =
      (row.sunriseUtcMs - dateUtcValues[day]) / MS_PER_MINUTE +
      standardUtcOffsetMinutes;
    const idealSunriseMinute = chooseIdealSunrise({
      wake,
      sleep,
      daylightMinutes: row.daylightSeconds / 60,
      bias
    });
    return (idealSunriseMinute - standardSunriseMinute) * 60;
  });
  ideals = interpolateMissingCircular(ideals);

  const leapDay = solarYear.findIndex(({ date }) => date.endsWith("-02-29"));
  if (leapDay > 0 && leapDay < ideals.length - 1) {
    ideals[leapDay] = (ideals[leapDay - 1] + ideals[leapDay + 1]) / 2;
  }

  const offsets = constrainCircularOffsets(ideals, 60);
  const wakingSeconds = wakingDurationSeconds(wake, sleep);
  let gainedSeconds = 0;
  const days = solarYear.map((row, day) => {
    const dateUtcMs = dateUtcValues[day];
    const proposedOffsetSeconds = offsets[day];
    const previousOffset = offsets[(day - 1 + offsets.length) % offsets.length];
    const currentUtcOffsetMinutes = getOffsetMinutes(
      dateUtcMs + 12 * 60 * MS_PER_MINUTE,
      timeZone
    );
    let proposedSunriseMinute = null;
    let proposedSunsetMinute = null;
    let currentSunriseMinute = null;
    let currentSunsetMinute = null;
    let proposedOverlap = row.state === "polar-day" ? wakingSeconds : 0;
    let currentOverlap = proposedOverlap;

    if (row.state === "normal") {
      const standardSunriseMinute =
        (row.sunriseUtcMs - dateUtcMs) / MS_PER_MINUTE +
        standardUtcOffsetMinutes;
      const standardSunsetMinute =
        (row.sunsetUtcMs - dateUtcMs) / MS_PER_MINUTE +
        standardUtcOffsetMinutes;
      proposedSunriseMinute =
        standardSunriseMinute + proposedOffsetSeconds / 60;
      proposedSunsetMinute =
        standardSunsetMinute + proposedOffsetSeconds / 60;
      currentSunriseMinute =
        (row.sunriseUtcMs - dateUtcMs) / MS_PER_MINUTE +
        getOffsetMinutes(row.sunriseUtcMs, timeZone);
      currentSunsetMinute =
        (row.sunsetUtcMs - dateUtcMs) / MS_PER_MINUTE +
        getOffsetMinutes(row.sunsetUtcMs, timeZone);
      proposedOverlap = proposedOverlapSeconds(
        row,
        dateUtcMs,
        standardUtcOffsetMinutes,
        proposedOffsetSeconds,
        wake,
        sleep
      );
      currentOverlap = currentOverlapSeconds(
        row,
        dateUtcMs,
        timeZone,
        wake,
        sleep
      );
    }
    gainedSeconds += proposedOverlap - currentOverlap;

    return {
      date: row.date,
      solarState: row.state,
      proposedSunriseMinute,
      proposedSunsetMinute,
      currentSunriseMinute,
      currentSunsetMinute,
      proposedOffsetSeconds,
      dailyAdjustmentSeconds: proposedOffsetSeconds - previousOffset,
      currentUtcOffsetMinutes,
      proposedOverlapSeconds: proposedOverlap,
      currentOverlapSeconds: currentOverlap
    };
  });

  return {
    days,
    gainedSeconds,
    gainedHoursRounded: Math.round(gainedSeconds / 3600),
    standardUtcOffsetMinutes
  };
}
