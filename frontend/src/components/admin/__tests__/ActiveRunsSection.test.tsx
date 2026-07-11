/**
 * Phase 147 Plan 07 (ADMIN-02 / sketch 064-B) — ActiveRunsSection contract.
 *
 * Locks the 064-B behavior: killable vs bounded (eval/tuner) affordances, the
 * victim-naming confirm sheet (Kill is NOT immediate), the honest Cancelling… →
 * Cancelled two-state with NO optimistic removal, client-derived elapsed, the
 * calm empty state, and the server-derived `not_responding` tag.
 *
 * `Date.now` is pinned so elapsed is deterministic; the component's 1s tick reads
 * the same pinned clock, so nothing drifts under real timers.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, waitFor, cleanup, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { ActiveRunsSection } from "../ActiveRunsSection"
import type { ActiveRun } from "@/lib/api"

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

describe("ActiveRunsSection (064-B) — cards + victim-naming Kill", () => {
  it("shows a Kill control for a killable run but NOT for a bounded tuner run", () => {
    const onKill = vi.fn().mockResolvedValue(undefined)
    const { rerender } = render(
      <ActiveRunsSection runs={[makeRun()]} onKill={onKill} />,
    )
    expect(screen.getByRole("button", { name: /end run/i })).toBeInTheDocument()

    // A tuner run is a bounded internal job (D-01): no Kill, honest "ends on its own".
    rerender(
      <ActiveRunsSection
        runs={[makeRun({ run_id: "run-t", kind: "tuner", killable: false })]}
        onKill={onKill}
      />,
    )
    expect(screen.queryByRole("button", { name: /end run/i })).not.toBeInTheDocument()
    expect(screen.getByText(/ends on its own/i)).toBeInTheDocument()
  })

  it("clicking Kill opens a confirm sheet that NAMES the victim (user + model + elapsed) — and does NOT cancel yet", async () => {
    const user = userEvent.setup()
    const onKill = vi.fn().mockResolvedValue(undefined)
    render(<ActiveRunsSection runs={[makeRun()]} onKill={onKill} />)

    await user.click(screen.getByRole("button", { name: /end run/i }))

    const dialog = await screen.findByRole("dialog")
    // The victim is named: who / which model / how long in.
    expect(within(dialog).getByText(/maria@acme\.io/)).toBeInTheDocument()
    expect(within(dialog).getByText(/gpt-5/)).toBeInTheDocument()
    expect(within(dialog).getByText(/2m 14s in/)).toBeInTheDocument()
    // Nothing fired — the sheet is the deliberate guard, not the trigger.
    expect(onKill).not.toHaveBeenCalled()
  })

  it("after Confirm the card stays (NO optimistic removal) and shows Cancelling… → Cancelled · recorded", async () => {
    const user = userEvent.setup()
    const onKill = vi.fn().mockResolvedValue(undefined)
    render(<ActiveRunsSection runs={[makeRun()]} onKill={onKill} />)

    await user.click(screen.getByRole("button", { name: /end run/i }))
    const dialog = await screen.findByRole("dialog")
    await user.click(within(dialog).getByRole("button", { name: /end it now/i }))

    // The operator Kill fired for THIS run…
    await waitFor(() => expect(onKill).toHaveBeenCalledWith("run-1"))
    // …and the card resolves to the honest terminal state, still present.
    expect(await screen.findByText(/cancelled · recorded/i)).toBeInTheDocument()
    expect(screen.getByText("gpt-5")).toBeInTheDocument() // card NOT removed
  })

  it("a stalled (not_responding) run reads as RECOVERED, not killed", async () => {
    const user = userEvent.setup()
    const onKill = vi.fn().mockResolvedValue(undefined)
    render(
      <ActiveRunsSection runs={[makeRun({ not_responding: true })]} onKill={onKill} />,
    )

    await user.click(screen.getByRole("button", { name: /end run/i }))
    const dialog = await screen.findByRole("dialog")
    await user.click(within(dialog).getByRole("button", { name: /end it now/i }))

    expect(
      await screen.findByText(/cancelled · recovered a stuck run/i),
    ).toBeInTheDocument()
  })

  it("derives elapsed from started_at (client math), not a server field", () => {
    const onKill = vi.fn().mockResolvedValue(undefined)
    render(<ActiveRunsSection runs={[makeRun()]} onKill={onKill} />)
    expect(screen.getByText("2m 14s")).toBeInTheDocument()
  })

  it("renders a calm 'No runs in flight' empty state", () => {
    const onKill = vi.fn().mockResolvedValue(undefined)
    render(<ActiveRunsSection runs={[]} onKill={onKill} />)
    expect(screen.getByText(/no runs in flight/i)).toBeInTheDocument()
  })

  it("renders the highlighted not-responding tag only when the server flag is true", () => {
    const onKill = vi.fn().mockResolvedValue(undefined)
    const { rerender } = render(
      <ActiveRunsSection runs={[makeRun({ not_responding: true })]} onKill={onKill} />,
    )
    expect(screen.getByText(/not responding/i)).toBeInTheDocument()

    rerender(
      <ActiveRunsSection runs={[makeRun({ not_responding: false })]} onKill={onKill} />,
    )
    expect(screen.queryByText(/not responding/i)).not.toBeInTheDocument()
  })

  it("renders the long-running tag past 8 minutes of elapsed (pure client math)", () => {
    const onKill = vi.fn().mockResolvedValue(undefined)
    // 9 minutes elapsed → started_at = now − 540s.
    render(
      <ActiveRunsSection
        runs={[makeRun({ started_at: Math.floor(NOW_MS / 1000) - 9 * 60 })]}
        onKill={onKill}
      />,
    )
    expect(screen.getByText(/long-running/i)).toBeInTheDocument()
  })

  it("uses the shared provider-mark resolver — the Bot fallback only appears for unmapped providers", () => {
    const onKill = vi.fn().mockResolvedValue(undefined)
    // openai resolves to a real @lobehub mark → no Bot fallback icon.
    const { container, rerender } = render(
      <ActiveRunsSection runs={[makeRun({ provider: "openai" })]} onKill={onKill} />,
    )
    expect(container.querySelector("svg.lucide-bot")).toBeNull()

    // an unmapped provider falls back to the Bot glyph (never placeholder art).
    rerender(
      <ActiveRunsSection
        runs={[makeRun({ run_id: "run-x", provider: "made-up-provider" })]}
        onKill={onKill}
      />,
    )
    expect(container.querySelector("svg.lucide-bot")).not.toBeNull()
  })

  it("null runs render a calm placeholder, never a crash", () => {
    const onKill = vi.fn().mockResolvedValue(undefined)
    expect(() =>
      render(<ActiveRunsSection runs={null} onKill={onKill} />),
    ).not.toThrow()
    expect(screen.getByText(/loading active runs/i)).toBeInTheDocument()
  })
})
