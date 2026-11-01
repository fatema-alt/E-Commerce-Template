import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 60000,
  expect: {
    timeout: 15000,
  },
  fullyParallel: false,
  reporter: [["list"]],
  use: {
    baseURL: process.env.PLAYWRIGHT_TEST_BASE_URL || "http://localhost:3001",
    trace: "on-first-retry",
    video: "off",
    browserName: "chromium",
  },
  projects: [
    {
      name: "chromium",
    },
  ],
});
