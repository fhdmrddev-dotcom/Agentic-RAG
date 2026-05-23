// Phase 075.4 Plan 05 Task 2 — Playwright E2E config (Wave 0 bootstrap).
//
// Plan 06 ships the 6 scenarios that ride on this config + the 3 fixtures
// under tests/e2e/fixtures/. Workers forced to 1 because db-teardown shares
// state across scenarios — parallel runs would race on the same test user's
// runs/messages/threads rows. `fullyParallel: false` keeps that explicit.
//
// FORWARD-REF: when Phase 079 enables --workers N on the backend, the E2E
// scenarios that exercise parallel-thread state (scenario-01-parallel-composers)
// will still run on a single Playwright worker — the parallelism is in the
// scenario, not in the test runner.

import { defineConfig } from "@playwright/test"

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: /scenario-\d+-.+\.spec\.ts$/,
  fullyParallel: false, // DB-teardown shared state — see header note
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: process.env.E2E_BASE_URL || "http://localhost:5173",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
})
