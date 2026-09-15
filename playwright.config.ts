import { defineConfig, devices } from "@playwright/test";

// Keep browser tests isolated from any production-style dotenv files that
// Next.js may load for `next start`.
const localTestEnvironment = {
  DATABASE_URL:
    "postgresql://degreepath:degreepath@127.0.0.1:54329/degreepath?schema=public",
  AUTH_SECRET: "degreepath-e2e-only-secret-not-for-production",
  AUTH_URL: "http://127.0.0.1:3000",
  AUTH_TRUST_HOST: "false",
};

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 60000,
  expect: { timeout: 10000 },
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://127.0.0.1:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    ...devices["Desktop Chrome"],
    channel: "chrome",
  },
  webServer: {
    command: "npm run start",
    env: localTestEnvironment,
    url: "http://127.0.0.1:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
