/**
 * Phase 158 Plan 10 (DEPLOY-02 / UI-SPEC §9, D-14 / SC#2) — FinalizedLockout contract.
 *
 * Locks the already-configured lock-out rules:
 *   • "Setup is already complete." with NO config fields and NO re-entry (D-14);
 *   • a single "Go to the app" CTA → onGoToApp;
 *   • the D-07 login-fallback restart note is present as a quiet secondary line.
 */
import { describe, it, expect, vi, afterEach } from "vitest"
import { render, screen, cleanup } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { FinalizedLockout } from "../FinalizedLockout"

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe("FinalizedLockout (SC#2 / D-14) — already-configured lock-out", () => {
  it("shows the already-complete card with NO config fields", () => {
    render(<FinalizedLockout onGoToApp={vi.fn()} />)
    expect(screen.getByText(/already complete/i)).toBeInTheDocument()
    // No re-entry: not a single text/secret field on the lock-out surface.
    expect(screen.queryAllByRole("textbox")).toHaveLength(0)
  })

  it("routes to the app via the single CTA", async () => {
    const user = userEvent.setup()
    const onGoToApp = vi.fn()
    render(<FinalizedLockout onGoToApp={onGoToApp} />)

    await user.click(screen.getByRole("button", { name: /go to the app/i }))
    expect(onGoToApp).toHaveBeenCalledTimes(1)
  })

  it("carries the quiet D-07 restart login-fallback note", () => {
    render(<FinalizedLockout onGoToApp={vi.fn()} />)
    expect(screen.getByText(/docker compose restart/i)).toBeInTheDocument()
    expect(screen.getByText(/if login doesn't work right away/i)).toBeInTheDocument()
  })
})
