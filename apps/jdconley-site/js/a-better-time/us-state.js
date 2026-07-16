import tzLookup from "tz-lookup";
import { DEFAULT_STATE } from "./core/url-state.js";
import { civilZoneAt, resolveUsCivilTimeZone } from "./us-containment.js";

const LOCATION_FIELDS = new Set(["lat", "lon", "place", "tz"]);

/**
 * Treat shared coordinates as the authority for U.S. scope and civil time.
 * Schedule preferences remain independent so a rejected location does not
 * discard otherwise valid waking-hour settings.
 */
export function normalizeUsState(parsed) {
  const state = { ...parsed.state };
  const resetFields = [...parsed.resetFields];
  const zone = civilZoneAt(state.lat, state.lon);

  if (!zone) {
    Object.assign(state, {
      lat: DEFAULT_STATE.lat,
      lon: DEFAULT_STATE.lon,
      place: DEFAULT_STATE.place,
      tz: DEFAULT_STATE.tz
    });
    return {
      state,
      resetFields: resetFields.filter((field) => !LOCATION_FIELDS.has(field)),
      locationReset: true,
      timeZoneCorrected: false
    };
  }

  const resolvedTimeZone = resolveUsCivilTimeZone(
    state.lat,
    state.lon,
    tzLookup(state.lat, state.lon)
  );
  const timeZoneCorrected = state.tz !== resolvedTimeZone;
  state.tz = resolvedTimeZone;
  return { state, resetFields, locationReset: false, timeZoneCorrected };
}
