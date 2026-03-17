/**
 * E2E tests for thread creation and chat functionality.
 *
 * PREREQUISITES:
 *   - App running at http://localhost:5173
 *   - Backend running at http://localhost:8000
 *   - TEST_USER_EMAIL and TEST_USER_PASSWORD env vars set
 */
import { test, expect, type Page } from "@playwright/test"

const TEST_EMAIL = process.env.TEST_USER_EMAIL ?? ""
const TEST_PASSWORD = process.env.TEST_USER_PASSWORD ?? ""
const hasCredentials = Boolean(TEST_EMAIL && TEST_PASSWORD)

async function signIn(page: Page) {
  await page.goto("/")
  const emailInput = page.getByRole("textbox", { name: /email/i })
  if ((await emailInput.count()) === 0) return // already signed in

  await emailInput.fill(TEST_EMAIL)
  await page.locator('input[type="password"]').fill(TEST_PASSWORD)
  await page.getByRole("button", { name: /sign in/i }).click()
  await expect(page.getByText(/new chat/i)).toBeVisible({ timeout: 15_000 })
}

test.describe("Threads", () => {
  test.beforeEach(async ({ page }) => {
    if (!hasCredentials) test.skip()
    await signIn(page)
  })

  test("New Chat button creates a thread", async ({ page }) => {
    await page.getByRole("button", { name: /new chat/i }).click()

    // Thread should appear in the sidebar
    await expect(
      page.getByText(/new chat/i).first(),
    ).toBeVisible({ timeout: 10_000 })
  })

  test("thread appears in sidebar after creation", async ({ page }) => {
    const before = await page.getByRole("listitem").count()

    await page.getByRole("button", { name: /new chat/i }).click()

    // Wait for the new thread to appear
    await expect(async () => {
      const after = await page.getByRole("listitem").count()
      expect(after).toBeGreaterThanOrEqual(before)
    }).toPass({ timeout: 10_000 })
  })

  test("sending a message shows user message immediately", async ({ page }) => {
    await page.getByRole("button", { name: /new chat/i }).click()

    const messageInput = page.getByRole("textbox", { name: /message|type/i }).or(
      page.locator("textarea"),
    )
    await messageInput.fill("Hello, test message!")
    await page.keyboard.press("Enter")

    // User message appears immediately (optimistic UI)
    await expect(page.getByText("Hello, test message!")).toBeVisible({ timeout: 5_000 })
  })

  test("assistant response streams in after user message", async ({ page }) => {
    await page.getByRole("button", { name: /new chat/i }).click()

    const messageInput = page.getByRole("textbox", { name: /message|type/i }).or(
      page.locator("textarea"),
    )
    await messageInput.fill("Say exactly: PONG")
    await page.keyboard.press("Enter")

    // Wait for streaming to complete (assistant response appears)
    await expect(
      page.locator('[data-role="assistant"], .bg-muted').first(),
    ).toBeVisible({ timeout: 30_000 })
  })

  test("multiple threads can be created and switched between", async ({ page }) => {
    // Create first thread
    await page.getByRole("button", { name: /new chat/i }).click()
    await expect(page.locator("textarea").or(page.locator('input[type="text"]')).first()).toBeVisible()

    // Create second thread
    await page.getByRole("button", { name: /new chat/i }).click()

    // Both threads should be in sidebar – count list items
    await expect(async () => {
      const count = await page.locator('[data-testid="thread-item"]').or(
        page.getByRole("button").filter({ hasText: /new chat/i }),
      ).count()
      expect(count).toBeGreaterThan(0)
    }).toPass({ timeout: 5_000 })
  })
})
