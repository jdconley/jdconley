import { expect, test } from "@playwright/test";

test("homepage renders core content and metadata", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveTitle(/JD Conley/i);
  await expect(page.getByRole("heading", { name: "Hi, I'm JD. I" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "make things" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "that people want." })).toBeVisible();
  await expect(page.getByRole("link", { name: "Big Projects" })).toBeVisible();

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

test("links to A Better Time from Vibe coded projects", async ({ page }) => {
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

test("A Better Time static metadata uses its approved share fallback", async ({ page }) => {
  await page.goto("/a-better-time.html");
  const fallback = "https://jdconley.com/images/a-better-time-share-fallback.png";
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute("content", fallback);
  await expect(page.locator('meta[name="twitter:image"]')).toHaveAttribute("content", fallback);
});

test("404 page renders expected message", async ({ page }) => {
  await page.goto("/404.html");

  await expect(page.getByRole("heading", { name: "Page Not Found" })).toBeVisible();
  await expect(page.getByText("doesn't exist or has been moved")).toBeVisible();
});
