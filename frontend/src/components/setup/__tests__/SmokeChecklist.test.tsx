/**
 * Phase 158 Plan 10 (DEPLOY-02 / UI-SPEC §7-§8, D-13/D-14) — SmokeChecklist contract.
 *
 * Locks the finalize-gate rules:
 *   • five rows render, a not-yet-run row is NEUTRAL ("Not checked yet") — never
 *     optimistically green;
 *   • Finalize is DISABLED until all rows are green on server truth;
 *   • all-green (postSmoke) → Finalize opens the irreversible-lock confirm → confirm
 *     (postFinalize) → onFinalized;
 *   • a red row BLOCKS Finalize and offers a "Back to fix" jump to the owning step.
 */
import { useState } from "react"
import { describe, it, expect, vi, afterEach } from "vitest"
import { render, screen, cleanup, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { SmokeChecklist } from "../SmokeChecklist"
import {
  postSmoke,
  postFinalize,
  type SmokeBody,
  type FinalizeBody,
  type SmokeResult,
  type FinalizeResult,
  type SmokeCheckId,
} from "@/lib/setupApi"

vi.mock("@/lib/setupApi", async () => {
  const actual = await vi.importActual<typeof import("@/lib/setupApi")>("@/lib/setupApi")
  return { ...actual, postSmoke: vi.fn(), postFinalize: vi.fn() }
})

const GREEN: SmokeResult = {
  all_green: true,
  checks: {
    supabase_auth: { state: "up" },
    postgres_schema: { state: "up" },
    redis_ping: { state: "up" },
    provider_key: { state: "up" },
    operator_row: { state: "up" },
  },
}
const RED: SmokeResult = {
  all_green: false,
  checks: {
    supabase_auth: { state: "up" },
    postgres_schema: { state: "up" },
    redis_ping: { state: "up" },
    provider_key: { state: "down", reason: "AuthenticationError" },
    operator_row: { state: "up" },
  },
}
const FINALIZED: FinalizeResult = {
  finalized: true,
  restart_required: true,
  setup_complete_persisted: true,
  message: "Setup complete.",
}

const SMOKE: SmokeBody = { supabase_url: "u", provider: "openai", provider_key: "k" }
const FINALIZE: FinalizeBody = { supabase_url: "u", provider: "openai", provider_key: "k" }

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

function Harness({
  onBackToFix,
  onFinalized,
}: {
  onBackToFix?: (t: SmokeCheckId) => void
  onFinalized?: (r: FinalizeResult) => void
}) {
  const [_last, setLast] = useState<SmokeCheckId | null>(null)
  return (
    <SmokeChecklist
      token="tok"
      smoke={SMOKE}
      finalize={FINALIZE}
      onBackToFix={(t) => {
        setLast(t)
        onBackToFix?.(t)
      }}
      onFinalized={onFinalized ?? (() => {})}
    />
  )
}

describe("SmokeChecklist (D-13) — server-truth checklist IS the finalize gate", () => {
  it("renders five NEUTRAL not-yet-run rows and a disabled Finalize", () => {
    render(<Harness />)
    expect(screen.getAllByText(/not checked yet/i)).toHaveLength(5)
    expect(screen.getByRole("button", { name: /finalize setup/i })).toBeDisabled()
  })

  it("all-green unlocks Finalize → confirm → postFinalize → onFinalized", async () => {
    const user = userEvent.setup()
    vi.mocked(postSmoke).mockResolvedValue(GREEN)
    vi.mocked(postFinalize).mockResolvedValue(FINALIZED)
    const onFinalized = vi.fn()
    render(<Harness onFinalized={onFinalized} />)

    await user.click(screen.getByRole("button", { name: /run checks/i }))
    await waitFor(() => expect(screen.getAllByText(/passed/i).length).toBeGreaterThanOrEqual(5))

    const finalize = screen.getByRole("button", { name: /finalize setup/i })
    await waitFor(() => expect(finalize).toBeEnabled())
    await user.click(finalize)

    // The irreversible-lock confirmation.
    expect(screen.getByText(/locks first-run setup/i)).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: /yes, finalize setup/i }))

    await waitFor(() => expect(postFinalize).toHaveBeenCalledWith("tok", FINALIZE))
    expect(onFinalized).toHaveBeenCalledWith(FINALIZED)
  })

  it("a red row BLOCKS Finalize and jumps 'Back to fix' to the owning step", async () => {
    const user = userEvent.setup()
    vi.mocked(postSmoke).mockResolvedValue(RED)
    const onBackToFix = vi.fn()
    render(<Harness onBackToFix={onBackToFix} />)

    await user.click(screen.getByRole("button", { name: /run checks/i }))

    // The failing provider row names its verbatim sanitized reason.
    expect(await screen.findByText(/AuthenticationError/)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /finalize setup/i })).toBeDisabled()

    await user.click(screen.getByRole("button", { name: /back to fix — provider step/i }))
    expect(onBackToFix).toHaveBeenCalledWith("provider_key")
  })
})
