import { defineConfig, devices } from "@playwright/test"

/**
 * Playwright configuration for E2E tests.
 *
 * REQUIREMENTS:
 *   - Frontend running at http://localhost:5173  (npm run dev in frontend/)
 *   - Backend running at http://localhost:8000   (uvicorn in backend/)
 *   - Real Supabase project configured via env vars
 *
 * Set these environment variables before running:
 *   TEST_USER_EMAIL=your-test-user@example.com
 *   TEST_USER_PASSWORD=your-test-password
 */
export default defineConfig({
  testDir: "./tests",
  timeout: 30_000,
  retries: 1,

  use: {
    baseURL: "http://localhost:5173",
    screenshot: "only-on-failure",
    video: "on-first-retry",
    trace: "on-first-retry",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  // Do NOT start a webserver automatically – tests expect the app to already be running
})
