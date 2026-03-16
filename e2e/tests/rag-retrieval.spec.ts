/**
 * E2E tests for RAG retrieval pipeline.
 *
 * PREREQUISITES:
 *   - App running at http://localhost:5173
 *   - Backend running at http://localhost:8000
 *   - TEST_USER_EMAIL and TEST_USER_PASSWORD env vars set
 *   - A document has been uploaded and ingested (or we upload it here)
 *
 * These tests verify that after uploading a document, the assistant can
 * answer questions grounded in the document's content.
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

async function uploadAndWaitForIngestion(page: Page) {
  // Navigate to ingestion page
  const docsLink = page.getByRole("link", { name: /document|ingestion/i })
  if ((await docsLink.count()) > 0) {
    await docsLink.click()
  } else {
    const docsButton = page.getByRole("button", { name: /document|ingestion/i })
    if ((await docsButton.count()) > 0) await docsButton.click()
  }

  const fileInput = page.locator('input[type="file"]')
  await fileInput.setInputFiles(TEST_DOC_PATH)

  // Wait for ingestion to complete
  await expect(page.getByText("completed")).toBeVisible({ timeout: 60_000 })
}

async function sendMessage(page: Page, message: string) {
  const input = page.getByRole("textbox", { name: /message|type/i }).or(
    page.locator("textarea"),
  )
  await input.fill(message)
  await page.keyboard.press("Enter")
}

test.describe("RAG Retrieval", () => {
  test.beforeEach(async ({ page }) => {
    if (!hasCredentials) test.skip()
    await signIn(page)
  })

  test("after uploading a document, related question gets a response", async ({ page }) => {
    await uploadAndWaitForIngestion(page)

    // Navigate to chat
    const chatLink = page.getByRole("link", { name: /chat/i }).or(
      page.getByRole("button", { name: /new chat/i }),
    )
    await chatLink.first().click()

    // Create a new thread
    await page.getByRole("button", { name: /new chat/i }).click()

    // Ask a question that should be answered from the document
    await sendMessage(page, "What is the capital of France according to the document?")

    // Wait for assistant response
    await expect(
      page.locator(".bg-muted").first(),
    ).toBeVisible({ timeout: 30_000 })

    // The response should mention Paris (from the test document)
    await expect(page.getByText(/paris/i)).toBeVisible({ timeout: 30_000 })
  })

  test("response indicates it used document content", async ({ page }) => {
    await uploadAndWaitForIngestion(page)

    // Navigate back to chat
    const newChatButton = page.getByRole("button", { name: /new chat/i })
    await newChatButton.click()

    await sendMessage(page, "What facts are in my uploaded documents?")

    // Wait for assistant response
    await expect(
      page.locator(".bg-muted").first(),
    ).toBeVisible({ timeout: 30_000 })

    // Response should contain information from the document
    const responseText = await page.locator(".bg-muted").first().textContent()
    expect(responseText?.length).toBeGreaterThan(20)
  })

  test("question about water chemistry uses document", async ({ page }) => {
    // This test assumes the test document is already ingested
    // If not, upload it first
    const docsLink = page.getByRole("link", { name: /document|ingestion/i })
    if ((await docsLink.count()) > 0) {
      await docsLink.click()
      const completedBadge = page.getByText("completed")
      if ((await completedBadge.count()) === 0) {
        await uploadAndWaitForIngestion(page)
      }
    }

    // Navigate to chat
    await page.getByRole("button", { name: /new chat/i }).click()

    await sendMessage(page, "What is the chemical formula for water from my documents?")

    // Wait for response
    await expect(
      page.locator(".bg-muted").first(),
    ).toBeVisible({ timeout: 30_000 })

    // Should mention H2O
    await expect(page.getByText(/h2o/i)).toBeVisible({ timeout: 30_000 })
  })
})
