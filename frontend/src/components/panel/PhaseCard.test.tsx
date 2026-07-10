/**
 * Phase 101.1-04 (GAP-C / D-11) — PhaseCard emit sub-steps + the 5 distinguishable
 * failure states, rendered on the EXISTING status-node rail (no new UI / A5).
 *
 * The render half of the GAP-C run-honesty contract: a sealed forced emit is ATOMIC, so
 * the emit moment surfaces as DISCRETE `phase_substep` sub-steps (forcing → emitting →
 * recovering → validating → rendering → validated) — and each of the 5 terminal failure
 * values (model_failed_to_emit / citation_gate_rejected / render_failed / integrity_failed
 * / no_template_bound) renders FAILED-AS-FAILED via the closed taxonomy (never an empty
 * 'done' card — RC-4). XSS rule held (every label is a fixed plain-text child).
 *
 * These render PhaseCard directly with crafted Phase objects (the demux wiring that
 * populates emitSubStep/emitFailure is the deferred run-legibility path — this is the
 * RENDER contract: PhaseCard renders the sub-events when present).
 */
import { describe, it, expect, afterEach } from "vitest"
import { render, screen, cleanup } from "@testing-library/react"
import type { EmitFailure, EmitSubStep, Phase } from "@/types"
import { PhaseCard } from "./PhaseCard"

afterEach(() => cleanup())

function fillPhase(overrides: Partial<Phase> = {}): Phase {
  return {
    slug: "fill",
    phaseIndex: 0,
    phaseType: "llm_emit",
    status: "running",
    subAgents: [],
    pendingAsk: null,
    ...overrides,
  }
}

const SUBSTEPS: EmitSubStep[] = [
  "forcing",
  "emitting",
  "recovering",
  "validating",
  "rendering",
  "validated",
]

const FAILURES: EmitFailure[] = [
  "model_failed_to_emit",
  "citation_gate_rejected",
  "render_failed",
  "integrity_failed",
  "no_template_bound",
]

describe("PhaseCard — GAP-C emit sub-steps (D-11)  [owner: 101.1-04]", () => {
  it.each(SUBSTEPS)("renders the %s sub-step as a status-node sub-row on the existing rail", (s) => {
    render(<PhaseCard phase={fillPhase({ emitSubStep: s })} position={0} />)
    // The sub-step renders as a sub-row tagged with its value (the existing rail, not a
    // new container) — and carries a real visible label (non-color-only).
    const row = document.querySelector(`[data-emit-substep="${s}"]`)
    expect(row).toBeInTheDocument()
    expect(row?.textContent?.trim().length).toBeGreaterThan(0)
  })

  it("a `validated` sub-step renders the done (green) node, never a failure", () => {
    render(<PhaseCard phase={fillPhase({ emitSubStep: "validated" })} position={0} />)
    expect(document.querySelector('[data-emit-substep="validated"]')).toBeInTheDocument()
    // No failure alert on a successful sub-step.
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  })

  it("`recovering` is the degraded-but-honest amber sub-step (D-06), still a sub-row not a failure", () => {
    render(<PhaseCard phase={fillPhase({ emitSubStep: "recovering" })} position={0} />)
    const row = document.querySelector('[data-emit-substep="recovering"]')
    expect(row).toBeInTheDocument()
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  })

  it("an UNKNOWN sub-step value falls back gracefully (never crashes, never a 'done' success)", () => {
    // Forward-compat: a server that adds a 7th sub-step must not crash the card.
    const phase = fillPhase({ emitSubStep: "some_future_substep" as unknown as EmitSubStep })
    render(<PhaseCard phase={phase} position={0} />)
    const row = document.querySelector('[data-emit-substep="some_future_substep"]')
    expect(row).toBeInTheDocument()
    // The fallback renders the neutral "Working" label, never an empty node.
    expect(row?.textContent).toContain("Working")
  })
})

describe("PhaseCard — GAP-C 5 emit failure states (D-11 / RC-4)  [owner: 101.1-04]", () => {
  it.each(FAILURES)("renders %s failed-as-failed with a reason (never an empty 'done' card)", (f) => {
    render(<PhaseCard phase={fillPhase({ status: "failed", emitFailure: f })} position={0} />)
    // The status atom reads "Failed", never "Complete".
    expect(screen.getByText("Failed")).toBeInTheDocument()
    expect(screen.queryByText("Complete")).not.toBeInTheDocument()
    // The reason renders in a role="alert" (assertive) — never an empty red card.
    const alert = screen.getByRole("alert")
    expect(alert).toBeInTheDocument()
    expect(alert.textContent?.trim().length).toBeGreaterThan(10)
  })

  it("each of the 5 failures renders a DISTINCT reason (the closed taxonomy, not a generic 'failed')", () => {
    const reasons = new Set<string>()
    for (const f of FAILURES) {
      const { unmount } = render(
        <PhaseCard phase={fillPhase({ status: "failed", emitFailure: f })} position={0} />,
      )
      reasons.add(screen.getByRole("alert").textContent ?? "")
      unmount()
    }
    // 5 distinguishable failure states → 5 distinct rendered reasons.
    expect(reasons.size).toBe(5)
  })

  it("a typed emit failure renders failed-as-failed even before status flips to 'failed' (RC-4)", () => {
    // status is still 'running' on the wire but the terminal emit failure arrived first —
    // it must render failed-as-failed, never a 'done'/running success.
    render(<PhaseCard phase={fillPhase({ status: "running", emitFailure: "render_failed" })} position={0} />)
    expect(screen.getByRole("alert")).toHaveTextContent(/render failed/i)
    expect(screen.queryByText("Complete")).not.toBeInTheDocument()
  })

  it("a failure suppresses any sub-step node (never both a 'done' node AND a failed card)", () => {
    render(
      <PhaseCard
        phase={fillPhase({ status: "failed", emitSubStep: "validated", emitFailure: "integrity_failed" })}
        position={0}
      />,
    )
    // The failure block wins — no 'validated' done sub-row alongside the failure alert.
    expect(document.querySelector('[data-emit-substep="validated"]')).not.toBeInTheDocument()
    expect(screen.getByRole("alert")).toBeInTheDocument()
  })

  it("the failure copy is fixed text children — no dangerouslySetInnerHTML (XSS rule, T-101.1-04-01)", () => {
    const { container } = render(
      <PhaseCard phase={fillPhase({ status: "failed", emitFailure: "citation_gate_rejected" })} position={0} />,
    )
    // No raw-HTML injection anywhere in the rendered tree.
    expect(container.querySelector("[data-dangerously-set]")).toBeNull()
    // The reason is present as text (React-escaped).
    expect(screen.getByRole("alert").textContent).toMatch(/uncited or invented/i)
  })
})

describe("PhaseCard — GAP-C does not regress a plain non-emit phase  [owner: 101.1-04]", () => {
  it("a normal phase with no emit fields renders no sub-step row and no failure", () => {
    render(
      <PhaseCard
        phase={{
          slug: "research",
          phaseIndex: 1,
          phaseType: "llm_agent",
          status: "done",
          subAgents: [],
          pendingAsk: null,
        }}
        position={1}
      />,
    )
    expect(document.querySelector("[data-emit-substep]")).not.toBeInTheDocument()
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
    expect(screen.getByText("Complete")).toBeInTheDocument()
  })
})

// ── Phase 127-03 (WUX-03 / SC#2) — density-by-status: quiet idle / bloom active /
//    fold done, the shared 3D glyph, and the running-only honest engine chip. These
//    are the NEW density contracts; every assertion above stays green UNCHANGED (the
//    visual-only proof that the re-skin did not touch the data model or a11y scaffold). ──
const LLM_AGENT_ONELINER = "An AI agent using allowed tools, looping until done."

describe("PhaseCard — 127-03 density-by-status (WUX-03 / SC#2)  [owner: 127-03]", () => {
  it("a pending (idle) card is QUIET — no type one-liner, no activity line, no motion", () => {
    const { container } = render(
      <PhaseCard phase={fillPhase({ phaseType: "llm_agent", status: "pending" })} position={0} />,
    )
    // No type-lecture one-liner on idle (it belongs only to the active step).
    expect(screen.queryByText(LLM_AGENT_ONELINER)).not.toBeInTheDocument()
    // No running-only activity line.
    expect(container.querySelector("[data-activity-line]")).toBeNull()
    // No pulse / animation class anywhere on a quiet idle card.
    expect(container.querySelector('[class*="animate-"]')).toBeNull()
  })

  it("a running (active) card BLOOMS — it renders the running-only activity line", () => {
    const { container } = render(
      <PhaseCard phase={fillPhase({ phaseType: "llm_agent", status: "running" })} position={0} />,
    )
    expect(container.querySelector("[data-activity-line]")).toBeInTheDocument()
    // The active step shows its one-liner context (a DIFFERENT line from the activity line).
    expect(screen.getByText(LLM_AGENT_ONELINER)).toBeInTheDocument()
  })

  it("the running activity line renders the engine chip ONLY when a real provider exists", () => {
    // A real sub-agent provider → a brand mark (svg) renders in the activity line.
    const withProvider = render(
      <PhaseCard
        phase={fillPhase({
          phaseType: "llm_agent",
          status: "running",
          subAgents: [
            {
              sub_run_id: "s1",
              parent_run_id: "p1",
              status: "running",
              model: "claude-opus-4-8",
              provider: "anthropic",
            },
          ],
        })}
        position={0}
      />,
    )
    const line = withProvider.container.querySelector("[data-activity-line]")
    expect(line).toBeInTheDocument()
    expect(line?.querySelector("svg")).toBeInTheDocument()
    withProvider.unmount()

    // No provider (subAgents: []) → the chip is honestly-ABSENT (no Bot on the live card).
    const noProvider = render(
      <PhaseCard
        phase={fillPhase({ phaseType: "llm_agent", status: "running", subAgents: [] })}
        position={0}
      />,
    )
    const line2 = noProvider.container.querySelector("[data-activity-line]")
    expect(line2).toBeInTheDocument()
    expect(line2?.querySelector("svg")).toBeNull()
  })

  it("a done card FOLDS to a one-line essence — no type one-liner, no activity line", () => {
    const { container } = render(
      <PhaseCard phase={fillPhase({ phaseType: "llm_agent", status: "done" })} position={0} />,
    )
    expect(screen.queryByText(LLM_AGENT_ONELINER)).not.toBeInTheDocument()
    expect(container.querySelector("[data-activity-line]")).toBeNull()
    expect(screen.getByText("Complete")).toBeInTheDocument()
  })

  it("renders the shared 3D phase-type glyph for a known type, unicode fallback for an unknown type", () => {
    // Known type → the 3D mark (an svg) renders in the header <h3>.
    const known = render(
      <PhaseCard phase={fillPhase({ phaseType: "llm_agent", status: "pending" })} position={0} />,
    )
    expect(known.container.querySelector("h3")?.querySelector("svg")).toBeInTheDocument()
    known.unmount()
    // Unknown type → phaseGlyph returns null → the unicode "•" fallback, no svg glyph.
    const unknown = render(
      <PhaseCard phase={fillPhase({ phaseType: "some_future_type", status: "pending" })} position={0} />,
    )
    const head = unknown.container.querySelector("h3")
    expect(head?.textContent).toContain("•")
    expect(head?.querySelector("svg")).toBeNull()
  })
})
