/**
 * Phase 136-03 Task 2 (GATE-01 / D-05) — the thin publish-gate confirm dialog.
 *
 * Asserts the two D-05 branches the dialog renders straight from the SERVER gate
 * (`getPublishGate` — no client-side gate math, D-07):
 *   (a) MET  → the satisfied "X/N passed on the current version" status + a
 *              Publish action that confirms with override=false;
 *   (b) UNMET (never_evaled) → the honest "never been evaled" pointer copy + a
 *              destructive Force-publish action that confirms with override=true.
 *
 * `@/lib/api` is mocked so no live backend is needed (Plan 02 owns enforcement).
 * Authored fresh (MEMORY project_frontend_vitest_rot) — not leaning on a rotted
 * sibling.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, waitFor, cleanup } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { PublishGate } from "@/types"

const getPublishGate = vi.fn()
vi.mock("@/lib/api", () => ({
  getPublishGate: (...a: unknown[]) => getPublishGate(...(a as [string])),
}))

import { PublishGateDialog } from "./PublishGateDialog"

function mkGate(overrides: Partial<PublishGate> = {}): PublishGate {
  return {
    met: true,
    state: "passed",
    measured: 3,
    passed: 3,
    passing_run_id: "run-1",
    reason: "Eval passed 3/3 on the current version.",
    last_override: null,
    ...overrides,
  }
}

// Radix marks the body pointer-events:none while a modal dialog is open; disable
// user-event's pointer-events guard so clicks on the dialog actions register.
const user = userEvent.setup({ pointerEventsCheck: 0 })

afterEach(() => cleanup())

describe("PublishGateDialog — server gate status + force (136-03)", () => {
  beforeEach(() => {
    getPublishGate.mockReset()
  })

  it("(a) met → renders the satisfied X/N status and a Publish action that confirms with override=false", async () => {
    getPublishGate.mockResolvedValue(mkGate({ met: true, state: "passed", measured: 3, passed: 3 }))
    const onConfirm = vi.fn().mockResolvedValue(undefined)

    render(
      <PublishGateDialog skillId="skill-1" open onOpenChange={() => {}} onConfirm={onConfirm} />,
    )

    // Server-computed satisfied status is rendered (refetch-not-optimistic).
    expect(await screen.findByText(/passed 3\/3/i)).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: /^publish$/i }))

    await waitFor(() => expect(onConfirm).toHaveBeenCalledWith(false))
  })

  it("(b) unmet never_evaled → renders the honest 'never been evaled' pointer and a Force-publish action that confirms with override=true", async () => {
    getPublishGate.mockResolvedValue(
      mkGate({
        met: false,
        state: "never_evaled",
        measured: null,
        passed: null,
        passing_run_id: null,
        reason: "This skill has never had a completed eval.",
      }),
    )
    const onConfirm = vi.fn().mockResolvedValue(undefined)

    render(
      <PublishGateDialog skillId="skill-2" open onOpenChange={() => {}} onConfirm={onConfirm} />,
    )

    // Honest unmet copy + a pointer to run an eval.
    expect(await screen.findByText(/never been evaled/i)).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: /force publish/i }))

    await waitFor(() => expect(onConfirm).toHaveBeenCalledWith(true))
  })
})
