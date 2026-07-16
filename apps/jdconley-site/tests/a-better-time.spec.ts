import { expect, test } from "@playwright/test";

const path = "/a-better-time.html";

// Full-page captures at five large viewports are intentionally serialized to
// keep the shared preview server and Chromium raster workers deterministic.
test.describe.configure({ mode: "serial" });

test.describe("A Better Time page shell", () => {
  test("renders the complete accessible shell and metadata", async ({ page }) => {
    await page.goto(path);

    await expect(page).toHaveTitle(/A Better Time/);
    await expect(page.getByRole("heading", { name: "What if the clock followed the sun?" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Share this result" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Tune my day" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Show support" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Yearly daylight comparison" })).toBeVisible();
    await expect(page.locator("[aria-live='polite'][data-gain-metric]")).toContainText(/minutes/i);

    await expect(page.locator("link[rel='canonical']")).toHaveAttribute("href", "https://jdconley.com/a-better-time");
    await expect(page.locator("meta[property='og:image']")).toHaveAttribute("content", "https://jdconley.com/images/webclip.png");
    await expect(page.locator("meta[name='twitter:image']")).toHaveAttribute("content", "https://jdconley.com/images/webclip.png");
    const fallbackImage = await page.request.get("/images/webclip.png");
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
    await expect(page.getByRole("button", { name: "Copy share link" })).toBeFocused();

    await page.keyboard.press("Shift+Tab");
    await expect(page.getByRole("button", { name: "Close share dialog" })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: "Copy share link" })).toBeFocused();

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
    await expect(controls).toHaveCount(6);
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
  test(`${layout.name} layout has intentional responsive composition`, async ({ page }) => {
    await page.setViewportSize({ width: layout.width, height: layout.height });
    await page.goto(path);

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
      await snapshotPage.goto(path);
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
