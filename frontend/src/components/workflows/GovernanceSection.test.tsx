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

import governanceSectionSource from "./GovernanceSection?raw"
import { GovernanceSection, type GovernanceSectionProps } from "./GovernanceSection"
import {
  ACTION_RISK_ARM_LABEL,
  ACTION_RISK_ARMED_NOTE,
  GROUNDING_ALREADY_SET_NOTE,
  GROUNDING_ATTACHED_GATE,
  GROUNDING_DIAL_LOOSE_LABEL,
  GROUNDING_DIAL_STRICT_LABEL,
  GROUNDING_LOCK_REFUSAL,
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
