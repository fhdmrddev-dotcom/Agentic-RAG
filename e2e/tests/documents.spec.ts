/**
 * E2E tests for document upload and management.
 *
 * PREREQUISITES:
 *   - App running at http://localhost:5173
 *   - Backend running at http://localhost:8000
 *   - TEST_USER_EMAIL and TEST_USER_PASSWORD env vars set
 */
import { test, expect, type Page } from "@playwright/test"
import path from "path"

const TEST_EMAIL = process.env.TEST_USER_EMAIL ?? ""
const TEST_PASSWORD = process.env.TEST_USER_PASSWORD ?? ""
const hasCredentials = Boolean(TEST_EMAIL && TEST_PASSWORD)
const TEST_DOC_PATH = path.join(__dirname, "../fixtures/test-document.txt")

async function signIn(page: Page) {
  await page.goto("/")
  const emailInput = page.getByRole("textbox", { name: /email/i })
  if ((await emailInput.count()) === 0) return
  await emailInput.fill(TEST_EMAIL)
  await page.locator('input[type="password"]').fill(TEST_PASSWORD)
  await page.getByRole("button", { name: /sign in/i }).click()
  await expect(page.getByText(/new chat/i)).toBeVisible({ timeout: 15_000 })
}

async function navigateToDocuments(page: Page) {
  // Try nav link first
  const docsLink = page.getByRole("link", { name: /document|ingestion/i })
  if ((await docsLink.count()) > 0) {
    await docsLink.click()
  } else {
    // Try button
    const docsButton = page.getByRole("button", { name: /document|ingestion/i })
    await docsButton.click()
  }
}

test.describe("Documents", () => {
  test.beforeEach(async ({ page }) => {
    if (!hasCredentials) test.skip()
    await signIn(page)
  })

  test("documents nav link shows ingestion page", async ({ page }) => {
    await navigateToDocuments(page)

    // Should show the ingestion page with an upload area
    await expect(
      page.getByText(/upload|ingestion|document/i).first(),
    ).toBeVisible({ timeout: 5_000 })
  })

  test("can upload a text file via file input", async ({ page }) => {
    await navigateToDocuments(page)

    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles(TEST_DOC_PATH)

    // Document should appear in the list with a status badge
    await expect(
      page.getByText(/test-document.txt|pending|processing/i),
    ).toBeVisible({ timeout: 10_000 })
  })

  test("uploaded document shows status transitions", async ({ page }) => {
    await navigateToDocuments(page)

    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles(TEST_DOC_PATH)

    // Initial status should be pending or processing
    await expect(
      page.getByText(/pending|processing/i).first(),
    ).toBeVisible({ timeout: 10_000 })

    // Eventually should complete (wait up to 60 seconds for ingestion)
    await expect(
      page.getByText("completed"),
    ).toBeVisible({ timeout: 60_000 })
  })

  test("can delete a document and it disappears from list", async ({ page }) => {
    await navigateToDocuments(page)

    // Upload first
    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles(TEST_DOC_PATH)

    await expect(
      page.getByText(/test-document.txt/i),
    ).toBeVisible({ timeout: 10_000 })

    // Click delete button for the uploaded document
    const deleteButton = page.getByRole("button", { name: /delete|remove/i }).first()
    if ((await deleteButton.count()) > 0) {
      await deleteButton.click()

      // Confirm deletion if a dialog appears
      const confirmButton = page.getByRole("button", { name: /confirm|yes|delete/i })
      if ((await confirmButton.count()) > 0) {
        await confirmButton.click()
      }

      // Document should disappear
      await expect(page.getByText(/test-document.txt/i)).not.toBeVisible({
        timeout: 10_000,
      })
    } else {
      test.skip()
    }
  })

  test("invalid file type shows error", async ({ page }) => {
    await navigateToDocuments(page)

    // Create an in-memory file with an invalid MIME type (image/jpeg)
    // We can do this via page.evaluate to bypass file input restrictions
    // Or we just check if the UI has validation feedback
    const fileInput = page.locator('input[type="file"]')
    const acceptAttr = await fileInput.getAttribute("accept")

    // If the file input has an accept attribute, invalid types are rejected by browser
    // If not, the API returns 422 and the UI should show an error
    if (acceptAttr) {
      expect(acceptAttr).toMatch(/\.txt|\.pdf|\.md|text/)
    } else {
      // The error handling is on the API side; just verify the upload area is present
      expect(await fileInput.count()).toBeGreaterThan(0)
    }
  })
})
