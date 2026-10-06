import { defineConfig } from "@playwright/test";

const port = Number(process.env.BLIPO_E2E_PORT ?? "4599");

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run build && node scripts/e2e-launch.mjs",
    url: `http://127.0.0.1:${port}/`,
    reuseExistingServer: false,
    timeout: 300_000,
    env: {
      BLIPO_E2E_PORT: String(port),
    },
  },
});
