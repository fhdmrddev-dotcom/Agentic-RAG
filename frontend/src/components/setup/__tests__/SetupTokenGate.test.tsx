/**
 * Phase 158 Plan 09 (DEPLOY-02 / UI-SPEC §1, D-15) — SetupTokenGate contract.
 *
 * Locks the token-gate rules:
 *   • the token input autofocuses and is MASKED (type=password) with an Eye/EyeOff
 *     reveal — the ProviderPicker pattern the threat model mandates (T-158-10);
 *   • a valid token calls onTokenAccepted(token, detect) with the postDetect result
 *     (the validation probe doubles as the first env-detect, D-08) and NEVER echoes
 *     the token in full — only its last 4;
 *   • a bad token (401) shows a destructive inline alert and does NOT advance;
 *   • a rate-limited token (429) shows an AMBER message and briefly disables Continue;
 *   • the logs command is copyable.
 */
import { describe, it, expect, vi, afterEach } from "vitest"
import { render, screen, cleanup, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { SetupTokenGate } from "../SetupTokenGate"
import { postDetect, SetupApiError, type DetectResult } from "@/lib/setupApi"

vi.mock("@/lib/setupApi", async () => {
  const actual = await vi.importActual<typeof import("@/lib/setupApi")>("@/lib/setupApi")
  return { ...actual, postDetect: vi.fn() }
})

const DETECT: DetectResult = {
  in_docker: true,
  store_present: false,
  db_reachable: true,
  redis_reachable: false,
}

const FULL_TOKEN = "SUPERSECRETTOKEN1234"

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe("SetupTokenGate (D-15) — masked entry, single-probe validation, honest errors", () => {
  it("autofocuses a MASKED (type=password) token input with an Eye/EyeOff reveal", async () => {
    const user = userEvent.setup()
    render(<SetupTokenGate onTokenAccepted={vi.fn()} />)

    const input = screen.getByLabelText(/setup token/i)
    expect(input).toHaveFocus()
    expect(input).toHaveAttribute("type", "password")

    // The reveal toggle flips the field to plain text and back.
    await user.click(screen.getByRole("button", { name: /show value/i }))
    expect(input).toHaveAttribute("type", "text")
    await user.click(screen.getByRole("button", { name: /hide value/i }))
    expect(input).toHaveAttribute("type", "password")
  })

  it("a valid token calls onTokenAccepted(token, detect) and echoes ONLY the last 4 — never the full token", async () => {
    const user = userEvent.setup()
    vi.mocked(postDetect).mockResolvedValue(DETECT)
    const onTokenAccepted = vi.fn()
    render(<SetupTokenGate onTokenAccepted={onTokenAccepted} />)

    await user.type(screen.getByLabelText(/setup token/i), FULL_TOKEN)
    await user.click(screen.getByRole("button", { name: /continue/i }))

    await waitFor(() => expect(onTokenAccepted).toHaveBeenCalledWith(FULL_TOKEN, DETECT))
    // The probe fired exactly once (the light detect doubles as validation, D-08).
    expect(postDetect).toHaveBeenCalledTimes(1)
    // The full token is NEVER rendered as text; the success line shows the masked last 4.
    expect(screen.queryByText(FULL_TOKEN)).not.toBeInTheDocument()
    expect(screen.getByText(/····1234/)).toBeInTheDocument()
  })

  it("a bad token (401) shows a destructive alert and does NOT advance", async () => {
    const user = userEvent.setup()
    vi.mocked(postDetect).mockRejectedValue(new SetupApiError("bad", 401, "bad"))
    const onTokenAccepted = vi.fn()
    render(<SetupTokenGate onTokenAccepted={onTokenAccepted} />)

    await user.type(screen.getByLabelText(/setup token/i), "wrong-token")
    await user.click(screen.getByRole("button", { name: /continue/i }))

    const alert = await screen.findByRole("alert")
    expect(alert).toHaveTextContent(/didn't match/i)
    expect(alert.className).toContain("text-destructive")
    expect(onTokenAccepted).not.toHaveBeenCalled()
  })

  it("a rate-limited token (429) shows an AMBER message and disables Continue briefly", async () => {
    const user = userEvent.setup()
    vi.mocked(postDetect).mockRejectedValue(new SetupApiError("slow down", 429, "slow down"))
    render(<SetupTokenGate onTokenAccepted={vi.fn()} />)

    await user.type(screen.getByLabelText(/setup token/i), "too-many")
    await user.click(screen.getByRole("button", { name: /continue/i }))

    const alert = await screen.findByRole("alert")
    expect(alert).toHaveTextContent(/too many tries/i)
    // Amber (warn), NOT destructive/red — a rate limit is "wait", not a failure.
    expect(alert.className).toMatch(/amber/)
    expect(alert.className).not.toContain("text-destructive")
    expect(screen.getByRole("button", { name: /continue/i })).toBeDisabled()
  })

  it("copies the logs command to the clipboard", async () => {
    const user = userEvent.setup()
    // Override AFTER setup — userEvent installs its own clipboard stub on setup().
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true })
    render(<SetupTokenGate onTokenAccepted={vi.fn()} />)

    await user.click(screen.getByRole("button", { name: /copy the logs command/i }))
    expect(writeText).toHaveBeenCalledWith("docker compose logs backend")
  })
})
