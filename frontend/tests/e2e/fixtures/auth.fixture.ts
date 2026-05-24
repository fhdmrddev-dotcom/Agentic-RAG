// Phase 075.4 Plan 05 Task 2 — env-driven auth fixture (Wave 0 bootstrap).
//
// Credentials are NOT committed: process.env.E2E_USER_EMAIL /
// E2E_USER_PASSWORD with the local dev defaults (fhdmrd@gmail.com / 123456)
// as fallback per D-075.4-G1. CI MUST supply secrets via GitHub Actions.
// Local dev acceptable per memory reference_local_dev_app.md.
//
// Threat T-075.4-07 mitigation: defaults are the documented local test
// login already in repo memory; production paths NEVER use this fixture.
// A dedicated test-user creation flow is deferred to v3.0 multi-tenancy.

import { test as base, Page, expect } from "@playwright/test"

const DEFAULT_EMAIL = "fhdmrd@gmail.com"
const DEFAULT_PASSWORD = "123456"

export interface AuthedFixtures {
  authedPage: Page
}

export const test = base.extend<AuthedFixtures>({
  authedPage: async ({ page }, use) => {
    const email = process.env.E2E_USER_EMAIL || DEFAULT_EMAIL
    const password = process.env.E2E_USER_PASSWORD || DEFAULT_PASSWORD

    // Navigate to the login route. Vite dev server defaults to /login;
    // baseURL is set in playwright.config.ts (http://localhost:5173).
    await page.goto("/login")

    // Form fill + submit. Selectors deliberately broad (label / placeholder /
    // role) so a future Settings-UI redesign that swaps the input types
    // doesn't immediately break this fixture.
    await page
      .getByLabel(/email/i)
      .or(page.getByPlaceholder(/email/i))
      .first()
      .fill(email)

    await page
      .getByLabel(/password/i)
      .or(page.getByPlaceholder(/password/i))
      .first()
      .fill(password)

    await page
      .getByRole("button", { name: /sign in|log in|login/i })
      .first()
      .click()

    // App quirk: the /login route does NOT redirect after successful auth —
    // it just re-renders the chat surface inline while the URL stays /login
    // (verified via Chrome MCP 2026-05-24 during 075.7 UAT). Asserting on
    // URL change is a false-positive trap. Assert on the chat-surface's
    // stable visible landmark: the "Ask anything…" composer is the post-auth
    // gate that's present on every authenticated render.
    await expect(
      page.getByPlaceholder(/ask anything/i).first()
    ).toBeVisible({ timeout: 15_000 })

    await use(page)
  },
})

export { expect } from "@playwright/test"
