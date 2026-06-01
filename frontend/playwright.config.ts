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
import { readFileSync } from "node:fs"
import { resolve } from "node:path"

// E2E env bootstrap (092.5 de-rot). The db-teardown fixture needs SUPABASE_URL +
// SUPABASE_SERVICE_ROLE_KEY (the LOCAL service-role key) to clean the test user's
// rows between scenarios. They live in backend/.env (local-pointed by default).
// Load them here — only if not already set — so a plain `npx playwright test`
// works without manually exporting them first (the prior failure: all 17 specs
// died on "SUPABASE_URL ... (unset)"). SAFETY: the db-teardown LOCALHOST_RE guard
// still INDEPENDENTLY refuses any non-localhost SUPABASE_URL, so this can never
// target a production DB; CI / an explicit env always wins (we never overwrite).
for (const key of ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]) {
  if (process.env[key]) continue
  for (const candidate of ["../backend/.env", "backend/.env"]) {
    try {
      const file = readFileSync(resolve(process.cwd(), candidate), "utf-8")
      const line = file.split(/\r?\n/).find((l) => l.startsWith(`${key}=`))
      if (line) {
        process.env[key] = line.slice(key.length + 1).trim().replace(/^["']|["']$/g, "")
        break
      }
    } catch {
      // candidate path absent — try the next, else env must come from the runner
    }
  }
}

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
