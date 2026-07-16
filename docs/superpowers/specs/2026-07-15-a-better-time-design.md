# A Better Time — Design Specification

**Status:** Approved for implementation  
**Date:** July 15, 2026  
**Public route:** `https://jdconley.com/a-better-time`

## Product thesis

“A Better Time” is an interactive thought experiment: what if local clocks made one small adjustment every day instead of jumping by an hour twice a year? The proposed clock follows local solar conditions closely enough to place more daylight inside the hours a person is normally awake.

The page should make the idea easy to understand, personalize, inspect, share, and support. It is explicitly a visualization of an exact-location experience, not a complete national policy proposal. The page will explain that any real policy would likely group nearby places into administrable clock regions.

## Success criteria

- A visitor can use browser location or search for a U.S. city or ZIP code and see a full-year result.
- The default waking window is 7:00 a.m.–10:00 p.m.
- The proposed clock changes once per day at 2:00 a.m., by no more than 60 seconds forward or backward.
- The visitor can favor morning or evening daylight with a balanced default.
- The visualization compares the proposal with the location’s real current standard/DST policy, including no-DST locations.
- Every valid configuration has a stable, reproducible query-string URL and personalized share image.
- Visitors can add public support with first name and display location. Duplicate support is prevented without storing raw IP addresses.
- The experience feels like a premium consumer app on mobile and an editorial data story on larger screens.

## User experience

### Entry and location

The hero asks, “What if the clock followed the sun?” and explains the premise in one sentence. The primary prompt is “See your daylight.”

The visitor can:

1. Use browser geolocation. Exact coordinates remain in browser memory and are never sent to the support API.
2. Search a U.S. city or five-digit ZIP code. Results come from a Worker endpoint backed by a public-domain Census-derived D1 location index.

The initial page uses South Lake Tahoe, California as an illustrative default until the visitor chooses a location. Geolocation is never requested automatically; it begins only after a user gesture.

Browser coordinates are converted to an IANA time zone in the client. Manual results already include coordinates, display label, and time zone. The page supports the 50 states and District of Columbia; territories are excluded from the first release because the proposal and reference policy are framed around the U.S. states.

### Personalized result

The primary result is a plain-language number: additional hours of daylight inside the selected waking window compared with current civil time over the same calendar year.

The main chart shows:

- Optimized sunrise time.
- Optimized sunset time.
- Current-policy sunrise and sunset as a visually secondary dashed reference.
- The selected waking-window boundaries.
- A touch/hover inspection cursor with date, proposed sunrise/sunset, current sunrise/sunset, daily clock adjustment, and total proposed offset.

A secondary “Clock shift” view shows:

- Each day’s signed adjustment in seconds.
- The cumulative proposed offset from the location’s standard-zone baseline.
- The two one-hour current-policy DST jumps as reference markers where applicable.

On desktop the two views may be visible together when space permits. On mobile they use a two-option segmented control so only one chart appears at a time.

### Controls

Defaults:

- Wake: 7:00 a.m.
- Sleep: 10:00 p.m.
- Preference: balanced.
- Maximum daily adjustment: fixed at 60 seconds and explained, not user-configurable.

Wake and sleep are selectable in 15-minute increments. The window must be at least eight hours and at most twenty hours. The preference slider is continuous from “more morning” to “more evening,” with a labeled balanced midpoint and keyboard support.

Desktop places the three settings directly above the result. Mobile keeps the primary screen focused and opens “Tune my day” as a bottom sheet containing the three settings. Changes preview immediately; “Apply settings” closes the sheet.

### Sharing

An icon-only share control sits in the result/chart header. It has an accessible name, visible focus state, and hover/focus tooltip.

Activation:

- Uses the Web Share API when available.
- Otherwise opens a compact share panel with Copy link and Download image actions.
- Copying uses the canonical query-string URL.
- The panel previews the generated 1200×630 social image.

The social image contains the product name, display location, waking window, preference label, gained daylight result, a simplified annual chart, and jdconley.com branding. It uses the same visual tokens as the app and remains legible at feed-preview sizes.

### Showing support

The page displays the verified total and a short recent-supporters list such as “Maya · Portland, OR.” The support sheet asks for:

- First name, 2–40 characters.
- Display location, prefilled from the current result but editable, 2–60 characters.
- An explicit checkbox consenting to display both fields publicly.
- A managed Cloudflare Turnstile check.

The sheet previews the exact public line before submission. It explains that one support entry is allowed per internet connection and that the IP is irreversibly hashed for duplicate prevention. No email address is requested.

After success, the count updates immediately and the visitor sees a short confirmation. A privacy/removal link opens a pre-addressed email requesting removal; the site owner can locate the record from the submitted name, location, and approximate submission time.

## Optimization model

### Time basis

For each date in the selected calendar year, the solar engine calculates sunrise and sunset instants in UTC from latitude and longitude. Current-policy clock times use the IANA zone’s actual offset on that date, naturally capturing U.S. DST, Arizona and Hawaii, and rule data supplied by the browser and Worker runtimes.

The proposed clock begins with the IANA zone’s standard UTC offset as its baseline and adds a variable schedule offset. It does not inherit the zone’s DST jump.

### Unconstrained daily optimum

Let the waking interval be `[wake, sleep]` and the solar interval have length `daylightLength`.

For each date, first maximize the overlap between the shifted solar interval and the waking interval. When multiple offsets have the same maximum overlap, allocate the unavoidable darkness or surplus daylight according to the preference slider:

- Balanced allocates it equally before wake and after sleep.
- Favor morning shifts daylight earlier, reducing morning darkness at the expense of evening daylight.
- Favor evening shifts daylight later, reducing evening darkness at the expense of morning daylight.

This produces one deterministic ideal offset for each date. The preference value is stored as an integer from `-100` (morning) through `0` (balanced) to `100` (evening).

### Implementable annual schedule

The ideal offsets are smoothed into a circular annual schedule that minimizes total squared distance from the daily ideals subject to:

`abs(offset[d] - offset[d - 1]) <= 60 seconds`

The same constraint applies from December 31 back to January 1. Offsets and daily adjustments are integer seconds. Deterministic tie-breaking chooses the smaller absolute offset, then the earlier clock, so the same inputs always produce identical results and share images.

Each signed change is applied as a discrete clock correction at 2:00 a.m. proposed local time. The visualization explicitly notes that real adoption would also require a gradual transition into the steady-state schedule; it would not begin with a large one-time reset.

### Comparison metric

For both current policy and the proposal, compute the number of seconds in the intersection of the solar interval and waking interval for every day. The headline gain is:

`sum(proposed overlap - current-policy overlap)`

It is displayed in rounded hours, while the exact value remains available to the chart and share-image renderer. Distribution changes that do not add overlap are not counted as gains.

### Edge conditions

- Polar day: the chart shows continuous daylight and overlap is the entire waking window.
- Polar night: the chart shows no sunrise/sunset and zero daylight overlap.
- Sunrise or sunset outside the displayed clock day: times remain attached to the correct date and may render beyond the nominal 0–24 hour plot before clipping.
- Leap years: February 29 interpolates between the adjacent schedule offsets; annual comparisons use the selected URL year when supplied and the current year otherwise.
- Unsupported or invalid coordinates fall back to the South Lake Tahoe example with an inline explanation.

## URL contract

Canonical parameters:

- `lat`: latitude rounded to three decimal places.
- `lon`: longitude rounded to three decimal places.
- `place`: compact display label, URI encoded and capped at 60 characters.
- `tz`: valid IANA time-zone identifier.
- `wake`: minutes after midnight, default `420`.
- `sleep`: minutes after midnight, default `1320`.
- `bias`: integer `-100..100`, default `0`.
- `year`: four-digit year, default current year.

Default-valued parameters may be omitted, but generated share URLs include all values needed to reproduce the result without lookup. Parameters are normalized into a stable order. Invalid fields fall back independently so one malformed value does not discard the rest of a shared configuration.

Three-decimal coordinates are approximately city-level precision and preserve materially identical solar results while avoiding precise-location sharing. The share UI states that it will share rounded coordinates and the visible place label.

## Visual design

### Direction

The approved direction is premium consumer software rather than a dashboard, climate editorial, or campaign poster.

Core tokens:

- Ink: `#111318`.
- Canvas: `#F7F8FA`.
- Surface: `#FFFFFF`.
- Primary action: `#315EEA`.
- Sunrise/cool line: `#2385FF`.
- Sunset/warm line: `#FF9F0A`.
- Reference gray: `#A5AAB3`.

Color is saturated but localized to meaning: primary actions, the headline gain, sunrise, and sunset. Most of the interface remains neutral. Surfaces use 12–20px radii, fine cool-gray borders, and at most one restrained shadow level. Typography uses Inter/system sans to match the existing site while adopting tighter, consumer-app metric hierarchy.

The direction synthesizes patterns from premium health, weather, and finance apps: metric-first hierarchy, one dominant chart, compact segmented controls, touch inspection, and progressive disclosure. Reference screens include [Oura Body Clock](https://mobbin.com/screens/fb49ee69-838d-4018-a6e4-8eac8a95b7c7), [Gentler Streak Insights](https://mobbin.com/screens/4b8e9bd2-23d2-4639-9e46-37965c805e65), [Apple Weather solar detail](https://mobbin.com/screens/b58d318e-09b6-4736-851d-75e3c4edbd7d), and [Acorns fund detail](https://mobbin.com/screens/c0cf7bf7-2494-46a3-8530-bafc6c9f92b7).

### Responsive behavior

The mobile chart is an intentionally transformed visualization, not a scaled desktop chart:

- One chart view at a time.
- Fewer axis labels.
- Direct labels and a compact legend.
- A full-height touch inspection target that follows horizontal drag.
- Settings in a bottom sheet.
- Share in the top-right header.
- “Tune my day” and “Show support” in a reachable bottom action area that does not obscure content or safe-area insets.

Desktop adds explanatory copy, exposes settings, and may show both chart views without adding unrelated dashboard cards.

The implementation follows established responsive-visualization guidance: explicit mobile transformations, single-touch inspection, legible labels, and progressive disclosure rather than simple CSS shrinking. See [Our World in Data’s Grapher redesign](https://ourworldindata.org/redesigning-our-interactive-data-visualizations), [UW mobile visualization interaction research](https://idl.uw.edu/papers/mobile-vis-interaction-techniques), and [responsive visualization design patterns](https://arxiv.org/abs/2104.07724).

### Site integration

The homepage’s “Vibe coded” projects section gains an “A Better Time” project card linking to `/a-better-time`. Its image uses a static default-state capture consistent with the personalized social-card design. Navigation, footer, favicon, analytics behavior, and existing jdconley.com typography remain consistent.

## Technical architecture

### Cloudflare Workers migration

The site currently deploys to Cloudflare Pages. This feature migrates it to a single Cloudflare Worker because Workers Static Assets is Cloudflare’s recommended target for new static/full-stack work, while Pages remains operational but is no longer the focus of new platform optimization.

The Worker configuration will include:

- A module Worker entry point.
- A static-assets binding pointing at Vite’s `dist` directory.
- Worker-first routes for `/a-better-time`, `/a-better-time/share.png`, and `/api/a-better-time/*`.
- A D1 binding named `DB`.
- Turnstile site-key configuration and encrypted secret.
- An encrypted `SUPPORT_IP_HMAC_SECRET`.

All unrelated site assets bypass Worker execution and retain static-asset caching. The Worker fetches `/a-better-time.html` from the asset binding, injects normalized Open Graph/Twitter metadata with `HTMLRewriter`, and returns it. The migration updates local preview, deployment scripts, GitHub Actions, environment documentation, and Wrangler configuration from Pages commands to `wrangler dev`/`wrangler deploy`.

Cloudflare’s guidance: [Workers Static Assets best practice](https://developers.cloudflare.com/workers/best-practices/workers-best-practices/) and [Pages-to-Workers migration](https://developers.cloudflare.com/workers/static-assets/migration-guides/migrate-from-pages/).

### Browser modules

The page uses focused modules with explicit interfaces:

- Solar events: coordinates/date → UTC sunrise, sunset, or polar state.
- Current-policy clock: UTC instant/time zone → displayed civil time and UTC offset.
- Optimizer: daily solar events and settings → ideal offsets, constrained schedule, overlaps, and summary metrics.
- URL state: query string ↔ validated configuration.
- Chart renderer: result series and active date → accessible SVG visualization.
- Location controller: browser geolocation or API result → normalized location.
- Share controller: canonical URL → Web Share, clipboard, and image preview/download.
- Support controller: count/recent reads and consented submission.

Core calculation modules are pure and shared by the browser and share-image route to prevent numerical drift.

### Worker routes

- `GET /a-better-time`: serves the static app HTML with normalized dynamic social metadata.
- `GET /a-better-time/share.png`: validates query state, recomputes the result, renders a 1200×630 PNG with Satori-compatible markup and a Worker-compatible resvg implementation, and caches by normalized query.
- `GET /api/a-better-time/locations?q=`: searches U.S. city/state names and five-digit ZIPs, returning at most eight normalized results.
- `GET /api/a-better-time/supporters`: returns the total and the twelve most recent consented public entries.
- `POST /api/a-better-time/supporters`: validates Turnstile, input, rate limits, and duplicate status; then inserts one supporter.

JSON endpoints use strict method handling, request-size limits, no-store response headers for submissions, and structured error codes suitable for user-facing messages.

### Location index

A reproducible script imports public-domain U.S. Census Gazetteer place and ZCTA centroid data into D1. The repository stores the import script and pinned source URLs/checksums, not an ad hoc third-party API key. The normalized table includes search name, display name, state, optional ZIP, latitude, longitude, and IANA time zone. Time zones are assigned deterministically from coordinates during import.

### Supporter data and privacy

D1 stores:

```sql
CREATE TABLE supporters (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  first_name TEXT NOT NULL,
  display_location TEXT NOT NULL,
  ip_hmac TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL
);
```

The Worker reads `CF-Connecting-IP`, normalizes the textual address, and computes an HMAC-SHA-256 with the stable secret. Only the hex HMAC enters D1. The raw header is never logged by application code or included in responses. Secret rotation requires an intentional duplicate-policy reset and is documented accordingly.

First name and location are trimmed, Unicode-normalized, length-limited, and rendered only through text APIs. The recent list and count contain no IP-derived value. A unique D1 constraint is the final duplicate guard. Duplicate submission returns the current count without exposing whether any other specific person supported the idea.

Turnstile verification and a coarse Worker rate limit protect the endpoint. A same-origin check, JSON content type, small body limit, and generic errors reduce automated abuse.

## Failure states

- Geolocation denied/unavailable: preserve the example and focus manual search with a short explanation.
- Search unavailable: retain the current chart and invite browser location or retry.
- No matching city/ZIP: show an inline no-results state without clearing the query.
- Invalid shared URL: fall back per field and show a dismissible “Some shared settings were reset” notice.
- Share image unavailable: sharing still copies the canonical URL and uses a static fallback Open Graph image.
- Support API unavailable: hide recent names, label the count temporarily unavailable, and keep the calculator fully functional.
- Duplicate support: show a friendly “This connection has already added support” confirmation and the live count.
- Polar state: replace missing line segments with explicit “sun does not rise/set” labels for affected dates.
- JavaScript disabled: serve a meaningful static explanation, default social metadata, and site navigation.

## Accessibility

- All controls work with keyboard, touch, pointer, and screen readers.
- Icon-only actions have accessible names, tooltips, visible focus rings, and at least 44×44 CSS-pixel targets.
- The preference slider exposes minimum, maximum, current value, and descriptive text.
- Charts include a concise text summary, table-equivalent active-date values, and non-color encodings such as solid/dashed lines and direct labels.
- Touch chart inspection has tap selection as an alternative to dragging.
- Motion respects `prefers-reduced-motion`; data updates do not depend on animation.
- Color pairs meet WCAG 2.2 contrast requirements in their actual line/text contexts.
- Bottom sheets trap focus, announce their titles, close with Escape, and return focus to the opener.

## Testing and verification

### Unit tests

- Solar-event fixtures at representative latitudes and dates.
- Standard/DST conversion for Pacific, Mountain, Central, Eastern, Arizona, and Hawaii zones.
- Polar day/night behavior for Alaska.
- Optimizer overlap maximum, preference allocation, deterministic tie-breaking, integer-second output, and the 60-second circular constraint.
- Comparison metric against hand-calculated intervals.
- URL parse/serialize round trips, stable ordering, coordinate rounding, and independent invalid-field fallback.
- HMAC determinism without raw-IP persistence.
- Support input validation and duplicate handling.

### Worker integration tests

- Static assets continue to serve through the Worker.
- `/a-better-time` injects query-specific canonical and social metadata.
- Share route returns a valid 1200×630 PNG and cache headers.
- Location search covers city/state ambiguity and ZIP lookup.
- Local D1 migration, support insert, duplicate rejection, and recent-list ordering.
- Turnstile success/failure paths use a replaceable verification adapter in tests.

### Playwright tests

- Browser-location success and denial.
- Manual city and ZIP flows.
- Wake/sleep and preference changes update the chart and URL.
- DST reference jump appears in a DST zone and is absent in Arizona/Hawaii.
- Share icon invokes native-share fallback behavior and copies the expected URL.
- Support preview, consent requirement, successful submission, and duplicate confirmation.
- Keyboard navigation and chart tap/drag inspection.
- Desktop and mobile screenshots for the main result, settings sheet, share panel, and support sheet.
- Existing homepage, navigation, “How This Is Built,” and error-page smoke coverage remain green after the Workers migration.

### Release verification

1. Build the Vite assets and generate LLM/site artifacts.
2. Apply D1 migrations and seed the location index in preview.
3. Run unit and Worker integration tests.
4. Run Playwright against local `wrangler dev` with local D1.
5. Inspect desktop/mobile layouts and the actual rendered share PNG.
6. Deploy a preview Worker and verify custom-domain routing, Turnstile, D1, headers, and social-card crawlers.
7. Move the jdconley.com custom domain from the Pages project to the Worker only after preview parity passes.

## Explicit non-goals

- Designing federal legislation or administrable national clock-zone boundaries.
- Supporting locations outside the 50 U.S. states and District of Columbia in the first release.
- Collecting supporter email addresses, last names, precise locations, or raw IP addresses.
- User accounts, comments, donations, petitions sent to legislators, or supporter profiles.
- Letting visitors change the 60-second safety cap or 2:00 a.m. adjustment time.
- Claiming health, safety, energy, or economic outcomes beyond the computed waking-daylight comparison.
