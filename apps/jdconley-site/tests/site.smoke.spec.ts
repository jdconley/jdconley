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

test("404 page renders expected message", async ({ page }) => {
  await page.goto("/404.html");

  await expect(page.getByRole("heading", { name: "Page Not Found" })).toBeVisible();
  await expect(page.getByText("doesn't exist or has been moved")).toBeVisible();
});
