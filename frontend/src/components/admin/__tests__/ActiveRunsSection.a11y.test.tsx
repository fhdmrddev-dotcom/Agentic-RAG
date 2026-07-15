/**
 * Phase 155 Plan 04 Task 2 — ActiveRunsSection a11y contract (WCAG 2.1 AA / D-01, D-09).
 *
 * The 147-07 live active-runs surface is a PURE PRESENTATIONAL LEAF (props in, DOM
 * out): its honest states are loading (`runs === null`), empty (`[]`), and
 * populated. This suite locks the D-12 zero-STRUCTURAL-violations bar across all
 * three, plus the D-09 scenario-3 (automatable half) destructive-guard contract:
 *   - the Kill control is reachable by role="button" + accessible NAME
 *     ("End run — <user> on <model>") — never colour/hover-alone;
 *   - a bounded (eval/tuner) run has NO Kill affordance (honest "Ends on its own");
 *   - opening the victim-naming confirm SHEET exposes a role="dialog" with a real
 *     confirm <button> ("End it now") queryable by role+name — proving the live
 *     keyboard drive (the operator's VALIDATION.md re-run) can succeed.
 *
 * The Radix sheet's OPEN-state axe scan is deliberately NOT run here (the plan
 * frames the sheet as the roles/names proof, not a structural scan of Radix
 * internals); the structural scans cover the three non-portal honest states.
 * STRUCTURAL rules only (no contrast assertion). `Date.now` is pinned so elapsed
 * is deterministic.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, cleanup, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { axe } from "vitest-axe"

import { ActiveRunsSection } from "../ActiveRunsSection"
import type { AdminActiveRun as ActiveRun } from "@/lib/api"

// started_at is a unix epoch (seconds); pin "now" 134s later → elapsed "2m 14s".
const STARTED_AT = 1_000_000
const NOW_MS = (STARTED_AT + 134) * 1000

beforeEach(() => {
  vi.spyOn(Date, "now").mockReturnValue(NOW_MS)
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

function makeRun(overrides: Partial<ActiveRun> = {}): ActiveRun {
  return {
    run_id: "run-1",
    kind: "chat",
    thread_id: "thread-1",
    user_id: "user-1",
    user_email: "maria@acme.io",
    model: "gpt-5",
    provider: "openai",
    started_at: STARTED_AT,
    killable: true,
    not_responding: false,
    ...overrides,
  }
}

describe("ActiveRunsSection a11y — WCAG 2.1 AA (structural) across honest states", () => {
  it("no aXe structural violations — loading (runs === null)", async () => {
    const { container } = render(<ActiveRunsSection runs={null} onKill={vi.fn()} />)
    await screen.findByText(/loading active runs/i)
    expect(await axe(container)).toHaveNoViolations()
  })

  it("no aXe structural violations — empty (calm 'No runs in flight')", async () => {
    const { container } = render(<ActiveRunsSection runs={[]} onKill={vi.fn()} />)
    await screen.findByText(/no runs in flight/i)
    expect(await axe(container)).toHaveNoViolations()
  })

  it("no aXe structural violations — populated (a killable run card)", async () => {
    const { container } = render(<ActiveRunsSection runs={[makeRun()]} onKill={vi.fn()} />)
    await screen.findByRole("button", { name: /end run/i })
    expect(await axe(container)).toHaveNoViolations()
  })

  it("the loading placeholder exposes aria-busy (the leaf's real honest-loading signal)", () => {
    const { container } = render(<ActiveRunsSection runs={null} onKill={vi.fn()} />)
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull()
  })
})

describe("ActiveRunsSection a11y — D-09 destructive-guard roles + names", () => {
  it("the Kill control is reachable by role+accessible-name (never colour/hover-alone)", () => {
    render(<ActiveRunsSection runs={[makeRun()]} onKill={vi.fn().mockResolvedValue(undefined)} />)
    // The button names its victim (user + model) — a real, keyboard-focusable control.
    const kill = screen.getByRole("button", { name: /end run — maria@acme\.io on gpt-5/i })
    expect(kill).toBeInTheDocument()
  })

  it("a bounded (tuner) run exposes NO Kill affordance — honest 'Ends on its own'", () => {
    render(
      <ActiveRunsSection
        runs={[makeRun({ run_id: "run-t", kind: "tuner", killable: false })]}
        onKill={vi.fn()}
      />,
    )
    expect(screen.queryByRole("button", { name: /end run/i })).not.toBeInTheDocument()
    expect(screen.getByText(/ends on its own/i)).toBeInTheDocument()
  })

  it("opening the confirm sheet exposes a role=dialog with a keyboard-operable 'End it now' button", async () => {
    const user = userEvent.setup()
    render(<ActiveRunsSection runs={[makeRun()]} onKill={vi.fn().mockResolvedValue(undefined)} />)

    await user.click(screen.getByRole("button", { name: /end run/i }))

    const dialog = await screen.findByRole("dialog")
    // The victim-naming confirm is a real, reachable dialog with a named confirm button.
    expect(within(dialog).getByText(/end this run\?/i)).toBeInTheDocument()
    expect(within(dialog).getByRole("button", { name: /end it now/i })).toBeInTheDocument()
    expect(within(dialog).getByRole("button", { name: /keep running/i })).toBeInTheDocument()
  })
})
