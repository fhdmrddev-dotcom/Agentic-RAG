/**
 * Phase 185-07 Task 2 — acceptance criteria 12 and 13 for the governance section,
 * plus the Req 7 vocabulary lock and the D-185-02 honesty rule, machine-checked.
 *
 * A NET-NEW suite, and deliberately so. It does NOT absorb, replace or re-implement
 * `PhaseFormPanel.test.tsx` (pinned at 19) or `PhaseFormPanel.rails.test.tsx`: those are
 * the regression nets for the PANEL, and Phase 177's coverage-loss lesson — a "net-new"
 * file that quietly REPLACED an existing suite, so the total never moved and nobody
 * noticed — is exactly why `scripts/vitest-count-gate.cjs` pins per-file counts. This
 * file postdates the 424 pin, reports to the gate as `new`, and must NOT be added to
 * `BASELINE` (the `WorkflowBuilderPage.header.test.tsx` precedent). It already sits
 * inside the `src/components/workflows` target glob, so `TARGETS` needs no edit either.
 *
 * WHY THE COMPONENT IS TESTED DIRECTLY RATHER THAN THROUGH THE PANEL. The section is a
 * LEAF: it takes a flat, total prop contract and renders. Driving criteria 12/13 through
 * `PhaseFormPanel` would make every case depend on the panel's per-type field
 * conditioning as well as on the dial, so a red would not say which of the two moved.
 * The panel's own obligations (the mount is gated on `rails`, and document order) are
 * asserted in `PhaseFormPanel.rails.test.tsx`, where the D-14 guard already lives.
 *
 * The fixture idiom is `PhaseFormPanel.rails.test.tsx`'s, adapted: `AGENT` is the same
 * `llm_agent`-with-`search_documents` shape, flattened to props because this component
 * takes no `PhaseSpecJSON` (D-185-10 — a narrow, total contract, never a spread).
 *
 * The banned-vocabulary needles and the two forbidden emit-path phrases are ASSEMBLED
 * FROM STRING FRAGMENTS, so a grep of this guard file can neither satisfy nor break the
 * greps it exists to protect — the D-ITEM-183-02 trap this phase has hit repeatedly.
 */
import { describe, it, expect, vi } from "vitest"
import { fireEvent, render, screen, within } from "@testing-library/react"

import { FieldGuidance } from "./FieldGuidance"
import governanceSectionSource from "./GovernanceSection?raw"
import { GovernanceSection, type GovernanceSectionProps } from "./GovernanceSection"
import {
  ACTION_RISK_ARM_LABEL,
  ACTION_RISK_ARMED_NOTE,
  ACTION_RISK_LOCKED_REFUSAL,
  GROUNDING_ALREADY_SET_NOTE,
  GROUNDING_ATTACHED_GATE,
  GROUNDING_DIAL_LOOSE_LABEL,
  GROUNDING_DIAL_STRICT_LABEL,
  GROUNDING_LOCK_REFUSAL,
  GROUNDING_PUBLISH_CONSEQUENCE,
  GROUNDING_NOTHING_TO_PROVE,
  GROUNDING_TOOL_LIST_IS_THE_CONTROL,
  GROUNDING_WHY_DETECTED,
  GROUNDING_WHY_ESCALATED,
} from "./definitionOps"

/** The server's list, mirrored here as a FIXTURE only — the component never owns it. */
const KB_TOOLS = [
  "search_documents",
  "query_documents",
  "read_document",
  "analyze_document",
  "get_related_documents",
]

/** The shipped `llm_agent` shape — the type that actually carries `available_tools`. */
const AGENT = { phaseType: "llm_agent", availableTools: ["search_documents"] }

/** Every step type that renders NO dial at all (D-185-15 / Req 5). */
const NO_DIAL_TYPES = ["llm_single", "llm_human_input", "programmatic"]

/** Every step type the Builder can create. */
const ALL_TYPES = [
  "programmatic",
  "llm_single",
  "llm_agent",
  "llm_batch_agents",
  "llm_human_input",
  "llm_emit",
]

function renderSection(over: Partial<GovernanceSectionProps> = {}) {
  const props: GovernanceSectionProps = {
    phaseType: "llm_agent",
    availableTools: [],
    kbTools: KB_TOOLS,
    groundingEscalated: false,
    actionRiskArmed: false,
    onGovernanceChange: () => {},
    ...over,
  }
  return render(<GovernanceSection {...props} />)
}

const looseButton = () =>
  screen.queryByRole("button", { name: new RegExp(GROUNDING_DIAL_LOOSE_LABEL) })

const strictButton = () =>
  screen.queryByRole("button", { name: new RegExp(GROUNDING_DIAL_STRICT_LABEL) })

// ── 1. CRITERION 12 — the refusal is TEXT, not a title ────────────────────────────────

describe("GovernanceSection — criterion 12: pressing the refused side prints a readable reason", () => {
  it("renders the refusal as real DOM text, character-identical to the shared constant", () => {
    renderSection(AGENT)
    // Imported, so this assertion is character-identity: the component cannot drift a
    // word without going red, and it authors no sentence it could drift.
    expect(screen.getByText(GROUNDING_LOCK_REFUSAL)).toBeInTheDocument()
  })

  it("finds that reason on NO title attribute anywhere (the 184-07 lesson)", () => {
    renderSection(AGENT)
    expect(() => screen.getByTitle(GROUNDING_LOCK_REFUSAL)).toThrow()
    expect(looseButton()).not.toHaveAttribute("title")
  })

  it("wires the loose side to its visible reason via aria-describedby (the round trip)", () => {
    renderSection(AGENT)
    const loose = looseButton()
    expect(loose).not.toBeNull()
    const describedBy = loose!.getAttribute("aria-describedby")
    expect(describedBy).toBeTruthy()
    const reason = document.getElementById(describedBy as string)
    expect(reason).not.toBeNull()
    expect(reason?.textContent).toBe(GROUNDING_LOCK_REFUSAL)
  })

  it("marks the refused side struck through, disabled and aria-disabled — never hidden", () => {
    renderSection(AGENT)
    const loose = looseButton()!
    expect(loose).toBeInTheDocument()
    expect(loose.getAttribute("data-refused")).toBe("true")
    expect(loose).toHaveAttribute("aria-disabled", "true")
    expect(loose.className).toContain("line-through")
  })

  it("pressing the refused side does NOT write (the lock has no undo)", () => {
    const onGovernanceChange = vi.fn()
    renderSection({ ...AGENT, onGovernanceChange })
    fireEvent.click(looseButton()!)
    expect(onGovernanceChange).not.toHaveBeenCalled()
  })

  it("POSITIVE CONTROL — an unlocked agent step has NO refusal and no describedby", () => {
    // Without this, every assertion above could pass on a component that always refuses.
    renderSection({ phaseType: "llm_agent", availableTools: ["execute_code"] })
    expect(screen.queryByText(GROUNDING_LOCK_REFUSAL)).toBeNull()
    expect(looseButton()).not.toHaveAttribute("aria-describedby")
    expect(looseButton()!.getAttribute("data-refused")).toBe("false")
  })
})

// ── 2. CRITERION 13 — absent, not disabled ────────────────────────────────────────────

describe("GovernanceSection — criterion 13: a step that can never be grounded has NO dial", () => {
  for (const phaseType of NO_DIAL_TYPES) {
    it(`${phaseType}: the dial query returns null (not a disabled node)`, () => {
      renderSection({ phaseType, availableTools: ["search_documents"] })
      // `null`, deliberately. Asserting that the control is merely greyed out would pin
      // the exact defect Req 5 forbids: a control that could never do anything, still on
      // screen. Absence is the acceptance bar; the four disabled-state assertions in this
      // file all sit on `llm_agent`, whose loose side IS refused rather than removed.
      expect(looseButton()).toBeNull()
      expect(strictButton()).toBeNull()
      expect(screen.queryByTestId("governance-dial")).toBeNull()
    })

    it(`${phaseType}: the SECTION still renders, and it says something honest (D-185-16)`, () => {
      renderSection({ phaseType })
      const section = screen.getByTestId("rail-governance")
      expect(section).toBeInTheDocument()
      expect(within(section).getByText(GROUNDING_NOTHING_TO_PROVE)).toBeInTheDocument()
    })

    it(`${phaseType}: a stored escalation bit cannot conjure a dial back`, () => {
      // The bit is INERT where the control is unrepresentable — an escalated `llm_single`
      // has no retrieval path, so a gate attached to it would fail on every single run.
      renderSection({ phaseType, groundingEscalated: true })
      expect(screen.queryByTestId("governance-dial")).toBeNull()
      expect(screen.queryByTestId("governance-attached")).toBeNull()
      expect(screen.getByText(GROUNDING_NOTHING_TO_PROVE)).toBeInTheDocument()
    })
  }

  it("POSITIVE CONTROL — both dial types DO render the control", () => {
    for (const phaseType of ["llm_agent", "llm_batch_agents"]) {
      const { unmount } = renderSection({ phaseType })
      expect(looseButton()).not.toBeNull()
      expect(strictButton()).not.toBeNull()
      expect(screen.queryByText(GROUNDING_NOTHING_TO_PROVE)).toBeNull()
      unmount()
    }
  })
})

// ── 3. CRITERION 7 (DOM half) — you can only undo a lock you created ──────────────────

describe("GovernanceSection — the one-way lock", () => {
  it("an ESCALATED step with no KB tool offers a pressable undo", () => {
    const onGovernanceChange = vi.fn()
    renderSection({
      phaseType: "llm_agent",
      availableTools: ["execute_code"],
      groundingEscalated: true,
      onGovernanceChange,
    })

    expect(screen.getByTestId("governance-why").textContent).toBe(GROUNDING_WHY_ESCALATED)
    const loose = looseButton()!
    expect(loose).not.toBeDisabled()
    fireEvent.click(loose)
    expect(onGovernanceChange).toHaveBeenCalledWith({ grounding_escalated: false })
  })

  it("the SAME step with a KB tool added loses the undo and calls nothing", () => {
    const onGovernanceChange = vi.fn()
    renderSection({
      phaseType: "llm_agent",
      availableTools: ["execute_code", "search_documents"],
      groundingEscalated: true,
      onGovernanceChange,
    })

    // Detection wins and the stored bit goes inert — the reason on screen changes with it.
    expect(screen.getByTestId("governance-why").textContent).toBe(GROUNDING_WHY_DETECTED)
    expect(looseButton()).toBeDisabled()
    fireEvent.click(looseButton()!)
    expect(onGovernanceChange).not.toHaveBeenCalled()
  })

  it("a FREE step can be escalated by hand — the one authored cause", () => {
    const onGovernanceChange = vi.fn()
    renderSection({ phaseType: "llm_agent", availableTools: ["execute_code"], onGovernanceChange })

    expect(screen.queryByTestId("governance-why")).toBeNull()
    expect(screen.queryByTestId("governance-attached")).toBeNull()
    fireEvent.click(strictButton()!)
    expect(onGovernanceChange).toHaveBeenCalledWith({ grounding_escalated: true })
  })

  it("each of the five KB tools locks the step ON ITS OWN", () => {
    for (const tool of KB_TOOLS) {
      const { unmount } = renderSection({ phaseType: "llm_agent", availableTools: [tool] })
      expect(screen.getByTestId("rail-governance").getAttribute("data-cause")).toBe("detected")
      expect(looseButton()).toBeDisabled()
      unmount()
    }
  })

  it("an empty KB list marks NOTHING — a failed palette read never invents a lock", () => {
    renderSection({ ...AGENT, kbTools: [] })
    expect(screen.getByTestId("rail-governance").getAttribute("data-cause")).toBe("none")
    expect(looseButton()).not.toBeDisabled()
  })

  it("the attached-gate statement appears for BOTH lock causes and for neither free step", () => {
    const detected = renderSection(AGENT)
    expect(screen.getByTestId("governance-attached").textContent).toContain(GROUNDING_ATTACHED_GATE)
    detected.unmount()

    const escalated = renderSection({
      phaseType: "llm_agent",
      availableTools: [],
      groundingEscalated: true,
    })
    expect(screen.getByTestId("governance-attached").textContent).toContain(GROUNDING_ATTACHED_GATE)
    escalated.unmount()

    renderSection({ phaseType: "llm_agent", availableTools: [] })
    expect(screen.queryByTestId("governance-attached")).toBeNull()
  })

  it("the tool list is named as the real control, wherever a dial renders", () => {
    renderSection(AGENT)
    expect(screen.getByText(GROUNDING_TOOL_LIST_IS_THE_CONTROL)).toBeInTheDocument()
  })
})

// ── 4. D-185-15 / L-14 — the deliverable owns its own strictness ──────────────────────

describe("GovernanceSection — llm_emit is READ-ONLY here (L-14)", () => {
  it("renders no dial and the already-set note when the policy is strict", () => {
    renderSection({ phaseType: "llm_emit", citationPolicy: "strict" })

    expect(screen.queryByTestId("governance-dial")).toBeNull()
    expect(screen.getByText(GROUNDING_ALREADY_SET_NOTE)).toBeInTheDocument()
    expect(screen.getByTestId("rail-governance").getAttribute("data-cause")).toBe("already-set")
  })

  it("offers NO second control for a value the citation policy dial already owns", () => {
    renderSection({ phaseType: "llm_emit", citationPolicy: "strict" })

    const section = screen.getByTestId("rail-governance")
    const controls = section.querySelectorAll('button, [role="button"], input, select, textarea')
    expect(controls).toHaveLength(1)
    expect(controls[0]).toBe(screen.getByTestId("governance-arm"))
  })

  it("a non-strict deliverable says the honest thing instead", () => {
    renderSection({ phaseType: "llm_emit", citationPolicy: "draft" })
    expect(screen.queryByText(GROUNDING_ALREADY_SET_NOTE)).toBeNull()
    expect(screen.getByText(GROUNDING_NOTHING_TO_PROVE)).toBeInTheDocument()
  })
})

// ── 5. THE ACTION-RISK SWITCH (Req 8 / Req 9) ─────────────────────────────────────────

describe("GovernanceSection — the action-risk checkpoint", () => {
  it("is offered on EVERY step type", () => {
    for (const phaseType of ALL_TYPES) {
      const { unmount } = renderSection({ phaseType })
      expect(screen.getByRole("switch", { name: ACTION_RISK_ARM_LABEL })).toBeInTheDocument()
      unmount()
    }
  })

  it("defaults to OFF in 185 — arming is always the author's act", () => {
    renderSection({ phaseType: "llm_agent" })
    expect(screen.getByTestId("governance-arm")).toHaveAttribute("aria-checked", "false")
  })

  it("toggling on writes the armed intent", () => {
    const onGovernanceChange = vi.fn()
    renderSection({ phaseType: "llm_agent", onGovernanceChange })
    fireEvent.click(screen.getByTestId("governance-arm"))
    expect(onGovernanceChange).toHaveBeenCalledWith({ action_risk_armed: true })
  })

  it("toggling off writes the disarmed intent", () => {
    const onGovernanceChange = vi.fn()
    renderSection({ phaseType: "llm_agent", actionRiskArmed: true, onGovernanceChange })
    fireEvent.click(screen.getByTestId("governance-arm"))
    expect(onGovernanceChange).toHaveBeenCalledWith({ action_risk_armed: false })
  })

  it("says the run waits ONLY when armed — an unarmed step claims nothing (Req 9)", () => {
    const unarmed = renderSection({ phaseType: "llm_agent" })
    expect(screen.queryByText(ACTION_RISK_ARMED_NOTE)).toBeNull()
    expect(screen.queryByTestId("governance-armed-note")).toBeNull()
    unarmed.unmount()

    renderSection({ phaseType: "llm_agent", actionRiskArmed: true })
    expect(screen.getByText(ACTION_RISK_ARMED_NOTE)).toBeInTheDocument()
    expect(screen.getByTestId("governance-arm")).toHaveAttribute("aria-checked", "true")
  })

  // ── Phase 189 (D-04 / D-24) — the ONE type where the switch refuses ────────────────
  //
  // ⚠ THE NEGATIVE CONTROL IS NOT OPTIONAL and it is written FIRST. Every assertion below
  // could be satisfied by disabling the switch on EVERY step type, which would silently
  // delete a shipped control from six surfaces. The six-type case is what makes the pin
  // mean "this type" rather than "all types".

  it("NEGATIVE CONTROL — all SIX shipped types keep an INTERACTIVE switch that fires", () => {
    for (const phaseType of ALL_TYPES) {
      const onGovernanceChange = vi.fn()
      const { unmount } = renderSection({ phaseType, onGovernanceChange })
      const arm = screen.getByTestId("governance-arm")

      expect(arm).not.toBeDisabled()
      expect(arm).not.toHaveAttribute("aria-disabled")
      expect(arm).toHaveAttribute("data-arm-pinned", "false")
      expect(arm).toHaveAttribute("aria-checked", "false")
      // DRIVEN, not read: the callback really does fire on these six.
      fireEvent.click(arm)
      expect(onGovernanceChange).toHaveBeenCalledWith({ action_risk_armed: true })
      expect(screen.queryByTestId("governance-arm-refusal")).toBeNull()
      unmount()
    }
  })

  it("external_action: the switch renders ON, disabled, and its callback does NOT fire", () => {
    const onGovernanceChange = vi.fn()
    // ⚠ `actionRiskArmed: false` ON PURPOSE. That is the state a freshly-placed step is
    // in — `minimalPhaseFor` emits no `action_risk_armed` — and rendering OFF there would
    // be the exact lie D-04 exists to prevent. The rendered value is a fact about the
    // TYPE, which the server pins at the Pydantic level (189-07).
    renderSection({ phaseType: "external_action", actionRiskArmed: false, onGovernanceChange })

    const arm = screen.getByTestId("governance-arm")
    expect(arm).toHaveAttribute("aria-checked", "true")
    expect(arm).toBeDisabled()
    expect(arm).toHaveAttribute("aria-disabled", "true")
    expect(arm.className).toContain("cursor-not-allowed")
    // The ON track really is painted — `aria-checked` alone would pass on a switch that
    // announces one state and paints the other.
    expect(screen.getByTestId("governance-arm-track").className).toContain("hsl(38_92%_60%/0.55)")

    // DRIVE THE CLICK. Asserting the attribute alone would pass on a control that still
    // fires — `disabled` is a browser behaviour, and the handler is the second lock.
    fireEvent.click(arm)
    expect(onGovernanceChange).not.toHaveBeenCalled()
  })

  it("external_action: the reason is REAL DOM TEXT, and NO `title` carries it", () => {
    renderSection({ phaseType: "external_action" })

    const refusal = screen.getByTestId("governance-arm-refusal")
    // Character-identity against the imported constant — the component authors nothing.
    expect(refusal).toHaveTextContent(ACTION_RISK_LOCKED_REFUSAL)
    expect(screen.getByText(ACTION_RISK_LOCKED_REFUSAL)).toBeInTheDocument()

    // `aria-describedby` points AT it, and the id really resolves — a dangling id is a
    // sentence a screen reader never reaches.
    const describedBy = screen.getByTestId("governance-arm").getAttribute("aria-describedby") ?? ""
    expect(describedBy.split(/\s+/)).toContain(refusal.id)
    expect(refusal.id).not.toBe("")

    // THE RECORDED LESSON, asserted explicitly: no element in this section carries the
    // sentence as a tooltip, and no element carries a `title` at all.
    expect(
      screen.getByTestId("rail-governance").querySelectorAll("[title]"),
    ).toHaveLength(0)
  })

  it("external_action: the switch is NOT struck through and NOT dimmed", () => {
    // Strike-through is 142-B's treatment for a REFUSED OPTION. This control states a fact
    // that is TRUE and ACTIVE; striking it would read as "this protection is off".
    const { container } = renderSection({ phaseType: "external_action" })
    const arm = screen.getByTestId("governance-arm")

    expect(arm.className).not.toContain("line-through")
    expect(arm.className).not.toContain("opacity-[0.42]")
    expect(container.innerHTML).not.toContain("line-through")

    // POSITIVE CONTROL — the strike-through class really IS rendered where 142-B puts it,
    // so the absence above is a decision rather than a class name that never appears.
    const locked = renderSection({ phaseType: "llm_agent", availableTools: ["search_documents"] })
    expect(locked.container.innerHTML).toContain("line-through")
  })

  it("external_action: the cost note still renders BENEATH the refusal, unchanged", () => {
    // Two facts, two sentences: the new one says why arming cannot be REMOVED, the shipped
    // one says what arming COSTS. Neither restates the other, and the order is the reading.
    renderSection({ phaseType: "external_action" })
    const refusal = screen.getByTestId("governance-arm-refusal")
    const note = screen.getByTestId("governance-armed-note")

    expect(note).toHaveTextContent(ACTION_RISK_ARMED_NOTE)
    expect(refusal.compareDocumentPosition(note) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(ACTION_RISK_LOCKED_REFUSAL).not.toBe(ACTION_RISK_ARMED_NOTE)
  })

  it("external_action: NO grounding dial, and the nothing-to-prove phrase instead (D-26)", () => {
    // A connector performs an action and makes no claim: its capabilities are disjoint
    // from `KB_TOOLS`, so it reads no documents and has nothing to prove. The MISSING dial
    // and the MISSING ⛨ seal are both correct, not gaps.
    renderSection({ phaseType: "external_action", availableTools: ["send_email"] })

    expect(screen.queryByTestId("governance-dial")).toBeNull()
    expect(looseButton()).toBeNull()
    expect(strictButton()).toBeNull()
    expect(screen.getByText(GROUNDING_NOTHING_TO_PROVE)).toBeInTheDocument()
    expect(screen.getByTestId("rail-governance").getAttribute("data-cause")).toBe("none")
    // …and a stored escalation bit cannot conjure one back on this type either.
    const escalated = renderSection({ phaseType: "external_action", groundingEscalated: true })
    expect(within(escalated.container).queryByTestId("governance-dial")).toBeNull()
  })

  it("`DIAL_TYPES` was NOT widened — external_action is absent from the source list", () => {
    // A D-185-15 red line, asserted on source because the render cases above can only
    // prove the types they render. `ARM_PINNED_TYPES` is a SEPARATE list answering a
    // different question, and merging the two is the failure this guards.
    const dialTypes = governanceSectionSource.match(
      /const DIAL_TYPES: readonly string\[\] = \[[^\]]*\]/,
    )
    expect(dialTypes).not.toBeNull()
    expect(dialTypes![0]).toBe('const DIAL_TYPES: readonly string[] = ["llm_agent", "llm_batch_agents"]')
    expect(governanceSectionSource).toMatch(
      /const ARM_PINNED_TYPES: readonly string\[\] = \["external_action"\]/,
    )
  })

  it("renders read-only with NO writer wired — the section never disappears, and never throws", () => {
    // 185-08 supplies the handler. Until then a dropped wiring must be VISIBLE, not silent.
    render(
      <GovernanceSection
        phaseType="llm_agent"
        availableTools={["search_documents"]}
        kbTools={KB_TOOLS}
        groundingEscalated={false}
        actionRiskArmed={false}
      />,
    )
    expect(screen.getByTestId("rail-governance")).toBeInTheDocument()
    expect(() => fireEvent.click(screen.getByTestId("governance-arm"))).not.toThrow()
    expect(() => fireEvent.click(strictButton()!)).not.toThrow()
  })
})

// ── 6. D-185-02 AND REQ 7 — the vocabulary locks, machine-checked ─────────────────────

/** Assembled from fragments so a grep of THIS file cannot satisfy the guards it protects. */
const EMIT_PATH_PHRASES = ["every value " + "traceable", "everything it says is " + "checked"]
const BANNED_TERMS = ["Pro" + "ven", "Ungo" + "verned", "Unch" + "ecked", "Not app" + "licable"]

function renderedText(phaseType: string, over: Partial<GovernanceSectionProps> = {}): string {
  const { unmount } = renderSection({ phaseType, ...over })
  const text = screen.getByTestId("rail-governance").textContent ?? ""
  unmount()
  return text
}

describe("GovernanceSection — the copy locks", () => {
  it("D-185-02: a detected AGENT step never wears the deliverable path's stronger claim", () => {
    const text = renderedText("llm_agent", { availableTools: ["search_documents"] }).toLowerCase()
    for (const phrase of EMIT_PATH_PHRASES) {
      expect(text).not.toContain(phrase.toLowerCase())
    }
    // The honest agent-step claim IS made — this is not an assertion that says nothing.
    expect(text).toContain("retrieved")
    expect(text).toContain("point at what it used")
  })

  it("POSITIVE CONTROL — those needles really do fire on the phrase they forbid", () => {
    for (const phrase of EMIT_PATH_PHRASES) {
      expect(`before it ships, ${phrase} in the deliverable`).toContain(phrase)
    }
  })

  it("Req 7: the required vocabulary is on screen where each phrase belongs", () => {
    expect(renderedText("llm_agent", { availableTools: ["search_documents"] })).toMatch(
      /Must prove it/,
    )
    expect(renderedText("llm_agent")).toMatch(/Free to think/)
    expect(renderedText("llm_human_input")).toMatch(/Nothing to prove here/)
  })

  it("Req 7: no banned reading appears on ANY step type, in any state", () => {
    const banned = new RegExp(`\\b(${BANNED_TERMS.join("|")}|N\\/A)\\b`, "i")
    for (const phaseType of ALL_TYPES) {
      for (const armed of [false, true]) {
        for (const tools of [[], ["search_documents"]]) {
          const text = renderedText(phaseType, {
            availableTools: tools,
            actionRiskArmed: armed,
            citationPolicy: "strict",
          })
          expect(text).not.toMatch(banned)
        }
      }
    }
  })

  it("POSITIVE CONTROL — the banned pattern really does go red on a planted term", () => {
    const banned = new RegExp(`\\b(${BANNED_TERMS.join("|")}|N\\/A)\\b`, "i")
    for (const term of [...BANNED_TERMS, "N/A"]) {
      expect(`this step is ${term} today`).toMatch(banned)
    }
    expect("this step must prove it").not.toMatch(banned)
  })
})

// ── 7. THE SOURCE FENCE (the shipped `?raw` house idiom, S7) ──────────────────────────

describe("GovernanceSection — source purity", () => {
  it("imports nothing from the API client and opens no request", () => {
    expect(governanceSectionSource).not.toMatch(/from\s+["']@\/lib\/api["']/)
    expect(governanceSectionSource).not.toMatch(/fetch\(/)
    expect(governanceSectionSource).not.toMatch(/XMLHttpRequest|EventSource|navigator\.sendBeacon/)
  })

  it("carries NO title attribute — the refusal cannot regress into a tooltip", () => {
    expect(governanceSectionSource).not.toMatch(/title=/)
    expect(governanceSectionSource).toMatch(/aria-describedby/)
  })

  it("takes every sentence from the one vocabulary home rather than authoring any", () => {
    expect(governanceSectionSource).toMatch(
      /from\s+["']@\/components\/workflows\/definitionOps["']/,
    )
    expect(governanceSectionSource).toMatch(/GROUNDING_LOCK_REFUSAL/)
  })

  it("keeps the KB list on the server — it declares no tool-name table of its own", () => {
    // Two-or-more tool ids in one array literal would be a second home for the rule
    // D-182-06 puts on the server. The fixture in THIS file is not the component.
    expect(governanceSectionSource).not.toMatch(
      /\[\s*["'][a-z_]+_documents?["']\s*,\s*["'][a-z_]+["']/,
    )
  })

  it("those fences are real — each pattern matches its planted literal", () => {
    expect('import { x } from "@/lib/api"').toMatch(/from\s+["']@\/lib\/api["']/)
    expect('const r = await fetch("/x")').toMatch(/fetch\(/)
    expect("new EventSource(url)").toMatch(/XMLHttpRequest|EventSource|navigator\.sendBeacon/)
    expect('<span title="why">x</span>').toMatch(/title=/)
    expect('const KB = ["search_documents", "read_document"]').toMatch(
      /\[\s*["'][a-z_]+_documents?["']\s*,\s*["'][a-z_]+["']/,
    )
  })
})

// ── 199-06 (DES-01) — THE DENSITY CEILING CANNOT REACH THE REFUSAL ────────────────────
//
// Phase 199-06 folded this panel's per-field guidance behind one switch. The threat that
// change carries (T-199-06-02) is not that the dial breaks — it is that a control which
// VISIBLY REFUSES quietly degrades into one that is merely DISABLED, because its reason
// went behind a click. That is a governance regression wearing a tidy-up.
//
// The claim asserted here is structural rather than incidental: this component reads no
// guidance context at all, so the ceiling has no mechanism by which to reach it. The cases
// mount the section inside the real provider, at its COLLAPSED reading, and drive the same
// assertions criterion 12 already makes — a fence is only worth having if it fails when the
// property fails, so the wrapper is the shipped one and not a stub.
describe("GovernanceSection 199-06 — the refusal survives the panel's density ceiling", () => {
  it("SOURCE — the section reads NO guidance context, so the ceiling cannot reach it", () => {
    const src = governanceSectionSource as string
    // Built, never spelled: this file greps the component for a token, so a comment naming
    // it would be counted by its own fence (the 187-24 trap, hit twice in this phase).
    expect(src.split("use" + "FieldGuidance").length - 1).toBe(0)
    expect(src.split("Field" + "Guidance").length - 1).toBe(0)
    // NON-VACUITY — the source really was loaded and really is this component.
    expect(src.length).toBeGreaterThan(1000)
    expect(src).toContain("export function GovernanceSection")
  })

  it("POSITIVE CONTROL — that needle really can find what it forbids", () => {
    const planted = 'const shown = use' + 'FieldGuidance()'
    expect(planted.split("use" + "FieldGuidance").length - 1).toBe(1)
  })

  it("at the COLLAPSED reading the refusal is still real DOM text, character-identical", () => {
    render(
      <FieldGuidance>
        <GovernanceSection
          phaseType="llm_agent"
          availableTools={["search_documents"]}
          kbTools={KB_TOOLS}
          groundingEscalated={false}
          actionRiskArmed
          onGovernanceChange={() => {}}
        />
      </FieldGuidance>,
    )
    // The ceiling really is collapsed — otherwise this case would prove nothing.
    expect(screen.getByTestId("field-guidance-toggle").getAttribute("aria-expanded")).toBe("false")
    // …and every atom of the refusal is on screen anyway.
    expect(screen.getByText(GROUNDING_LOCK_REFUSAL)).toBeInTheDocument()
    expect(screen.getByText(GROUNDING_WHY_DETECTED)).toBeInTheDocument()
    expect(screen.getByText(GROUNDING_TOOL_LIST_IS_THE_CONTROL)).toBeInTheDocument()
    expect(screen.getByText(GROUNDING_ATTACHED_GATE)).toBeInTheDocument()
    expect(screen.getByText(ACTION_RISK_ARMED_NOTE)).toBeInTheDocument()
  })

  it("⚠ it REFUSES, it is not merely disabled — the reason is still WIRED to the control", () => {
    render(
      <FieldGuidance>
        <GovernanceSection
          phaseType="llm_agent"
          availableTools={["search_documents"]}
          kbTools={KB_TOOLS}
          groundingEscalated={false}
          actionRiskArmed={false}
          onGovernanceChange={() => {}}
        />
      </FieldGuidance>,
    )
    const loose = looseButton() as HTMLButtonElement
    // A disabled control with an unreachable reason is the regression. The round trip —
    // control → aria-describedby → visible sentence — is what makes it a refusal instead.
    expect(loose).toBeDisabled()
    const describedBy = loose.getAttribute("aria-describedby")
    expect(describedBy).toBeTruthy()
    expect(document.getElementById(describedBy as string)?.textContent).toBe(GROUNDING_LOCK_REFUSAL)
    // …and the reason is STILL not hiding on a title attribute.
    expect(loose).not.toHaveAttribute("title")
    // Struck through and dimmed — refused, never hidden (142-B), still true after the change.
    expect(loose.className).toContain("line-through")
  })

  it("both sides of the DOOR carry their binding words at the collapsed reading", () => {
    render(
      <FieldGuidance>
        <GovernanceSection {...({ phaseType: "llm_agent", availableTools: [], kbTools: KB_TOOLS, groundingEscalated: false, actionRiskArmed: false, onGovernanceChange: () => {} })} />
      </FieldGuidance>,
    )
    expect(looseButton()).toHaveTextContent(GROUNDING_DIAL_LOOSE_LABEL)
    expect(strictButton()).toHaveTextContent(GROUNDING_DIAL_STRICT_LABEL)
    expect(screen.getByTestId("governance-arm")).toHaveTextContent(ACTION_RISK_ARM_LABEL)
  })
})

// ── SEED-230 — THE CONSEQUENCE, AND THE ONE ARM IT MAY NOT APPEAR ON ────────────────────
//
// The operator scrolled past this whole section and then spent four failed publishes finding
// the rule by experiment. Everything the section said described a STATE ("held strictly", "a
// check runs on this step") and nothing said what the state DOES. These cases pin the sentence
// that closes that, and — more importantly — pin where it must NOT appear.
describe("SEED-230: the panel names the publish consequence", () => {
  it("says it on a DETECTED step — the one the engine actually gates", () => {
    renderSection(AGENT)
    expect(screen.getByTestId("governance-publish-consequence").textContent).toBe(
      GROUNDING_PUBLISH_CONSEQUENCE,
    )
  })

  it("⭐ says NOTHING on an ESCALATED step, because no gate is attached to one", () => {
    // `grounding.effective_phase` synthesizes `citations_required` for `detected` ONLY. An
    // author who turned the dial by hand gets the seal and NO synthesized gate, so promising
    // them a publish refusal would be a claim about a check that does not exist. This is the
    // case that makes the sentence honest rather than merely present.
    renderSection({ phaseType: "llm_agent", availableTools: ["execute_code"], groundingEscalated: true })
    expect(screen.getByTestId("governance-why").textContent).toBe(GROUNDING_WHY_ESCALATED)
    expect(screen.queryByTestId("governance-publish-consequence")).toBeNull()
  })

  it("says nothing on a step held to nothing", () => {
    renderSection({ phaseType: "llm_agent", availableTools: ["execute_code"] })
    expect(screen.queryByTestId("governance-publish-consequence")).toBeNull()
  })

  it("says nothing on a step type that carries no dial", () => {
    renderSection({ phaseType: "llm_single", availableTools: ["search_documents"] })
    expect(screen.queryByTestId("governance-publish-consequence")).toBeNull()
  })

  it("is CONDITIONAL on the outcome, never on the state", () => {
    // The gate retries twice, and a step that retrieves something on the retry publishes fine
    // — measured 2 of 8 attempts recovering exactly that way. So the copy may not say the step
    // "cannot be published"; it must condition on what the run produces.
    const copy = GROUNDING_PUBLISH_CONSEQUENCE.toLowerCase()
    expect(copy).toContain("if ")
    for (const forbidden of ["cannot be published", "can't be published", "will fail", "blocked"]) {
      expect(copy).not.toContain(forbidden)
    }
  })

  it("shares the refusal's vocabulary, so meeting either surface explains the other", () => {
    // The publish block reads "…nothing was retrieved (0 sources) — this step reads your
    // documents and must show where its answer came from". Both sides must say `retriev`.
    renderSection(AGENT)
    const panel = screen.getByTestId("governance-publish-consequence").textContent ?? ""
    expect(panel.toLowerCase()).toContain("retriev")
    expect(panel.toLowerCase()).toContain("publish")
  })
})
