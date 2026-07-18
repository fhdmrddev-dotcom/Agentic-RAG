/**
 * Phase 155 Plan 04 Task 1 — HealthSignals a11y contract (WCAG 2.1 AA / D-01).
 *
 * The 146-05 / 147-07 / 150 health block is a PURE PRESENTATIONAL LEAF: the shell
 * (ControlRoomPage) owns the fetch, so this leaf's honest states are "signals
 * resolved" vs "signals === null (still loading)". Its loading signal is
 * `aria-busy` on the grids (NOT role="status") and it has NO error branch —
 * the shell owns error surfacing. This suite asserts the leaf's ACTUAL contract
 * (see the "assert real contracts" finding in the plan SUMMARY), not an invented
 * role=status/role=alert pair.
 *
 * Locks the D-12 zero-STRUCTURAL-violations bar across:
 *   - resolved (populated) with the dependency + secrets tiles;
 *   - loading (signals === null) — exposes aria-busy, renders a calm placeholder;
 *   - ⌥ Technical names revealed (the raw field names appear).
 * Plus never-colour-alone: each dependency/secrets status is a visible WORD next
 * to the aria-hidden colour dot. STRUCTURAL rules only (no contrast assertion).
 */
import { describe, it, expect, afterEach } from "vitest"
import { render, screen, cleanup } from "@testing-library/react"
import { axe } from "vitest-axe"

import { HealthSignals } from "../HealthSignals"
import type { BackpressureSignals } from "@/lib/api"

const SIGNALS: BackpressureSignals = {
  anyio_threadpool_depth: { borrowed: 1, total: 40 },
  redis_active_runs: 0,
  postgres_pool_in_use: 2,
  per_worker_run_count: 0,
  dependencies: {
    redis: { state: "up", latency_ms: 3 },
    supabase: { state: "up", latency_ms: 12 },
    sandbox: { state: "off", latency_ms: null },
  },
  secrets_encryption: { state: "encrypted" },
} as unknown as BackpressureSignals

afterEach(() => {
  cleanup()
})

describe("HealthSignals a11y — WCAG 2.1 AA (structural) across honest states", () => {
  it("no aXe structural violations — signals resolved (deps + secrets tiles)", async () => {
    const { container } = render(<HealthSignals signals={SIGNALS} showTechnical={false} />)
    await screen.findByText(/agents working/i)
    expect(await axe(container)).toHaveNoViolations()
  })

  it("no aXe structural violations — loading (signals === null)", async () => {
    const { container } = render(<HealthSignals signals={null} showTechnical={false} />)
    await screen.findByText(/agents working/i)
    expect(await axe(container)).toHaveNoViolations()
  })

  it("no aXe structural violations — ⌥ Technical names revealed", async () => {
    const { container } = render(<HealthSignals signals={SIGNALS} showTechnical={true} />)
    await screen.findByText("anyio_threadpool_depth")
    expect(await axe(container)).toHaveNoViolations()
  })
})

describe("HealthSignals a11y — honest loading + never-colour-alone contract", () => {
  it("the loading state exposes aria-busy (the leaf's real honest-loading signal)", () => {
    const { container } = render(<HealthSignals signals={null} showTechnical={false} />)
    // The shell owns the fetch/error; this leaf marks loading with aria-busy on
    // its grids (NOT role="status") and never renders a role="alert" — asserting
    // the ACTUAL contract, not an invented one.
    expect(container.querySelectorAll('[aria-busy="true"]').length).toBeGreaterThan(0)
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  })

  it("every dependency + secrets status is a visible WORD (never colour-alone)", () => {
    render(<HealthSignals signals={SIGNALS} showTechnical={false} />)
    // The colour dots are aria-hidden; the status must ALSO read as a word.
    expect(screen.getAllByText(/healthy/i).length).toBeGreaterThan(0) // redis + db up
    expect(screen.getByText(/off by config/i)).toBeInTheDocument() // sandbox off (neutral, not red)
    expect(screen.getByText(/^encrypted$/i)).toBeInTheDocument() // secrets at rest
  })
})
