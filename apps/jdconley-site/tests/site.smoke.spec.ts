import { expect, test } from "@playwright/test";

test("homepage renders core content and metadata", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveTitle(/JD Conley/i);
  await expect(page.getByRole("heading", { name: "Hi, I'm JD. I" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "make things" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "that people want." })).toBeVisible();
  await expect(page.getByRole("link", { name: "Big Projects" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Little Projects" })).toHaveAttribute(
    "href",
    "#vibe-projects"
  );
  await expect(page.locator("#vibe-projects .section-heading")).toHaveText("Little projects");

  const canonicalHref = await page.locator("link[rel='canonical']").getAttribute("href");
  expect(canonicalHref).toContain("http");
});

test("critical contact and profile links are present", async ({ page }) => {
  await page.goto("/");

  await expect(page.locator('a[href^="mailto:jd.conley@gmail.com"]')).toBeVisible();
  await expect(page.locator('a[href^="tel:+15304949447"]')).toBeVisible();
  await expect(page.locator('a[href="https://github.com/jdconley"]')).toBeVisible();
  await expect(page.locator('a[href="https://www.linkedin.com/in/jdconley"]')).toBeVisible();
});

test("links to A Better Time from Little projects", async ({ page }) => {
  await page.goto("/");
  const project = page.getByRole("link", { name: /A Better Time/ });
  await expect(project).toBeVisible();
  await expect(project).toHaveAttribute("href", "/a-better-time");
  await expect(project).toContainText(
    "A gentler clock that follows the sun · Explore your location’s optimal time."
  );
  await expect(project.getByRole("img", { name: /daylight visualizer/ })).toHaveAttribute(
    "src",
    "/images/a-better-time-card.png"
  );
});

test("Also building shows Pounce from Conley Chaos", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: "Also Building" })).toHaveAttribute("href", "#pounce");

  const section = page.locator("#pounce");
  await expect(section.locator(".section-heading")).toHaveText("Also building");
  await expect(section).toContainText("Family game night, every night.");
  await expect(section.getByRole("link", { name: "Conley Chaos" })).toHaveAttribute(
    "href",
    "https://conleychaos.com"
  );
  await expect(section.getByRole("link", { name: "Get Pounce on the App Store" })).toHaveAttribute(
    "href",
    "https://apps.apple.com/app/id6829560061"
  );
  await expect(section.getByRole("link", { name: "play.conleychaos.com" })).toHaveAttribute(
    "href",
    "https://play.conleychaos.com"
  );
  await expect(section.getByRole("link", { name: "Code on GitHub" })).toHaveAttribute(
    "href",
    "https://github.com/jdconley/pounce"
  );

  const img = section.getByRole("img", { name: /Family game night, every night/ });
  await img.scrollIntoViewIfNeeded();
  await expect
    .poll(() => img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth))
    .toBe(2400);

  // Pounce moved out of Little projects; it should not appear twice.
  await expect(page.locator("#vibe-projects").getByRole("link", { name: /Pounce/ })).toHaveCount(0);
});

for (const card of [
  {
    name: /Good First Token/,
    href: "https://goodfirsttoken.org",
    text: "Spend your spare AI tokens on open source",
    img: /Good First Token homepage/,
  },
]) {
  test(`links to ${card.name.source} from Little projects`, async ({ page }) => {
    await page.goto("/");
    const project = page.locator("#vibe-projects").getByRole("link", { name: card.name });
    await expect(project).toHaveAttribute("href", card.href);
    await expect(project).toContainText(card.text);
    const img = project.getByRole("img", { name: card.img });
    await img.scrollIntoViewIfNeeded();
    await expect
      .poll(() => img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth))
      .toBe(800);
  });
}

test("A Better Time static metadata uses its approved share fallback", async ({ page }) => {
  test.skip(process.env.E2E_SERVER === "wrangler", "Wrangler personalizes share metadata");
  await page.goto("/a-better-time.html");
  const fallback = "https://jdconley.com/images/a-better-time-share-fallback.png";
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute("content", fallback);
  await expect(page.locator('meta[name="twitter:image"]')).toHaveAttribute("content", fallback);
});

test("Wrangler injects the deterministic Turnstile test site key", async ({ page }) => {
  test.skip(process.env.E2E_SERVER !== "wrangler", "Worker runtime only");
  await page.goto("/a-better-time");
  await expect(page.locator('meta[name="turnstile-site-key"]')).toHaveAttribute(
    "content",
    "1x00000000000000000000AA"
  );
});

test("404 page renders expected message", async ({ page }) => {
  await page.goto("/404.html");

  await expect(page.getByRole("heading", { name: "Page Not Found" })).toBeVisible();
  await expect(page.getByText("doesn't exist or has been moved")).toBeVisible();
});
