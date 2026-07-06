/**
 * Phase 139 Plan 05 Task 1 (SI-02 / D-04/D-05/D-09) — DescriptionProposalCard spec.
 *
 * Authored FRESH (MEMORY project_frontend_vitest_rot — must pass at HEAD, not
 * leaning on a rotted sibling). DescriptionProposalCard is RENDER-ONLY: it imports
 * no `@/lib/api`, so there is nothing to mock — the handlers are plain `vi.fn()`
 * props and the component is driven purely by the `proposal` row it is handed.
 *
 * The load-bearing fixture contract (the exact shape 139-02 persists): the
 * `scoreboard_snapshot` is a `DescriptionScoreboardSnapshot` = `{ winner, baseline,
 * run_id }` where `winner`/`baseline` are cell-bearing `TunerCandidate`s — NOT a
 * `TunerScoreboard` `candidates[]`/`winner_index` blob. The card reads
 * `scoreboard_snapshot.winner.cells` / `.baseline.cells`; a `candidates[]`-shaped
 * fixture would false-green while the real card reads `.winner`/`.baseline`
 * (the exact contract mismatch the plan-checker flagged).
 *
 * Cases:
 *   1. proposed  → base→proposed line diff (a remove row + an add row) + a
 *                  ProviderScoreboard with ≥2 provider cells; Approve + Reject present.
 *   2. Approve/Reject fire the injected handlers.
 *   3. promoted  → "Promoted to the live skill" + NO Approve/Reject buttons.
 *   4. text-node-only render (no dangerouslySetInnerHTML sink).
 */
import { describe, it, expect, vi, afterEach } from "vitest"
import { render, screen, fireEvent, cleanup } from "@testing-library/react"
import type { SkillProposal } from "@/types"
import type { TunerCandidate, TunerCell } from "@/lib/api"
import { DescriptionProposalCard } from "./DescriptionProposalCard"

function mkCell(provider: string, model: string, score: number): TunerCell {
  return {
    provider,
    model,
    axes: { fires: score, no_false: score },
    score,
    measured: true,
    error_count: 0,
  }
}

function mkCandidate(overrides: Partial<TunerCandidate> = {}): TunerCandidate {
  return {
    index: 0,
    description: "candidate description",
    // ≥2 provider cells so the ProviderScoreboard renders ≥2 rows.
    cells: [mkCell("openai", "gpt-5.5", 0.9), mkCell("anthropic", "claude-opus-4-8", 0.88)],
    held_out_score: 0.9,
    is_baseline: false,
    ...overrides,
  }
}

/** A `SkillProposal` of `kind='description'` with the LITERAL `{winner, baseline,
 *  run_id}` snapshot shape (NOT a `candidates[]`/`winner_index` TunerScoreboard). */
function mkProposal(overrides: Partial<SkillProposal> = {}): SkillProposal {
  return {
    id: "prop-desc-1",
    skill_id: "skill-1",
    kind: "description",
    base_skill_version_id: "ver-0",
    new_skill_version_id: null,
    re_eval_run_id: null,
    source_eval_run_id: null,
    // Instruction fields are empty on a description row — the diff lives in the
    // description fields below.
    proposed_instructions: "",
    base_instructions: "",
    rationale: "",
    evidence_summary: "",
    // SI-02 description fields — a two-line diff so a REMOVE row + an ADD row both surface.
    base_description: "Use this skill for invoices\nand receipts",
    proposed_description: "Use this skill for invoices\nand purchase orders",
    source_tuner_run_id: "tuner-run-1",
    scoreboard_snapshot: {
      winner: mkCandidate({ index: 1, description: "the reworded winner", is_baseline: false }),
      baseline: mkCandidate({ index: 0, description: "the current description", is_baseline: true }),
      run_id: "tuner-run-1",
    },
    status: "proposed",
    override_forced: false,
    gate: null,
    created_at: "2026-07-06T00:00:00Z",
    updated_at: "2026-07-06T00:00:00Z",
    ...overrides,
  }
}

const handlers = () => ({
  onApprove: vi.fn(),
  onReject: vi.fn(),
  onPropose: vi.fn(),
})

afterEach(() => cleanup())

describe("DescriptionProposalCard — SI-02 propose door (139-05)", () => {
  it("1. proposed → base→proposed diff (remove + add rows) + ProviderScoreboard ≥2 cells", () => {
    const h = handlers()
    render(<DescriptionProposalCard proposal={mkProposal({ status: "proposed" })} {...h} />)

    // The base→proposed line diff renders remove-then-add of the changed line.
    const diff = screen.getByTestId("description-proposal-diff")
    expect(diff.textContent).toContain("- and receipts")
    expect(diff.textContent).toContain("+ and purchase orders")

    // The per-provider scoreboard is PRE-approval evidence (D-04) — ≥2 provider cells
    // sourced from scoreboard_snapshot.winner.cells (and baseline).
    const cells = screen.getAllByTestId("scoreboard-cell")
    expect(cells.length).toBeGreaterThanOrEqual(2)
    // Provider labels render as text from the winner's cells.
    expect(screen.getAllByText("openai").length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText("anthropic").length).toBeGreaterThanOrEqual(1)

    // Approve + Reject are offered on a `proposed` row.
    expect(screen.getByRole("button", { name: /Approve/i })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Reject/i })).toBeInTheDocument()
  })

  it("2. Approve → onApprove; Reject → onReject", () => {
    const h = handlers()
    render(<DescriptionProposalCard proposal={mkProposal({ status: "proposed" })} {...h} />)

    fireEvent.click(screen.getByRole("button", { name: /Approve/i }))
    expect(h.onApprove).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole("button", { name: /Reject/i }))
    expect(h.onReject).toHaveBeenCalledTimes(1)
  })

  it("3. promoted → 'Promoted to the live skill' + NO Approve/Reject buttons", () => {
    const h = handlers()
    render(<DescriptionProposalCard proposal={mkProposal({ status: "promoted" })} {...h} />)

    expect(screen.getByText(/Promoted to the live skill/i)).toBeInTheDocument()
    // A terminal promoted proposal offers no approve/reject door.
    expect(screen.queryByRole("button", { name: /Approve/i })).toBeNull()
    expect(screen.queryByRole("button", { name: /Reject/i })).toBeNull()
    // The diff + scoreboard evidence still render on the promoted (immutable) snapshot.
    expect(screen.getByTestId("description-proposal-diff")).toBeInTheDocument()
    expect(screen.getAllByTestId("scoreboard-cell").length).toBeGreaterThanOrEqual(2)
  })

  it("4. renders proposal text as plain text nodes (no dangerouslySetInnerHTML sink)", () => {
    const h = handlers()
    const { container } = render(
      <DescriptionProposalCard
        proposal={mkProposal({
          base_description: "old <b>bold</b> line",
          proposed_description: "new <i>italic</i> line",
        })}
        {...h}
      />,
    )
    // The angle-bracketed source is rendered as literal text, never parsed to markup —
    // proof there is no raw-HTML injection sink (T-139-14).
    expect(container.querySelector("b")).toBeNull()
    expect(container.querySelector("i")).toBeNull()
    const diff = screen.getByTestId("description-proposal-diff")
    expect(diff.textContent).toContain("<b>bold</b>")
    expect(diff.textContent).toContain("<i>italic</i>")
  })
})
