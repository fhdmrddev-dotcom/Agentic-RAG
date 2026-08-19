/**
 * Phase 124-01 Task 2 (WUX-01, sketch 046-A / D-03 / D-04) — WorkflowSoul tests.
 *
 * The scale-keyed 5-atom soul (purpose HERO · needs · glyph-dot spine · ONE tier
 * chip · output). These tests pin the locked contract:
 *  - all 5 atoms render at scale="card".
 *  - TIER CONSISTENCY INVARIANT: the SAME fixture yields the SAME data-tier on the
 *    tier chip at scale card / run / pub (SC#1+SC#2).
 *  - HONEST empty-states (D-03): null business_requirement → "draft · purpose not
 *    declared yet"; no terminal llm_emit → "produces: answer in chat". Both atoms
 *    are ALWAYS rendered, never hidden.
 *  - GLYPH + WORD: the tier chip renders tier.glyph AND a WORD at every scale
 *    (never colour-alone — WCAG 1.4.1).
 *  - G-5: the source never imports PhaseTimeline / PhaseCard.
 */
import { describe, it, expect } from "vitest"
import { render, screen, within } from "@testing-library/react"
import workflowSoulSource from "./WorkflowSoul?raw"
// 199-03 Task 1 (DES-01): the `UNDETERMINED` sweep runs over the WHOLE soul chain, not
// just the renderer — the word could arrive as a tier label, a derivation arm or a
// vocabulary entry, and only one of those three lives in the component.
import soulDataSource from "./soulData?raw"
import deriveTierSource from "./deriveTier?raw"
// The glyph + label vocabulary, read from its ONE home rather than re-typed here — a test
// that spelled 🔒/Strict itself would pass against a chip that had drifted from TIERS.
import { TIERS } from "./deriveTier"
// 199-03 Task 2: the THIRD surface that mounts this soul and pins its DOM byte for byte.
// Read as source rather than mounted — the point is the coupling's existence, not the
// door's behaviour, and that door already has two suites of its own.
import doorSwitchSource from "./WorkflowDoorSwitch?raw"
import doorBaselineSource from "./WorkflowDoorSwitch.baseline.test?raw"
import { WorkflowSoul } from "./WorkflowSoul"
import type { DefShape } from "./soulData"

/** A full STRICT workflow: purpose + needs + a terminal strict llm_emit. */
const strictDef: DefShape = {
  name: "Weekly Status",
  business_requirement: "Summarize this week's progress for leadership.",
  input_keys: ["week_of"],
  phases: [
    { slug: "gather", phase_index: 0, name: "Gather updates", config: { phase_type: "llm_agent" } },
    {
      slug: "emit",
      phase_index: 1,
      name: "Render report",
      config: { phase_type: "llm_emit", citation_policy: "strict" },
    },
  ],
}

/** A draft (null business_requirement) chat-only workflow → both honest empties. */
const draftChatDef: DefShape = {
  name: "Untitled draft",
  business_requirement: null,
  phases: [
    { slug: "gather", phase_index: 0, name: "Gather", config: { phase_type: "llm_agent" } },
    { slug: "chat", phase_index: 1, name: "Discuss", config: { phase_type: "llm_single" } },
  ],
}

const SCALES = ["card", "run", "pub"] as const

describe("WorkflowSoul — the scale-keyed 5-atom soul", () => {
  it("renders all 5 atoms at scale='card'", () => {
    render(<WorkflowSoul def={strictDef} scale="card" />)
    // (1) purpose HERO
    expect(screen.getByTestId("soul-purpose")).toHaveTextContent(
      "Summarize this week's progress for leadership.",
    )
    // (2) needs
    expect(screen.getByTestId("soul-needs")).toHaveTextContent("week_of")
    // (3) glyph-dot spine
    expect(screen.getByTestId("soul-spine")).toBeInTheDocument()
    expect(screen.getAllByTestId(/^spine-dot-/)).toHaveLength(2)
    // (4) ONE tier chip
    expect(screen.getAllByTestId("soul-tier")).toHaveLength(1)
    // (5) output
    expect(screen.getByTestId("soul-output")).toBeInTheDocument()
  })

  it("TIER CONSISTENCY: the same fixture yields the same data-tier at card/run/pub", () => {
    const tiers = SCALES.map((scale) => {
      const { unmount } = render(<WorkflowSoul def={strictDef} scale={scale} />)
      const dataTier = screen.getByTestId("soul-tier").getAttribute("data-tier")
      unmount()
      return dataTier
    })
    expect(tiers).toEqual(["STRICT", "STRICT", "STRICT"])
    // All three identical — the invariant.
    expect(new Set(tiers).size).toBe(1)
  })

  it("HONEST empty-state (D-03): null purpose → 'draft · purpose not declared yet' (atom present)", () => {
    render(<WorkflowSoul def={draftChatDef} scale="card" />)
    const purpose = screen.getByTestId("soul-purpose")
    expect(purpose).toBeInTheDocument()
    expect(purpose).toHaveTextContent(/draft · purpose not declared yet/i)
  })

  it("HONEST empty-state (D-03): no terminal llm_emit → 'produces: answer in chat' (atom present)", () => {
    render(<WorkflowSoul def={draftChatDef} scale="card" />)
    const output = screen.getByTestId("soul-output")
    expect(output).toBeInTheDocument()
    expect(output).toHaveTextContent(/produces: answer in chat/i)
  })

  it("GLYPH + WORD: the tier chip renders tier.glyph AND the tier WORD at every scale", () => {
    for (const scale of SCALES) {
      const { unmount } = render(<WorkflowSoul def={strictDef} scale={scale} />)
      const chip = screen.getByTestId("soul-tier")
      // The locked STRICT glyph 🔒 AND the WORD "Strict" — never colour-alone.
      expect(within(chip).getByText("🔒")).toBeInTheDocument()
      expect(chip.textContent ?? "").toMatch(/strict/i)
      unmount()
    }
  })

  it("renders a file deliverable label when a terminal llm_emit phase exists", () => {
    render(<WorkflowSoul def={strictDef} scale="card" />)
    const output = screen.getByTestId("soul-output")
    // Honest file signal — NOT "answer in chat", and a non-empty label.
    expect(output.textContent ?? "").not.toMatch(/answer in chat/i)
    expect((output.textContent ?? "").trim().length).toBeGreaterThan(0)
  })

  it("never throws on a null def", () => {
    expect(() => render(<WorkflowSoul def={null} scale="card" />)).not.toThrow()
  })

  it("the SOURCE never imports PhaseTimeline or PhaseCard (G-5)", () => {
    const src = workflowSoulSource
    expect(src).not.toMatch(/PhaseTimeline/)
    expect(src).not.toMatch(/PhaseCard/)
    // No local PHASE_GLYPHS / tierForDefinition re-declaration — derived from soulData.
    expect(src).not.toMatch(/const PHASE_GLYPHS/)
    expect(src).not.toMatch(/function tierForDefinition/)
    expect(src).toMatch(/soulData/)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Phase 199-03 Task 1 (DES-01 · sheet 178 `c7-gauntlet-soul` §2) — THE PRE-CHANGE
// INVENTORY at the two scales that are actually MOUNTED, and the sheet's third arm.
//
// ⚠ CORRECTED DURING TASK 2 — the original claim is kept here rather than overwritten,
// because it came from the PLAN and being wrong is the finding. It read: *"`scale="card"`
// is no longer a live consumer: Phase 192.2 removed `<WorkflowSoul scale="card" />` from
// `WorkflowCard.tsx`, so the shipped mounts are `run` and `pub`."* That is FALSE of the
// tree. 192.2 removed the LIBRARY CARD's mount, not the card SCALE:
// `WorkflowDoorSwitch.tsx:451` still mounts `<WorkflowSoul scale="card" />` on the describe
// door, and `WorkflowDoorSwitch.baseline.test.tsx` pins that door's DOM byte for byte — a
// coupling this plan discovered only by breaking it. See the CANNOT-EXPRESS case below.
//
// The two describes here pin `run` and `pub` because those are the scales the plan's two
// named surfaces use; the `card` cases above are untouched and still exercise the third.
//
// ⚠ AND THE SHEET DRAWS A DIFFERENT COMPONENT. Its §2 rows are `glyph + NAME + tier chip`
// on ONE line — that is the LIBRARY CARD's identity line, not the soul. The soul's five
// atoms and their ORDER are locked (046-A) with PURPOSE as the hero at every size, and
// `name` is not one of them. Adopting the sheet's row would delete four atoms including
// the hero, so the shipped language wins and the disagreement is reported, not resolved.
// ─────────────────────────────────────────────────────────────────────────────

/** A MIDDLE workflow — `flag` citation policy WITHOUT the full floor-raising gate set. */
const middleDef: DefShape = {
  name: "Vendor Renewal Risk Sweep",
  business_requirement: "Flag vendor contracts whose renewal terms changed this quarter.",
  input_keys: ["quarter"],
  phases: [
    { slug: "gather", phase_index: 0, name: "Gather contracts", config: { phase_type: "llm_agent" } },
    {
      slug: "emit",
      phase_index: 1,
      name: "Render the sweep",
      config: { phase_type: "llm_emit", citation_policy: "flag" },
      validators: [{ kind: "structure_check" }],
    },
  ],
}

/** A LOOSE workflow — `draft` policy and no structural gate at all. */
const looseDef: DefShape = {
  name: "Scratch notes",
  business_requirement: "Turn my meeting notes into a short summary.",
  phases: [
    {
      slug: "emit",
      phase_index: 0,
      name: "Write it up",
      config: { phase_type: "llm_emit", citation_policy: "draft" },
    },
  ],
}

const LIVE_SCALES = ["run", "pub"] as const

describe("WorkflowSoul 199-03 — the pre-change RESTING inventory at the two LIVE scales", () => {
  it.each(LIVE_SCALES)("(%s) all five atoms render, in the locked order, as literals", (scale) => {
    const { container } = render(<WorkflowSoul def={strictDef} scale={scale} />)

    expect(screen.getByTestId("soul-purpose")).toHaveTextContent(
      "Summarize this week's progress for leadership.",
    )
    expect(screen.getByTestId("soul-needs")).toHaveTextContent("needs week_of")
    expect(screen.getByTestId("soul-spine")).toBeInTheDocument()
    expect(screen.getByTestId("soul-tier")).toHaveAttribute("data-tier", "STRICT")
    expect(screen.getByTestId("soul-output")).toHaveTextContent("produces: Weekly Status · file")

    // THE ORDER IS THE ATOM. A re-presentation may retune layout and typography; it may
    // not reorder, and purpose must lead. Read off the rendered DOM, never asserted twice.
    const ids = Array.from(container.querySelectorAll<HTMLElement>("[data-testid^='soul-']")).map(
      (el) => el.getAttribute("data-testid"),
    )
    expect(ids).toEqual(["soul-purpose", "soul-needs", "soul-spine", "soul-tier", "soul-output"])
  })

  it.each(LIVE_SCALES)("(%s) both honest empty-states are RENDERED, never hidden", (scale) => {
    render(<WorkflowSoul def={draftChatDef} scale={scale} />)
    expect(screen.getByTestId("soul-purpose")).toHaveTextContent("draft · purpose not declared yet")
    expect(screen.getByTestId("soul-output")).toHaveTextContent("produces: answer in chat")
    // The atoms are PRESENT in both empty cases — an absence would be the worse trade.
    expect(screen.getByTestId("soul-needs")).toHaveTextContent("needs kickoff_prompt")
  })

  it("the two live scales render the SAME data — only layout and typography differ", () => {
    const read = (scale: (typeof LIVE_SCALES)[number]) => {
      const { unmount } = render(<WorkflowSoul def={strictDef} scale={scale} />)
      const snapshot = {
        purpose: screen.getByTestId("soul-purpose").textContent,
        needs: screen.getByTestId("soul-needs").textContent,
        tier: screen.getByTestId("soul-tier").getAttribute("data-tier"),
        output: screen.getByTestId("soul-output").textContent,
      }
      unmount()
      return snapshot
    }
    expect(read("run")).toEqual(read("pub"))
  })
})

describe("WorkflowSoul 199-03 — the sheet's UNDETERMINED third arm is NOT adopted", () => {
  it("the third derived band is MIDDLE — a REAL band, and it says its own word", () => {
    // The sheet's third row is captioned `UNDETERMINED` with a `help` glyph and a dashed
    // border — the visual language of "we could not tell". Our third band is `MIDDLE`, and
    // it is a value the code CAN tell: a `flag` citation policy carrying some but not all
    // of the floor-raising gates. Printing "undetermined" over it would be a FALSE claim
    // about our own certainty, so the sheet's word is refused.
    render(<WorkflowSoul def={middleDef} scale="pub" />)
    const chip = screen.getByTestId("soul-tier")
    expect(chip).toHaveAttribute("data-tier", "MIDDLE")
    expect(chip.textContent ?? "").toMatch(/middle/i)
    expect(within(chip).getByText("◐")).toBeInTheDocument()
    // It is a derived band, not an unknown: the chip's own description says what it means.
    expect(chip.getAttribute("title") ?? "").toMatch(/citations flagged or partial/i)
  })

  it("all three arms are real, distinct, derived bands — none of them is an 'unknown'", () => {
    const seen: string[] = []
    for (const def of [strictDef, middleDef, looseDef]) {
      const { unmount } = render(<WorkflowSoul def={def} scale="pub" />)
      seen.push(screen.getByTestId("soul-tier").getAttribute("data-tier") ?? "")
      unmount()
    }
    expect(seen).toEqual(["STRICT", "MIDDLE", "LOOSE"])
  })

  it("all three arms render glyph + WORD identically today — the sheet's WEIGHTING is a CANNOT-EXPRESS", () => {
    // ⚠ THIS CASE PINS A REFUSAL, AND THE REFUSAL IS THE DELIVERABLE.
    //
    // The sheet's one genuinely applicable idea for this atom is that the arms should not
    // weigh the same: it draws STRICT filled and bordered, LOOSE transparent and muted.
    // Ours render ONE identical treatment, so the only separator is the word. That idea
    // was BUILT during this plan and then WITHDRAWN, for a reason worth writing down:
    //
    //   the chip's class string is part of a DOM that a THIRD surface pins byte-for-byte.
    //
    // `WorkflowDoorSwitch.tsx` mounts `<WorkflowSoul scale="card">`, and
    // `WorkflowDoorSwitch.baseline.test.tsx` captures that door's rendered DOM as a
    // characterization baseline. Re-toning the chip failed two of its cases. The plan's
    // binding rule is "never re-baseline a characterization pin to turn red green", and
    // `WorkflowDoorSwitch` is not in this plan's scope — so the honest outcome is to
    // report the gap rather than to widen the plan or to soften the pin.
    //
    // What is pinned here is TODAY's state, so a future plan that does carry the door in
    // its scope INVERTS this case rather than discovering the coupling again.
    const faces = new Set<string>()
    for (const [def, expected] of [
      [strictDef, "STRICT"],
      [middleDef, "MIDDLE"],
      [looseDef, "LOOSE"],
    ] as const) {
      const { unmount } = render(<WorkflowSoul def={def} scale="pub" />)
      const chip = screen.getByTestId("soul-tier")
      expect(chip).toHaveAttribute("data-tier", expected)
      // Glyph AND word on every arm — read from TIERS, the vocabulary's own home, so this
      // cannot go green against a chip that has drifted from it. This is what carries the
      // distinction today, and it is why an identical tone is not a WCAG 1.4.1 problem.
      expect(within(chip).getByText(TIERS[expected].glyph)).toBeInTheDocument()
      expect(chip.textContent ?? "").toContain(TIERS[expected].label)
      faces.add(chip.className)
      unmount()
    }
    // ONE treatment across all three arms — the measured state the sheet disagrees with.
    expect(faces.size).toBe(1)
  })

  it("(the coupling, mechanically) the soul at scale='card' IS still mounted, and its DOM is pinned by that surface", () => {
    // ⚠ AND THIS REFUTES A CLAIM THE PLAN HANDED DOWN. `199-03-PLAN.md` states that
    // `PhaseSpine` "no longer renders at scale='card'" because 192.2 removed
    // `<WorkflowSoul scale="card" />` from `WorkflowCard.tsx`, leaving `run` and `pub` as
    // the only live consumers — and instructs "verify this before assuming a card
    // regression is possible". Verified, and it is FALSE of the tree: 192.2 removed the
    // LIBRARY CARD's mount, not the card SCALE. A second card-scale mount survives on the
    // describe door, and it is the one that made the tone change unshippable.
    expect(doorSwitchSource.length).toBeGreaterThan(500) // non-vacuity: the module loaded
    expect(doorSwitchSource).toMatch(/<WorkflowSoul[^>]*scale="card"/)

    // …and that surface pins the soul's own rendered subtree, which is what turns a tone
    // change into a cross-surface change. The ESCAPED quotes are load-bearing: they are how
    // the captured DOM sits inside a JS string literal, so matching them proves the chip is
    // inside the CAPTURE rather than merely mentioned in the file's prose.
    expect(doorBaselineSource.length).toBeGreaterThan(500)
    expect(doorBaselineSource).toContain('data-testid=\\"soul-tier\\"')
  })

  it("no soul module spells the sheet's word — and the sweep is NON-VACUOUS", () => {
    // A positive control first: without it these three `not.toMatch` calls could be passing
    // because they inspect nothing at all.
    expect("the tier is UNDETERMINED").toMatch(/undetermined/i)
    for (const src of [workflowSoulSource, soulDataSource, deriveTierSource]) {
      expect(src.length).toBeGreaterThan(500) // the module really loaded
      expect(src).not.toMatch(/undetermined/i)
    }
  })
})
