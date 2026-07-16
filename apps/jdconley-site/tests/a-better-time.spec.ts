import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const path = "/a-better-time.html";

// Full-page captures at five large viewports are intentionally serialized to
// keep the shared preview server and Chromium raster workers deterministic.
test.describe.configure({ mode: "serial" });

test.describe("A Better Time page shell", () => {
  test("announces support loading while retaining a decorative skeleton", async ({ page }) => {
    await page.route("**/api/a-better-time/supporters", async () => new Promise(() => {}));
    await page.goto(path);

    const label = page.locator("[data-support-status] [data-support-label]").first();
    await expect(label).toHaveText("Loading support…");
    await expect(label).toHaveCSS("position", "absolute");
  });

  test("meets automated accessibility checks and uses valid named groups", async ({ page }) => {
    await page.goto(path);

    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
    await expect(page.getByRole("group", { name: "Daylight chart legend" })).toBeVisible();
    await expect(page.getByRole("group", { name: "Clock shift chart legend" })).toBeVisible();
    await expect(page.locator("[data-turnstile-slot]")).not.toHaveAttribute("aria-label");
  });

  test("keeps secondary copy at AA contrast on its rendered surface", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(path);
    await page.getByRole("button", { name: "Show support" }).click();

    const contrastRatios = await page.evaluate(() => {
      const parse = (color: string) => color.match(/[\d.]+/g)?.slice(0, 3).map(Number) ?? [];
      const luminance = (color: string) => {
        const channels = parse(color).map((value) => {
          const normalized = value / 255;
          return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
        });
        return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
      };
      const ratio = (foreground: string, background: string) => {
        const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
        return (values[0] + 0.05) / (values[1] + 0.05);
      };
      return [
        [".location-button small", ".location-button"],
        [".location-note", "html"],
        [".settings-row span", ".settings-row"],
        [".settings-rail .setting-block > span", ".settings-rail"],
        [".settings-rail .rail-note", ".settings-rail"],
        [".settings-rail .balance-labels span", ".settings-rail"],
        [".range-labels span", ".dialog-panel"],
        [".site-footer > span", "html"],
        [".support-preview > span", ".support-preview"]
      ].map(([foregroundSelector, backgroundSelector]) => {
        const foreground = document.querySelector<HTMLElement>(foregroundSelector)!;
        const background = document.querySelector<HTMLElement>(backgroundSelector)!;
        return { selector: foregroundSelector, ratio: ratio(getComputedStyle(foreground).color, getComputedStyle(background).backgroundColor) };
      });
    });
    for (const result of contrastRatios) expect(result.ratio, result.selector).toBeGreaterThanOrEqual(4.5);
  });

  test("gives dialog close buttons and support consent a 44px target", async ({ page }) => {
    await page.goto(path);
    await page.getByRole("button", { name: "Show support" }).click();
    const dialog = page.getByRole("dialog", { name: "Show your support" });

    const closeSizes = await page.locator(".dialog-close").evaluateAll((buttons) => buttons.map((button) => {
      const styles = getComputedStyle(button);
      return { width: Number.parseFloat(styles.width), height: Number.parseFloat(styles.height) };
    }));
    expect(closeSizes).toHaveLength(4);
    for (const size of closeSizes) {
      expect(size.width).toBeGreaterThanOrEqual(44);
      expect(size.height).toBeGreaterThanOrEqual(44);
    }

    for (const target of [
      dialog.getByRole("button", { name: "Close support dialog" }),
      dialog.getByText("Display my first name and location publicly.")
    ]) {
      const box = await target.boundingBox();
      expect(box?.width).toBeGreaterThanOrEqual(44);
      expect(box?.height).toBeGreaterThanOrEqual(44);
    }
  });

  test("renders the complete accessible shell and metadata", async ({ page }) => {
    await page.goto(`${path}?year=2025`);

    await expect(page).toHaveTitle(/A Better Time/);
    await expect(page.getByRole("heading", { name: "What if the clock followed the sun?" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Share this result" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Tune my day" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Show support" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Yearly daylight comparison" })).toBeVisible();
    await expect(page.locator("[aria-live='polite'][data-gain-metric]")).toContainText(/hours/i);
    await expect(page.locator("[data-chart-root]")).not.toContainText(/illustrative|placeholder/i);

    const expectedCanonical = process.env.E2E_SERVER === "wrangler"
      ? /https:\/\/jdconley\.com\/a-better-time\?lat=.+&year=\d{4}$/
      : "https://jdconley.com/a-better-time";
    await expect(page.locator("link[rel='canonical']")).toHaveAttribute("href", expectedCanonical);
    const expectedImage = process.env.E2E_SERVER === "wrangler"
      ? /https:\/\/jdconley\.com\/a-better-time\/share\.png\?.+&v=/
      : "https://jdconley.com/images/a-better-time-share-fallback.png";
    await expect(page.locator("meta[property='og:image']")).toHaveAttribute("content", expectedImage);
    await expect(page.locator("meta[name='twitter:image']")).toHaveAttribute("content", expectedImage);
    const fallbackImage = await page.request.get("/images/a-better-time-share-fallback.png");
    expect(fallbackImage.ok()).toBeTruthy();
    expect(fallbackImage.headers()["content-type"]).toBe("image/png");
    expect(await page.locator("script[type='application/ld+json']").textContent()).toContain("WebApplication");
    expect(await page.locator("noscript").textContent()).toContain("South Lake Tahoe");
  });

  test("share dialog traps focus, closes with Escape, and restores focus", async ({ page }) => {
    await page.goto(path);
    const share = page.getByRole("button", { name: "Share this result" });
    const dialog = page.getByRole("dialog", { name: "Share your daylight plan" });

    await share.focus();
    await share.click();
    await expect(dialog).toBeVisible();
    await expect(page.getByRole("button", { name: "Copy link" })).toBeFocused();

    await page.keyboard.press("Shift+Tab");
    await expect(page.getByRole("button", { name: "Close share dialog" })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: "Copy link" })).toBeFocused();

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(share).toBeFocused();
  });

  test("backdrop closes dialogs while dialog content does not", async ({ page }) => {
    await page.goto(path);
    const support = page.getByRole("button", { name: "Show support" }).first();
    const dialog = page.getByRole("dialog", { name: "Show your support" });

    await support.click();
    await dialog.locator(".dialog-panel").click();
    await expect(dialog).toBeVisible();
    await dialog.click({ position: { x: 3, y: 3 } });
    await expect(dialog).toBeHidden();
    await expect(support).toBeFocused();
  });

  test("reopened dialog restores focus to the latest trigger", async ({ page }) => {
    await page.goto(path);
    const desktopTrigger = page.locator(".desktop-support");
    const mobileTrigger = page.locator(".mobile-support");
    const close = page.getByRole("button", { name: "Close support dialog" });

    await desktopTrigger.evaluate((element) => { element.style.display = "inline-flex"; });
    await mobileTrigger.evaluate((element) => { element.style.display = "inline-flex"; });
    await page.locator(".mobile-actions").evaluate((element) => { element.style.display = "flex"; });

    await desktopTrigger.click();
    await close.click();
    await mobileTrigger.click();
    await close.click();

    await expect(mobileTrigger).toBeFocused();
  });

  test("share control is icon-only with an accessible tooltip", async ({ page }) => {
    await page.goto(path);
    const share = page.getByRole("button", { name: "Share this result" });
    await expect(share.locator("svg")).toBeVisible();
    await expect(share.locator(".share-button__label")).toHaveCount(0);
    const target = await share.boundingBox();
    expect(target?.width).toBeGreaterThanOrEqual(44);
    expect(target?.height).toBeGreaterThanOrEqual(44);
    await share.hover();
    await expect(page.getByRole("tooltip")).toContainText("Share this result");
  });

  test("uses the approved A Better Time tokens without CSS gradients", async ({ page }) => {
    await page.goto(path);
    const tokens = await page.evaluate(() => {
      const styles = getComputedStyle(document.documentElement);
      return {
        ink: styles.getPropertyValue("--abt-ink").trim(),
        canvas: styles.getPropertyValue("--abt-canvas").trim(),
        surface: styles.getPropertyValue("--abt-surface").trim(),
        action: styles.getPropertyValue("--abt-action").trim(),
        sunrise: styles.getPropertyValue("--abt-sunrise").trim(),
        sunset: styles.getPropertyValue("--abt-sunset").trim(),
        reference: styles.getPropertyValue("--abt-reference").trim(),
        border: styles.getPropertyValue("--abt-border").trim(),
        radiusSm: styles.getPropertyValue("--abt-radius-sm").trim(),
        radiusLg: styles.getPropertyValue("--abt-radius-lg").trim(),
        sunsetLine: styles.getPropertyValue("--abt-sunset-line").trim(),
        referenceLine: styles.getPropertyValue("--abt-reference-line").trim(),
        axis: styles.getPropertyValue("--abt-axis").trim(),
        css: [...document.styleSheets].flatMap((sheet) => [...sheet.cssRules]).map((rule) => rule.cssText).join(" ")
      };
    });
    expect(tokens).toMatchObject({ ink: "#111318", canvas: "#f7f8fa", surface: "#fff", action: "#315eea", sunrise: "#2385ff", sunset: "#ff9f0a", reference: "#a5aab3", border: "#e2e5ea", radiusSm: "12px", radiusLg: "20px", sunsetLine: "#9c4a00", referenceLine: "#68707d", axis: "#59616e" });
    expect(tokens.css).not.toContain("gradient(");
    expect(tokens.css).toContain("transition: opacity 0.15s, transform 0.15s");
  });

  test("all form controls expose stable names and useful examples", async ({ page }) => {
    await page.goto(path);
    const controls = page.locator("input");
    await expect(controls).toHaveCount(7);
    for (let index = 0; index < await controls.count(); index += 1) {
      await expect(controls.nth(index)).toHaveAttribute("name", /.+/);
    }
    await expect(page.locator("input[name='supporter_name']")).toHaveAttribute("placeholder", "e.g. Jamie…");
    await expect(page.locator("input[name='location_search']")).toHaveAttribute("placeholder", "e.g. Phoenix or 85001…");
    await expect(page.locator("input[name='location_search']")).toHaveAttribute("autocomplete", "off");
  });

  test("fallback dialogs isolate every outside body sibling and restore them", async ({ browser }) => {
    const context = await browser.newContext();
    await context.addInitScript(() => {
      HTMLDialogElement.prototype.showModal = undefined;
      HTMLDialogElement.prototype.close = undefined;
    });
    const page = await context.newPage();
    await page.goto(path);
    const trigger = page.getByRole("button", { name: "Share this result" });
    await trigger.click();
    const isolated = await page.evaluate(() => [...document.body.children]
      .filter((node) => node.id !== "share-dialog" && node.tagName !== "SCRIPT")
      .every((node) => node.inert));
    expect(isolated).toBeTruthy();
    await page.keyboard.press("Escape");
    const remainingInert = await page.evaluate(() => [...document.body.children]
      .filter((node) => node.id !== "share-dialog" && node.tagName !== "SCRIPT")
      .filter((node) => node.inert)
      .map((node) => node.id || node.tagName));
    expect(remainingInert).toEqual([]);
    await expect(trigger).toBeFocused();
    await context.close();
  });

  test("no-JS fallback hides dead controls but keeps the model readable", async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto(path);
    await expect(page.getByRole("heading", { name: "What if the clock followed the sun?" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Yearly daylight comparison" })).toBeVisible();
    expect(await page.locator("noscript").textContent()).toContain("South Lake Tahoe");
    await expect(page.locator(".js-only:visible")).toHaveCount(0);
    await context.close();
  });
});

const layouts = [
  { name: "phone", width: 390, height: 844, visible: "mobile-actions", hidden: "settings-row" },
  { name: "tablet-portrait", width: 768, height: 1024, visible: "settings-row", hidden: "insight-rail" },
  { name: "tablet-landscape", width: 1024, height: 768, visible: "insight-rail", hidden: "settings-rail" },
  { name: "desktop", width: 1440, height: 1000, visible: "settings-rail", hidden: "mobile-actions" },
  { name: "wide-desktop", width: 1920, height: 1080, visible: "settings-rail", hidden: "mobile-actions" }
] as const;

test("phone actions stay pinned below the tool while post-tool content scrolls", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(path);
  await expect(page.locator("[data-gain-metric] strong")).not.toHaveText("Calculating…");

  const actions = page.locator(".mobile-actions");
  const chart = page.locator(".chart-card");

  const actionHeight = await actions.evaluate((element) => element.getBoundingClientRect().height);
  const actionDocumentTop = await actions.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return rect.top + window.scrollY;
  });
  await page.evaluate(({ actionDocumentTop, actionHeight }) => {
    window.scrollTo(0, actionDocumentTop - (window.innerHeight - actionHeight));
  }, { actionDocumentTop, actionHeight });
  const boundaryScroll = await page.evaluate(() => window.scrollY);

  const assertPinnedWithoutToolOverlap = async () => {
    const [actionRect, chartRect, viewportHeight] = await Promise.all([
      actions.boundingBox(),
      chart.boundingBox(),
      page.evaluate(() => window.innerHeight)
    ]);
    expect(actionRect).not.toBeNull();
    expect(chartRect).not.toBeNull();
    expect(Math.abs((actionRect?.y ?? 0) + (actionRect?.height ?? 0) - viewportHeight)).toBeLessThanOrEqual(2);
    const overlap = Math.min(
      (actionRect?.y ?? 0) + (actionRect?.height ?? 0),
      (chartRect?.y ?? 0) + (chartRect?.height ?? 0)
    ) - Math.max(actionRect?.y ?? 0, chartRect?.y ?? 0);
    expect(overlap).toBeLessThanOrEqual(0);
  };

  await assertPinnedWithoutToolOverlap();
  for (const offset of [200, 500]) {
    await page.evaluate((nextScroll) => window.scrollTo(0, nextScroll), boundaryScroll + offset);
    await assertPinnedWithoutToolOverlap();
  }

  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  const [actionRect, postToolRect, footerRect] = await Promise.all([
    actions.boundingBox(),
    page.locator(".post-tool").boundingBox(),
    page.locator(".site-footer").boundingBox()
  ]);
  expect(actionRect).not.toBeNull();
  expect(postToolRect).not.toBeNull();
  expect(footerRect).not.toBeNull();
  expect((actionRect?.y ?? 0) + (actionRect?.height ?? 0)).toBeLessThanOrEqual((postToolRect?.y ?? 0) + (postToolRect?.height ?? 0) + 2);
  expect((actionRect?.y ?? 0) + (actionRect?.height ?? 0)).toBeLessThanOrEqual((footerRect?.y ?? 0) + 2);
});

for (const layout of layouts) {
  test(`${layout.name} layout has intentional responsive composition`, async ({ page }, testInfo) => {
    testInfo.snapshotSuffix = "";
    await page.context().route("**/api/a-better-time/supporters", (route) => route.abort());
    await page.setViewportSize({ width: layout.width, height: layout.height });
    await page.goto(`${path}?year=2025`);

    await expect(page.locator(`[data-layout='${layout.hidden}']`)).toBeHidden();
    if (layout.name === "phone") {
      await page.locator(".mobile-actions").scrollIntoViewIfNeeded();
      const [card, actions] = await Promise.all([
        page.locator(".chart-card").boundingBox(),
        page.locator(".mobile-actions").boundingBox()
      ]);
      expect(actions && card && actions.y >= card.y + card.height).toBeTruthy();
    }
    await expect(page.locator(`[data-layout='${layout.visible}']`)).toBeVisible();
    await expect(page.getByRole("button", { name: "Tune my day" })).toBeVisible();
    const sizes = await page.evaluate(() => ({
      document: document.documentElement.scrollWidth,
      viewport: document.documentElement.clientWidth,
      workspace: document.querySelector<HTMLElement>(".app-workspace")?.getBoundingClientRect().width ?? 0
    }));
    expect(sizes.document).toBeLessThanOrEqual(sizes.viewport);
    if (layout.name === "wide-desktop") expect(sizes.workspace).toBeLessThan(1600);
    let snapshotPage = page;
    if (layout.name === "phone") {
      snapshotPage = await page.context().newPage();
      await snapshotPage.setViewportSize({ width: layout.width, height: layout.height });
      await snapshotPage.goto(`${path}?year=2025`);
    } else {
      await page.evaluate(() => {
        if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      });
    }
    await snapshotPage.locator(".skip-link").evaluate((element) => element.remove());
    await expect(snapshotPage).toHaveScreenshot(`${layout.name}.png`, {
      animations: "disabled",
      fullPage: layout.name !== "phone",
      maxDiffPixelRatio: 0.01
    });
    if (snapshotPage !== page) await snapshotPage.close();
  });
}

test("phone tuning opens as a bottom sheet", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(path);
  await page.getByRole("button", { name: "Tune my day" }).click();
  const dialog = page.getByRole("dialog", { name: "Tune your day" });
  await expect(dialog).toBeVisible();
  await expect(dialog.locator(".dialog-panel")).toHaveCSS("border-bottom-left-radius", "0px");
  await expect(dialog.getByLabel("Day starts")).toBeFocused();
});

test.describe("location personalization", () => {
  for (const location of [
    { name: "Canada", lat: 49.2827, lon: -123.1207, place: "Vancouver, BC", tz: "America/Vancouver" },
    { name: "Puerto Rico", lat: 18.2208, lon: -66.5901, place: "San Juan, PR", tz: "America/Puerto_Rico" }
  ]) {
    test(`resets a shared ${location.name} location while preserving valid schedule settings`, async ({ page }) => {
      await page.goto(`${path}?lat=${location.lat}&lon=${location.lon}&place=${encodeURIComponent(location.place)}&tz=${encodeURIComponent(location.tz)}&wake=480&sleep=1380&bias=35&year=2026`);

      await expect(page).toHaveURL(/lat=38\.940&lon=-119\.977&place=South\+Lake\+Tahoe%2C\+CA&tz=America%2FLos_Angeles/);
      await expect(page).toHaveURL(/wake=480&sleep=1380&bias=35&year=2026/);
      await expect(page.locator("[data-place-name]").first()).toHaveText("South Lake Tahoe, CA");
      const notice = page.getByRole("status").filter({ hasText: "50 states and Washington, D.C." });
      await expect(notice).toContainText("reset");
      await expect(notice.getByRole("button", { name: "Dismiss reset notice" })).toBeVisible();
    });
  }

  for (const location of [
    { name: "Phoenix", lat: 33.448, lon: -112.074, place: "Phoenix, AZ", expected: "America%2FPhoenix" },
    { name: "Bowbells border", lat: 48.803, lon: -102.246, place: "Bowbells, ND", expected: "America%2FChicago" }
  ]) {
    test(`corrects a mismatched shared time zone for ${location.name}`, async ({ page }) => {
      await page.goto(`${path}?lat=${location.lat}&lon=${location.lon}&place=${encodeURIComponent(location.place)}&tz=America%2FNew_York&wake=420&sleep=1320&bias=0&year=2026`);

      await expect(page).toHaveURL(new RegExp(`tz=${location.expected}`));
      await expect(page.locator("[data-place-name]").first()).toHaveText(location.place);
      await expect(page).not.toHaveURL(/tz=America%2FNew_York/);
    });
  }

  test("uses precise Tahoe coordinates locally and only rounds the shared URL", async ({ context, page }) => {
    const exact = { latitude: 38.9487374, longitude: -119.9507952 };
    await page.goto(path);
    await context.grantPermissions(["geolocation"], { origin: new URL(page.url()).origin });
    await context.setGeolocation(exact);
    const locationRequests: string[] = [];
    page.on("request", (request) => {
      if (request.url().includes("/api/a-better-time/locations")) locationRequests.push(request.url());
    });
    await page.getByRole("button", { name: /Showing daylight for/ }).click();
    await page.getByRole("button", { name: "Use my precise location" }).click();

    await expect(page.getByRole("dialog", { name: "Choose your location" })).toBeHidden();
    await expect(page.locator("[data-place-name]").first()).toHaveText("Current location");
    await expect(page).toHaveURL(/lat=38\.949/);
    await expect(page).toHaveURL(/lon=-119\.951/);
    expect(locationRequests).toEqual([]);

    const retained = await page.evaluate(async ({ latitude, longitude }) => {
      const { createLocationController } = await import("/js/a-better-time/location.js");
      const host = document.createElement("div");
      host.innerHTML = `<button data-use-location></button><input name="location_search"><p data-location-status></p><ul data-location-results></ul>`;
      document.body.append(host);
      let selected: { lat: number; lon: number } | null = null;
      const controller = createLocationController({
        root: host,
        geolocation: { getCurrentPosition(success: PositionCallback) { success({ coords: { latitude, longitude } } as GeolocationPosition); } },
        timezoneLookup: () => "America/Los_Angeles",
        onLocation(location: { lat: number; lon: number }) { selected = location; }
      });
      await controller.usePreciseLocation();
      controller.destroy();
      host.remove();
      return selected;
    }, exact);
    expect(retained).toMatchObject({ lat: exact.latitude, lon: exact.longitude });
  });

  for (const location of [
    { name: "Canada", latitude: 45.4215, longitude: -75.6972 },
    { name: "Puerto Rico", latitude: 18.2208, longitude: -66.5901 },
    { name: "Mexico", latitude: 32.5149, longitude: -117.0382 }
  ]) {
    test(`rejects precise coordinates in ${location.name} and preserves the Tahoe fallback`, async ({ context, page }) => {
      await page.goto(path);
      await context.grantPermissions(["geolocation"], { origin: new URL(page.url()).origin });
      await context.setGeolocation(location);
      const locationRequests: string[] = [];
      page.on("request", (request) => {
        if (request.url().includes("/api/a-better-time/locations")) locationRequests.push(request.url());
      });

      await page.getByRole("button", { name: /Showing daylight for/ }).click();
      await page.getByRole("button", { name: "Use my precise location" }).click();

      await expect(page.getByRole("dialog", { name: "Choose your location" })).toBeVisible();
      await expect(page.locator("[data-location-status]")).toContainText("50 states and Washington, D.C.");
      await expect(page.getByRole("combobox", { name: "City or ZIP code" })).toBeFocused();
      await expect(page.locator("[data-place-name]").first()).toHaveText("South Lake Tahoe, CA");
      await expect(page).toHaveURL(/lat=38\.940/);
      await expect(page).toHaveURL(/lon=-119\.977/);
      expect(locationRequests).toEqual([]);
    });
  }

  test("local boundary data includes Alaska, Hawaii, and Washington D.C. while excluding nearby non-covered regions", async ({ page }) => {
    await page.goto(path);
    const containment = await page.evaluate(async () => {
      const { isIn50StatesAndDc } = await import("/js/a-better-time/us-containment.js");
      return {
        alaska: isIn50StatesAndDc(61.2181, -149.9003),
        hawaii: isIn50StatesAndDc(21.3099, -157.8581),
        dc: isIn50StatesAndDc(38.9072, -77.0369),
        canada: isIn50StatesAndDc(45.4215, -75.6972),
        mexico: isIn50StatesAndDc(32.5149, -117.0382),
        puertoRico: isIn50StatesAndDc(18.2208, -66.5901)
      };
    });
    expect(containment).toEqual({ alaska: true, hawaii: true, dc: true, canada: false, mexico: false, puertoRico: false });
  });

  for (const location of [
    { name: "Bowbells, ND", latitude: 48.803, longitude: -102.246, tz: "America/Chicago" },
    { name: "Crosby, ND", latitude: 48.914, longitude: -103.295, tz: "America/Chicago" },
    { name: "Portal, ND", latitude: 48.996, longitude: -102.551, tz: "America/Chicago" },
    { name: "Redford, TX", latitude: 29.45, longitude: -104.18, tz: "America/Chicago" },
    { name: "Calais, ME", latitude: 45.189, longitude: -67.279, tz: "America/New_York" },
    { name: "Phoenix, AZ", latitude: 33.448, longitude: -112.074, tz: "America/Phoenix" },
    { name: "Honolulu, HI", latitude: 21.307, longitude: -157.858, tz: "Pacific/Honolulu" },
    { name: "Adak, AK", latitude: 51.88, longitude: -176.658, tz: "America/Adak" }
  ]) {
    test(`uses the local U.S. civil zone for precise coordinates in ${location.name}`, async ({ context, page }) => {
      await page.goto(path);
      await context.grantPermissions(["geolocation"], { origin: new URL(page.url()).origin });
      await context.setGeolocation(location);
      await page.getByRole("button", { name: /Showing daylight for/ }).click();
      await page.getByRole("button", { name: "Use my precise location" }).click();

      await expect(page.getByRole("dialog", { name: "Choose your location" })).toBeHidden();
      await expect(page).toHaveURL(new RegExp(`tz=${location.tz.replace("/", "%2F")}`));
    });
  }

  test("explains denied geolocation inline and focuses manual search", async ({ page }) => {
    await page.goto(path);
    await page.getByRole("button", { name: /Showing daylight for/ }).click();
    await page.getByRole("button", { name: "Use my precise location" }).click();

    await expect(page.locator("[data-location-status]")).toContainText(/denied|couldn.t access/i);
    await expect(page.getByRole("combobox", { name: "City or ZIP code" })).toBeFocused();
    await expect(page.getByRole("dialog", { name: "Choose your location" })).toBeVisible();
  });

  test("debounces Portland search and disambiguates results by state", async ({ page }) => {
    const calls: string[] = [];
    await page.route("**/api/a-better-time/locations**", async (route) => {
      calls.push(route.request().url());
      await route.fulfill({ json: { results: [
        { place: "Portland, OR", lat: 45.537, lon: -122.65, tz: "America/Los_Angeles" },
        { place: "Portland, ME", lat: 43.633, lon: -70.185, tz: "America/New_York" }
      ] } });
    });
    await page.goto(path);
    await page.getByRole("button", { name: /Showing daylight for/ }).click();
    const input = page.getByRole("combobox", { name: "City or ZIP code" });
    await input.fill("Portland");
    await page.waitForTimeout(200);
    expect(calls).toHaveLength(0);
    await expect(page.getByRole("option", { name: "Portland, OR" })).toBeVisible();
    await expect(page.getByRole("option", { name: "Portland, ME" })).toBeVisible();
    expect(calls).toHaveLength(1);

    await input.press("ArrowDown");
    await expect(page.getByRole("option", { name: "Portland, OR" })).toHaveAttribute("aria-selected", "true");
    await input.press("Enter");
    await expect(page.locator("[data-place-name]").first()).toHaveText("Portland, OR");
    await expect(page).toHaveURL(/place=Portland%2C\+OR/);
  });

  test("selects exact ZIP 96150", async ({ page }) => {
    await page.route("**/api/a-better-time/locations**", (route) => route.fulfill({ json: { results: [
      { place: "96150, CA", lat: 38.87332, lon: -120.068481, tz: "America/Los_Angeles" }
    ] } }));
    await page.goto(path);
    await page.getByRole("button", { name: /Showing daylight for/ }).click();
    await page.getByRole("combobox", { name: "City or ZIP code" }).fill("96150");
    await page.getByRole("option", { name: "96150, CA" }).click();

    await expect(page.locator("[data-place-name]").first()).toHaveText("96150, CA");
    await expect(page).toHaveURL(/lat=38\.873/);
    await expect(page).toHaveURL(/lon=-120\.068/);
  });

  test("shows no-results and API errors without changing the chart", async ({ page }) => {
    let fail = false;
    await page.route("**/api/a-better-time/locations**", (route) => fail
      ? route.fulfill({ status: 503, json: { error: "Unavailable" } })
      : route.fulfill({ json: { results: [] } }));
    await page.goto(path);
    const chartBefore = await page.locator("[data-series='proposed-sunrise']").getAttribute("d");
    const placeBefore = await page.locator("[data-place-name]").first().textContent();
    await page.getByRole("button", { name: /Showing daylight for/ }).click();
    const input = page.getByRole("combobox", { name: "City or ZIP code" });
    await input.fill("Nowhere");
    await expect(page.locator("[data-location-status]")).toContainText("No U.S. cities or ZIP codes found");
    expect(await page.locator("[data-series='proposed-sunrise']").getAttribute("d")).toBe(chartBefore);

    fail = true;
    await input.fill("Broken");
    await expect(page.locator("[data-location-status]")).toContainText(/couldn.t search/i);
    await expect(page.locator("[data-place-name]").first()).toHaveText(placeBefore ?? "");
    expect(await page.locator("[data-series='proposed-sunrise']").getAttribute("d")).toBe(chartBefore);
  });

  test("dismisses suggestions with Escape and click-outside", async ({ page }) => {
    await page.route("**/api/a-better-time/locations**", (route) => route.fulfill({ json: { results: [
      { place: "Portland, OR", lat: 45.537, lon: -122.65, tz: "America/Los_Angeles" }
    ] } }));
    await page.goto(path);
    await page.getByRole("button", { name: /Showing daylight for/ }).click();
    const input = page.getByRole("combobox", { name: "City or ZIP code" });
    await input.fill("Portland");
    await expect(page.getByRole("option", { name: "Portland, OR" })).toBeVisible();
    await input.press("Escape");
    await expect(page.getByRole("dialog", { name: "Choose your location" })).toBeVisible();
    await expect(page.getByRole("option", { name: "Portland, OR" })).toBeHidden();
    await input.fill("Portland");
    await expect(page.getByRole("option", { name: "Portland, OR" })).toBeVisible();
    await page.getByRole("heading", { name: "Choose your location" }).click();
    await expect(page.getByRole("option", { name: "Portland, OR" })).toBeHidden();
  });

  test("dismissal during debounce cancels the pending search", async ({ page }) => {
    const calls: string[] = [];
    await page.route("**/api/a-better-time/locations**", (route) => {
      calls.push(route.request().url());
      return route.fulfill({ json: { results: [{ place: "Portland, OR", lat: 45.537, lon: -122.65, tz: "America/Los_Angeles" }] } });
    });
    await page.goto(path);
    await page.getByRole("button", { name: /Showing daylight for/ }).click();
    await page.getByRole("combobox", { name: "City or ZIP code" }).fill("Portland");
    await page.waitForTimeout(100);
    await page.getByRole("heading", { name: "Choose your location" }).click();
    await page.waitForTimeout(300);

    expect(calls).toEqual([]);
    await expect(page.getByRole("option", { name: "Portland, OR" })).toBeHidden();
  });

  test("closing the dialog aborts an in-flight search so its result cannot reopen", async ({ page }) => {
    let requestStarted!: () => void;
    const started = new Promise<void>((resolve) => { requestStarted = resolve; });
    await page.route("**/api/a-better-time/locations**", async (route) => {
      requestStarted();
      await new Promise((resolve) => setTimeout(resolve, 400));
      await route.fulfill({ json: { results: [{ place: "Portland, OR", lat: 45.537, lon: -122.65, tz: "America/Los_Angeles" }] } });
    });
    await page.goto(path);
    await page.getByRole("button", { name: /Showing daylight for/ }).click();
    await page.getByRole("combobox", { name: "City or ZIP code" }).fill("Portland");
    await started;
    await page.getByRole("button", { name: "Close location dialog" }).click();
    await page.waitForTimeout(500);
    await page.getByRole("button", { name: /Showing daylight for/ }).click();

    await expect(page.getByRole("option", { name: "Portland, OR" })).toBeHidden();
    await expect(page.locator("[data-location-status]")).not.toContainText("Searching");
  });
});

test.describe("public support experience", () => {
  const publicState = { count: 128, recent: [
    { firstName: "Maya", location: "Portland, OR" },
    { firstName: "<img src=x onerror=alert(1)>", location: "Austin, TX" }
  ] };

  test("loads a verified count and recent supporter text without HTML execution", async ({ page }) => {
    await page.route("**/api/a-better-time/supporters", (route) => route.fulfill({ json: publicState }));
    await page.goto(path);
    const status = page.locator("[data-support-status]").first();
    await expect(status).toHaveAttribute("aria-busy", "false");
    await expect(page.locator("[data-support-count]").first()).toHaveText("128");
    await expect(page.locator("[data-support-recent]").first()).toContainText("Maya · Portland, OR");
    await expect(page.locator("[data-support-recent]").first()).toContainText("<img src=x onerror=alert(1)> · Austin, TX");
    await expect(page.locator("[data-support-recent] img")).toHaveCount(0);
  });

  test("keeps loading neutral and reports API unavailability without a fake count", async ({ page }) => {
    let release!: () => void;
    const pending = new Promise<void>((resolve) => { release = resolve; });
    await page.route("**/api/a-better-time/supporters", async (route) => {
      await pending;
      await route.fulfill({ status: 503, json: { error: "unavailable" } });
    });
    await page.goto(path);
    const status = page.locator("[data-support-status]").first();
    await expect(status).toHaveAttribute("aria-busy", "true");
    await expect(page.locator("[data-support-count]").first()).toHaveText("");
    release();
    await expect(status).toContainText("Support count temporarily unavailable.");
    await expect(status).toHaveAttribute("aria-busy", "false");
  });

  test("prefills editable location, previews the public line, and requires consent", async ({ page }) => {
    await page.route("**/api/a-better-time/supporters", (route) => route.fulfill({ json: publicState }));
    await page.goto(`${path}?place=Phoenix%2C+AZ`);
    await page.getByRole("button", { name: "Show support" }).first().click();
    const dialog = page.getByRole("dialog", { name: "Show your support" });
    await expect(dialog.getByLabel("Display location")).toHaveValue("Phoenix, AZ");
    await dialog.getByRole("textbox", { name: "First name" }).fill("Jamie");
    await dialog.getByLabel("Display location").fill("Tempe, AZ");
    await expect(dialog.locator("[data-support-preview]")).toHaveText("Jamie · Tempe, AZ");
    await dialog.getByRole("button", { name: "Add my support" }).click();
    await expect(dialog.locator("[data-support-error]")).toContainText("consent");
    await expect(dialog.getByLabel(/display.*publicly/i)).toBeFocused();
  });

  test("passes the Turnstile token, updates count on success, and confirms duplicates", async ({ page }) => {
    const posts: unknown[] = [];
    let postCount = 0;
    await page.addInitScript(() => {
      let index = 0;
      (window as any).turnstileResets = 0;
      (window as any).__abtTurnstile = {
        getToken: async () => `turnstile-token-${++index}`,
        reset: () => { (window as any).turnstileResets += 1; }
      };
    });
    await page.route("**/api/a-better-time/supporters", async (route) => {
      if (route.request().method() === "GET") return route.fulfill({ json: { count: 128, recent: [] } });
      posts.push(route.request().postDataJSON());
      postCount += 1;
      return route.fulfill({ status: postCount === 1 ? 201 : 200, json: { status: postCount === 1 ? "created" : "duplicate", count: 129 } });
    });
    await page.goto(path);
    const trigger = page.getByRole("button", { name: "Show support" }).first();
    await trigger.click();
    const dialog = page.getByRole("dialog", { name: "Show your support" });
    await dialog.getByRole("textbox", { name: "First name" }).fill("Jamie");
    await dialog.getByLabel(/display.*publicly/i).check();
    await dialog.getByRole("button", { name: "Add my support" }).click();
    await expect(dialog.locator("[data-support-confirmation]")).toContainText("Thanks for supporting");
    await expect(page.locator("[data-support-count]").first()).toHaveText("129");
    expect(posts[0]).toMatchObject({ firstName: "Jamie", location: "South Lake Tahoe, CA", consent: true, turnstileToken: "turnstile-token-1" });

    await dialog.getByRole("button", { name: "Add my support" }).click();
    await expect(dialog.locator("[data-support-confirmation]")).toContainText("already recorded");
    expect(posts[1]).toMatchObject({ turnstileToken: "turnstile-token-2" });
    expect(await page.evaluate(() => (window as any).turnstileResets)).toBe(2);
  });

  test("maps malformed and network submission failures to friendly unavailable copy", async ({ page }) => {
    let failure = "malformed";
    await page.addInitScript(() => { (window as any).__abtTurnstile = { getToken: async () => "token", reset: () => {} }; });
    await page.route("**/api/a-better-time/supporters", async (route) => {
      if (route.request().method() === "GET") return route.fulfill({ json: { count: 1, recent: [] } });
      if (failure === "malformed") return route.fulfill({ status: 500, body: "not-json" });
      return route.abort("failed");
    });
    await page.goto(path);
    await page.getByRole("button", { name: "Show support" }).first().click();
    const dialog = page.getByRole("dialog", { name: "Show your support" });
    await dialog.getByRole("textbox", { name: "First name" }).fill("Jamie");
    await dialog.getByLabel(/display.*publicly/i).check();
    await dialog.getByRole("button", { name: "Add my support" }).click();
    await expect(dialog.locator("[data-support-error]")).toHaveText("We couldn’t add your support right now.");
    failure = "network";
    await dialog.getByRole("button", { name: "Add my support" }).click();
    await expect(dialog.locator("[data-support-error]")).toHaveText("We couldn’t add your support right now.");
  });

  test("closing during pending Turnstile cancels the attempt and ignores a late token", async ({ page }) => {
    await page.addInitScript(() => {
      (window as any).resolveTurnstile = null;
      (window as any).turnstileResets = 0;
      (window as any).__abtTurnstile = {
        getToken: () => new Promise((resolve) => { (window as any).resolveTurnstile = resolve; }),
        reset: () => { (window as any).turnstileResets += 1; }
      };
    });
    const posts: string[] = [];
    await page.route("**/api/a-better-time/supporters", (route) => {
      if (route.request().method() === "GET") return route.fulfill({ json: { count: 1, recent: [] } });
      posts.push(route.request().postData() ?? "");
      return route.fulfill({ status: 201, json: { status: "created", count: 2 } });
    });
    await page.goto(path);
    const trigger = page.getByRole("button", { name: "Show support" }).first();
    await trigger.click();
    const dialog = page.getByRole("dialog", { name: "Show your support" });
    await dialog.getByRole("textbox", { name: "First name" }).fill("Jamie");
    await dialog.getByLabel(/display.*publicly/i).check();
    const submit = dialog.getByRole("button", { name: "Add my support" });
    await submit.click();
    await expect(submit).toBeDisabled();
    await dialog.getByRole("button", { name: "Close support dialog" }).click();
    await trigger.click();
    await expect(submit).toBeEnabled();
    await page.evaluate(() => (window as any).resolveTurnstile?.("late-token"));
    await page.waitForTimeout(100);
    expect(posts).toEqual([]);
    expect(await page.evaluate(() => (window as any).turnstileResets)).toBeGreaterThanOrEqual(1);
  });

  test("a delayed initial load cannot overwrite a newer submitted count", async ({ page }) => {
    let release!: () => void;
    const pending = new Promise<void>((resolve) => { release = resolve; });
    await page.addInitScript(() => { (window as any).__abtTurnstile = { getToken: async () => "token", reset: () => {} }; });
    await page.route("**/api/a-better-time/supporters", async (route) => {
      if (route.request().method() === "GET") {
        await pending;
        return route.fulfill({ json: { count: 10, recent: [] } });
      }
      return route.fulfill({ status: 201, json: { status: "created", count: 11 } });
    });
    await page.goto(path);
    await page.getByRole("button", { name: "Show support" }).first().click();
    const dialog = page.getByRole("dialog", { name: "Show your support" });
    await dialog.getByRole("textbox", { name: "First name" }).fill("Jamie");
    await dialog.getByLabel(/display.*publicly/i).check();
    await dialog.getByRole("button", { name: "Add my support" }).click();
    await expect(page.locator("[data-support-count]").first()).toHaveText("11");
    release();
    await page.waitForTimeout(100);
    await expect(page.locator("[data-support-count]").first()).toHaveText("11");
  });

  for (const viewport of [
    { name: "phone", width: 390, height: 844, sheet: true },
    { name: "tablet", width: 768, height: 1024, sheet: false },
    { name: "desktop", width: 1440, height: 1000, sheet: false }
  ]) {
    test(`${viewport.name} support dialog traps focus, closes with Escape, and restores its trigger`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.route("**/api/a-better-time/supporters", (route) => route.fulfill({ json: publicState }));
      await page.goto(path);
      const trigger = page.getByRole("button", { name: "Show support" }).first();
      await trigger.click();
      const dialog = page.getByRole("dialog", { name: "Show your support" });
      await expect(dialog.getByRole("textbox", { name: "First name" })).toBeFocused();
      if (viewport.sheet) await expect(dialog.locator(".dialog-panel")).toHaveCSS("border-bottom-left-radius", "0px");
      await dialog.getByRole("textbox", { name: "First name" }).press("Shift+Tab");
      await expect(dialog.getByRole("button", { name: "Close support dialog" })).toBeFocused();
      await page.keyboard.press("Escape");
      await expect(dialog).toBeHidden();
      await expect(trigger).toBeFocused();
    });
  }
});

test.describe("personalized sharing", () => {
  test("uses native sharing with the exact canonical query when available", async ({ page }) => {
    await page.addInitScript(() => {
      (window as any).nativeShares = [];
      Object.defineProperty(navigator, "share", { configurable: true, value: async (payload: unknown) => { (window as any).nativeShares.push(payload); } });
    });
    await page.goto(`${path}?year=2026&place=Phoenix%2C+AZ&lat=33.4484&lon=-112.074&tz=America%2FPhoenix`);
    await page.getByRole("button", { name: "Share this result" }).click();
    const shares = await page.evaluate(() => (window as any).nativeShares);
    expect(shares).toHaveLength(1);
    expect(shares[0].url).toMatch(/lat=33\.448&lon=-112\.074&place=Phoenix%2C\+AZ&tz=America%2FPhoenix&wake=420&sleep=1320&bias=0&year=2026$/);
    await expect(page.getByRole("dialog", { name: "Share your daylight plan" })).toBeHidden();
  });

  test("fallback dialog copies canonical URL and exposes matching preview and download", async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "share", { configurable: true, value: undefined });
      (window as any).copiedShare = "";
      Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async (value: string) => { (window as any).copiedShare = value; } } });
    });
    await page.goto(`${path}?year=2026&place=Phoenix%2C+AZ&lat=33.4484&lon=-112.074&tz=America%2FPhoenix`);
    await page.getByRole("button", { name: "Share this result" }).click();
    const dialog = page.getByRole("dialog", { name: "Share your daylight plan" });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Copy link" }).click();
    const canonical = await page.evaluate(() => (window as any).copiedShare);
    expect(canonical).toContain("place=Phoenix%2C+AZ");
    const imageUrl = new URL(canonical);
    imageUrl.pathname = "/a-better-time/share.png";
    imageUrl.searchParams.set("v", "satori-resvg-inter-2026-07-16.3");
    const image = imageUrl.href;
    await expect(dialog.locator("[data-share-preview]")).toHaveAttribute("src", image);
    await expect(dialog.getByRole("link", { name: "Download image" })).toHaveAttribute("download", "a-better-time.png");
    await expect(dialog.getByRole("link", { name: "Download image" })).toHaveAttribute("href", image);
  });

  test("keeps the icon-only accessible trigger and handles preview failure", async ({ page }) => {
    await page.addInitScript(() => Object.defineProperty(navigator, "share", { configurable: true, value: undefined }));
    await page.goto(path);
    const share = page.getByRole("button", { name: "Share this result" });
    await expect(share.locator("svg")).toBeVisible();
    await share.hover();
    await expect(page.getByRole("tooltip")).toHaveText("Share this result");
    await share.click();
    const dialog = page.getByRole("dialog", { name: "Share your daylight plan" });
    await dialog.locator("[data-share-preview]").evaluate((image: HTMLImageElement) => image.dispatchEvent(new Event("error")));
    await expect(dialog.locator("[data-share-error]")).toContainText("preview unavailable");
  });
});

test.describe("live daylight model", () => {
  test("uses honest comparison copy when extreme Anchorage settings lose useful daylight", async ({ page }) => {
    await page.goto(`${path}?lat=61.218&lon=-149.900&place=Anchorage%2C+AK&tz=America%2FAnchorage&wake=420&sleep=1320&bias=-100&year=2026`);
    await expect(page.locator("[data-gain-metric] strong")).toHaveText(/−\d+ hours/);
    await expect(page.locator("#chart-title")).toHaveText("Less useful light with these settings");
    await expect(page.locator("[data-gain-metric] span")).toContainText("less useful daylight than current clock policy");
  });

  test("renders computed chart paths and current-policy DST markers", async ({ page }) => {
    await page.goto(`${path}?lat=38.940&lon=-119.977&place=South+Lake+Tahoe%2C+CA&tz=America%2FLos_Angeles&wake=420&sleep=1320&bias=0&year=2026`);
    await expect(page.locator("[data-chart='daylight'] [data-series='proposed-sunrise']")).toHaveAttribute("d", /^M.+L/);
    await expect(page.locator("[data-chart='daylight'] [data-series='current-sunrise']")).toHaveAttribute("stroke-dasharray", /./);
    await expect(page.locator("[data-dst-marker]")).toHaveCount(2);
    await expect(page.locator(".dst-label")).toHaveText(["DST starts", "Standard time"]);
    await expect(page.locator("[data-active-readout]")).toContainText(/Sunrise|Polar/);
  });

  test("zones without daylight saving show no policy markers", async ({ page }) => {
    await page.goto(`${path}?lat=33.448&lon=-112.074&place=Phoenix%2C+AZ&tz=America%2FPhoenix&wake=420&sleep=1320&bias=0&year=2026`);
    await expect(page.locator("[data-chart='daylight'] [data-series='proposed-sunrise']")).toHaveAttribute("d", /^M/);
    await expect(page.locator("[data-dst-marker]")).toHaveCount(0);
    await page.goto(`${path}?lat=21.307&lon=-157.858&place=Honolulu%2C+HI&tz=Pacific%2FHonolulu&wake=420&sleep=1320&bias=0&year=2026`);
    await expect(page.locator("[data-dst-marker]")).toHaveCount(0);
  });

  test("tuning validates and then updates canonical URL and model", async ({ page }) => {
    await page.goto(path);
    const gainBefore = await page.locator("[data-gain-metric] strong").textContent();
    await page.getByRole("button", { name: "Tune my day" }).first().click();
    const dialog = page.getByRole("dialog", { name: "Tune your day" });
    await dialog.getByLabel("Day starts").fill("06:00");
    await dialog.getByLabel("Day ends").fill("11:00");
    await dialog.getByRole("button", { name: "Apply settings" }).click();
    await expect(dialog).toBeVisible();
    await expect(dialog.locator("[data-tune-error]")).toContainText(/8 and 20 hours/);
    await expect(dialog.getByLabel("Day starts")).toHaveAttribute("aria-invalid", "true");
    await expect(dialog.getByLabel("Day ends")).toHaveAttribute("aria-invalid", "true");
    await expect(dialog.getByLabel("Day starts")).toBeFocused();

    await dialog.getByLabel("Day ends").fill("21:00");
    await dialog.getByLabel("Daylight priority").fill("50");
    await expect(dialog.getByLabel("Daylight priority")).toHaveAttribute("aria-valuetext", "Evening");
    await dialog.getByLabel("Daylight priority").press("Enter");
    await expect(dialog).toBeHidden();
    await expect(page.locator("#tune-dialog [name='day_start']")).not.toHaveAttribute("aria-invalid", "true");
    await expect(page).toHaveURL(/wake=360/);
    await expect(page).toHaveURL(/sleep=1260/);
    await expect(page).toHaveURL(/bias=50/);
    await expect(page.locator("[data-settings-summary]").first()).toContainText("6:00 AM");
    await expect(page.locator("[data-gain-metric] strong")).not.toHaveText(gainBefore ?? "");
  });

  test("tuning identifies the exact malformed time endpoint", async ({ page }) => {
    await page.goto(path);
    await page.getByRole("button", { name: "Tune my day" }).first().click();
    const dialog = page.getByRole("dialog", { name: "Tune your day" });
    const start = dialog.getByLabel("Day starts");
    const end = dialog.getByLabel("Day ends");

    await start.fill("07:00");
    await end.fill("");
    await dialog.getByRole("button", { name: "Apply settings" }).click();
    await expect(start).not.toHaveAttribute("aria-invalid", "true");
    await expect(end).toHaveAttribute("aria-invalid", "true");
    await expect(end).toBeFocused();

    await start.fill("");
    await end.fill("22:00");
    await dialog.getByRole("button", { name: "Apply settings" }).click();
    await expect(start).toHaveAttribute("aria-invalid", "true");
    await expect(end).not.toHaveAttribute("aria-invalid", "true");
    await expect(start).toBeFocused();
  });

  test("keyboard inspection coordinates both desktop charts", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(`${path}?year=2026`);
    const target = page.locator("[data-chart='daylight'] [data-inspection-target]");
    await expect(page.getByRole("slider", { name: "Inspect daylight by date" })).toBeVisible();
    await target.focus();
    await page.keyboard.press("Home");
    await expect(target).toHaveAttribute("aria-valuenow", "0");
    await page.keyboard.press("ArrowRight");
    await expect(target).toHaveAttribute("aria-valuenow", "1");
    await expect(page.locator("[data-cursor-index='1']")).toHaveCount(2);
    await page.keyboard.press("ArrowLeft");
    await expect(target).toHaveAttribute("aria-valuenow", "0");
    await page.keyboard.press("End");
    await expect(target).toHaveAttribute("aria-valuenow", "364");
  });

  test("phone switches between daylight and clock shift charts", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(path);
    await expect(page.locator("[data-chart-panel='daylight']")).toBeVisible();
    await expect(page.locator("[data-chart-panel='clock']")).toBeHidden();
    await page.getByRole("button", { name: "Clock shift" }).click();
    await expect(page.locator("[data-chart-panel='clock']")).toBeVisible();
    await expect(page.locator("[data-chart-panel='daylight']")).toBeHidden();
  });

  test("phone reduces date ticks while desktop keeps monthly context", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(path);
    await expect(page.locator("[data-chart='daylight'] [data-month-label]")).toHaveCount(4);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.reload();
    await expect(page.locator("[data-chart='daylight'] [data-month-label]")).toHaveCount(12);
  });

  test("pointer drag and click inspect the same linked date", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(`${path}?year=2026`);
    const target = page.locator("[data-chart='daylight'] [data-inspection-target]");
    const box = await target.boundingBox();
    expect(box).not.toBeNull();
    const announcementBeforeHover = await page.locator("[data-chart-announcer]").textContent();
    await page.mouse.move(box!.x + 10, box!.y + box!.height / 2);
    const hovered = Number(await target.getAttribute("aria-valuenow"));
    expect(hovered).toBeLessThan(10);
    await expect(page.locator("[data-active-readout] strong")).toContainText("January");
    await expect(page.locator("[data-chart-announcer]")).toHaveText(announcementBeforeHover ?? "");
    await page.mouse.down();
    await page.mouse.move(box!.x + box!.width * 0.75, box!.y + box!.height / 2, { steps: 4 });
    await page.mouse.up();
    const dragged = Number(await page.locator("[data-chart='daylight'] [data-inspection-target]").getAttribute("aria-valuenow"));
    expect(dragged).toBeGreaterThan(250);
    await page.locator("[data-chart='clock'] [data-inspection-target]").click({ position: { x: 5, y: box!.height / 2 } });
    const clicked = Number(await page.locator("[data-chart='daylight'] [data-inspection-target]").getAttribute("aria-valuenow"));
    expect(clicked).toBeLessThan(10);
    await expect(page.locator(`[data-cursor-index='${clicked}']`)).toHaveCount(2);
  });

  test("clock adjustments use a visible seconds band without stretched SVG text", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(`${path}?year=2026`);
    const adjustment = page.locator("[data-series='daily-adjustment']");
    const box = await adjustment.boundingBox();
    expect(box?.height).toBeGreaterThan(20);
    await expect(page.locator("[data-chart='clock'] [data-adjustment-band]")).toHaveAttribute("data-axis-domain", "-60,0,60 seconds");
    await expect(page.locator("[data-chart='clock'] svg")).toHaveAttribute("preserveAspectRatio", "xMidYMid meet");
    const geometry = await page.locator("[data-chart='clock'] svg").evaluate((svg) => {
      const ticks = [...svg.querySelectorAll("[data-axis-kind='offset'][data-axis-value]")];
      const adjustment = svg.querySelector("[data-adjustment-band]");
      return {
        tickY: ticks.map((tick) => Number(tick.getAttribute("y1") ?? tick.getAttribute("y"))),
        tickValues: ticks.map((tick) => Number(tick.getAttribute("data-axis-value"))),
        adjustmentTop: Number(adjustment?.getAttribute("data-band-top")),
        offsetBottom: Number(svg.querySelector("[data-offset-band]")?.getAttribute("data-band-bottom"))
      };
    });
    expect(geometry.tickValues).toEqual([-180, 0, 180]);
    expect(geometry.tickY[0]).toBeGreaterThan(geometry.tickY[1]);
    expect(geometry.tickY[1]).toBeGreaterThan(geometry.tickY[2]);
    expect(geometry.offsetBottom).toBeLessThan(geometry.adjustmentTop);
  });

  test("crossing the phone breakpoint rerenders ticks while retaining focus and date", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(`${path}?year=2026`);
    const target = page.locator("[data-chart='daylight'] [data-inspection-target]");
    await target.focus();
    await page.keyboard.press("Home");
    await page.keyboard.press("ArrowRight");
    await expect(page.locator("[data-chart='daylight'] [data-month-label]")).toHaveCount(12);
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.locator("[data-chart='daylight'] [data-month-label]")).toHaveCount(4);
    await expect(page.locator("[data-chart='daylight'] [data-inspection-target]")).toHaveAttribute("aria-valuenow", "1");
    await expect(page.locator("[data-chart='daylight'] [data-inspection-target]")).toBeFocused();
  });

  test("committed interactions announce exactly once while hover remains silent", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(`${path}?year=2026`);
    await expect(page.locator("[data-gain-metric] strong")).not.toHaveText("Calculating…");
    await page.evaluate(() => {
      const announcer = document.querySelector("[data-chart-announcer]")!;
      announcer.textContent = "";
      (window as any).announcementMutations = 0;
      new MutationObserver(() => { (window as any).announcementMutations += 1; }).observe(announcer, { childList: true, characterData: true, subtree: true });
    });
    const target = page.locator("[data-chart='daylight'] [data-inspection-target]");
    const box = await target.boundingBox();
    await page.mouse.move(box!.x + box!.width * 0.25, box!.y + box!.height / 2);
    expect(await page.evaluate(() => (window as any).announcementMutations)).toBe(0);
    await page.mouse.down();
    await page.mouse.up();
    await expect.poll(() => page.evaluate(() => (window as any).announcementMutations)).toBe(1);
    await target.focus();
    await page.keyboard.press("ArrowUp");
    await expect.poll(() => page.evaluate(() => (window as any).announcementMutations)).toBe(2);
    await page.keyboard.press("ArrowDown");
    await expect.poll(() => page.evaluate(() => (window as any).announcementMutations)).toBe(3);
  });

  test("a real touch tap inspects a date without hover", async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      hasTouch: true,
      isMobile: true
    });
    const page = await context.newPage();
    await page.goto(`${path}?year=2026`);
    const target = page.locator("[data-chart='daylight'] [data-inspection-target]");
    const box = await target.boundingBox();
    expect(box).not.toBeNull();
    await page.touchscreen.tap(box!.x + box!.width * 0.9, box!.y + box!.height / 2);
    expect(Number(await target.getAttribute("aria-valuenow"))).toBeGreaterThan(320);
    await context.close();
  });

  test("invalid shared settings show and dismiss a reset notice while using fallbacks", async ({ page }) => {
    await page.goto(`${path}?lat=nope&bias=900&year=2026`);
    const notice = page.getByRole("status");
    await expect(notice).toContainText("lat, bias");
    await expect(page.locator("[data-chart='daylight'] [data-series='proposed-sunrise']")).toHaveAttribute("d", /^M.+L/);
    await expect(page).toHaveURL(/lat=38\.940/);
    await expect(page).toHaveURL(/bias=0/);
    await notice.getByRole("button", { name: "Dismiss reset notice" }).click();
    await expect(notice).toBeHidden();
  });

  test("polar seasons are labeled and split missing-event line segments", async ({ page }) => {
    await page.goto(`${path}?lat=71.291&lon=-156.789&place=Utqiagvik%2C+AK&tz=America%2FAnchorage&wake=420&sleep=1320&bias=0&year=2026`);
    await expect(page.locator(".polar-label", { hasText: "Polar day" })).toBeVisible();
    await expect(page.locator(".polar-label", { hasText: "Polar night" }).first()).toBeVisible();
    const pathData = await page.locator("[data-series='proposed-sunrise']").getAttribute("d");
    expect(pathData?.match(/M/g)?.length).toBeGreaterThanOrEqual(2);
  });
});
