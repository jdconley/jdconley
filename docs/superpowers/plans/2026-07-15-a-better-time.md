# A Better Time Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish a location-aware annual daylight optimizer at `/a-better-time`, migrate jdconley.com from Cloudflare Pages to a Worker with static assets, and add personalized sharing plus privacy-preserving public support.

**Architecture:** Keep the solar, civil-time, URL, and optimization logic in pure browser-compatible modules shared by the page and Worker share-image route. Serve the existing Vite multi-page site through a module Worker with static assets; run Worker code only for the visualizer HTML, share image, location search, and supporter APIs. Store city/ZIP lookup data and supporters in D1, with Turnstile and HMAC-hashed IP deduplication.

**Tech Stack:** Vite multi-page HTML, modern JavaScript modules, SVG charts, Vitest, `@cloudflare/vitest-pool-workers`, Playwright, Cloudflare Workers Static Assets, D1, Turnstile, SunCalc, `tz-lookup`, Satori, `@resvg/resvg-wasm`, Inter font data, pnpm.

---

## File map

### Site and shared calculation modules

- `apps/jdconley-site/a-better-time.html` — semantic page shell and static fallback content.
- `apps/jdconley-site/css/a-better-time.css` — approved premium consumer styles and phone/tablet/desktop compositions.
- `apps/jdconley-site/js/a-better-time/index.js` — top-level controller and dependency wiring.
- `apps/jdconley-site/js/a-better-time/core/solar.js` — solar events and polar-state normalization.
- `apps/jdconley-site/js/a-better-time/core/civil-time.js` — standard offset and current DST/reference conversions.
- `apps/jdconley-site/js/a-better-time/core/optimizer.js` — ideal daily offsets, circular constrained projection, and daylight gain.
- `apps/jdconley-site/js/a-better-time/core/url-state.js` — validated query parsing and canonical serialization.
- `apps/jdconley-site/js/a-better-time/chart.js` — accessible SVG daylight and clock-shift charts.
- `apps/jdconley-site/js/a-better-time/location.js` — geolocation and debounced U.S. location search.
- `apps/jdconley-site/js/a-better-time/share.js` — native share, clipboard fallback, preview, and download.
- `apps/jdconley-site/js/a-better-time/support.js` — count/recent supporter reads and consented submission UI.
- `apps/jdconley-site/js/a-better-time/dialog.js` — focus-safe modal and bottom-sheet behavior.

### Worker and data

- `apps/jdconley-site/worker/index.js` — Worker router and asset fallback.
- `apps/jdconley-site/worker/html.js` — visualizer HTML metadata rewriting.
- `apps/jdconley-site/worker/share-image.js` — Satori SVG and resvg PNG response.
- `apps/jdconley-site/worker/locations.js` — D1 city/ZIP search handler.
- `apps/jdconley-site/worker/supporters.js` — public supporter read/write handlers.
- `apps/jdconley-site/worker/security.js` — validation, Turnstile, origin checks, and HMAC.
- `apps/jdconley-site/worker/env.js` — runtime binding documentation via JSDoc types.
- `apps/jdconley-site/migrations/0001_a_better_time.sql` — D1 schemas and indexes.
- `apps/jdconley-site/scripts/build-location-index.mjs` — reproducible Census data download/normalization.
- `apps/jdconley-site/scripts/import-location-index.mjs` — batched D1 import for local/remote databases.
- `apps/jdconley-site/data/location-fixtures.json` — deterministic test/preview subset.

### Tests, configuration, and integration

- `apps/jdconley-site/tests/unit/*.test.js` — pure module tests.
- `apps/jdconley-site/tests/worker/*.test.js` — workerd/D1 integration tests.
- `apps/jdconley-site/tests/a-better-time.spec.ts` — responsive Playwright behavior and screenshots.
- `apps/jdconley-site/vitest.config.mjs` — Node-side pure module tests.
- `apps/jdconley-site/vitest.worker.config.mjs` — Workers pool and D1 migrations.
- `apps/jdconley-site/wrangler.toml` — Worker, assets, D1, vars, and route-first rules.
- `apps/jdconley-site/package.json` and root `package.json` — pnpm scripts.
- `apps/jdconley-site/vite.config.mjs` — preserve multi-page build and Worker asset requirements.
- `.github/workflows/ci.yml` and `.github/workflows/deploy.yml` — Worker tests and deployment.
- `apps/jdconley-site/index.html` — “A Better Time” project card.
- `apps/jdconley-site/images/a-better-time-card.png` — homepage project image.
- `apps/jdconley-site/public/images/a-better-time-share-fallback.png` — static social fallback.
- `README.md`, `DEVELOPING.md`, and `apps/jdconley-site/.env.example` — local setup, D1, secrets, migration, and deploy notes.

---

### Task 1: Establish the test harness and Worker static-asset migration

**Files:**
- Modify: `apps/jdconley-site/package.json`
- Modify: `package.json`
- Modify: `apps/jdconley-site/wrangler.toml`
- Create: `apps/jdconley-site/worker/index.js`
- Create: `apps/jdconley-site/worker/env.js`
- Create: `apps/jdconley-site/vitest.config.mjs`
- Create: `apps/jdconley-site/vitest.worker.config.mjs`
- Create: `apps/jdconley-site/tests/unit/smoke.test.js`
- Create: `apps/jdconley-site/tests/worker/assets.test.js`
- Modify: `apps/jdconley-site/playwright.config.mjs`

- [ ] **Step 1: Add dependencies with pnpm**

Run:

```bash
pnpm --filter @jdconley/jdconley-site add suncalc tz-lookup satori @resvg/resvg-wasm @fontsource/inter
pnpm --filter @jdconley/jdconley-site add -D vitest@^4.1.0 @cloudflare/vitest-pool-workers
```

Expected: `package.json` and `pnpm-lock.yaml` change; install exits 0.

- [ ] **Step 2: Write failing static-asset Worker tests**

Create `tests/unit/smoke.test.js`:

```js
import { describe, expect, it } from "vitest";

describe("unit harness", () => {
  it("runs ESM tests", () => expect(import.meta.url).toContain("smoke.test.js"));
});
```

Create `tests/worker/assets.test.js`:

```js
import { describe, expect, it } from "vitest";
import worker from "../../worker/index.js";

describe("Worker assets", () => {
  it("delegates unrelated routes to the static-assets binding", async () => {
    const requested = [];
    const env = { ASSETS: { fetch: async (request) => {
      requested.push(new URL(request.url).pathname);
      return new Response("<h1>Hi, I’m JD</h1>", { status: 200 });
    } } };
    const response = await worker.fetch(new Request("https://jdconley.test/"), env);
    expect(requested).toEqual(["/"]);
    expect(await response.text()).toContain("Hi, I’m JD");
  });
});
```

- [ ] **Step 3: Run the tests and verify the Worker test fails**

Run:

```bash
pnpm --filter @jdconley/jdconley-site exec vitest run --config vitest.config.mjs
pnpm --filter @jdconley/jdconley-site exec vitest run --config vitest.worker.config.mjs
```

Expected: unit harness passes; Worker suite fails because no Worker entry/config exists.

- [ ] **Step 4: Add the minimal Worker and Workers Static Assets config**

Use this Worker router in `worker/index.js`:

```js
export default {
  async fetch(request, env) {
    return env.ASSETS.fetch(request);
  },
};
```

Replace Pages-only Wrangler fields with:

```toml
name = "jdconley-site"
main = "worker/index.js"
compatibility_date = "2026-07-15"
compatibility_flags = ["nodejs_compat"]

[assets]
directory = "dist"
binding = "ASSETS"
run_worker_first = ["/a-better-time", "/a-better-time/*", "/api/a-better-time/*"]
```

Add the `Env` JSDoc typedef in `worker/env.js` and configure both Vitest files. The Worker pool must point at `wrangler.toml`, load `dist`, and enable isolated storage.

- [ ] **Step 5: Replace Pages commands with Worker commands**

Set app scripts to:

```json
{
  "test:unit": "vitest run --config vitest.config.mjs",
  "test:worker": "vitest run --config vitest.worker.config.mjs",
  "preview:cf": "dotenvx run -- wrangler dev --ip 127.0.0.1 --port 8788",
  "preview:cf:build": "pnpm run build && pnpm run preview:cf",
  "deploy": "pnpm run build && dotenvx run -- wrangler deploy"
}
```

Keep root script names stable so existing developer commands still work.

- [ ] **Step 6: Run build and both test environments**

Run:

```bash
pnpm run build:site
pnpm --filter @jdconley/jdconley-site run test:unit
pnpm --filter @jdconley/jdconley-site run test:worker
pnpm run test:e2e:site
```

Expected: unit and Worker delegation tests pass. The existing Playwright smoke suite verifies real built assets and 404 behavior through Vite; the Wrangler E2E command in Task 13 verifies the same behavior through the production Worker runtime.

- [ ] **Step 7: Commit**

```bash
git add package.json pnpm-lock.yaml apps/jdconley-site/package.json apps/jdconley-site/wrangler.toml apps/jdconley-site/worker apps/jdconley-site/vitest*.mjs apps/jdconley-site/tests apps/jdconley-site/playwright.config.mjs
git commit -m "infra: migrate site runtime to Cloudflare Workers"
```

---

### Task 2: Build solar and civil-time primitives test-first

**Files:**
- Create: `apps/jdconley-site/js/a-better-time/core/solar.js`
- Create: `apps/jdconley-site/js/a-better-time/core/civil-time.js`
- Create: `apps/jdconley-site/tests/unit/solar.test.js`
- Create: `apps/jdconley-site/tests/unit/civil-time.test.js`

- [ ] **Step 1: Write failing solar fixtures**

Test South Lake Tahoe solstices, Anchorage polar behavior, and date count:

```js
import { describe, expect, it } from "vitest";
import { buildSolarYear } from "../../js/a-better-time/core/solar.js";

describe("buildSolarYear", () => {
  it("returns every day in a leap year", () => {
    expect(buildSolarYear({ year: 2028, lat: 38.9399, lon: -119.9772 })).toHaveLength(366);
  });

  it("has a longer Tahoe day in June than December", () => {
    const year = buildSolarYear({ year: 2026, lat: 38.9399, lon: -119.9772 });
    expect(year[171].daylightSeconds).toBeGreaterThan(year[354].daylightSeconds + 18_000);
  });

  it("represents polar day and night explicitly", () => {
    const year = buildSolarYear({ year: 2026, lat: 71.2906, lon: -156.7886 });
    expect(year[171].state).toBe("polar-day");
    expect(year[354].state).toBe("polar-night");
  });
});
```

- [ ] **Step 2: Run solar tests and verify missing-module failure**

Run: `pnpm --filter @jdconley/jdconley-site exec vitest run tests/unit/solar.test.js`

Expected: FAIL because `solar.js` does not exist.

- [ ] **Step 3: Implement normalized solar events**

Wrap SunCalc behind this stable return shape:

```js
export function buildSolarYear({ year, lat, lon }) {
  return eachUtcDate(year).map((date) => {
    const { sunrise, sunset } = getTimes(date, lat, lon);
    if (!Number.isFinite(sunrise.getTime()) || !Number.isFinite(sunset.getTime())) {
      return inferPolarState(date, lat, lon);
    }
    return {
      date: date.toISOString().slice(0, 10),
      state: "normal",
      sunriseUtcMs: sunrise.getTime(),
      sunsetUtcMs: sunset.getTime(),
      daylightSeconds: (sunset.getTime() - sunrise.getTime()) / 1000,
    };
  });
}
```

Use solar altitude at noon/midnight to distinguish polar day from polar night when SunCalc omits events.

- [ ] **Step 4: Write failing civil-time/DST tests**

```js
import { describe, expect, it } from "vitest";
import { getOffsetMinutes, getStandardOffsetMinutes } from "../../js/a-better-time/core/civil-time.js";

describe("civil time", () => {
  it("detects Pacific DST and standard offsets", () => {
    expect(getOffsetMinutes(Date.UTC(2026, 0, 15, 12), "America/Los_Angeles")).toBe(-480);
    expect(getOffsetMinutes(Date.UTC(2026, 6, 15, 12), "America/Los_Angeles")).toBe(-420);
    expect(getStandardOffsetMinutes(2026, "America/Los_Angeles")).toBe(-480);
  });

  it("shows no seasonal jump in Arizona or Hawaii", () => {
    expect(getStandardOffsetMinutes(2026, "America/Phoenix")).toBe(-420);
    expect(getOffsetMinutes(Date.UTC(2026, 6, 15, 12), "America/Phoenix")).toBe(-420);
    expect(getOffsetMinutes(Date.UTC(2026, 6, 15, 12), "Pacific/Honolulu")).toBe(-600);
  });
});
```

- [ ] **Step 5: Implement civil-time helpers and run tests**

Use `Intl.DateTimeFormat(...).formatToParts()` to calculate the IANA offset without parsing localized strings. Sample noon UTC on the 15th of every month and choose the minimum offset as the standard U.S. zone offset.

Run: `pnpm --filter @jdconley/jdconley-site run test:unit`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/jdconley-site/js/a-better-time/core apps/jdconley-site/tests/unit
git commit -m "feat: calculate solar events and civil time"
```

---

### Task 3: Implement the daylight optimizer with circular daily constraints

**Files:**
- Create: `apps/jdconley-site/js/a-better-time/core/optimizer.js`
- Create: `apps/jdconley-site/tests/unit/optimizer.test.js`

- [ ] **Step 1: Write failing tests for ideal placement and preference**

```js
import { describe, expect, it } from "vitest";
import { chooseIdealSunrise, constrainCircularOffsets, optimizeYear } from "../../js/a-better-time/core/optimizer.js";

describe("chooseIdealSunrise", () => {
  it("centers a short day when balanced", () => {
    expect(chooseIdealSunrise({ wake: 420, sleep: 1320, daylightMinutes: 600, bias: 0 })).toBe(570);
  });

  it("places a short day at wake for morning preference", () => {
    expect(chooseIdealSunrise({ wake: 420, sleep: 1320, daylightMinutes: 600, bias: -100 })).toBe(420);
  });

  it("places sunset at sleep for evening preference", () => {
    expect(chooseIdealSunrise({ wake: 420, sleep: 1320, daylightMinutes: 600, bias: 100 })).toBe(720);
  });
});
```

- [ ] **Step 2: Verify the preference tests fail**

Run: `pnpm --filter @jdconley/jdconley-site exec vitest run tests/unit/optimizer.test.js`

Expected: FAIL because optimizer exports are missing.

- [ ] **Step 3: Implement ideal placement**

Use the overlap-maximizing interval:

```js
export function chooseIdealSunrise({ wake, sleep, daylightMinutes, bias }) {
  const end = sleep <= wake ? sleep + 1440 : sleep;
  const lower = Math.min(wake, end - daylightMinutes);
  const upper = Math.max(wake, end - daylightMinutes);
  const t = (clamp(bias, -100, 100) + 100) / 200;
  return lower + (upper - lower) * t;
}
```

- [ ] **Step 4: Add failing circular constraint tests**

```js
it("limits every daily change including year end", () => {
  const ideals = [0, 240, 240, 0];
  const offsets = constrainCircularOffsets(ideals, 60);
  for (let day = 0; day < offsets.length; day += 1) {
    const previous = offsets[(day - 1 + offsets.length) % offsets.length];
    expect(Number.isInteger(offsets[day])).toBe(true);
    expect(Math.abs(offsets[day] - previous)).toBeLessThanOrEqual(60);
  }
});

it("is deterministic", () => {
  const ideals = Array.from({ length: 365 }, (_, day) => Math.sin(day / 58) * 5400);
  expect(constrainCircularOffsets(ideals, 60)).toEqual(constrainCircularOffsets(ideals, 60));
});
```

- [ ] **Step 5: Implement Dykstra projection and integer repair**

Project onto all pair constraints `|x[d] - x[d-1]| <= 59.999` until the maximum coordinate change is below `1e-7`, cap at 20,000 sweeps, round to integer seconds, then run deterministic forward/backward repair passes. Throw a descriptive error if convergence is not reached; do not silently emit an invalid schedule.

- [ ] **Step 6: Add failing end-to-end optimizer tests**

Assert:

- 365/366 output rows match input dates.
- Every proposed adjustment is an integer in `[-60, 60]`.
- Sum of proposed overlap is not worse than current policy for the default Tahoe fixture.
- Arizona has no current-policy DST discontinuity.
- Polar day overlap equals waking-window length and polar night overlap is zero.

- [ ] **Step 7: Implement `optimizeYear` and verify all tests**

Return:

```js
{
  days: [{ date, solarState, proposedSunriseMinute, proposedSunsetMinute,
    currentSunriseMinute, currentSunsetMinute, proposedOffsetSeconds,
    dailyAdjustmentSeconds, currentUtcOffsetMinutes, proposedOverlapSeconds,
    currentOverlapSeconds }],
  gainedSeconds,
  gainedHoursRounded,
  standardUtcOffsetMinutes,
}
```

Run: `pnpm --filter @jdconley/jdconley-site run test:unit`

Expected: PASS with no invalid schedule warnings.

- [ ] **Step 8: Commit**

```bash
git add apps/jdconley-site/js/a-better-time/core/optimizer.js apps/jdconley-site/tests/unit/optimizer.test.js
git commit -m "feat: optimize annual daylight schedule"
```

---

### Task 4: Define stable shared URL state

**Files:**
- Create: `apps/jdconley-site/js/a-better-time/core/url-state.js`
- Create: `apps/jdconley-site/tests/unit/url-state.test.js`

- [ ] **Step 1: Write failing parse/serialize tests**

Cover defaults, rounded coordinates, stable key order, invalid field fallback, label length, invalid IANA zones, and cross-midnight waking windows.

```js
it("round-trips a complete share state", () => {
  const input = { lat: 38.939926, lon: -119.977187, place: "South Lake Tahoe, CA",
    tz: "America/Los_Angeles", wake: 420, sleep: 1320, bias: 25, year: 2026 };
  const query = serializeState(input);
  expect(query).toBe("lat=38.940&lon=-119.977&place=South+Lake+Tahoe%2C+CA&tz=America%2FLos_Angeles&wake=420&sleep=1320&bias=25&year=2026");
  expect(parseState(query).state).toEqual({ ...input, lat: 38.94, lon: -119.977 });
});

it("falls back only malformed fields", () => {
  const { state, resetFields } = parseState("lat=nope&lon=-112.074&place=Phoenix%2C+AZ&tz=America%2FPhoenix&bias=900");
  expect(state.lon).toBe(-112.074);
  expect(state.tz).toBe("America/Phoenix");
  expect(resetFields).toEqual(["lat", "bias"]);
});
```

- [ ] **Step 2: Verify failure, implement validation, and rerun**

Use an explicit `DEFAULT_STATE`, normalize Unicode/place whitespace, validate with `Intl.DateTimeFormat`, and require waking duration of 8–20 hours.

Run: `pnpm --filter @jdconley/jdconley-site exec vitest run tests/unit/url-state.test.js`

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/jdconley-site/js/a-better-time/core/url-state.js apps/jdconley-site/tests/unit/url-state.test.js
git commit -m "feat: add shareable daylight URL state"
```

---

### Task 5: Build the responsive premium page shell

**Files:**
- Create: `apps/jdconley-site/a-better-time.html`
- Create: `apps/jdconley-site/css/a-better-time.css`
- Create: `apps/jdconley-site/js/a-better-time/index.js`
- Create: `apps/jdconley-site/js/a-better-time/dialog.js`
- Create: `apps/jdconley-site/tests/a-better-time.spec.ts`

- [ ] **Step 1: Write failing page-shell E2E tests**

```ts
test("renders the personalized app shell", async ({ page }) => {
  await page.goto("/a-better-time");
  await expect(page.getByRole("heading", { name: "What if the clock followed the sun?" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Share this result" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Tune my day" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Show support" })).toBeVisible();
});
```

Add viewport assertions for 390×844, 768×1024, 1024×768, 1440×1000, and 1920×1080. Desktop must expose a settings rail; mobile must use the tuning sheet; tablet landscape must expose the insight rail.

- [ ] **Step 2: Run and verify the page is missing**

Run: `pnpm --filter @jdconley/jdconley-site exec playwright test tests/a-better-time.spec.ts`

Expected: FAIL with 404/missing heading.

- [ ] **Step 3: Create semantic HTML with a useful no-JS fallback**

Include:

- Unique title, description, canonical URL, static fallback social tags, and JSON-LD `WebApplication` metadata.
- Site home link, hero, location chooser, headline metric live region, settings, chart region, explanation, share dialog, support dialog, and footer.
- A `<noscript>` explanation of the model and default location.
- Icon-only share button with `aria-label="Share this result"` and tooltip text.

- [ ] **Step 4: Implement approved visual tokens and responsive compositions**

Start CSS with:

```css
:root {
  --abt-ink: #111318;
  --abt-canvas: #f7f8fa;
  --abt-surface: #fff;
  --abt-action: #315eea;
  --abt-sunrise: #2385ff;
  --abt-sunset: #ff9f0a;
  --abt-reference: #a5aab3;
  --abt-border: #e2e5ea;
  --abt-radius-sm: 12px;
  --abt-radius-lg: 20px;
}
```

Implement explicit layout modes:

- `< 700px`: one chart, sticky safe-area-aware bottom actions, tuning bottom sheet.
- `700–899px`: tablet portrait centered column and visible compact settings row.
- `900–1199px`: tablet landscape two-thirds chart plus insight rail.
- `>= 1200px`: capped editorial workspace with sticky settings rail, coordinated chart column, and insight rail.

Use container/element collision constraints in addition to media queries. Avoid decorative gradients, card grids, and more than one elevation level.

- [ ] **Step 5: Implement accessible dialog/bottom-sheet mechanics**

`openDialog(trigger, dialog)` must focus the first control, contain Tab/Shift+Tab, close on Escape/backdrop, set `aria-modal`, prevent background scroll, and restore focus to `trigger`.

- [ ] **Step 6: Run page-shell tests and capture baseline screenshots**

Run:

```bash
pnpm --filter @jdconley/jdconley-site exec playwright test tests/a-better-time.spec.ts --update-snapshots
```

Expected: all five viewport structures pass and screenshots show intentional composition changes.

- [ ] **Step 7: Commit**

```bash
git add apps/jdconley-site/a-better-time.html apps/jdconley-site/css/a-better-time.css apps/jdconley-site/js/a-better-time apps/jdconley-site/tests/a-better-time.spec.ts
git commit -m "feat: add responsive A Better Time shell"
```

---

### Task 6: Render linked interactive charts and settings

**Files:**
- Create: `apps/jdconley-site/js/a-better-time/chart.js`
- Modify: `apps/jdconley-site/js/a-better-time/index.js`
- Modify: `apps/jdconley-site/a-better-time.html`
- Modify: `apps/jdconley-site/css/a-better-time.css`
- Create: `apps/jdconley-site/tests/unit/chart.test.js`
- Modify: `apps/jdconley-site/tests/a-better-time.spec.ts`

- [ ] **Step 1: Write failing chart unit tests**

Test SVG path breaks for polar states, reduced mobile labels, active-date value rendering, dashed current-policy reference, and shared active date between chart instances.

- [ ] **Step 2: Verify failure and implement pure SVG geometry helpers**

Export `buildLinePath(days, accessor, scales)`, `getNearestDay(clientX, bounds, dayCount)`, and `formatClockMinute(minute)`. Missing solar events must split paths rather than drawing through polar periods.

- [ ] **Step 3: Add failing Playwright interaction tests**

Test that:

- Changing wake/sleep/bias updates the headline and `history.replaceState` query.
- Mobile segmented control switches between Daylight and Clock shift.
- Pointer move, horizontal drag, keyboard arrows, and tap update the same active-date readout.
- Desktop inspection in one chart updates both chart cursors.
- Arizona lacks DST markers while Tahoe has two.

- [ ] **Step 4: Wire optimizer state and render both chart views**

Keep all application state in one controller object:

```js
const model = {
  location: state,
  settings: { wake: state.wake, sleep: state.sleep, bias: state.bias, year: state.year },
  result: null,
  activeDayIndex: getTodayIndex(state.year),
  activeChart: "daylight",
};
```

Recalculate through one debounced `updateResult()` and update URL only after valid settings. Announce the new rounded gain through a polite live region.

- [ ] **Step 5: Run unit, E2E, and accessibility interaction tests**

Run:

```bash
pnpm --filter @jdconley/jdconley-site run test:unit
pnpm --filter @jdconley/jdconley-site exec playwright test tests/a-better-time.spec.ts
```

Expected: PASS at phone, tablet, and desktop widths.

- [ ] **Step 6: Commit**

```bash
git add apps/jdconley-site/js/a-better-time apps/jdconley-site/a-better-time.html apps/jdconley-site/css/a-better-time.css apps/jdconley-site/tests
git commit -m "feat: visualize optimized daylight and clock shifts"
```

---

### Task 7: Create the U.S. city/ZIP location index and search API

**Files:**
- Create: `apps/jdconley-site/migrations/0001_a_better_time.sql`
- Create: `apps/jdconley-site/scripts/build-location-index.mjs`
- Create: `apps/jdconley-site/scripts/import-location-index.mjs`
- Create: `apps/jdconley-site/data/location-fixtures.json`
- Create: `apps/jdconley-site/worker/locations.js`
- Create: `apps/jdconley-site/tests/unit/location-index.test.js`
- Create: `apps/jdconley-site/tests/worker/locations.test.js`
- Modify: `apps/jdconley-site/wrangler.toml`
- Modify: `apps/jdconley-site/package.json`

- [ ] **Step 1: Write migration and failing Worker search tests**

Create tables with FTS search:

```sql
CREATE TABLE locations (
  id INTEGER PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('place', 'zip')),
  search_name TEXT NOT NULL,
  display_name TEXT NOT NULL,
  state_code TEXT NOT NULL,
  zip TEXT,
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  time_zone TEXT NOT NULL
);
CREATE UNIQUE INDEX locations_kind_name_state_zip ON locations(kind, search_name, state_code, COALESCE(zip, ''));
CREATE VIRTUAL TABLE locations_fts USING fts5(search_name, display_name, state_code, zip, content='locations', content_rowid='id');
```

The tests seed fixtures for South Lake Tahoe, Portland OR/ME, Phoenix, Honolulu, Anchorage, and ZIPs `96150`, `97205`, and `85001`. Assert ranked prefix search, exact ZIP search, eight-result cap, two-character minimum, and escaped FTS input.

- [ ] **Step 2: Run Worker tests and verify missing schema/handler failure**

Run: `pnpm --filter @jdconley/jdconley-site run test:worker`

Expected: FAIL on missing locations table/route.

- [ ] **Step 3: Implement the route with parameterized D1 queries**

Return only:

```json
{"results":[{"place":"South Lake Tahoe, CA","lat":38.9399,"lon":-119.9772,"tz":"America/Los_Angeles"}]}
```

Normalize input, select an exact ZIP query for five digits, otherwise use escaped prefix tokens with deterministic population/name ordering. Do not expose internal row IDs.

- [ ] **Step 4: Build the reproducible Census pipeline**

The build script must:

1. Download the pinned annual Census Gazetteer Places and ZCTA files over HTTPS.
2. Verify committed SHA-256 values before parsing.
3. Keep only the 50 states and District of Columbia.
4. Normalize names and coordinates.
5. Assign IANA zones with `tz-lookup`.
6. Emit stable, state/name/ZIP-sorted NDJSON plus a manifest of source URLs, checksums, row counts, and generation time.

The import script batches parameterized inserts and refreshes the FTS table. It accepts `--local` or `--remote`; remote mode requires explicit invocation.

- [ ] **Step 5: Add D1 binding and local import scripts**

Use a local sentinel UUID until the production D1 resource is provisioned:

```toml
[[d1_databases]]
binding = "DB"
database_name = "a-better-time"
database_id = "00000000-0000-0000-0000-000000000000"
migrations_dir = "migrations"
```

Add scripts `db:migrate:local`, `locations:build`, `locations:import:local`, and `locations:import:remote`.

- [ ] **Step 6: Run migration, seed fixtures, and tests**

Run:

```bash
pnpm --filter @jdconley/jdconley-site exec wrangler d1 migrations apply a-better-time --local
pnpm --filter @jdconley/jdconley-site run locations:import:local -- --fixtures
pnpm --filter @jdconley/jdconley-site run test:worker
```

Expected: all location searches pass against isolated D1.

- [ ] **Step 7: Commit**

```bash
git add apps/jdconley-site/migrations apps/jdconley-site/scripts apps/jdconley-site/data apps/jdconley-site/worker/locations.js apps/jdconley-site/tests apps/jdconley-site/wrangler.toml apps/jdconley-site/package.json pnpm-lock.yaml
git commit -m "feat: add U.S. city and ZIP search"
```

---

### Task 8: Connect browser geolocation and manual search

**Files:**
- Create: `apps/jdconley-site/js/a-better-time/location.js`
- Modify: `apps/jdconley-site/js/a-better-time/index.js`
- Modify: `apps/jdconley-site/a-better-time.html`
- Modify: `apps/jdconley-site/css/a-better-time.css`
- Modify: `apps/jdconley-site/tests/a-better-time.spec.ts`

- [ ] **Step 1: Write failing Playwright location tests**

Cover:

- Geolocation granted with Tahoe coordinates and no network location search.
- Geolocation denied, inline explanation, and focus moved to manual search.
- Debounced “Portland” results with state disambiguation.
- Exact ZIP `96150` selection.
- No-results and API-unavailable states preserving the current chart.
- Rounded coordinates in the URL while full coordinates remain in memory.

- [ ] **Step 2: Implement the location controller**

Use a 250ms debounce, `AbortController` for stale searches, listbox/option semantics, arrow-key selection, Escape dismissal, and click-outside behavior. For browser coordinates, call `tzlookup(lat, lon)` locally and use a city-level label `Current location` until the user picks a named result; never reverse-geocode or transmit exact browser coordinates.

- [ ] **Step 3: Run E2E tests**

Run: `pnpm --filter @jdconley/jdconley-site exec playwright test tests/a-better-time.spec.ts`

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/jdconley-site/js/a-better-time apps/jdconley-site/a-better-time.html apps/jdconley-site/css/a-better-time.css apps/jdconley-site/tests/a-better-time.spec.ts
git commit -m "feat: personalize daylight by U.S. location"
```

---

### Task 9: Implement privacy-preserving supporter storage and API

**Files:**
- Modify: `apps/jdconley-site/migrations/0001_a_better_time.sql`
- Create: `apps/jdconley-site/worker/security.js`
- Create: `apps/jdconley-site/worker/supporters.js`
- Modify: `apps/jdconley-site/worker/index.js`
- Create: `apps/jdconley-site/tests/worker/supporters.test.js`
- Modify: `apps/jdconley-site/wrangler.toml`

- [ ] **Step 1: Add supporter schema and failing API tests**

Use:

```sql
CREATE TABLE supporters (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  first_name TEXT NOT NULL CHECK(length(first_name) BETWEEN 2 AND 40),
  display_location TEXT NOT NULL CHECK(length(display_location) BETWEEN 2 AND 60),
  ip_hmac TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL
);
CREATE INDEX supporters_created_at ON supporters(created_at DESC);
```

Tests must cover empty state, valid insert, public text only, duplicate HMAC, Unicode normalization, overlong input, missing consent, invalid origin/content type/body size, Turnstile failure, and recent ordering.

- [ ] **Step 2: Verify API tests fail**

Run: `pnpm --filter @jdconley/jdconley-site run test:worker`

Expected: FAIL because supporter routes are missing.

- [ ] **Step 3: Implement security helpers**

```js
export async function hmacIp(ip, secret) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const bytes = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(ip.trim().toLowerCase()));
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
```

Provide `verifyTurnstile(token, ip, env, fetchImpl = fetch)` so tests replace outbound verification without mocking business logic.

- [ ] **Step 4: Implement supporter handlers**

`GET` returns `{ count, recent }`. `POST` requires consent `true`, validated fields, same-origin request, JSON body under 2KB, a valid Turnstile token, and `CF-Connecting-IP`. Insert via a prepared D1 statement; translate the unique-constraint failure to `{ status: "duplicate", count }` without exposing other supporter data.

- [ ] **Step 5: Run Worker tests and inspect storage**

Run:

```bash
pnpm --filter @jdconley/jdconley-site run test:worker
pnpm --filter @jdconley/jdconley-site exec wrangler d1 execute a-better-time --local --command "SELECT first_name, display_location, ip_hmac, created_at FROM supporters"
```

Expected: tests pass and no raw IP column/value exists.

- [ ] **Step 6: Commit**

```bash
git add apps/jdconley-site/migrations apps/jdconley-site/worker apps/jdconley-site/tests/worker apps/jdconley-site/wrangler.toml
git commit -m "feat: add privacy-preserving supporter API"
```

---

### Task 10: Build the support experience

**Files:**
- Create: `apps/jdconley-site/js/a-better-time/support.js`
- Modify: `apps/jdconley-site/js/a-better-time/index.js`
- Modify: `apps/jdconley-site/a-better-time.html`
- Modify: `apps/jdconley-site/css/a-better-time.css`
- Modify: `apps/jdconley-site/tests/a-better-time.spec.ts`

- [ ] **Step 1: Write failing support UI tests**

Test live total/recent names, prefilled editable location, public-line preview, required consent, Turnstile token pass-through, success update, duplicate confirmation, API-unavailable state, HTML-like name rendered as text, focus trapping, Escape, and focus restoration.

- [ ] **Step 2: Implement support controller and accessible sheet/dialog**

Do not render a fake initial count. While loading, use a neutral skeleton with `aria-busy`; on failure display “Support count temporarily unavailable.” Render recent entries only through `textContent`.

- [ ] **Step 3: Run E2E tests at all responsive widths**

Run: `pnpm --filter @jdconley/jdconley-site exec playwright test tests/a-better-time.spec.ts`

Expected: support flow passes on phone, tablet, and desktop.

- [ ] **Step 4: Commit**

```bash
git add apps/jdconley-site/js/a-better-time apps/jdconley-site/a-better-time.html apps/jdconley-site/css/a-better-time.css apps/jdconley-site/tests/a-better-time.spec.ts
git commit -m "feat: add public support experience"
```

---

### Task 11: Generate personalized social metadata and PNG cards

**Files:**
- Create: `apps/jdconley-site/worker/html.js`
- Create: `apps/jdconley-site/worker/share-image.js`
- Modify: `apps/jdconley-site/worker/index.js`
- Create: `apps/jdconley-site/worker/font-modules.d.ts`
- Create: `apps/jdconley-site/tests/worker/share.test.js`
- Create: `apps/jdconley-site/js/a-better-time/share.js`
- Modify: `apps/jdconley-site/js/a-better-time/index.js`
- Modify: `apps/jdconley-site/a-better-time.html`
- Modify: `apps/jdconley-site/css/a-better-time.css`
- Modify: `apps/jdconley-site/wrangler.toml`
- Modify: `apps/jdconley-site/tests/a-better-time.spec.ts`

- [ ] **Step 1: Write failing Worker metadata/image tests**

Assert:

- `/a-better-time?...` returns a canonical URL with normalized query order.
- `og:image` and `twitter:image` point to the matching encoded `/a-better-time/share.png?...` URL.
- Invalid query fields are normalized before metadata generation.
- The image response starts with the PNG signature, is 1200×630, has `Content-Type: image/png`, an immutable cache header, and an ETag derived from canonical state.

- [ ] **Step 2: Implement HTML metadata rewriting**

Fetch `/a-better-time.html` through `env.ASSETS`, then use `HTMLRewriter` to replace title, description, canonical, Open Graph, and Twitter attributes. Keep the visible page client-rendered and cache the HTML privately/briefly because its metadata depends on the query.

- [ ] **Step 3: Implement the share image renderer**

Import Inter font buffers through Wrangler `Data` module rules. Use Satori to build a 1200×630 SVG with the approved ink/canvas/cobalt/blue/amber tokens, a simplified annual chart, result metric, place, settings, and jdconley.com label. Initialize `@resvg/resvg-wasm` once per isolate and render the SVG to PNG.

The Satori component must use only supported flexbox CSS and local font data; it must not fetch remote fonts or images.

- [ ] **Step 4: Run Worker tests and visually inspect a real PNG**

Run:

```bash
pnpm --filter @jdconley/jdconley-site run test:worker
curl -o /tmp/a-better-time-share.png "http://127.0.0.1:8788/a-better-time/share.png?lat=38.940&lon=-119.977&place=South+Lake+Tahoe%2C+CA&tz=America%2FLos_Angeles&wake=420&sleep=1320&bias=0&year=2026"
```

Inspect `/tmp/a-better-time-share.png` at full size and feed-thumbnail size. Expected: no clipping, correct chart colors, and readable metric/location.

- [ ] **Step 5: Write failing browser sharing tests**

Test native `navigator.share`, fallback panel, icon-only accessible name/tooltip, canonical clipboard content, image preview URL, download filename, and graceful image failure.

- [ ] **Step 6: Implement browser share controller and run E2E**

Use native share only when available and not blocked by the test/browser environment. Otherwise open the share panel. `Download image` uses an anchor with `download="a-better-time.png"` and the exact normalized query.

- [ ] **Step 7: Commit**

```bash
git add apps/jdconley-site/worker apps/jdconley-site/js/a-better-time apps/jdconley-site/a-better-time.html apps/jdconley-site/css/a-better-time.css apps/jdconley-site/tests apps/jdconley-site/wrangler.toml
git commit -m "feat: add personalized result sharing"
```

---

### Task 12: Integrate the project into jdconley.com

**Files:**
- Modify: `apps/jdconley-site/index.html`
- Modify: `apps/jdconley-site/css/jdconley-com.webflow.css`
- Create: `apps/jdconley-site/images/a-better-time-card.png`
- Create: `apps/jdconley-site/public/images/a-better-time-share-fallback.png`
- Modify: `apps/jdconley-site/tests/site.smoke.spec.ts`
- Modify: `README.md`

- [ ] **Step 1: Write failing homepage integration test**

```ts
test("links to A Better Time from Vibe coded projects", async ({ page }) => {
  await page.goto("/");
  const project = page.getByRole("link", { name: /A Better Time/ });
  await expect(project).toBeVisible();
  await expect(project).toHaveAttribute("href", "/a-better-time");
});
```

- [ ] **Step 2: Verify failure and add the project card**

Add it as the first “Vibe coded” card with the concise copy: “A gentler clock that follows the sun · Explore your location’s optimal time.” Match the existing project card DOM and avoid unrelated homepage refactors.

- [ ] **Step 3: Generate project/fallback artwork from the approved result state**

Use the actual page/share renderer, not an unrelated illustration. Capture the Tahoe balanced default at desktop-card aspect ratio and 1200×630 fallback. Verify sharpness after the existing image optimization script.

- [ ] **Step 4: Run smoke tests and README link check**

Run:

```bash
pnpm run build:site
pnpm run test:e2e:site
```

Expected: homepage, project link, existing navigation, and visualizer pass.

- [ ] **Step 5: Commit**

```bash
git add apps/jdconley-site/index.html apps/jdconley-site/css/jdconley-com.webflow.css apps/jdconley-site/images/a-better-time-card.png apps/jdconley-site/public/images/a-better-time-share-fallback.png apps/jdconley-site/tests/site.smoke.spec.ts README.md
git commit -m "feat: feature A Better Time on homepage"
```

---

### Task 13: Update CI, deployment, and operating documentation

**Files:**
- Modify: `.github/workflows/ci.yml`
- Modify: `.github/workflows/deploy.yml`
- Modify: `apps/jdconley-site/.env.example`
- Modify: `DEVELOPING.md`
- Modify: `AGENTS.md`
- Modify: `.agents/skills/cloudflare-pages-ops/SKILL.md`

- [ ] **Step 1: Add CI commands and verify the workflow locally where possible**

CI order:

```yaml
- run: pnpm install --frozen-lockfile
- run: pnpm run build:site
- run: pnpm --filter @jdconley/jdconley-site run test:unit
- run: pnpm --filter @jdconley/jdconley-site run test:worker
- run: pnpm run test:e2e:site
- run: pnpm run test:e2e:wrangler:site
```

Use deterministic fixture location data and Turnstile test keys in CI; never call the production D1 database.

- [ ] **Step 2: Change deployment from Pages to Worker**

The deploy workflow must run `wrangler deploy` from `apps/jdconley-site`, using `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`. Remove `CLOUDFLARE_PAGES_PROJECT`; add `TURNSTILE_SITE_KEY` as a repository variable. Keep `TURNSTILE_SECRET_KEY` and `SUPPORT_IP_HMAC_SECRET` as Worker secrets provisioned outside the workflow.

- [ ] **Step 3: Document local and production provisioning**

Document exact commands:

```bash
pnpm --filter @jdconley/jdconley-site exec wrangler d1 create a-better-time
pnpm --filter @jdconley/jdconley-site exec wrangler d1 migrations apply a-better-time --remote
pnpm --filter @jdconley/jdconley-site run locations:import:remote
pnpm --filter @jdconley/jdconley-site exec wrangler secret put TURNSTILE_SECRET_KEY
pnpm --filter @jdconley/jdconley-site exec wrangler secret put SUPPORT_IP_HMAC_SECRET
pnpm run deploy:site
```

The D1 create command returns the production UUID; replace the all-zero local sentinel in `wrangler.toml` with that generated value in the same provisioning commit. Document that rotating the HMAC secret intentionally resets duplicate identity.

- [ ] **Step 4: Update repository Cloudflare instructions**

Rename the repo-local skill to describe Worker operations while preserving the old path only if external references require it. Update AGENTS routing phrases and quick commands from Pages to Worker terminology.

- [ ] **Step 5: Run all documented local commands**

Run:

```bash
pnpm run logs:sync:site
pnpm run build:site
pnpm --filter @jdconley/jdconley-site run test:unit
pnpm --filter @jdconley/jdconley-site run test:worker
pnpm run test:e2e:site
pnpm run test:e2e:wrangler:site
```

Expected: all pass using only local D1/fixture data.

- [ ] **Step 6: Commit**

```bash
git add .github apps/jdconley-site/.env.example DEVELOPING.md AGENTS.md .agents/skills/cloudflare-pages-ops/SKILL.md apps/jdconley-site/wrangler.toml
git commit -m "ci: deploy jdconley.com as a Worker"
```

---

### Task 14: Complete cross-device, accessibility, privacy, and release verification

**Files:**
- Modify as findings require: visualizer, Worker, tests, and documentation files already listed.

- [ ] **Step 1: Run the complete automated suite from a clean build**

```bash
pnpm run logs:sync:site
pnpm run build:site
pnpm --filter @jdconley/jdconley-site run test:unit
pnpm --filter @jdconley/jdconley-site run test:worker
pnpm run test:e2e:site
pnpm run test:e2e:wrangler:site
```

Expected: every command exits 0 with no warnings from the optimizer, Worker, or browser console.

- [ ] **Step 2: Verify optimizer invariants over a U.S. coordinate matrix**

Run a test matrix covering Seattle, San Diego, Phoenix, Honolulu, Anchorage, Miami, New York, Indianapolis, and South Lake Tahoe for morning/balanced/evening preferences and 2026/2028. Assert URL round trips, no adjustment over 60 seconds, circular year boundary, valid polar states, and reproducible gain.

- [ ] **Step 3: Perform visual QA at five canonical viewports**

Inspect and approve:

- 390×844 phone.
- 768×1024 tablet portrait.
- 1024×768 tablet landscape.
- 1440×1000 desktop.
- 1920×1080 wide desktop.

Check chart labels, no clipped tooltips, capped desktop width, sticky rails, safe areas, sheet/dialog focus, recent supporters, and share preview. Compare against the approved premium visual tokens, not the discarded beige or high-neon concepts.

- [ ] **Step 4: Perform accessibility checks**

Keyboard through the entire page; test screen-reader names/states, 44px targets, focus visibility, reduced motion, chart text equivalent, non-color line differentiation, bottom-sheet focus restoration, and contrast in actual chart contexts.

- [ ] **Step 5: Perform privacy and abuse checks**

Confirm exact browser coordinates never reach supporter/location requests, query coordinates are rounded to three decimals, no raw IP is in D1 or application logs, HTML-like supporter input is inert text, duplicate support does not reveal identity, and all secrets are absent from git/build output.

- [ ] **Step 6: Deploy preview and validate Worker parity**

Deploy to a preview Worker/custom preview route. Validate assets, D1, location index, Turnstile, dynamic metadata, share PNG caching, 404 behavior, and existing site paths before moving the production custom domain.

- [ ] **Step 7: Move production traffic only after explicit final confirmation**

Switch `jdconley.com` from the Pages project to the verified Worker route, smoke-test the live site and shared link, and retain the Pages project briefly for rollback. This is the only step that changes production routing.

- [ ] **Step 8: Commit verification fixes**

```bash
git add -A
git commit -m "test: verify A Better Time release"
```

Use an intentional file list instead of `git add -A` if unrelated user changes are present.

---

## Plan self-review

- Every approved requirement maps to a task: exact-location solar model, 60-second 2:00 a.m. jumps, current DST reference, adjustable waking window and bias, query sharing, generated PNG, U.S. search, public supporters, hashed-IP deduplication, Workers migration, homepage integration, and responsive premium layouts.
- Mobile, tablet portrait, tablet landscape, desktop, and wide desktop each have explicit composition and screenshot verification.
- Pure logic is tested before UI wiring; Worker handlers are tested with real workerd/D1 bindings before browser integration.
- Production-only identifiers and secrets are created by explicit provisioning commands; the committed all-zero D1 UUID is a deliberate and documented local sentinel.
- Production domain routing is isolated as the final, explicitly confirmed external change.
