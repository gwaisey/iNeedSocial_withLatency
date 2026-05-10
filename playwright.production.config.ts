import { defineConfig, devices } from "@playwright/test"

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: /feed-preview-media\.spec\.ts/,
  timeout: 300_000,
  workers: 1,
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "https://i-need-social-without-latency.vercel.app",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "production-desktop-chromium",
      use: {
        ...devices["Desktop Chrome"],
      },
    },
    {
      name: "production-mobile-chromium",
      use: {
        ...devices["Pixel 7"],
      },
    },
  ],
})
