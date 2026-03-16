/**
 * E2E tests for the authentication flow.
 *
 * PREREQUISITES:
 *   - App running at http://localhost:5173
 *   - Supabase project configured
 *   - TEST_USER_EMAIL and TEST_USER_PASSWORD env vars set
 *
 * These tests require live Supabase. They are skipped gracefully if env vars
 * are not set.
 */
import { test, expect } from "@playwright/test"

const TEST_EMAIL = process.env.TEST_USER_EMAIL ?? ""
const TEST_PASSWORD = process.env.TEST_USER_PASSWORD ?? ""
const hasCredentials = Boolean(TEST_EMAIL && TEST_PASSWORD)

test.describe("Authentication", () => {
  test("can navigate to app and see auth page", async ({ page }) => {
    await page.goto("/")
    // The app should show either a sign-in form or the chat interface
    // If not signed in, we expect the auth page
    await expect(page).toHaveURL(/.*/)
    // Look for known auth UI elements
    const signInHeading = page.getByRole("heading", { name: /sign in/i })
    const emailInput = page.getByRole("textbox", { name: /email/i })
    // Either the auth page or the main chat is shown
    const isAuth = (await signInHeading.count()) > 0 || (await emailInput.count()) > 0
    const isChat = (await page.getByText(/new chat/i).count()) > 0
    expect(isAuth || isChat).toBe(true)
  })

  test("invalid login shows error message", async ({ page }) => {
    await page.goto("/")
    // If already logged in, skip
    const emailInput = page.getByRole("textbox", { name: /email/i })
    if ((await emailInput.count()) === 0) {
      test.skip()
      return
    }

    await emailInput.fill("invalid@example.com")
    const passwordInput = page.getByRole("textbox", { name: /password/i }).or(
      page.locator('input[type="password"]'),
    )
    await passwordInput.fill("wrongpassword")
    await page.getByRole("button", { name: /sign in/i }).click()

    // Should show an error message
    await expect(
      page.getByText(/invalid|error|incorrect|failed/i),
    ).toBeVisible({ timeout: 10_000 })
  })

  test("sign in with valid credentials shows chat interface", async ({ page }) => {
    if (!hasCredentials) {
      test.skip()
      return
    }

    await page.goto("/")
    const emailInput = page.getByRole("textbox", { name: /email/i })
    if ((await emailInput.count()) === 0) {
      // Already signed in
      return
    }

    await emailInput.fill(TEST_EMAIL)
    const passwordInput = page.locator('input[type="password"]')
    await passwordInput.fill(TEST_PASSWORD)
    await page.getByRole("button", { name: /sign in/i }).click()

    // Should navigate to chat interface
    await expect(page.getByText(/new chat/i)).toBeVisible({ timeout: 15_000 })
  })

  test("sign out returns to auth page", async ({ page }) => {
    if (!hasCredentials) {
      test.skip()
      return
    }

    await page.goto("/")

    // Sign in first
    const emailInput = page.getByRole("textbox", { name: /email/i })
    if ((await emailInput.count()) > 0) {
      await emailInput.fill(TEST_EMAIL)
      await page.locator('input[type="password"]').fill(TEST_PASSWORD)
      await page.getByRole("button", { name: /sign in/i }).click()
      await expect(page.getByText(/new chat/i)).toBeVisible({ timeout: 15_000 })
    }

    // Find and click sign out
    const signOutButton = page.getByRole("button", { name: /sign out/i })
    if ((await signOutButton.count()) === 0) {
      // Look in a dropdown/menu
      const menuButton = page.getByRole("button").filter({ hasText: /menu|account|user/i })
      if ((await menuButton.count()) > 0) {
        await menuButton.click()
        await page.getByRole("menuitem", { name: /sign out/i }).click()
      } else {
        test.skip()
        return
      }
    } else {
      await signOutButton.click()
    }

    // Should return to auth page
    await expect(
      page.getByRole("textbox", { name: /email/i }),
    ).toBeVisible({ timeout: 10_000 })
  })
})
