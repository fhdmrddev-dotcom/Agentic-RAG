/**
 * Phase 123.1 Plan 08 Task 2 (TT-14) — LiveRunCard tests.
 *
 * The card carries a NEVER-VANISHING elapsed timer (the 095 lesson) and per-provider
 * lanes (queued ≠ running, no fake percent). This suite pins the three phase footers:
 *  - phase="running"      → the "runs in the background — reconciles on return" line +
 *                           a Cancel control + the timer ticking.
 *  - phase="reconciling"  → (TT-14) the honest "finishing — loading results…" footer (NOT
 *                           the red error, NOT the idle line), the card STAYS mounted (no
 *                           empty-pane flash on done), the timer is FROZEN, and Cancel is
 *                           hidden (the job already finished).
 *  - phase="error"        → the alert error copy.
 */
import { describe, it, expect, vi } from "vitest"
import { render, screen, within } from "@testing-library/react"
import { LiveRunCard, type ProviderLane } from "./LiveRunCard"

function lane(
  provider: string,
  model: string,
  status: ProviderLane["status"],
  score?: number | null,
): ProviderLane {
  return { provider, model, status, score }
}

const LANES: ProviderLane[] = [
  lane("openai", "gpt-5.4-mini", "running"),
  lane("anthropic", "claude-haiku-4-5", "queued"),
]

describe("LiveRunCard — phase footers + never-vanishes timer", () => {
  it("phase='running' renders the background/reconcile line + a Cancel control + the timer", () => {
    render(
      <LiveRunCard lanes={LANES} startTs={Date.now() - 3000} phase="running" error={null} onCancel={() => {}} />,
    )
    const card = screen.getByTestId("live-run-card")
    expect(within(card).getByTestId("live-run-timer")).toBeTruthy()
    expect(card.textContent?.toLowerCase()).toContain("runs in the background")
    expect(screen.getByRole("button", { name: /cancel/i })).toBeTruthy()
    // no reconciling / error footer while running.
    expect(screen.queryByTestId("live-run-reconciling")).toBeNull()
    expect(screen.queryByRole("alert")).toBeNull()
  })

  it("Cancel fires onCancel while running", async () => {
    const onCancel = vi.fn()
    render(
      <LiveRunCard lanes={LANES} startTs={Date.now()} phase="running" error={null} onCancel={onCancel} />,
    )
    screen.getByRole("button", { name: /cancel/i }).click()
    expect(onCancel).toHaveBeenCalledOnce()
  })

  it("renders one lane per provider with the honest queued≠running vocabulary", () => {
    render(
      <LiveRunCard lanes={LANES} startTs={Date.now()} phase="running" error={null} onCancel={() => {}} />,
    )
    expect(screen.getByTestId("lane-openai").textContent?.toLowerCase()).toContain("running")
    expect(screen.getByTestId("lane-anthropic").textContent?.toLowerCase()).toContain("queued")
  })

  it("phase='reconciling' (TT-14) keeps the card mounted with an honest 'finishing — loading results…' footer, NO red error, NO Cancel", () => {
    render(
      <LiveRunCard
        lanes={[lane("openai", "gpt-5.4-mini", "done", 0.88)]}
        startTs={Date.now() - 5000}
        phase="reconciling"
        error={null}
        onCancel={() => {}}
      />,
    )
    // the card is STILL mounted (no empty-pane flash between done and getTunerResults).
    expect(screen.getByTestId("live-run-card")).toBeTruthy()
    // the timer stays visible (frozen — never vanishes, the 095 lesson).
    expect(screen.getByTestId("live-run-timer")).toBeTruthy()
    // the honest reconciling footer — NOT the red error, NOT the idle "runs in the background".
    const footer = screen.getByTestId("live-run-reconciling")
    expect(footer.textContent?.toLowerCase()).toContain("finishing")
    expect(footer.textContent?.toLowerCase()).toContain("loading results")
    expect(screen.queryByRole("alert")).toBeNull()
    expect(screen.getByTestId("live-run-card").textContent?.toLowerCase()).not.toContain(
      "runs in the background",
    )
    // Cancel is hidden once reconciling (the job already finished — nothing to cancel).
    expect(screen.queryByRole("button", { name: /cancel/i })).toBeNull()
  })

  it("phase='error' renders the alert error copy", () => {
    render(
      <LiveRunCard
        lanes={LANES}
        startTs={Date.now()}
        phase="error"
        error="Lost the live connection to the tuning run."
        onCancel={() => {}}
      />,
    )
    const alert = screen.getByRole("alert")
    expect(alert.textContent).toContain("Lost the live connection")
    // no reconciling footer in the error state.
    expect(screen.queryByTestId("live-run-reconciling")).toBeNull()
  })
})
