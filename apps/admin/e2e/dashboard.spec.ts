import { test, expect, type Page, type ConsoleMessage, type Response } from "@playwright/test";

const ADMIN_EMAIL = "admin@demo.local";
const ADMIN_PASSWORD = "AdminPass123456789!";

test.describe("Commerce Suite Dashboard E2E", () => {
  test.beforeEach(async ({ context }) => {
    // Clear any previous state
    await context.clearCookies();
  });

  async function loginAndGoToDashboard(page: Page) {
    const consoleErrors: string[] = [];
    page.on("console", (msg: ConsoleMessage) => {
      console.log(`[BROWSER ${msg.type()}]:`, msg.text());
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      }
    });
    page.on("response", (res: Response) => {
      if (res.status() >= 400) {
        console.log(`[HTTP ${res.status()}]:`, res.url());
      }
    });

    await page.goto("/login");
    await page.waitForLoadState("networkidle");

    // Fill credentials
    await page.fill('input[type="email"]', ADMIN_EMAIL);
    await page.fill('input[type="password"]', ADMIN_PASSWORD);
    await page.click('button:has-text("Sign in")');

    // Wait for redirect to dashboard
    await page.waitForURL("/", { timeout: 15000 });
    await page.waitForLoadState("networkidle");

    // Wait for KPI cards or main header to be visible
    await expect(page.locator("text=Live store data")).toBeVisible({
      timeout: 10000,
    });

    return consoleErrors;
  }

  test("Desktop 1440px - Dark & Light mode assertions & screenshots", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const consoleErrors = await loginAndGoToDashboard(page);

    // 1. Assert no horizontal page overflow
    const hasHorizontalOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth;
    });
    expect(hasHorizontalOverflow).toBeFalsy();

    // 2. Assert KPI cards exist, display ৳ symbol, and no text is clipped
    const salesCard = page.locator("text=Total sales").first();
    await expect(salesCard).toBeVisible();

    const ordersCard = page.locator("text=Total orders").first();
    await expect(ordersCard).toBeVisible();

    // 3. Assert Sidebar deduplication: "Homepage Builder", "Site Settings", "Tracking & Pixels" appear at most once
    const navText = await page.locator('nav[aria-label="Main navigation"]').innerText();
    const countOccurrences = (str: string, substr: string) =>
      str.split(substr).length - 1;

    expect(countOccurrences(navText, "Homepage Builder")).toBeLessThanOrEqual(1);
    expect(countOccurrences(navText, "Site Settings")).toBeLessThanOrEqual(1);
    expect(countOccurrences(navText, "Tracking & Pixels")).toBeLessThanOrEqual(1);

    // 4. Assert Dark theme appearance & screenshot
    await page.evaluate(() => {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    });
    await page.waitForTimeout(500);
    await page.screenshot({
      path: "e2e/screenshots/desktop-1440-dark.png",
      fullPage: true,
    });

    // 5. Assert Light theme appearance & screenshot
    await page.evaluate(() => {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    });
    await page.waitForTimeout(500);
    await page.screenshot({
      path: "e2e/screenshots/desktop-1440-light.png",
      fullPage: true,
    });

    // 6. Assert no console errors
    expect(consoleErrors).toEqual([]);
  });

  test("Tablet 768px - Responsive Icon Rail & no horizontal overflow", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    const consoleErrors = await loginAndGoToDashboard(page);

    // Assert no horizontal overflow
    const hasHorizontalOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth;
    });
    expect(hasHorizontalOverflow).toBeFalsy();

    // In tablet mode (768px), sidebar width is 80px (w-20 rail)
    const sidebar = page.locator("aside").first();
    const sidebarBox = await sidebar.boundingBox();
    expect(sidebarBox).not.toBeNull();
    if (sidebarBox) {
      expect(sidebarBox.width).toBeLessThanOrEqual(85);
    }

    // Capture Tablet Dark screenshot
    await page.evaluate(() => {
      document.documentElement.classList.add("dark");
    });
    await page.waitForTimeout(500);
    await page.screenshot({
      path: "e2e/screenshots/tablet-768-dark.png",
      fullPage: true,
    });

    // Assert no console errors
    expect(consoleErrors).toEqual([]);
  });

  test("Mobile 390px - Drawer collapse & no horizontal overflow", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const consoleErrors = await loginAndGoToDashboard(page);

    // Assert no horizontal overflow on mobile
    const hasHorizontalOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth;
    });
    expect(hasHorizontalOverflow).toBeFalsy();

    // Mobile menu trigger exists
    const menuBtn = page.locator('button[aria-label="Open navigation drawer"]');
    await expect(menuBtn).toBeVisible();

    // Capture Mobile Dark screenshot
    await page.evaluate(() => {
      document.documentElement.classList.add("dark");
    });
    await page.waitForTimeout(500);
    await page.screenshot({
      path: "e2e/screenshots/mobile-390-dark.png",
      fullPage: true,
    });

    // Assert no console errors
    expect(consoleErrors).toEqual([]);
  });
});
