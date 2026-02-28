import { test, expect } from "@playwright/test";

test("landscape monthly view alignment", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });

  // Dismiss landing overlay and set monthly view before navigating
  await page.addInitScript(() => {
    localStorage.setItem("meanwhile-landing-seen", "true");
    localStorage.setItem("pregnancy-visualizer-view-mode", "monthly");
  });

  await page.goto("/");
  await page.waitForSelector(".landscape-monthly-wrapper", { state: "visible" });

  await expect(page).toHaveScreenshot("landscape-monthly.png");
});
