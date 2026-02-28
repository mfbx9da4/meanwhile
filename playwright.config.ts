import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  snapshotDir: "e2e/screenshots",
  use: {
    baseURL: "http://localhost:5173/meanwhile/",
  },
  projects: [
    {
      name: "chromium",
      use: { browserName: "chromium" },
    },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:5173/meanwhile/",
    reuseExistingServer: true,
  },
  expect: {
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.002,
    },
  },
});
