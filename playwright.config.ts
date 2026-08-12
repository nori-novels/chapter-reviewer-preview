import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  workers: 1,
  use: {
    baseURL: process.env.PREVIEW_BASE_URL ?? "http://127.0.0.1:3200",
    screenshot: "only-on-failure",
    trace: "on-first-retry",
  },
  webServer: process.env.PREVIEW_BASE_URL
    ? undefined
    : {
        command: "npm run start -- --listen 3200",
        port: 3200,
        timeout: 120_000,
        reuseExistingServer: !process.env.CI,
      },
});
