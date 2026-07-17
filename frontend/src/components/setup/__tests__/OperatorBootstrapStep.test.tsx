/**
 * Phase 158 Plan 10 (DEPLOY-02 / UI-SPEC §5, D-11) — OperatorBootstrapStep contract.
 *
 * Locks the operator-bootstrap rules:
 *   • plain "admin login" framing; password + confirm are MASKED (type=password) with
 *     one Eye/EyeOff reveal;
 *   • Continue is GATED on a valid email + matching passwords + the minimum length;
 *   • a confirm-mismatch is an inline DESTRUCTIVE alert AND blocks; a weak-but-above-
 *     minimum password is an AMBER advisory that does NOT block;
 *   • postOperator success shows "Admin account created" then Continue → onCreated;
 *   • a duplicate resolves to an honest "already exists" (idempotent, D-14);
 *   • a GoTrue 400 renders the server message VERBATIM (never a generic failure).
 */
import { useState } from "react"
import { describe, it, expect, vi, afterEach } from "vitest"
import { render, screen, cleanup, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { OperatorBootstrapStep } from "../OperatorBootstrapStep"
import { postOperator, SetupApiError, type OperatorResult } from "@/lib/setupApi"

vi.mock("@/lib/setupApi", async () => {
  const actual = await vi.importActual<typeof import("@/lib/setupApi")>("@/lib/setupApi")
  return { ...actual, postOperator: vi.fn() }
})

const CREATED: OperatorResult = { status: "created", already_exists: false, user_id: "u1" }
const DUP: OperatorResult = { status: "already_exists", already_exists: true, user_id: "u1" }

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

function Harness({ onCreated }: { onCreated?: () => void }) {
  const [email, setEmail] = useState("")
  return (
    <OperatorBootstrapStep
      token="tok"
      email={email}
      onEmailChange={setEmail}
      onCreated={onCreated ?? (() => {})}
    />
  )
}

describe("OperatorBootstrapStep (D-11) — gated admin-login bootstrap", () => {
  it("masks password + confirm with an Eye/EyeOff reveal and frames it as the admin login", async () => {
    const user = userEvent.setup()
    render(<Harness />)

    expect(screen.getByText("admin login")).toBeInTheDocument()
    expect(screen.getByLabelText("Password")).toHaveAttribute("type", "password")
    expect(screen.getByLabelText("Confirm password")).toHaveAttribute("type", "password")

    await user.type(screen.getByLabelText("Password"), "x")
    await user.click(screen.getByRole("button", { name: /show password/i }))
    expect(screen.getByLabelText("Password")).toHaveAttribute("type", "text")
  })

  it("gates Continue until a valid email + matching passwords + minimum length", async () => {
    const user = userEvent.setup()
    render(<Harness />)

    const submit = screen.getByRole("button", { name: /create admin account/i })
    expect(submit).toBeDisabled()

    await user.type(screen.getByLabelText("Email"), "admin@example.com")
    await user.type(screen.getByLabelText("Password"), "SuperSecret9")
    // Password valid but confirm still empty → gated.
    expect(submit).toBeDisabled()

    await user.type(screen.getByLabelText("Confirm password"), "SuperSecret9")
    expect(submit).toBeEnabled()
  })

  it("a confirm-mismatch shows a destructive alert and blocks", async () => {
    const user = userEvent.setup()
    render(<Harness />)

    await user.type(screen.getByLabelText("Email"), "admin@example.com")
    await user.type(screen.getByLabelText("Password"), "SuperSecret9")
    await user.type(screen.getByLabelText("Confirm password"), "Mismatched9")

    const alert = screen.getByRole("alert")
    expect(alert).toHaveTextContent(/don't match/i)
    expect(alert.className).toContain("text-destructive")
    expect(screen.getByRole("button", { name: /create admin account/i })).toBeDisabled()
  })

  it("a weak-but-long-enough password is an AMBER advisory that does NOT block", async () => {
    const user = userEvent.setup()
    render(<Harness />)

    await user.type(screen.getByLabelText("Email"), "admin@example.com")
    await user.type(screen.getByLabelText("Password"), "aaaaaaaa")
    await user.type(screen.getByLabelText("Confirm password"), "aaaaaaaa")

    const advisory = screen.getByText(/password is weak/i)
    expect(advisory.className).toMatch(/amber/)
    expect(advisory.className).not.toContain("text-destructive")
    // Weak ≠ blocked — the ONLY strength gate is the minimum length.
    expect(screen.getByRole("button", { name: /create admin account/i })).toBeEnabled()
  })

  it("creates the account then advances via Continue → onCreated", async () => {
    const user = userEvent.setup()
    vi.mocked(postOperator).mockResolvedValue(CREATED)
    const onCreated = vi.fn()
    render(<Harness onCreated={onCreated} />)

    await user.type(screen.getByLabelText("Email"), "admin@example.com")
    await user.type(screen.getByLabelText("Password"), "SuperSecret9")
    await user.type(screen.getByLabelText("Confirm password"), "SuperSecret9")
    await user.click(screen.getByRole("button", { name: /create admin account/i }))

    expect(await screen.findByText(/admin account created/i)).toBeInTheDocument()
    expect(postOperator).toHaveBeenCalledWith("tok", expect.objectContaining({ email: "admin@example.com", password: "SuperSecret9" }))

    await user.click(screen.getByRole("button", { name: /^continue$/i }))
    expect(onCreated).toHaveBeenCalledTimes(1)
  })

  it("a duplicate email resolves to an honest 'already exists' (idempotent)", async () => {
    const user = userEvent.setup()
    vi.mocked(postOperator).mockResolvedValue(DUP)
    render(<Harness />)

    await user.type(screen.getByLabelText("Email"), "admin@example.com")
    await user.type(screen.getByLabelText("Password"), "SuperSecret9")
    await user.type(screen.getByLabelText("Confirm password"), "SuperSecret9")
    await user.click(screen.getByRole("button", { name: /create admin account/i }))

    expect(await screen.findByText(/already exists/i)).toBeInTheDocument()
  })

  it("renders a GoTrue password-policy 400 message VERBATIM", async () => {
    const user = userEvent.setup()
    vi.mocked(postOperator).mockRejectedValue(
      new SetupApiError("Password should be at least 6 characters.", 400, "Password should be at least 6 characters."),
    )
    render(<Harness />)

    await user.type(screen.getByLabelText("Email"), "admin@example.com")
    await user.type(screen.getByLabelText("Password"), "SuperSecret9")
    await user.type(screen.getByLabelText("Confirm password"), "SuperSecret9")
    await user.click(screen.getByRole("button", { name: /create admin account/i }))

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("Password should be at least 6 characters."),
    )
  })
})
