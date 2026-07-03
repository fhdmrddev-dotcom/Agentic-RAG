/**
 * Phase 137-04 Task 2 (PANEL-01 / D-08) — ProposalCard spec.
 *
 * Authored FRESH (MEMORY project_frontend_vitest_rot — not leaning on a rotted
 * sibling). ProposalCard is RENDER-ONLY: it imports no `@/lib/api`, so there is
 * nothing to mock — the handlers are plain `vi.fn()` props and the component is
 * driven purely by the `proposal` row it is handed.
 *
 * One case per status + the two honesty locks:
 *   1. proposed      → Approve + Reject present; clicking Approve calls onApprove
 *   2. re_evaling    → injected live progress + a Reject escape; NO promote yet
 *   3. promoted      → override_forced echoes "(forced override)" + gate counts
 *   4. not_promoted  → the destructive line + Force-promote + gate counts
 *   5. interrupted   → "not promoted" + Re-run (never a silent success)
 *   6. diff          → renders lineDiff rows (an add row + a remove row)
 *   7. gate=null     → renderGateCounts contributes nothing (no fabricated pass)
 */
import { describe, it, expect, vi, afterEach } from "vitest"
import { render, screen, fireEvent, cleanup } from "@testing-library/react"
import type { SkillProposal, PromotionGate } from "@/types"
import { ProposalCard } from "./ProposalCard"

function mkGate(overrides: Partial<PromotionGate> = {}): PromotionGate {
  return {
    passed: true,
    no_regression: true,
    improved: true,
    prev_pass: 2,
    prev_fail: 1,
    still_pass: 2,
    newly_pass: 1,
    excluded_not_measured: 0,
    ...overrides,
  }
}

function mkProposal(overrides: Partial<SkillProposal> = {}): SkillProposal {
  return {
    id: "prop-1",
    skill_id: "skill-1",
    base_skill_version_id: "ver-0",
    new_skill_version_id: null,
    re_eval_run_id: null,
    source_eval_run_id: "run-src",
    base_instructions: "alpha\nbeta",
    proposed_instructions: "alpha\ngamma",
    rationale: "Tighten the citation instruction.",
    evidence_summary: "Case 3 failed without an explicit cite step.",
    status: "proposed",
    override_forced: false,
    gate: null,
    created_at: "2026-07-03T00:00:00Z",
    updated_at: "2026-07-03T00:00:00Z",
    ...overrides,
  }
}

const handlers = () => ({
  onPropose: vi.fn(),
  onApprove: vi.fn(),
  onReject: vi.fn(),
  onRerun: vi.fn(),
  onForcePromote: vi.fn(),
})

afterEach(() => cleanup())

describe("ProposalCard — status-driven rows + honesty locks (137-04)", () => {
  it("1. proposed → Approve + Reject present; Approve calls onApprove", () => {
    const h = handlers()
    render(<ProposalCard proposal={mkProposal({ status: "proposed" })} {...h} />)

    const approve = screen.getByRole("button", { name: /Approve/i })
    expect(approve).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Reject/i })).toBeInTheDocument()

    fireEvent.click(approve)
    expect(h.onApprove).toHaveBeenCalledTimes(1)
  })

  it("2. re_evaling → injected live progress + a Reject escape, no promote yet", () => {
    const h = handlers()
    render(
      <ProposalCard
        proposal={mkProposal({ status: "re_evaling", re_eval_run_id: "run-re" })}
        reEvalLive={<div>live-progress-node</div>}
        {...h}
      />,
    )

    expect(screen.getByText("live-progress-node")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Reject/i })).toBeInTheDocument()
    // Not yet a terminal promote — no promoted copy, no force-promote escape.
    expect(screen.queryByText(/Promoted to the live skill/)).toBeNull()
    expect(screen.queryByRole("button", { name: /Force promote/i })).toBeNull()
  })

  it("3. promoted + override_forced → '(forced override)' record + gate counts", () => {
    const h = handlers()
    render(
      <ProposalCard
        proposal={mkProposal({ status: "promoted", override_forced: true, gate: mkGate() })}
        {...h}
      />,
    )

    expect(screen.getByText(/forced override/)).toBeInTheDocument()
    // Honest gate counts render alongside the verdict.
    expect(screen.getByText(/prev pass/)).toBeInTheDocument()
  })

  it("4. not_promoted → destructive line + Force-promote + gate counts", () => {
    const h = handlers()
    render(
      <ProposalCard
        proposal={mkProposal({ status: "not_promoted", gate: mkGate({ passed: false }) })}
        {...h}
      />,
    )

    expect(screen.getByText(/did not pass/)).toBeInTheDocument()
    const force = screen.getByRole("button", { name: /Force promote/i })
    expect(force).toBeInTheDocument()
    expect(screen.getByText(/prev pass/)).toBeInTheDocument()

    fireEvent.click(force)
    expect(h.onForcePromote).toHaveBeenCalledTimes(1)
  })

  it("5. interrupted → 'not promoted' + Re-run (honest, not a silent success)", () => {
    const h = handlers()
    render(<ProposalCard proposal={mkProposal({ status: "interrupted" })} {...h} />)

    expect(screen.getByText(/Interrupted — not promoted/)).toBeInTheDocument()
    const rerun = screen.getByRole("button", { name: /Re-run/i })
    expect(rerun).toBeInTheDocument()
    // Never a fabricated success state on an interrupted re-eval.
    expect(screen.queryByText(/Promoted to the live skill/)).toBeNull()

    fireEvent.click(rerun)
    expect(h.onRerun).toHaveBeenCalledTimes(1)
  })

  it("6. diff renders lineDiff rows (an add row + a remove row)", () => {
    const h = handlers()
    render(
      <ProposalCard
        proposal={mkProposal({ base_instructions: "alpha\nbeta", proposed_instructions: "alpha\ngamma" })}
        {...h}
      />,
    )

    const diff = screen.getByTestId("proposal-diff")
    // remove-then-add of the changed line (D-09) — the shared lineDiff util output.
    expect(diff.textContent).toContain("- beta")
    expect(diff.textContent).toContain("+ gamma")
  })

  it("7. gate=null → renderGateCounts contributes nothing (no fabricated pass)", () => {
    const h = handlers()
    render(
      <ProposalCard proposal={mkProposal({ status: "promoted", gate: null })} {...h} />,
    )

    // The verdict copy still renders...
    expect(screen.getByText(/Promoted to the live skill/)).toBeInTheDocument()
    // ...but no gate counts are fabricated when the server gate is absent.
    expect(screen.queryByText(/prev pass/)).toBeNull()
    expect(screen.queryByText(/Gate passed|Gate not passed/)).toBeNull()
  })
})
