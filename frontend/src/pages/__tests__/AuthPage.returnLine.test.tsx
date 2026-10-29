/**
 * Phase 299-05 (LINK-06 / D-22 / S5 / T-299-14) — the quiet return line on the sign-in card.
 *
 * Signed out on an entity address, the card says one quiet line UNDER the form naming only the
 * KIND of thing the link opens — never its title, because a signed-out visitor may not learn it.
 * On chat home, a view address or anything that does not parse, there is no line. The forms
 * themselves are untouched (SignInForm.test.tsx pins them); the line is AuthPage's sibling.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"

vi.mock("@/lib/api", () => ({ getSsoRoute: vi.fn() }))
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ signInWithSSO: vi.fn() }) }))

import { AuthPage } from "@/pages/AuthPage"

const RUN_ID = "229f45ae-c85e-4707-a46c-bf4787541547"
const SIGNIN_LINE = "After you sign in, you'll go to a workflow run."
const SIGNUP_LINE = "After you sign up, you'll go to a workflow run."

function at(path: string) {
  window.history.replaceState(null, "", path)
}
function renderPage() {
  return render(<AuthPage onSignIn={vi.fn().mockResolvedValue(undefined)} onSignUp={vi.fn().mockResolvedValue(undefined)} />)
}

beforeEach(() => at("/"))
afterEach(() => at("/"))

describe("AuthPage — the quiet return line (S5)", () => {
  it("on a run address the sign-in card names the kind, under the form", () => {
    at(`/app/runs/${RUN_ID}`)
    const { container } = renderPage()
    const line = screen.getByText(SIGNIN_LINE)
    expect(line.tagName).toBe("P")
    expect(line.className).toContain("text-xs")
    expect(line.className).toContain("text-muted-foreground")
    // Under the form: the line follows the form in document order.
    const form = container.querySelector("form")
    expect(form).not.toBeNull()
    expect(form!.compareDocumentPosition(line) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it("after switching to sign-up the line says sign up", () => {
    at(`/app/runs/${RUN_ID}`)
    renderPage()
    fireEvent.click(screen.getByRole("button", { name: /sign up/i }))
    expect(screen.getByText(SIGNUP_LINE)).toBeInTheDocument()
    expect(screen.queryByText(SIGNIN_LINE)).toBeNull()
  })

  it.each(["/app", "/", "/app/library", "/https://evil.com", "/nonsense"])("%s shows no line", (path) => {
    at(path)
    renderPage()
    expect(screen.queryByText(/After you sign (in|up), you'll go to/)).toBeNull()
  })

  it("the line is React text: markup in the address is never rendered as HTML", () => {
    at(`/app/runs/${RUN_ID}`)
    const { container } = renderPage()
    expect(container.innerHTML).not.toContain("<script")
    expect(screen.getByText(SIGNIN_LINE).children.length).toBe(0)
  })
})
