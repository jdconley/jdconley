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
    await expect(page.locator("meta[property='og:image']")).toHaveAttribute("content", "https://jdconley.com/images/caverock.jpg");
    await expect(page.locator("meta[name='twitter:image']")).toHaveAttribute("content", "https://jdconley.com/images/caverock.jpg");
    const fallbackImage = await page.request.get("/images/caverock.jpg");
    expect(fallbackImage.ok()).toBeTruthy();
    expect(fallbackImage.headers()["content-type"]).toMatch(/^image\/(?:jpeg|jpg)/);
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
        css: [...document.styleSheets].flatMap((sheet) => [...sheet.cssRules]).map((rule) => rule.cssText).join(" ")
      };
    });
    expect(tokens).toMatchObject({ ink: "#111318", canvas: "#f7f8fa", surface: "#fff", action: "#315eea", sunrise: "#2385ff", sunset: "#ff9f0a", reference: "#a5aab3", border: "#e2e5ea", radiusSm: "12px", radiusLg: "20px" });
    expect(tokens.css).not.toContain("gradient(");
  });
});

const layouts = [
  { name: "phone", width: 390, height: 844, visible: "mobile-actions", hidden: "settings-row" },
  { name: "tablet-portrait", width: 768, height: 1024, visible: "settings-row", hidden: "insight-rail" },
  { name: "tablet-landscape", width: 1024, height: 768, visible: "insight-rail", hidden: "settings-rail" },
  { name: "desktop", width: 1440, height: 1000, visible: "settings-rail", hidden: "mobile-actions" },
  { name: "wide-desktop", width: 1920, height: 1080, visible: "settings-rail", hidden: "mobile-actions" }
] as const;

for (const layout of layouts) {
  test(`${layout.name} layout has intentional responsive composition`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: layout.width, height: layout.height });
    await page.goto(path);

    await expect(page.locator(`[data-layout='${layout.visible}']`)).toBeVisible();
    await expect(page.locator(`[data-layout='${layout.hidden}']`)).toBeHidden();
    await expect(page.getByRole("button", { name: "Tune my day" })).toBeVisible();
    const sizes = await page.evaluate(() => ({
      document: document.documentElement.scrollWidth,
      viewport: document.documentElement.clientWidth,
      workspace: document.querySelector<HTMLElement>(".app-workspace")?.getBoundingClientRect().width ?? 0
    }));
    expect(sizes.document).toBeLessThanOrEqual(sizes.viewport);
    if (layout.name === "wide-desktop") expect(sizes.workspace).toBeLessThan(1600);
    await page.screenshot({ path: testInfo.outputPath(`${layout.name}.png`), fullPage: true });
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
