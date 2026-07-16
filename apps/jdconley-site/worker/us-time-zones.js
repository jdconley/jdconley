// Reviewed civil zones used in the 50 states and DC. tz-lookup follows polygon
// geometry, which can return a neighboring country's zone near an international
// boundary. Valid special U.S. zones are preserved; only disallowed results are
// corrected with deterministic state/longitude rules below.
export const US_STATE_TIME_ZONES = Object.freeze({
  AL: ["America/Chicago"], AK: ["America/Adak", "America/Anchorage", "America/Juneau", "America/Metlakatla", "America/Nome", "America/Sitka", "America/Yakutat", "America/Los_Angeles"],
  AZ: ["America/Phoenix", "America/Denver"], AR: ["America/Chicago"], CA: ["America/Los_Angeles"], CO: ["America/Denver"], CT: ["America/New_York"],
  DE: ["America/New_York"], DC: ["America/New_York"], FL: ["America/New_York", "America/Chicago"], GA: ["America/New_York"], HI: ["Pacific/Honolulu"],
  ID: ["America/Boise", "America/Los_Angeles"], IL: ["America/Chicago"],
  IN: ["America/Chicago", "America/Indiana/Indianapolis", "America/Indiana/Knox", "America/Indiana/Marengo", "America/Indiana/Petersburg", "America/Indiana/Tell_City", "America/Indiana/Vevay", "America/Indiana/Vincennes", "America/Indiana/Winamac"],
  IA: ["America/Chicago"], KS: ["America/Chicago", "America/Denver"],
  KY: ["America/New_York", "America/Chicago", "America/Kentucky/Louisville", "America/Kentucky/Monticello"], LA: ["America/Chicago"], ME: ["America/New_York"],
  MD: ["America/New_York"], MA: ["America/New_York"], MI: ["America/Detroit", "America/Menominee"], MN: ["America/Chicago"], MS: ["America/Chicago"],
  MO: ["America/Chicago"], MT: ["America/Denver"], NE: ["America/Chicago", "America/Denver"], NV: ["America/Los_Angeles", "America/Denver"],
  NH: ["America/New_York"], NJ: ["America/New_York"], NM: ["America/Denver"], NY: ["America/New_York"], NC: ["America/New_York"],
  ND: ["America/Chicago", "America/Denver", "America/North_Dakota/Beulah", "America/North_Dakota/Center", "America/North_Dakota/New_Salem"],
  OH: ["America/New_York"], OK: ["America/Chicago"], OR: ["America/Los_Angeles", "America/Boise"], PA: ["America/New_York"], RI: ["America/New_York"],
  SC: ["America/New_York"], SD: ["America/Chicago", "America/Denver"], TN: ["America/Chicago", "America/New_York"],
  TX: ["America/Chicago", "America/Denver"], UT: ["America/Denver"], VT: ["America/New_York"], VA: ["America/New_York"], WA: ["America/Los_Angeles"],
  WV: ["America/New_York"], WI: ["America/Chicago"], WY: ["America/Denver"]
});

const DEFAULT_ZONE = Object.fromEntries(Object.entries(US_STATE_TIME_ZONES).map(([state, zones]) => [state, zones[0]]));
DEFAULT_ZONE.AK = "America/Anchorage";

function correctedBorderZone(state, longitude) {
  switch (state) {
    case "AK": return longitude >= -131 ? "America/Los_Angeles" : longitude >= -141 ? "America/Sitka" : "America/Anchorage";
    case "TX": return longitude <= -103 ? "America/Denver" : "America/Chicago";
    case "FL": return longitude <= -85.1 ? "America/Chicago" : "America/New_York";
    case "ID": return longitude <= -115 ? "America/Los_Angeles" : "America/Boise";
    case "IN": return longitude <= -87 ? "America/Chicago" : "America/Indiana/Indianapolis";
    case "KS": case "NE": case "SD": return longitude <= -101 ? "America/Denver" : "America/Chicago";
    case "KY": case "TN": return longitude <= -85.5 ? "America/Chicago" : "America/New_York";
    case "MI": return longitude <= -87 ? "America/Menominee" : "America/Detroit";
    case "NV": return longitude >= -114.1 ? "America/Denver" : "America/Los_Angeles";
    case "ND": return longitude <= -101 ? "America/Denver" : "America/Chicago";
    case "OR": return longitude >= -117.5 ? "America/Boise" : "America/Los_Angeles";
    default: return DEFAULT_ZONE[state];
  }
}

export function resolveUsTimeZone(state, latitude, longitude, lookup) {
  const allowed = US_STATE_TIME_ZONES[state];
  if (!allowed) throw new Error(`Unsupported U.S. state code: ${state}`);
  const lookedUp = lookup(latitude, longitude);
  if (allowed.includes(lookedUp)) return lookedUp;
  return correctedBorderZone(state, longitude);
}
