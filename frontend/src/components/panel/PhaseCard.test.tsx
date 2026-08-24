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
// Phase 200-07 — the ONE resolver, driven for real rather than stubbed. Its own import line
// rather than a widening of the one above: the `canvasModel.purity.test.ts:18-21` rule, so
// this plan's diff reads as ADDED lines.
import { phaseRunFacts, type PhaseTimingRow } from "@/components/workflows/phaseDuration"

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
  // Phase 196-03 (D-10). This array is meant to be the WHOLE union — a member missing here
  // is a member the generic sub-row assertion never exercises.
  "model_fallback",
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

  // ── Phase 196-03 (D-10) — the disabled-model fallback notice ────────────────────────
  it("`model_fallback` renders the honest fixed sentence on a degraded (amber) node", () => {
    render(<PhaseCard phase={fillPhase({ emitSubStep: "model_fallback" })} position={0} />)
    const row = document.querySelector('[data-emit-substep="model_fallback"]')
    expect(row).toBeInTheDocument()
    // The FIXED plain-text child (XSS rule) — true without interpolating either model id.
    expect(row?.textContent).toContain("Switched to the run's model")
    expect(row?.textContent).toContain("this step's model is turned off")
    // ⚠ It must NOT ride the forward-compat default arm — that renders the word "Working",
    // which would make the notice silent (the exact defect Phase 196 removes).
    expect(row?.textContent).not.toContain("Working")
    // Degraded-but-honest: the same amber `recovering` already uses, NOT a failure.
    expect(row?.querySelector(".text-accent-violet-text")).toBeInTheDocument()
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  })

  it("the default arm still catches a genuinely unknown value as 'Working' (the positive control)", () => {
    // The control that keeps the case above from being vacuous: if `model_fallback` were
    // riding the default arm, BOTH cases would pass on the same code path. This one proves
    // the default arm is still reachable AND still distinct from the mapped member.
    const phase = fillPhase({ emitSubStep: "a_genuinely_unknown_substep" as unknown as EmitSubStep })
    render(<PhaseCard phase={phase} position={0} />)
    const row = document.querySelector('[data-emit-substep="a_genuinely_unknown_substep"]')
    expect(row?.textContent).toContain("Working")
    expect(row?.textContent).not.toContain("Switched to the run's model")
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

// ── 199-02 Task 1 (DES-01 · sheet `c3-phase-spine`, Col 2) — THE PRE-CHANGE INVENTORY ──
//
// APPENDED, not woven in. Every assertion above belongs to 101.1-04 and 127-03 and stays
// theirs; this block adds none to them and deletes none.
//
// It measures the live panel row's RESTING atoms — one per status the closed taxonomy
// declares — so that 199-02's claim ("the spine renders no MORE at rest than before") is
// checkable against a before rather than asserted. The one atom this plan SUBTRACTS is
// pinned PRESENT here, so its removal is an INVERSION and never a deletion (`192.2-05`).

/** Every status the closed taxonomy declares, in `phaseStatusMeta`'s own order. Keeping
 *  the whole union here is deliberate: a member missing from this array is a member no
 *  inventory case ever measures, which is the `SUBSTEPS` lesson one describe block up. */
const ALL_STATUSES: Phase["status"][] = [
  "pending",
  "running",
  "done",
  "failed",
  "retrying",
  "skipped",
  "recorded-not-sent",
  "unknown",
  "cancelled",
]

/**
 * The status atom's [glyph, text] as rendered — the `ml-auto` span in the header.
 *
 * ⚠ BYTE-IDENTICAL to `panel/__tests__/PhaseTimeline.test.tsx:303-307`, on purpose and
 * recorded rather than left to be noticed. `STATUS_META` is module-private, so both suites
 * must read the rendered DOM; two DIFFERENT selectors for one atom is how two halves of a
 * contract start measuring different elements (the `SEAL_TEST_ID` lesson). If either
 * selector moves, both move together.
 */
function statusAtomOf(container: HTMLElement): [string, string] {
  const atom = container.querySelector("button span.ml-auto")
  const parts = Array.from(atom?.children ?? []).map((el) => el.textContent ?? "")
  return [parts[0] ?? "", parts[1] ?? ""]
}

/** The card ROOT — where the box (border + fill) lives. */
function rootOf(container: HTMLElement): HTMLElement {
  return container.firstElementChild as HTMLElement
}

describe("PhaseCard — 199-02 pre-change inventory (sheet c3 Col 2)", () => {
  it("pins the resting [glyph, word] of all NINE declared statuses as exact literals", () => {
    const atoms = ALL_STATUSES.map((status) => {
      const r = render(<PhaseCard phase={fillPhase({ status })} position={0} />)
      const pair = statusAtomOf(r.container)
      r.unmount()
      return pair
    })
    // ⚠ EXACT literals, not shapes. Sheet c3's column 2 spells four of these differently
    // (`Waiting`, `Blocked`, `Action Req`, `Failed`) and spells TWO of them for what is
    // ONE state here — the panel keeps its OWN vocabulary and this is the record of it.
    expect(atoms).toStrictEqual([
      ["○", "Locked"],
      ["●", "Running"],
      ["✓", "Complete"],
      ["✕", "Failed"],
      ["↻", "Attempt"],
      ["⤳", "Skipped"],
      ["↛", "Not sent"],
      ["?", "Unknown"],
      ["■", "Stopped"],
    ])
    // NON-VACUITY: nine distinct marks and nine distinct words, so the table above is a
    // measurement of nine rows and not one row read nine times.
    expect(new Set(atoms.map((a) => a[0])).size).toBe(9)
    expect(new Set(atoms.map((a) => a[1])).size).toBe(9)
  })

  it("REFUSES a determinate mid-phase count in EVERY status (sheet flaw 1 / D-03)", () => {
    // Sheet c3 prints `Processing liability caps section (4/12)` on its active row. Nothing
    // in this system emits a within-a-step count — `PhaseTimeline`'s SUPPRESS-DON'T-FAKE
    // (D-03) rule already forbids per-phase counts — so the sheet element is REFUSED and the
    // refusal is pinned as a fence across the whole taxonomy rather than left as prose.
    //
    // ⚠ THE FENCE TARGETS THE PARENTHESISED MID-PHASE FORM, and that narrowness is the
    // point: the run-level `Phase 2 / 3` ordinal is HONEST (it is the reconcile floor, and
    // it counts whole steps, never work inside one), so a fence that also forbade it would
    // be forbidding the shipped honesty contract.
    const DETERMINATE = /\(\s*\d+\s*\/\s*\d+\s*\)/
    for (const status of ALL_STATUSES) {
      const r = render(<PhaseCard phase={fillPhase({ status, attempt: 2 })} position={3} />)
      expect(r.container.textContent ?? "", `status ${status} leaked a mid-phase count`).not.toMatch(
        DETERMINATE,
      )
      r.unmount()
    }
    // POSITIVE CONTROL — the fence can find the shape it forbids.
    expect("Processing liability caps section (4/12)…").toMatch(DETERMINATE)
  })

  it("THE BOX is gone from the settled rows — the 199-02 subtraction, proved by inversion", () => {
    // ⚠ THIS ASSERTION WAS COMMITTED AS `.toBe(true)` AGAINST THE SHIPPED TREE, one commit
    // before the arms below were changed, and it is INVERTED here rather than deleted.
    //
    // Sheet c3's column 2 draws a BOX on exactly two rows — the live one and the one asking
    // for a person — and lets every settled row sit on the bare spine. The shipped panel
    // boxed ALL of them, so a six-step run rendered six competing frames and the eye had
    // nothing to land on. 127-03 already decided the direction (quiet at rest, bloom
    // active); this carries that decision into the frame itself.
    const pending = render(<PhaseCard phase={fillPhase({ status: "pending" })} position={0} />)
    expect(rootOf(pending.container).classList.contains("border-border/40")).toBe(false)
    expect(rootOf(pending.container).classList.contains("bg-card/20")).toBe(false)
    // ⚠ THE BORDER BOX STAYS, TRANSPARENT. Dropping the utility instead would move every
    // row by 2px — a geometry change wearing a tone change's clothes.
    expect(rootOf(pending.container).classList.contains("border")).toBe(true)
    expect(rootOf(pending.container).classList.contains("border-transparent")).toBe(true)
    // …and `opacity-60` survives, because "not yet" is what it carries and the box was
    // never what said it.
    expect(rootOf(pending.container).classList.contains("opacity-60")).toBe(true)
    pending.unmount()

    const done = render(<PhaseCard phase={fillPhase({ status: "done" })} position={0} />)
    expect(rootOf(done.container).classList.contains("border-border/50")).toBe(false)
    expect(rootOf(done.container).classList.contains("bg-card/30")).toBe(false)
    expect(rootOf(done.container).classList.contains("border-transparent")).toBe(true)
    done.unmount()

    // The other five settled terminals take the same arm — asserted rather than assumed,
    // because a ternary chain is exactly where "and the rest" silently stops being true.
    for (const status of ["skipped", "recorded-not-sent", "unknown", "cancelled"] as const) {
      const r = render(<PhaseCard phase={fillPhase({ status })} position={0} />)
      expect(
        rootOf(r.container).classList.contains("border-transparent"),
        `settled status ${status} kept a visible box`,
      ).toBe(true)
      r.unmount()
    }
  })

  it("the SUBTRACTION changed no word and no mark — the atoms are byte-identical", () => {
    // The claim that this is a re-PRESENTATION and not a re-wording, checked against the
    // same nine-row table the inventory above pins. If a tone change had cost a status its
    // word, this is where it would show.
    const atoms = ALL_STATUSES.map((status) => {
      const r = render(<PhaseCard phase={fillPhase({ status })} position={0} />)
      const pair = statusAtomOf(r.container)
      r.unmount()
      return pair
    })
    expect(atoms).toStrictEqual([
      ["○", "Locked"],
      ["●", "Running"],
      ["✓", "Complete"],
      ["✕", "Failed"],
      ["↻", "Attempt"],
      ["⤳", "Skipped"],
      ["↛", "Not sent"],
      ["?", "Unknown"],
      ["■", "Stopped"],
    ])
  })

  it("pins the two rows that KEEP their box — the live one and the failed one", () => {
    // The other half of the same claim, and the reason the subtraction above is a hierarchy
    // move rather than a flattening: what makes a bloom loud is that nothing else is.
    const running = render(<PhaseCard phase={fillPhase({ status: "running" })} position={0} />)
    const runClass = rootOf(running.container).className
    expect(runClass).toContain("border-l-[hsl(var(--panel-status-active))]")
    running.unmount()

    const failed = render(<PhaseCard phase={fillPhase({ status: "failed" })} position={0} />)
    expect(rootOf(failed.container).className).toContain("border-[hsl(var(--destructive)/0.55)]")
    failed.unmount()
  })
})

// ─────────────────────────────────────────────────────────────────────────────────────────
// Phase 200-07 Task 1 (DES-02 · `200-CHECKLIST.md` §4) — D-06's ARMS AND D-07's COUNT ON
// THE PANEL HALF OF THE RUN SURFACE.
//
// The atoms these cases carry, by row id: `RS-MR-01` (a per-step count, only where the type
// declared one), `RS-MR-02` (the per-step reading, from the durable timestamps), `RS-MR-04`
// (six distinct renders, plus the two arms measurement added), `RS-MNR-02` (no live clock on
// a step that never ran or on a run that ended) and `RS-MNR-03` (no `0` and no dash standing
// in for an absent count).
//
// ⚠ EVERY FIXTURE BELOW IS A WIRE ROW DRIVEN THROUGH THE REAL RESOLVER, never a hand-built
// facts object. A hand-built one would let this suite pass while `phaseDuration.ts` and this
// card disagreed about which arm a row is on — precisely the class of defect a shared
// resolver exists to make impossible. The card is the RENDERER; the arms are its.
//
// ⚠ AND THE PANEL IS A CROSS-SURFACE SHELL. `WorkspacePanel` has exactly ONE production
// mount — `ChatLayout.tsx:673` — and NO workflow page mounts it, so everything asserted here
// lands in CHAT first. A UAT run against a workflow surface alone will not see it.
// ─────────────────────────────────────────────────────────────────────────────────────────

/** A fixed instant, injected — no clock mock, and no case that drifts with the wall time. */
const FIXED_NOW = Date.parse("2026-08-20T12:00:30Z")
const T0 = "2026-08-20T12:00:00Z"
const T12 = "2026-08-20T12:00:12Z"

/** One durable `workflow_phases` row, in the shape `GET /threads/{id}/workflow` sends. */
function wireRow(over: Partial<PhaseTimingRow> = {}): PhaseTimingRow {
  return { slug: "fill", status: "completed", ...over }
}

/** The card's timing prop, resolved the way production resolves it. */
function facts(row: Partial<PhaseTimingRow>, runStatus?: string | null, now = FIXED_NOW) {
  return phaseRunFacts(wireRow(row), runStatus, now)
}

function timingTextOf(container: HTMLElement): string {
  return container.querySelector('[data-testid="phase-card-timing"]')?.textContent ?? ""
}
function timingKindOf(container: HTMLElement): string {
  return (
    container.querySelector('[data-testid="phase-card-timing"]')?.getAttribute("data-timing-kind") ??
    ""
  )
}
function countNodeOf(container: HTMLElement): Element | null {
  return container.querySelector('[data-testid="phase-card-count"]')
}

describe("PhaseCard — D-06's arms (RS-MR-02 / RS-MR-04)  [owner: 200-07]", () => {
  it("RS-MNR-04: `never ran` and `time not recorded` are PROVABLY DIFFERENT renders", () => {
    // ⚠ THE HEADLINE OF THIS WHOLE SCREEN, and the lesson this repo has now learned three
    // times. `library/runFacts.ts` needed a FOURTH arm after CR-01 because folding an absence
    // together with a negative printed "Never run" about workflows that really had run;
    // `DecisionsList` needed a THIRD under D-20 because an absent readiness rendered as a
    // pass. Here the twin cases are a step the run ROUTED AROUND (an affirmative fact) and a
    // HISTORIC row whose time was never written (we hold no fact at all).
    const skipped = render(
      <PhaseCard
        phase={fillPhase({ status: "skipped" })}
        position={0}
        timing={facts({ status: "skipped" })}
      />,
    )
    const skippedText = timingTextOf(skipped.container)
    const skippedKind = timingKindOf(skipped.container)
    skipped.unmount()

    // Terminal, BOTH timestamps null — a row written before migration 121 existed.
    const historic = render(
      <PhaseCard
        phase={fillPhase({ status: "done" })}
        position={0}
        timing={facts({ status: "completed", started_at: null, completed_at: null })}
      />,
    )
    const historicText = timingTextOf(historic.container)
    const historicKind = timingKindOf(historic.container)
    historic.unmount()

    // Both are non-empty — an absence rendered as a blank would make them "different" in the
    // uselessly-true way, so non-vacuity is asserted BEFORE the difference.
    expect(skippedText.length).toBeGreaterThan(0)
    expect(historicText.length).toBeGreaterThan(0)
    expect(skippedText).not.toBe(historicText)
    expect(skippedKind).not.toBe(historicKind)

    // ⚠ AND THE BOOLEAN A CARELESS IMPLEMENTATION WOULD USE COLLAPSES THEM. Driven rather
    // than argued: it answers the same for both, so a card keyed on it would print one thing
    // for two different facts.
    const hasDuration = (t: string) => /\d/.test(t) && !/not recorded/.test(t)
    expect(hasDuration(skippedText)).toBe(hasDuration(historicText))
  })

  it("RS-MR-04: the six arms plus the two measurement added are EIGHT distinct readings", () => {
    // `pending` (not reached) · `skipped` (never ran) · `active` (a live tick) · `completed`
    // (a duration) · `cancelled` (ran Ns, interrupted) · historic (time not recorded) · plus
    // `active` under a TERMINAL run (did not finish) and `active` under a PAUSED one.
    const cases: [string, Partial<PhaseTimingRow>, string | null][] = [
      ["pending", { status: "pending" }, "active"],
      ["skipped", { status: "skipped" }, "active"],
      ["running", { status: "active", started_at: T0 }, "active"],
      ["completed", { status: "completed", started_at: T0, completed_at: T12 }, "completed"],
      ["cancelled", { status: "cancelled", started_at: T0, completed_at: T12 }, "cancelled"],
      ["historic", { status: "completed" }, "completed"],
      ["unfinished", { status: "active", started_at: T0 }, "failed"],
      ["paused", { status: "active", started_at: T0 }, "paused"],
    ]
    const readings = cases.map(([, row, runStatus]) => {
      const r = render(
        <PhaseCard
          phase={fillPhase({ status: "done" })}
          position={0}
          timing={facts(row, runStatus)}
        />,
      )
      const text = timingTextOf(r.container)
      r.unmount()
      return text
    })
    // EIGHT readings, EIGHT distinct strings — the property a per-arm loop cannot show, and
    // the one that fails the instant two arms are folded.
    expect(readings).toHaveLength(8)
    expect(new Set(readings).size).toBe(8)
    for (const reading of readings) expect(reading.length).toBeGreaterThan(0)
  })

  it("RS-MNR-02: an `active` step under a TERMINAL run does NOT render a ticking clock", () => {
    // ⚠ THE ARM MEASUREMENT ADDED. `harness_engine.py:1698-1706` only terminalizes the
    // interrupted phase on a CANCELLATION, so a crash leaves an `active` row under a `failed`
    // run. Without this arm that row ticks forever — `BUG-260610-01`'s symptom re-created on
    // the very surface built to remove it.
    const live = render(
      <PhaseCard
        phase={fillPhase({ status: "running" })}
        position={0}
        timing={facts({ status: "active", started_at: T0 }, "active")}
      />,
    )
    const liveText = timingTextOf(live.container)
    const liveKind = timingKindOf(live.container)
    live.unmount()

    const dead = render(
      <PhaseCard
        phase={fillPhase({ status: "running" })}
        position={0}
        timing={facts({ status: "active", started_at: T0 }, "failed")}
      />,
    )
    const deadText = timingTextOf(dead.container)
    const deadKind = timingKindOf(dead.container)
    dead.unmount()

    // The LIVE row really does tick — the positive control, without which the negative below
    // could pass against a card that renders no clock in any state at all.
    expect(liveKind).toBe("running")
    expect(liveText).toMatch(/\d/)
    // The DEAD row carries no digit and is on a different arm.
    expect(deadKind).not.toBe("running")
    expect(deadText).not.toMatch(/\d/)
  })

  it("RS-MNR-02: a step that NEVER RAN carries no clock either", () => {
    for (const [status, runStatus] of [
      ["skipped", "completed"],
      ["pending", "active"],
    ] as const) {
      const r = render(
        <PhaseCard
          phase={fillPhase({ status: "skipped" })}
          position={0}
          timing={facts({ status }, runStatus)}
        />,
      )
      expect(timingTextOf(r.container), `${status} rendered a figure`).not.toMatch(/\d/)
      expect(timingKindOf(r.container)).not.toBe("running")
      r.unmount()
    }
  })

  it("renders NOTHING at all when the caller holds no durable row — an absence is not a claim", () => {
    // ⚠ `undefined` is a THIRD state: the caller has no row for this slug (a live-only
    // skeleton, or a mount before the first reconcile). Rendering `time not recorded` there
    // would assert that a row exists and its timestamps are empty, which is a different
    // statement and one nothing measured.
    const { container } = render(<PhaseCard phase={fillPhase({ status: "running" })} position={0} />)
    expect(container.querySelector('[data-testid="phase-card-timing"]')).toBeNull()
    expect(countNodeOf(container)).toBeNull()
  })
})

describe("PhaseCard — D-07's count (RS-MR-01 / RS-MNR-03)  [owner: 200-07]", () => {
  it("renders the declared pair VERBATIM — the number and the step's OWN noun", () => {
    const { container } = render(
      <PhaseCard
        phase={fillPhase({ status: "done" })}
        position={0}
        timing={facts({
          status: "completed",
          started_at: T0,
          completed_at: T12,
          step_count: 312,
          step_noun: "sources",
        })}
      />,
    )
    expect(countNodeOf(container)?.textContent).toBe("312 sources")
  })

  it("a DECLARED `0` renders — it is a measurement, not an absence", () => {
    // `source_refs: []` is the step saying *we looked and found nothing*. Suppressing it
    // would delete a real finding, which is the mirror-image error of inventing one.
    const { container } = render(
      <PhaseCard
        phase={fillPhase({ status: "done" })}
        position={0}
        timing={facts({
          status: "completed",
          started_at: T0,
          completed_at: T12,
          step_count: 0,
          step_noun: "sources",
        })}
      />,
    )
    expect(countNodeOf(container)?.textContent).toBe("0 sources")
  })

  it("RS-MNR-03: a step that DECLARED NO COUNT renders no element — never `0`, never a dash", () => {
    // Four of the seven phase types declare nothing: `programmatic`, `llm_single`,
    // `llm_human_input`, `external_action`. The absent case must render NO SLOT — an empty
    // element is still a rendered slot, which is why this asserts the node is null rather
    // than asserting its text is empty.
    const rows: Partial<PhaseTimingRow>[] = [
      { step_count: null, step_noun: null },
      { step_count: undefined, step_noun: undefined },
      // A number with no noun is a figure with no subject — worse than silence.
      { step_count: 12, step_noun: null },
      { step_count: 12, step_noun: "   " },
    ]
    for (const row of rows) {
      const r = render(
        <PhaseCard
          phase={fillPhase({ status: "done" })}
          position={0}
          timing={facts({ status: "completed", started_at: T0, completed_at: T12, ...row })}
        />,
      )
      expect(countNodeOf(r.container), `${JSON.stringify(row)} rendered a count slot`).toBeNull()
      // ...and no dash leaked into the reading beside it either.
      expect(timingTextOf(r.container)).not.toMatch(/[—–]/)
      r.unmount()
    }
  })

  it("the SHIPPED PINS are unmoved — the status atom is byte-identical with a timing prop", () => {
    // ⚠ THE REASON THE READING IS SITED IN THE IDENTITY COLUMN. `statusAtomOf` reads
    // `button span.ml-auto`'s children POSITIONALLY, and the nine-row inventory above pins
    // them as exact literals. This proves the new atoms did not enter that element — i.e.
    // that a characterization pin was answered by moving the NEW thing, not by re-baselining
    // the old one (the 199-03 precedent, and 200-06's icon-well decline).
    const withTiming = render(
      <PhaseCard
        phase={fillPhase({ status: "done" })}
        position={0}
        timing={facts({
          status: "completed",
          started_at: T0,
          completed_at: T12,
          step_count: 3,
          step_noun: "fields",
        })}
      />,
    )
    const pairWith = statusAtomOf(withTiming.container)
    withTiming.unmount()

    const without = render(<PhaseCard phase={fillPhase({ status: "done" })} position={0} />)
    const pairWithout = statusAtomOf(without.container)
    without.unmount()

    expect(pairWith).toStrictEqual(pairWithout)
    expect(pairWith).toStrictEqual(["✓", "Complete"])
  })
})
