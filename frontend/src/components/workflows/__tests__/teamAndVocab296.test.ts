/**
 * Phase 296-07 Task 1 — the team picture and the step vocabulary, each row driven RED first.
 *
 *  - 290-IN-01  the picture orders tied / unindexed steps exactly as the canvas does
 *  - 290-IN-02  "A step with no type" has ONE home (`phaseVocabulary.STEP_UNTYPED`)
 *  - 290-IN-04  the Steps | Team tablist has roving tabindex, arrow / Home / End keys, ids,
 *               `aria-controls`, and a `role="tabpanel"` container labelled by the selected tab
 *  - 290-IN-05  the `team-plane` scroller is a focusable, named region with the focus ring
 *  - 290-FU-canvas  an `external_action` step paints the armed mark whatever its stored flag says
 *  - 290-OBS-vocab  every map lookup in `phaseVocabulary.ts` is own-property, and a phase with
 *               no `config` never throws
 *
 * Written as a `.ts` file (the plan's name), so the DOM rows use `createElement`.
 */
import { createElement } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"

import { toCanvas } from "../canvasModel"
import { deriveTeam } from "../teamModel"
import * as phaseVocabulary from "../phaseVocabulary"
import type { PhaseSpecJSON } from "../phaseVocabulary"
import * as teamVocabulary from "../teamVocabulary"
import { STEP_LINE_UNTYPED } from "../library/libraryVocabulary"
import { TeamPicture, TeamViewSwitch } from "../TeamPicture"
import { teamFigureLabel } from "../teamVocabulary"

import phaseVocabularySource from "../phaseVocabulary?raw"

afterEach(() => cleanup())

const step = (slug: string, phaseType: string, extra: Record<string, unknown> = {}): PhaseSpecJSON =>
  ({ slug, name: slug, config: { phase_type: phaseType }, ...extra }) as unknown as PhaseSpecJSON

// ── 290-IN-01 ─────────────────────────────────────────────────────────────────────────────

describe("290-IN-01 — the picture numbers steps the way the canvas lays them out", () => {
  const canvasOrder = (phases: PhaseSpecJSON[]) =>
    toCanvas(phases)
      .nodes.filter((n) => phases.some((p) => p.slug === n.id))
      .map((n) => n.id)
  const teamOrder = (phases: PhaseSpecJSON[]) => deriveTeam(phases).steps.map((s) => s.slug)

  it("two steps tied on phase_index read in the same order on both views", () => {
    const phases = [step("zeta", "llm_single", { phase_index: 0 }), step("alpha", "llm_single", { phase_index: 0 })]
    expect(teamOrder(phases)).toEqual(canvasOrder(phases))
  })

  it("a step with NO phase_index is placed by the same rule on both views", () => {
    // The canvas used to subtract `undefined` (NaN) and fall straight through to the slug; the
    // picture coerced the missing index to 0. "alpha" (index 1) and "beta" (no index) came out
    // in opposite orders. One comparator now serves both.
    const phases = [step("alpha", "llm_single", { phase_index: 1 }), step("beta", "llm_single")]
    expect(teamOrder(phases)).toEqual(canvasOrder(phases))
  })
})

// ── 290-IN-02 ─────────────────────────────────────────────────────────────────────────────

describe("290-IN-02 — one home for the untyped-step words", () => {
  it("phaseVocabulary exports STEP_UNTYPED and both surfaces read it", () => {
    const home = (phaseVocabulary as Record<string, unknown>).STEP_UNTYPED
    expect(home).toBe("A step with no type")
    // The library re-exports it under its shipped name …
    expect(STEP_LINE_UNTYPED).toBe(home)
    // … and the team vocabulary (a zero-import leaf) no longer holds a second copy; the
    // team model reads the home directly, which a config-less step shows.
    expect("TEAM_STEP_UNTYPED" in teamVocabulary).toBe(false)
    const bare = { slug: "bare", phase_index: 0 } as unknown as PhaseSpecJSON
    expect(deriveTeam([bare]).steps[0]?.role).toBe(home)
  })
})

// ── 290-IN-04 ─────────────────────────────────────────────────────────────────────────────

describe("290-IN-04 — the Steps | Team tablist is a real tablist", () => {
  function mountSwitch(view: "steps" | "team") {
    const onChange = vi.fn()
    render(createElement(TeamViewSwitch, { view, onChange }))
    return {
      onChange,
      steps: screen.getByTestId("canvas-view-steps"),
      team: screen.getByTestId("canvas-view-team"),
    }
  }

  it("roving tabindex: the selected tab is 0, the other -1", () => {
    const { steps, team } = mountSwitch("steps")
    expect(steps.tabIndex).toBe(0)
    expect(team.tabIndex).toBe(-1)
  })

  it("each tab has an id and aria-controls", () => {
    const { steps, team } = mountSwitch("team")
    expect(steps.id).not.toBe("")
    expect(team.id).not.toBe("")
    expect(steps.id).not.toBe(team.id)
    expect(steps.getAttribute("aria-controls")).toBeTruthy()
    expect(team.getAttribute("aria-controls")).toBeTruthy()
    expect(team.tabIndex).toBe(0)
    expect(steps.tabIndex).toBe(-1)
  })

  it("ArrowRight / ArrowLeft select the other tab and move focus to it", () => {
    const { onChange, steps, team } = mountSwitch("steps")
    steps.focus()
    fireEvent.keyDown(steps, { key: "ArrowRight" })
    expect(onChange).toHaveBeenLastCalledWith("team")
    expect(document.activeElement).toBe(team)
    fireEvent.keyDown(team, { key: "ArrowLeft" })
    expect(onChange).toHaveBeenLastCalledWith("steps")
    expect(document.activeElement).toBe(steps)
  })

  it("Home and End go to the first and last tab", () => {
    const { onChange, steps, team } = mountSwitch("steps")
    fireEvent.keyDown(steps, { key: "End" })
    expect(onChange).toHaveBeenLastCalledWith("team")
    expect(document.activeElement).toBe(team)
    fireEvent.keyDown(team, { key: "Home" })
    expect(onChange).toHaveBeenLastCalledWith("steps")
    expect(document.activeElement).toBe(steps)
  })

  it("the team view sits in a tabpanel labelled by the Team tab", () => {
    render(createElement(TeamViewSwitch, { view: "team", onChange: () => {} }))
    render(
      createElement(TeamPicture, {
        phases: [step("draft", "llm_single", { phase_index: 0 })],
        showTechnical: false,
        workflowName: "Vendor brief",
      }),
    )
    const panel = screen.getByRole("tabpanel")
    const team = screen.getByTestId("canvas-view-team")
    expect(panel.getAttribute("aria-labelledby")).toBe(team.id)
    expect(team.getAttribute("aria-controls")).toBe(panel.id)
  })
})

// ── 290-IN-05 ─────────────────────────────────────────────────────────────────────────────

describe("290-IN-05 — keyboard users can scroll the team plane", () => {
  it.each([
    ["with steps", [step("draft", "llm_single", { phase_index: 0 })]],
    ["with no steps", []],
  ])("the team-plane scroller is a focusable named region (%s)", (_label, phases) => {
    render(createElement(TeamPicture, { phases, showTechnical: false, workflowName: "Vendor brief" }))
    const plane = screen.getByTestId("team-plane")
    expect(plane.tabIndex).toBe(0)
    expect(plane.getAttribute("role")).toBe("region")
    // 302-02 (FE-IN-06 / D-11): was teamFigureLabel(...) — the figure's name said twice.
    expect(plane.getAttribute("aria-label")).toBe("Team view, scrollable")
    expect(plane.getAttribute("aria-label")).not.toBe(teamFigureLabel("Vendor brief"))
    expect(plane.className).toContain("focus-visible:ring-2")
    expect(plane.className).toContain("focus-visible:ring-primary/30")
  })
})

// ── 290-FU-canvas ─────────────────────────────────────────────────────────────────────────

describe("290-FU-canvas — the engine always arms an external_action step", () => {
  it("the node face and the incoming connector are armed with the stored flag false", () => {
    const phases = [
      step("draft", "llm_single", { phase_index: 0 }),
      step("send", "external_action", { phase_index: 1, action_risk_armed: false }),
    ]
    const projection = toCanvas(phases)
    const node = projection.nodes.find((n) => n.id === "send")
    expect((node?.data as { armed?: boolean } | undefined)?.armed).toBe(true)
    const incoming = projection.edges.find((e) => e.target === "send")
    expect((incoming?.data as { armed?: boolean } | undefined)?.armed).toBe(true)
  })

  it("a step of any other type still reads its stored flag", () => {
    const projection = toCanvas([step("draft", "llm_single", { phase_index: 0, action_risk_armed: false })])
    expect((projection.nodes[0]?.data as { armed?: boolean }).armed).toBe(false)
  })
})

// ── 290-OBS-vocab ─────────────────────────────────────────────────────────────────────────

describe("290-OBS-vocab — lookups are own-property and config-less phases never throw", () => {
  it("a phase_type spelling an Object.prototype key resolves to nothing, not a function", () => {
    const ctor = step("weird", "constructor", { phase_index: 0, name: undefined })
    expect(typeof phaseVocabulary.nodeTitle(ctor)).toBe("string")
    expect(phaseVocabulary.nodeTitle(ctor)).toBe("constructor")
    expect(phaseVocabulary.technicalTitle(ctor)).toBe("constructor · weird")
  })

  it("an id that spells an Object.prototype key names nothing", () => {
    const skill = {
      slug: "s",
      phase_index: 0,
      config: { phase_type: "llm_single", skill_ref: "constructor" },
    } as unknown as PhaseSpecJSON
    expect(phaseVocabulary.derivedFaceOf(skill, { skillNames: {} })).toBeNull()
  })

  it("no bracket lookup on a vocabulary or name map is left in the source", () => {
    expect(phaseVocabularySource).not.toMatch(/PHASE_TYPE_SENTENCES\[/)
    expect(phaseVocabularySource).not.toMatch(/PHASE_TYPE_LABELS\[/)
    expect(phaseVocabularySource).not.toMatch(/Names\?\.\[/)
    expect(phaseVocabularySource).not.toMatch(/EXTERNAL_CAPABILITY_[A-Z_]+\[/)
  })

  it("a phase with no config never throws, through every exported reader", () => {
    const bare = { slug: "bare", phase_index: 0 } as unknown as PhaseSpecJSON
    expect(() => phaseVocabulary.nodeTitle(bare)).not.toThrow()
    expect(() => phaseVocabulary.technicalTitle(bare)).not.toThrow()
    expect(() => phaseVocabulary.groundingCauseOf(bare, ["search_documents"])).not.toThrow()
    expect(() => phaseVocabulary.intersectingKbToolOf(bare, ["search_documents"])).not.toThrow()
    expect(() => phaseVocabulary.waitsForYou(bare)).not.toThrow()
    expect(() => phaseVocabulary.notConnectedOf(bare)).not.toThrow()
    expect(phaseVocabulary.groundingCauseOf(bare, ["search_documents"])).toBeNull()
  })
})
