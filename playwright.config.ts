import { defineConfig, devices } from "@playwright/test";

// Next allows one dev server per project, so tests reuse `pnpm dev` when it is already running.
const PORT = Number(process.env.E2E_PORT ?? 3000);

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 45_000,
  retries: 0,
  // One at a time: the tests share one dev server and a free-tier Supabase project, and the
  // "core moment within 3 seconds" check should measure the app, not contention between tests.
  // Two workers put a second Mapbox globe on the same machine, and that budget lost the race
  // once phase 5 grew the suite. The whole run is green at one worker.
  workers: 1,
  use: { baseURL: `http://localhost:${PORT}`, trace: "retain-on-failure" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
    { name: "phone", use: { ...devices["Pixel 7"] } },
  ],
  webServer: { command: `pnpm dev -p ${PORT}`, url: `http://localhost:${PORT}`, reuseExistingServer: true, timeout: 60_000 },
});
