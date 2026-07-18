/**
 * Phase 158 Plan 09 (DEPLOY-02 / UI-SPEC §4, D-10) — ConnectionBindStep contract.
 *
 * Locks the bind-form rules:
 *   • the 4 Supabase keys + POSTGRES_DSN + REDIS_URL are MASKED (type=password +
 *     Eye/EyeOff); SUPABASE_URL is plain;
 *   • the always-visible OPERATOR.md A4 DSN hint (Session pooler on :5432);
 *   • per-group "Test connection" calls postValidate and renders the HealthSignals
 *     dot vocabulary (Connected / Couldn't connect — {verbatim sanitized reason});
 *   • Continue is GATED until BOTH groups test green (schema sub-check included);
 *   • schema-reachable-but-empty renders the amber SchemaGuidancePanel and keeps
 *     Continue blocked.
 */
import { useState } from "react"
import { describe, it, expect, vi, afterEach } from "vitest"
import { render, screen, cleanup, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { ConnectionBindStep } from "../ConnectionBindStep"
import { postValidate, type BindBody, type ValidateResult } from "@/lib/setupApi"

vi.mock("@/lib/setupApi", async () => {
  const actual = await vi.importActual<typeof import("@/lib/setupApi")>("@/lib/setupApi")
  return { ...actual, postValidate: vi.fn() }
})

const GREEN: ValidateResult = {
  supabase: { state: "up" },
  postgres: { state: "up", schema_present: true },
  redis: { state: "up" },
}
const SCHEMA_MISSING: ValidateResult = {
  supabase: { state: "up" },
  postgres: { state: "up", schema_present: false },
  redis: { state: "up" },
}
const SB_AUTH_DOWN: ValidateResult = {
  supabase: { state: "down", reason: "AuthApiError" },
  postgres: { state: "up", schema_present: true },
  redis: { state: "up" },
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

function Harness({ onContinue }: { onContinue?: () => void }) {
  const [value, setValue] = useState<BindBody>({})
  return (
    <ConnectionBindStep token="tok" value={value} onChange={setValue} onContinue={onContinue ?? (() => {})} />
  )
}

describe("ConnectionBindStep (D-10) — masked bind form + live per-group validation", () => {
  it("masks every secret (4 keys + DSN + Redis) with Eye/EyeOff; SUPABASE_URL is plain", () => {
    render(<Harness />)
    // Six masked secret fields → six "Show value" toggles.
    expect(screen.getAllByRole("button", { name: /show value/i })).toHaveLength(6)
    expect(screen.getByLabelText("Service role key")).toHaveAttribute("type", "password")
    expect(screen.getByLabelText("Secret key")).toHaveAttribute("type", "password")
    // The project URL is plain text (not a secret).
    expect(screen.getByLabelText("Project URL")).toHaveAttribute("type", "url")
  })

  it("shows the OPERATOR.md A4 DSN hint (Session pooler on :5432)", () => {
    render(<Harness />)
    expect(screen.getByText(/session pooler/i)).toBeInTheDocument()
    expect(screen.getByText(":5432")).toBeInTheDocument()
  })

  it("Continue is disabled until BOTH groups test green", async () => {
    const user = userEvent.setup()
    vi.mocked(postValidate).mockResolvedValue(GREEN)
    const onContinue = vi.fn()
    render(<Harness onContinue={onContinue} />)

    const continueBtn = screen.getByRole("button", { name: /^continue$/i })
    expect(continueBtn).toBeDisabled()

    const [testSupabase, testRedis] = screen.getAllByRole("button", { name: /test connection/i })
    await user.click(testSupabase)
    await screen.findByText(/schema present/i)
    // One group green is not enough.
    expect(continueBtn).toBeDisabled()

    await user.click(testRedis)
    await waitFor(() => expect(continueBtn).toBeEnabled())

    await user.click(continueBtn)
    expect(onContinue).toHaveBeenCalledTimes(1)
  })

  it("a reachable-but-empty database renders the amber SchemaGuidancePanel and keeps Continue blocked", async () => {
    const user = userEvent.setup()
    vi.mocked(postValidate).mockResolvedValue(SCHEMA_MISSING)
    render(<Harness />)

    const [testSupabase] = screen.getAllByRole("button", { name: /test connection/i })
    await user.click(testSupabase)

    expect(await screen.findByText(/reachable but empty/i)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /^continue$/i })).toBeDisabled()
  })

  it("a failed probe renders 'Couldn't connect' with the verbatim sanitized reason", async () => {
    const user = userEvent.setup()
    vi.mocked(postValidate).mockResolvedValue(SB_AUTH_DOWN)
    render(<Harness />)

    const [testSupabase] = screen.getAllByRole("button", { name: /test connection/i })
    await user.click(testSupabase)

    expect(await screen.findByText(/couldn't connect — authapierror/i)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /^continue$/i })).toBeDisabled()
  })
})
