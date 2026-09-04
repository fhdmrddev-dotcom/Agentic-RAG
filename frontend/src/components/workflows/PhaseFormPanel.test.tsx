/**
 * Phase 103-04 Task 2 (REQ-5 / WFAUTH-01, sketch 019-D D9) — PhaseFormPanel tests.
 *
 * Phase 103-ux: the form now uses PLAIN-LANGUAGE labels (Instructions, AI model,
 * Creativity, What this step can do, Folders it can read, …) with the technical
 * term behind an ⓘ hint, AND an always-visible muted helper sentence under every
 * field label (no hover/click needed). These tests assert the FRIENDLY accessible
 * names, the always-visible helper line, + the locked per-type field CONDITIONING
 * (unchanged from the raw-label version):
 *  - each of the 6 phase types renders ONLY its real fields; the others are ABSENT
 *    (programmatic/llm_human_input show NO model/tools/scope; only llm_emit has the
 *    sourcing-strictness control).
 *  - on llm_emit, the file-check (integrity_policy) control is present but
 *    DISABLED/read-only (greyed); it appears on NO other type, and the
 *    sourcing-strictness (citation_policy) control is editable.
 *  - folder_scope renders the folder NAME + bound UUID, NEVER a path.
 *  - the panel is NOT position:absolute/fixed — it is a grid track (push, not overlay).
 *  - a field change calls onChange; a blur/save calls onPersist.
 */
import { describe, it, expect, vi } from "vitest"
import { fireEvent, render, screen, within } from "@testing-library/react"
// Read the component SOURCE via Vite's ?raw loader (typechecks under `vite/client`).
import phaseFormPanelSource from "./PhaseFormPanel?raw"
// 200-04 — read so `SP-MR-04`'s mark can be tied to the ONE home of the arm-pinned decision
// (`ARM_PINNED_TYPES`), rather than to a second copy of that list living in this phase.
import governanceSectionSource from "./GovernanceSection?raw"
import {
  STEP_CARD_DELIVERS_TITLE,
  STEP_CARD_MODEL_TITLE,
  STEP_CARD_NEEDS_ARMING,
  STEP_CARD_NO_SOURCE_ADD,
  STEP_CARD_OUTSIDE_SENTENCE,
  STEP_CARD_OUTSIDE_TITLE,
  STEP_CARD_REACH_TITLE,
  STEP_CARD_WHAT_IT_DOES_TITLE,
} from "./stepCardSectionContext"
// 200-04 — the ONE tool-phrase home, so the fence asserts what a person reads against the
// same reader the panel uses rather than against a second copy of the phrases.
// SEED-230 — the sentence whose 87 characters ARE the density delta below. Imported from its
// declaring home so the arithmetic reads the shipped string, never a second copy of it.
import { GROUNDING_PUBLISH_CONSEQUENCE } from "@/components/workflows/definitionOps"
import { toolName } from "./toolNames"
import { FIELD_GUIDANCE_HIDE, FIELD_GUIDANCE_SHOW } from "./fieldGuidanceContext"
import { PhaseFormPanel, type PhaseFormRails } from "./PhaseFormPanel"
import {
  ACTION_RISK_ARM_LABEL,
  GOVERNANCE_GATE_ROW_LABEL,
  GROUNDING_DIAL_LOOSE_LABEL,
  GROUNDING_DIAL_STRICT_LABEL,
  GROUNDING_LOCK_REFUSAL,
  minimalPhaseFor,
  PHASE_TYPE_ORDER,
} from "./definitionOps"
import type { PhaseSpecJSON } from "./phaseVocabulary"

function phaseOf(config: Record<string, unknown>, extra: Partial<PhaseSpecJSON> = {}): PhaseSpecJSON {
  return {
    slug: "p",
    phase_index: 0,
    name: "A phase",
    config: config as PhaseSpecJSON["config"],
    ...extra,
  }
}

const noop = () => {}

/**
 * 196-08 (AUTH-04) — the registry answer a caller hands down, in the shape the four picker
 * mounts consume. Two rows and a resolved run default, which is enough for every assertion in
 * this file: what the picker DOES with them is fenced by its own 32-case suite, not here.
 *
 * ⚠ IT IS A FIXTURE, NOT A DEFAULT. The panel's prop is optional and ABSENT means the four
 * mounts render nothing, so a test that wants the model control on screen must pass this
 * deliberately — which is the point: it makes "the field exists only because a caller supplied
 * a complete registry read" a property this file states rather than assumes.
 */
const MODEL_PICKER = {
  models: [
    { model_id: "gpt-5.4", provider: "openai", capability_source: "registry", enabled: true, deprecated: false, emit_tier: "force_strict" as const },
    { model_id: "kimi-k3", provider: "moonshot", capability_source: "registry", enabled: true, deprecated: false, emit_tier: "coerce" as const },
  ],
  runDefaultModel: "gpt-5.4",
}

describe("PhaseFormPanel — 6 phase_type-conditioned forms (friendly labels)", () => {
  it("programmatic: renders Function + Inputs; NO model/tools/scope/instructions", () => {
    render(
      <PhaseFormPanel
        phase={phaseOf({ phase_type: "programmatic", fn: "split_topic", input_keys: ["topic"] })}
        open
        onChange={noop}
        onPersist={noop}
        onClose={noop}
      />,
    )
    expect(screen.getByLabelText(/^function/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/^inputs/i)).toBeInTheDocument()
    expect(screen.queryByLabelText(/^ai model/i)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/what this step can do/i)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/folders it can read/i)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/^instructions/i)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/sourcing strictness/i)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/file check/i)).not.toBeInTheDocument()
  })

  it("llm_single: renders Instructions + AI model + Creativity + Folders + Skill; NO tools/max-steps", () => {
    render(
      <PhaseFormPanel
        phase={phaseOf({ phase_type: "llm_single", prompt: "write it", model: "claude-opus-4-8", temperature: 0.2 })}
        open
        onChange={noop}
        onPersist={noop}
        onClose={noop}
        // 196-08 (AUTH-04): the `AI model` control is now the registry-backed picker, and it is
        // gated on a COMPLETE registry read arriving from the caller. This assertion has stood
        // since Phase 103 and still holds — but it now REQUIRES the prop, which is the honest
        // record of a real contract change rather than a silently relaxed test.
        modelPicker={MODEL_PICKER}
      />,
    )
    expect(screen.getByLabelText(/^instructions/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/^ai model/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/^creativity/i)).toBeInTheDocument()
    expect(screen.queryByLabelText(/what this step can do/i)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/max steps/i)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/sourcing strictness/i)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/file check/i)).not.toBeInTheDocument()
  })

  it("llm_agent: adds What-this-step-can-do + Max steps (default 12) + Time limit", () => {
    render(
      <PhaseFormPanel
        phase={phaseOf({ phase_type: "llm_agent", prompt: "search", available_tools: ["search_documents"] })}
        open
        onChange={noop}
        onPersist={noop}
        onClose={noop}
      />,
    )
    expect(screen.getByLabelText(/^instructions/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/what this step can do/i)).toBeInTheDocument()
    const maxSteps = screen.getByLabelText(/max steps/i) as HTMLInputElement
    expect(maxSteps).toBeInTheDocument()
    expect(maxSteps.value).toBe("12") // default
    expect(screen.getByLabelText(/time limit/i)).toBeInTheDocument()
    expect(screen.queryByLabelText(/sourcing strictness/i)).not.toBeInTheDocument()
  })

  it("llm_agent: available_tools render as friendly chips (raw ids reachable via title)", () => {
    render(
      <PhaseFormPanel
        phase={phaseOf({ phase_type: "llm_agent", prompt: "search", available_tools: ["search_documents", "execute_code"] })}
        open
        onChange={noop}
        onPersist={noop}
        onClose={noop}
      />,
    )
    const chips = screen.getByTestId("tools-chips")
    expect(chips.textContent).toContain("Search documents")
    expect(chips.textContent).toContain("Run code")
    // The editable comma field still carries the raw ids.
    const field = screen.getByLabelText(/what this step can do/i) as HTMLInputElement
    expect(field.value).toContain("search_documents")
  })

  it("llm_batch_agents: adds Parallel workers (default 5) + How to combine results", () => {
    render(
      <PhaseFormPanel
        phase={phaseOf({ phase_type: "llm_batch_agents", prompt: "fan out", available_tools: ["search_documents"] })}
        open
        onChange={noop}
        onPersist={noop}
        onClose={noop}
      />,
    )
    const maxParallel = screen.getByLabelText(/parallel workers/i) as HTMLInputElement
    expect(maxParallel).toBeInTheDocument()
    expect(maxParallel.value).toBe("5") // default
    expect(screen.getByLabelText(/how to combine results/i)).toBeInTheDocument()
  })

  it("llm_human_input: renders Instructions + Choices + Wait timeout (default 300); NO model/tools/scope", () => {
    render(
      <PhaseFormPanel
        phase={phaseOf({ phase_type: "llm_human_input", prompt: "confirm?", options: ["yes", "no"] })}
        open
        onChange={noop}
        onPersist={noop}
        onClose={noop}
      />,
    )
    expect(screen.getByLabelText(/^instructions/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/choices to offer the person/i)).toBeInTheDocument()
    const timeout = screen.getByLabelText(/wait timeout/i) as HTMLInputElement
    expect(timeout).toBeInTheDocument()
    expect(timeout.value).toBe("300") // default
    expect(screen.queryByLabelText(/^ai model/i)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/what this step can do/i)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/folders it can read/i)).not.toBeInTheDocument()
  })

  it("llm_emit: renders Sourcing strictness (editable) + File check (greyed/read-only)", () => {
    render(
      <PhaseFormPanel
        phase={phaseOf({
          phase_type: "llm_emit",
          prompt: "render",
          emitter: "render_template",
          citation_policy: "strict",
          integrity_policy: "strict",
        })}
        open
        onChange={noop}
        onPersist={noop}
        onClose={noop}
      />,
    )
    expect(screen.getByLabelText(/^instructions/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/output type/i)).toBeInTheDocument()
    const citation = screen.getByLabelText(/sourcing strictness/i) as HTMLSelectElement
    expect(citation).toBeInTheDocument()
    expect(citation.disabled).toBe(false) // editable
    const integrity = screen.getByLabelText(/file check/i) as HTMLSelectElement
    expect(integrity).toBeInTheDocument()
    expect(integrity.disabled).toBe(true) // greyed/read-only (shown-but-inert)
  })

  it("llm_emit: each sourcing-strictness option shows a plain-language caption", () => {
    render(
      <PhaseFormPanel
        phase={phaseOf({ phase_type: "llm_emit", prompt: "render", emitter: "render_template", citation_policy: "strict" })}
        open
        onChange={noop}
        onPersist={noop}
        onClose={noop}
      />,
    )
    // The "strict" caption is shown plainly (no enum jargon required to understand it).
    expect(screen.getByText(/every claim must be cited/i)).toBeInTheDocument()
  })

  it("every field shows a plain-English helper line under its label (not a title attr) — AT THE OPEN READING", () => {
    // ⚠ 199-06 (DES-01) — THE TITLE OF THIS CASE USED TO READ "ALWAYS-VISIBLE", AND THE
    // WORD IS STRUCK FROM IT RATHER THAN THE CASE BEING DELETED. Every assertion below is
    // the shipped one, unchanged, character for character; what is new is the click above
    // them and the inverted twin directly below, which asserts the same sentences are
    // ABSENT at the collapsed reading. That pair is what proves a subtraction happened —
    // a deleted assertion proves nothing at all.
    render(
      <PhaseFormPanel
        phase={phaseOf({ phase_type: "llm_agent", prompt: "search", available_tools: ["search_documents"] })}
        open
        onChange={noop}
        onPersist={noop}
        onClose={noop}
        modelPicker={MODEL_PICKER}
      />,
    )
    fireEvent.click(screen.getByTestId("field-guidance-toggle"))
    // The helper sentences are rendered as plain VISIBLE text (queryable via getByText),
    // not hidden behind a hover-only `title`/ⓘ tooltip.
    expect(screen.getByText("What you want the AI to do in this step.")).toBeInTheDocument()
    // ⚠ 196-08 (D-06): this line read "Leave blank to use the workspace default." from Phase 103
    // until now, and the sentence was WRONG rather than merely old — there is no workspace
    // default in the code. A run inherits whatever model STARTED it, which is knowable at run
    // time and not while somebody is authoring, so the picker's helper says that instead. The
    // assertion is updated to the shipped honest copy rather than loosened to a regex.
    // ⚠ 199-06 (DES-01) — AND IT IS NOW INVERTED, present → absent, because that sentence was
    // CUT rather than folded: it restated the control's own first option. The assertion is
    // kept and turned around, never deleted, and the surviving copy is asserted beside it.
    expect(screen.queryByText("Leave blank to use the run's model.")).not.toBeInTheDocument()
    expect(screen.getByLabelText(/^ai model/i).textContent).toContain("Use the run's model")
    expect(screen.getByText("How many actions the AI may take before it stops.")).toBeInTheDocument()
    expect(screen.getByText("Stop this step after this many seconds (optional).")).toBeInTheDocument()
    expect(screen.getByText("The tools the AI may use here.")).toBeInTheDocument()
    expect(screen.getByText("The knowledge-base folders this step may search.")).toBeInTheDocument()
    expect(screen.getByText("A saved skill to load for this step (optional).")).toBeInTheDocument()
    // The helper line is a real text node, distinct from the ⓘ title (which carries the raw term).
    const help = screen.getByText("The tools the AI may use here.")
    expect(help.getAttribute("data-testid")).toBe("field-help")
    expect(help.textContent).not.toContain("available_tools")
  })

  it("⚠ 199-06 INVERSION — the SAME sentences are ABSENT at the collapsed reading", () => {
    // The exact twin of the case above, with every assertion inverted from present to
    // absent and nothing dropped. If a future edit re-prints these at rest, this reds.
    render(
      <PhaseFormPanel
        phase={phaseOf({ phase_type: "llm_agent", prompt: "search", available_tools: ["search_documents"] })}
        open
        onChange={noop}
        onPersist={noop}
        onClose={noop}
        modelPicker={MODEL_PICKER}
      />,
    )
    expect(screen.queryByText("What you want the AI to do in this step.")).not.toBeInTheDocument()
    expect(screen.queryByText("Leave blank to use the run's model.")).not.toBeInTheDocument()
    expect(screen.queryByText("How many actions the AI may take before it stops.")).not.toBeInTheDocument()
    expect(screen.queryByText("Stop this step after this many seconds (optional).")).not.toBeInTheDocument()
    expect(screen.queryByText("The tools the AI may use here.")).not.toBeInTheDocument()
    expect(screen.queryByText("The knowledge-base folders this step may search.")).not.toBeInTheDocument()
    expect(screen.queryByText("A saved skill to load for this step (optional).")).not.toBeInTheDocument()
    expect(screen.queryAllByTestId("field-help")).toHaveLength(0)
    // ⚠ AND THE LABELS THEMSELVES DID NOT MOVE. Cutting a duplicate is only honest if the
    // thing it duplicated is still on screen — otherwise this is a deletion wearing a
    // disclosure. Every field is still reachable by its plain accessible name.
    expect(screen.getByLabelText(/^instructions/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/^ai model/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/max steps/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/time limit/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/what this step can do/i)).toBeInTheDocument()
    // ⚠ `getAllBy…`, and the reason is worth recording because it took two red runs. The
    // Skill field's ⓘ lives INSIDE its `<label>` and carries `aria-label="skill_ref — …"`,
    // so `/^skill/i` matches BOTH the input and the hint — which is the two-audience label
    // working exactly as designed. And a tighter `/^skill \(optional\)/` does not match the
    // input either: the label's two spans are adjacent, so its text node reads
    // `Skill(optional)` with no separating space. Asserting the INPUT is among the matches
    // states the real claim — the field is still reachable by its plain name — without
    // pinning the incidental spacing of two spans.
    const skillMatches = screen.getAllByLabelText(/^skill/i)
    expect(skillMatches.some((el) => el.tagName === "INPUT")).toBe(true)
    // …and so is the ⓘ that carries the exact technical term — the power-user affordance
    // is emphatically NOT the thing that was cut.
    expect(screen.getByLabelText(/^prompt — what you're telling the AI to do/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/^skill_ref — a saved skill/i)).toBeInTheDocument()
  })

  it("each phase type renders a helper line under its representative editable field — AT THE OPEN READING", () => {
    const cases: Array<[Record<string, unknown>, string]> = [
      [{ phase_type: "programmatic", fn: "f", input_keys: ["x"] }, "The registered function this step runs."],
      [{ phase_type: "llm_single", prompt: "x", temperature: 0.2 }, "Higher = more varied wording; lower = more focused."],
      [{ phase_type: "llm_batch_agents", prompt: "x", available_tools: [] }, "How many copies run at once."],
      [{ phase_type: "llm_human_input", prompt: "x", options: ["a"] }, "The options the person picks from when this pauses."],
      [{ phase_type: "llm_emit", prompt: "x", emitter: "render_template", citation_policy: "strict" }, "How strictly the deliverable must cite its sources."],
    ]
    for (const [config, helper] of cases) {
      const { unmount } = render(
        <PhaseFormPanel phase={phaseOf(config)} open onChange={noop} onPersist={noop} onClose={noop} />,
      )
      // ⚠ 199-06 INVERSION, INLINE — absent first, then present after the one click. The
      // five shipped `getByText` assertions are unchanged; each has gained its twin.
      expect(screen.queryByText(helper)).not.toBeInTheDocument()
      fireEvent.click(screen.getByTestId("field-guidance-toggle"))
      expect(screen.getByText(helper)).toBeInTheDocument()
      unmount()
    }
  })

  it("199-06 — the ceiling's switch says what it does, both ways, and writes NOTHING", () => {
    const onChange = vi.fn()
    const onPersist = vi.fn()
    render(
      <PhaseFormPanel
        phase={phaseOf({ phase_type: "llm_agent", prompt: "search", available_tools: ["search_documents"] })}
        open
        onChange={onChange}
        onPersist={onPersist}
        onClose={noop}
      />,
    )
    const toggle = screen.getByTestId("field-guidance-toggle")
    expect(toggle).toHaveTextContent(FIELD_GUIDANCE_SHOW)
    expect(toggle.getAttribute("aria-expanded")).toBe("false")
    fireEvent.click(toggle)
    expect(toggle).toHaveTextContent(FIELD_GUIDANCE_HIDE)
    expect(toggle.getAttribute("aria-expanded")).toBe("true")
    // …and back, so the ceiling is a ceiling and not a one-way door.
    fireEvent.click(toggle)
    expect(toggle).toHaveTextContent(FIELD_GUIDANCE_SHOW)
    expect(screen.queryAllByTestId("field-help")).toHaveLength(0)
    // ⚠ THE 184-11 TRAP, ONE CONTROL OVER. Asking to see the explanations is not an edit.
    expect(onChange).not.toHaveBeenCalled()
    expect(onPersist).not.toHaveBeenCalled()
  })

  it("199-06 — the whitelist's REFUSAL is fenced IN: on screen at rest, and not a helper", () => {
    render(
      <PhaseFormPanel
        phase={phaseOf({ phase_type: "llm_agent", prompt: "x", available_tools: ["search_documents"] })}
        open
        onChange={noop}
        onPersist={noop}
        onClose={noop}
        rails={{ order: { index: 1, total: 2 }, toolOptions: ["search_documents"], gates: [] }}
      />,
    )
    const refusal = screen.getByText("Pick from the tools this workspace allows — you cannot add one by typing.")
    expect(refusal).toBeInTheDocument()
    // It travels OUTSIDE the guidance channel — that is what keeps it at the resting read.
    expect(refusal.getAttribute("data-testid")).toBe("tools-no-typing")
    expect(screen.queryAllByTestId("field-help")).toHaveLength(0)
  })

  it("the file-check / sourcing-strictness controls are ABSENT on every non-llm_emit type", () => {
    // ⚠ DERIVED FROM THE SHIPPED ORDER (Phase 189), and the decision is recorded rather
    // than left to a hand-typed list. This claim is "these controls belong to the
    // DELIVERABLE and to nothing else", which quantifies over every OTHER type — so a
    // 7th type belongs in the subset by the claim's own words, and a literal five-element
    // array had silently stopped covering the union the moment `llm_emit` was not the
    // only thing that could be added. `minimalPhaseFor` builds each config, so every arm
    // (including `external_action`'s required `capability`) stays correct by construction
    // instead of by an `if` ladder that has to be remembered.
    const nonEmit = PHASE_TYPE_ORDER.filter((type) => type !== "llm_emit")
    expect(nonEmit).toHaveLength(PHASE_TYPE_ORDER.length - 1)
    for (const pt of nonEmit) {
      const config = minimalPhaseFor(pt, "some-slug", 0).config
      const { unmount } = render(
        <PhaseFormPanel phase={phaseOf(config)} open onChange={noop} onPersist={noop} onClose={noop} />,
      )
      expect(screen.queryByLabelText(/file check/i)).not.toBeInTheDocument()
      expect(screen.queryByLabelText(/sourcing strictness/i)).not.toBeInTheDocument()
      unmount()
    }
  })

  it("folder_scope renders the folder NAME (from the id→name map) + bound UUID, never a path", () => {
    const uuid = "8c1a0000-0000-4000-8000-000000000001"
    render(
      <PhaseFormPanel
        phase={phaseOf({ phase_type: "llm_single", prompt: "x", folder_scope: [uuid] })}
        open
        folderNames={{ [uuid]: "Vendors — 2025 Assessments" }}
        onChange={noop}
        onPersist={noop}
        onClose={noop}
      />,
    )
    const scope = screen.getByTestId("folder-scope-display")
    expect(scope.textContent).toContain("Vendors — 2025 Assessments")
    // The bound id is reachable via the chip's title attribute (not a path).
    const chip = scope.querySelector(`[title="${uuid}"]`)
    expect(chip).toBeTruthy()
    // Never a filesystem path in the visible text.
    expect(scope.textContent).not.toMatch(/\/[A-Za-z]/)
    expect(scope.textContent).not.toMatch(/[A-Za-z]:\\/)
  })

  it("skill_ref renders the skill NAME (from the id→name map)", () => {
    const skillId = "skill-abc"
    render(
      <PhaseFormPanel
        phase={phaseOf({ phase_type: "llm_single", prompt: "x", skill_ref: skillId })}
        open
        skillNames={{ [skillId]: "Risk Scoring Rubric" }}
        onChange={noop}
        onPersist={noop}
        onClose={noop}
      />,
    )
    expect(screen.getByTestId("skill-name").textContent).toContain("Risk Scoring Rubric")
  })

  it("calls onChange on a field edit and onPersist on blur", async () => {
    const onChange = vi.fn()
    const onPersist = vi.fn()
    const { default: userEvent } = await import("@testing-library/user-event")
    const user = userEvent.setup()
    render(
      <PhaseFormPanel
        phase={phaseOf({ phase_type: "llm_single", prompt: "hi" })}
        open
        onChange={onChange}
        onPersist={onPersist}
        onClose={noop}
      />,
    )
    const prompt = screen.getByLabelText(/^instructions/i)
    await user.click(prompt)
    await user.type(prompt, "!")
    expect(onChange).toHaveBeenCalled()
    await user.tab() // blur
    expect(onPersist).toHaveBeenCalled()
  })

  it("the panel is a grid track — NOT position:absolute/fixed (push, not overlay)", () => {
    const { container } = render(
      <PhaseFormPanel
        phase={phaseOf({ phase_type: "llm_single", prompt: "x" })}
        open
        onChange={noop}
        onPersist={noop}
        onClose={noop}
      />,
    )
    const root = container.firstElementChild as HTMLElement
    expect(root).toBeTruthy()
    // No absolute/fixed positioning class on the panel root.
    expect(root.className).not.toMatch(/\b(absolute|fixed)\b/)
  })

  it("renders a resting rail (not the form) when closed", () => {
    render(
      <PhaseFormPanel
        phase={null}
        open={false}
        onChange={noop}
        onPersist={noop}
        onClose={noop}
      />,
    )
    expect(screen.getByTestId("phase-form-rail")).toBeInTheDocument()
    expect(screen.queryByLabelText(/^instructions/i)).not.toBeInTheDocument()
  })

  it("the SOURCE is push (not overlay) — no position:absolute/fixed inset", () => {
    const src = phaseFormPanelSource
    expect(src).not.toMatch(/position:\s*(absolute|fixed)/)
    expect(src).not.toMatch(/fixed inset|absolute inset/)
  })
})

/**
 * Phase 183-09 (GAP-1). The panel shipped with NO discoverable close: its only exit was
 * re-activating the same node, which a user has no way to know. The close handler is a
 * REQUIRED prop so "a panel the user cannot dismiss" is not a representable state.
 *
 * NOTE for a future reader: during the RED window of 183-09 these two tests passed
 * `onClose` to a component whose props did not declare it yet, so `tsc` reported a
 * phase-file error until Task 2 landed the prop. That was expected and is not a defect
 * to "fix" by deleting the prop.
 */
describe("PhaseFormPanel — dismissal (183-09 / GAP-1)", () => {
  it("the open panel header carries exactly one announced close control", () => {
    const onClose = vi.fn()
    render(
      <PhaseFormPanel
        phase={phaseOf({ phase_type: "llm_single", prompt: "x" })}
        open
        onChange={noop}
        onPersist={noop}
        onClose={onClose}
      />,
    )
    // Positive control: this render really IS the open branch, not the rail.
    expect(screen.queryByTestId("phase-form-rail")).not.toBeInTheDocument()

    const close = screen.getByTestId("phase-form-close")
    expect(close.tagName).toBe("BUTTON")
    expect(close.getAttribute("type")).toBe("button")
    // Announced as a sentence — the glyph alone is not an accessible name.
    expect(screen.getByRole("button", { name: /close/i })).toBe(close)

    // `fireEvent` — one click driver across every suite this plan touches (the
    // d3-drag landmine bans `user-event` inside the canvas plane, and a second driver
    // here would invite it back by example).
    fireEvent.click(close)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it("the resting rail renders NO close control", () => {
    // Expected to pass at RED — this is a guard against the fix over-reaching into the
    // collapsed rail, not a GAP-1 reproduction.
    render(
      <PhaseFormPanel phase={null} open={false} onChange={noop} onPersist={noop} onClose={noop} />,
    )
    expect(screen.getByTestId("phase-form-rail")).toBeInTheDocument()
    expect(screen.queryByTestId("phase-form-close")).not.toBeInTheDocument()
  })
})

/**
 * Phase 193.1-09 (AUTH-03 / SC#3 — D-22) — THE NAME-CHECK MOUNT IS ONE GATED LINE.
 *
 * Two properties, and the first is the load-bearing one: **absent ⇒ nothing renders**. That
 * is what keeps every OTHER mount of this panel — including the flag-off Spine surface, which
 * passes no such prop — byte-identical by construction rather than by review. The second is
 * the type gate: the check is about the file a deliverable step fills in, so it belongs to
 * the one phase type whose executor resolves a bound template, exactly as the attach section
 * beside it already does.
 */
describe("PhaseFormPanel — the 193.1 name-check mount (D-22)", () => {
  const CLASSIFICATION = { produced: ["retrieve"], runInput: [], nowhere: ["project_name"] }

  it("ABSENT ⇒ nothing renders, on a non-emit step AND on an llm_emit step", () => {
    for (const phase_type of ["llm_single", "llm_emit"]) {
      const { unmount } = render(
        <PhaseFormPanel
          phase={phaseOf({ phase_type, prompt: "x" })}
          open
          onChange={noop}
          onPersist={noop}
          onClose={noop}
        />,
      )
      expect(screen.queryByTestId("name-check")).not.toBeInTheDocument()
      unmount()
    }
  })

  it("PRESENT but NOT llm_emit ⇒ still nothing renders — the gate is the phase type", () => {
    render(
      <PhaseFormPanel
        phase={phaseOf({ phase_type: "llm_agent", prompt: "x" })}
        open
        onChange={noop}
        onPersist={noop}
        onClose={noop}
        nameCheck={{ classification: CLASSIFICATION }}
      />,
    )
    expect(screen.queryByTestId("name-check")).not.toBeInTheDocument()
  })

  it("PRESENT and llm_emit ⇒ it mounts, and the panel added no computation to do it", () => {
    render(
      <PhaseFormPanel
        phase={phaseOf({ phase_type: "llm_emit", prompt: "x" })}
        open
        onChange={noop}
        onPersist={noop}
        onClose={noop}
        nameCheck={{ classification: CLASSIFICATION }}
      />,
    )
    expect(screen.getByTestId("name-check")).toBeInTheDocument()
    // The names came from the PROP, unchanged — the panel derives nothing about slugs.
    expect(screen.getByTestId("name-check-bucket-produced")).toHaveTextContent("retrieve")
    expect(screen.getByTestId("name-check-bucket-nowhere")).toHaveTextContent("project_name")
  })

  it("it sits ABOVE the attach section, as sketch 167 places it", () => {
    render(
      <PhaseFormPanel
        phase={phaseOf({ phase_type: "llm_emit", prompt: "x" })}
        open
        onChange={noop}
        onPersist={noop}
        onClose={noop}
        nameCheck={{ classification: CLASSIFICATION }}
        template={{ definitionId: null, onAttached: noop }}
      />,
    )
    const check = screen.getByTestId("name-check")
    const attach = screen.getByTestId("rail-template")
    // Document order, asserted through the DOM rather than by reading the source.
    expect(check.compareDocumentPosition(attach) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it("SOURCE — the mount really is ONE gated line and the panel computes nothing for it", () => {
    // The G-5 shape this file's ledger row demands, asserted rather than described. The whole
    // cost of this surface in this file is an import, a prop, a destructure and one line.
    const mounts = phaseFormPanelSource.split("\n").filter((line) => line.includes("<TemplateNameCheck"))
    expect(mounts).toHaveLength(1)
    expect(mounts[0]).toContain('pt === "llm_emit"')
    // …and it forwards the prop whole rather than picking it apart here.
    expect(mounts[0]).toContain("{...nameCheck}")
  })
})

/**
 * Phase 196-08 (AUTH-04 / D-20) — THE FOUR PICKER MOUNTS, AND THE PANEL'S ABSOLUTE ZERO.
 *
 * ⚠ WHY THIS FENCE EXISTS WHEN ONE ALREADY DOES, DIRECTLY ABOVE. The shipped fence is scoped
 * to the template name-check mount and to nothing else. A picker mount passes through it
 * invisibly, and — the failure that actually matters — this panel could grow a memo to shape
 * the option list, or an effect to fetch the registry itself, and that fence would notice
 * nothing at all. The G-5 order on this file is a property of the WHOLE file, so it needs a
 * guard that reads the whole file.
 *
 * Three claims, each mechanical:
 *
 *   1. EXACTLY FOUR mounts, one per step type that carries a model, each carrying its own
 *      `pt ===` guard and forwarding the caller's answer WHOLE via spread. The captured guards
 *      are compared as a SORTED SET, so a duplicate (two mounts both gated `llm_single`) and an
 *      omission (three types covered, one missing) are each a failure — a bare length check
 *      would pass both.
 *   2. The fitness flag rides the deliverable mount and ONLY it (D-12).
 *   3. `useMemo` / `useState` / `useEffect` are at an ABSOLUTE ZERO in this file's source.
 *      Not "no increase" — zero, because all three measured zero before this phase, and a
 *      non-decrease criterion on a file that already reads 0 is a criterion that permits the
 *      first one.
 *
 * ⚠ THE MATCHED TOKENS ARE BUILT, NEVER SPELLED, in this file's prose and in the panel's. A
 * comment that names the needle is COUNTED BY the fence that greps for it — the 187-24 trap,
 * which this phase hit three separate times while writing these very paragraphs (twice in the
 * panel's docblock, once in the comment explaining the first two).
 */
describe("PhaseFormPanel — the 196-08 picker mounts (AUTH-04 / D-20)", () => {
  /** The opening tag, assembled so this file's own text never carries it as a literal. */
  const MOUNT_TOKEN = "<" + "ModelField"
  /** The four step types that carry a model, as the schema orders them in this panel. */
  const MODEL_BEARING_TYPES = ["llm_agent", "llm_batch_agents", "llm_emit", "llm_single"]

  /** The extractor, ONE definition, run over the real source below and over the deliberately
   *  wrong fixtures in the positive control — so the control tests the same code the fence
   *  runs, which is the only thing that makes a control worth having. */
  const mountsIn = (src: string) => src.split("\n").filter((line) => line.includes(MOUNT_TOKEN))
  const guardsIn = (lines: string[]) =>
    lines.map((l) => l.match(/pt === "([a-z_]+)"/)?.[1] ?? null)

  it("NON-VACUITY — the source really was loaded, and really is this panel", () => {
    expect(phaseFormPanelSource.length).toBeGreaterThan(1000)
    expect(phaseFormPanelSource).toContain("export function PhaseFormPanel")
    expect(mountsIn(phaseFormPanelSource).length).toBeGreaterThan(0)
  })

  it("POSITIVE CONTROL — the extractor really can fail, on both shapes it exists to reject", () => {
    // Too few mounts: the shape where one step type keeps a free-text box.
    const tooFew = ["  {modelPicker && pt === \"llm_single\" && " + MOUNT_TOKEN + " />}", "  <TextField label=\"AI model\" />"].join("\n")
    expect(mountsIn(tooFew)).toHaveLength(1)
    // An UNGATED mount: the shape where the picker leaks onto a step type that has no model.
    const ungated = ["  {modelPicker && " + MOUNT_TOKEN + " {...modelPicker} />}"].join("\n")
    expect(guardsIn(mountsIn(ungated))).toEqual([null])
    // And a shape the fence must ACCEPT, so the control proves discrimination, not just noise.
    const good = MODEL_BEARING_TYPES.map((t) => "  {modelPicker && pt === \"" + t + "\" && " + MOUNT_TOKEN + " {...modelPicker} />}").join("\n")
    expect(guardsIn(mountsIn(good)).sort()).toEqual(MODEL_BEARING_TYPES)
  })

  it("SOURCE — exactly FOUR mounts, one per model-bearing step type, each forwarding the prop whole", () => {
    const mounts = mountsIn(phaseFormPanelSource)
    expect(mounts).toHaveLength(4)
    // A sorted SET comparison, not a length check: a duplicated guard and a missing type both fail.
    expect(guardsIn(mounts).sort()).toEqual(MODEL_BEARING_TYPES)
    for (const line of mounts) {
      expect(line).toContain("{...modelPicker}")
      // The panel keeps its ONE save-on-blur discipline; no mount introduces a second.
      expect(line).toContain("onPersist={onPersist}")
    }
  })

  it("SOURCE — the fitness flag rides the deliverable mount and ONLY it (D-12)", () => {
    const withFitness = mountsIn(phaseFormPanelSource).filter((l) => l.includes("showFitness"))
    expect(withFitness).toHaveLength(1)
    expect(withFitness[0]).toContain('pt === "llm_emit"')
  })

  it("SOURCE — the panel computes NOTHING for the picker: an ABSOLUTE zero, not a non-increase", () => {
    // Built, never spelled — this assertion would otherwise count itself.
    for (const token of ["use" + "Memo(", "use" + "State(", "use" + "Effect("]) {
      expect(phaseFormPanelSource.split(token).length - 1).toBe(0)
    }
  })

  it("POSITIVE CONTROL — the zero-compute needle really can find what it forbids", () => {
    const planted = "  const rows = use" + "Memo(() => models.filter(Boolean), [models])"
    expect(planted.split("use" + "Memo(").length - 1).toBe(1)
  })

  it("ABSENT ⇒ no model control at all — and emphatically NO free-text box (AUTH-04)", () => {
    // The load-bearing negative. AUTH-04 is the claim that there is no path through this form
    // that accepts a typed model name; a caller that supplies no registry answer must therefore
    // get NOTHING, never a fallback input. Absence is the honest degradation, a text box is the
    // regression, and only this assertion tells them apart.
    for (const phase_type of MODEL_BEARING_TYPES) {
      const { unmount } = render(
        <PhaseFormPanel
          phase={phaseOf({ phase_type, prompt: "x", model: "gpt-5.4" })}
          open
          onChange={noop}
          onPersist={noop}
          onClose={noop}
        />,
      )
      expect(screen.queryByLabelText(/^ai model/i)).not.toBeInTheDocument()
      unmount()
    }
  })

  it("PRESENT ⇒ a real <select> on all four types, and NEVER a textbox", () => {
    for (const phase_type of MODEL_BEARING_TYPES) {
      const { unmount } = render(
        <PhaseFormPanel
          phase={phaseOf({ phase_type, prompt: "x", model: "gpt-5.4" })}
          open
          onChange={noop}
          onPersist={noop}
          onClose={noop}
          modelPicker={MODEL_PICKER}
        />,
      )
      const control = screen.getByLabelText(/^ai model/i)
      expect(control.tagName).toBe("SELECT")
      expect((control as HTMLSelectElement).value).toBe("gpt-5.4")
      unmount()
    }
  })

  it("PRESENT but a step type with NO model ⇒ still nothing — the gate is the phase type", () => {
    for (const phase_type of ["programmatic", "llm_human_input"]) {
      const { unmount } = render(
        <PhaseFormPanel
          phase={phaseOf({ phase_type, prompt: "x", fn: "split_topic", input_keys: ["topic"] })}
          open
          onChange={noop}
          onPersist={noop}
          onClose={noop}
          modelPicker={MODEL_PICKER}
        />,
      )
      expect(screen.queryByLabelText(/^ai model/i)).not.toBeInTheDocument()
      unmount()
    }
  })

  it("A BLANK stored model — the case 239 of 257 real phases are in — renders as the named inherit option", () => {
    // ⚠ THE DOMINANT REAL SHAPE, MEASURED: of 257 phases across 270 stored definitions, 239
    // carry a blank `model`. A mount that could not render a blank gracefully would break the
    // overwhelming majority of workflows that exist, so this is the case the phase is judged on.
    render(
      <PhaseFormPanel
        phase={phaseOf({ phase_type: "llm_single", prompt: "x", model: "" })}
        open
        onChange={noop}
        onPersist={noop}
        onClose={noop}
        modelPicker={MODEL_PICKER}
      />,
    )
    const control = screen.getByLabelText(/^ai model/i) as HTMLSelectElement
    expect(control.value).toBe("")
    // A NAMED leading option, never an empty slot (D-05), and it hedges rather than asserting a
    // default this code does not implement (D-06) — the resolved id is the server's, not ours.
    expect(control.options[0].textContent).toContain("Use the run's model")
    expect(control.options[0].textContent).toContain("gpt-5.4")
    // …and a blank is NOT retained as a phantom `(current)` row.
    expect(control.textContent).not.toContain("(current)")
  })

  it("A MISSING model key reads the same as a blank one — no crash, no phantom row", () => {
    // `cfg.model` is genuinely absent on some stored phases, not merely empty. `asStr` maps both
    // to `""`, and this pins that the mount inherits that mapping rather than passing undefined.
    render(
      <PhaseFormPanel
        phase={phaseOf({ phase_type: "llm_emit", prompt: "x" })}
        open
        onChange={noop}
        onPersist={noop}
        onClose={noop}
        modelPicker={MODEL_PICKER}
      />,
    )
    const control = screen.getByLabelText(/^ai model/i) as HTMLSelectElement
    expect(control.value).toBe("")
    expect(control.textContent).not.toContain("(current)")
  })

  it("OPENING THE FORM WRITES NOTHING — viewing a workflow is not editing it (D-07)", () => {
    // The failure this catches is INVISIBLE on screen, which is why it is asserted here as well
    // as being owed as UAT row U-A1 (whose proof is a DB read). A mount that normalised a stored
    // value on open would silently rewrite 239 blank models the first time anyone looked.
    const onChange = vi.fn()
    const onPersist = vi.fn()
    for (const model of ["", "gpt-5.4", "a-model-the-registry-never-heard-of"]) {
      const { unmount } = render(
        <PhaseFormPanel
          phase={phaseOf({ phase_type: "llm_emit", prompt: "x", model })}
          open
          onChange={onChange}
          onPersist={onPersist}
          onClose={noop}
          modelPicker={MODEL_PICKER}
        />,
      )
      unmount()
    }
    expect(onChange).not.toHaveBeenCalled()
    expect(onPersist).not.toHaveBeenCalled()
  })

  it("A STORED model the registry does not know is KEPT, not silently dropped (D-08)", () => {
    // Saving is not blocked and the value is not rewritten: an operator retiring a registry row
    // must not make every existing workflow unsaveable, or quietly change what they run on.
    render(
      <PhaseFormPanel
        phase={phaseOf({ phase_type: "llm_agent", prompt: "x", model: "retired-model-9" })}
        open
        onChange={noop}
        onPersist={noop}
        onClose={noop}
        modelPicker={MODEL_PICKER}
      />,
    )
    const control = screen.getByLabelText(/^ai model/i) as HTMLSelectElement
    expect(control.value).toBe("retired-model-9")
    expect(control.textContent).toContain("(current)")
  })

  it("a pick calls onChange with the chosen id, and a blur persists — the panel's ONE discipline", () => {
    const onChange = vi.fn()
    const onPersist = vi.fn()
    render(
      <PhaseFormPanel
        phase={phaseOf({ phase_type: "llm_single", prompt: "x", model: "" })}
        open
        onChange={onChange}
        onPersist={onPersist}
        onClose={noop}
        modelPicker={MODEL_PICKER}
      />,
    )
    const control = screen.getByLabelText(/^ai model/i)
    fireEvent.change(control, { target: { value: "kimi-k3" } })
    expect(onChange).toHaveBeenCalledWith({ model: "kimi-k3" })
    fireEvent.blur(control)
    expect(onPersist).toHaveBeenCalledTimes(1)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════════════
// Phase 199-06 Task 1 (DES-01, sheet `c4-phase-form-panel`) — THE PRE-CHANGE INVENTORY.
//
// MEASURE BEFORE CHANGING ANYTHING. This block is committed on its own, one commit BEFORE
// the density ceiling exists, so that "the panel got quieter" is a delta between two
// recorded readings rather than a claim made about a tree nobody wrote down.
//
// It carries four things, and each answers a different question the plan asks:
//
//   1. `HELPERS_AT_FULL_DENSITY` — every always-visible plain-English helper sentence this
//      panel prints today, as LITERALS, per phase type. Pinned PRESENT so that a later
//      removal is proved by INVERTING each assertion (present → absent at the collapsed
//      reading) rather than by deleting it. Zero assertion deletions is the target.
//
//   2. `FENCED_IN` — the atoms that may NEVER move behind a fold, enumerated BEFORE any
//      decision about what moves. SEED-184's rule 3: a person may not be asked to click to
//      find out whether their step is governed, which side of the door it is on, whether it
//      is armed, or what it delivers. This list is the work list's complement.
//
//   3. A DENSITY READING for two representative phase types, as exact numbers.
//
//   4. ⚠ A CANNOT-EXPRESS, DEMONSTRATED RATHER THAN ASSERTED. The plan asks for the rendered
//      HEIGHT of the panel body. jsdom implements no layout engine, so every box metric it
//      reports is a constant zero — a "height delta" measured here would be `0 − 0` and
//      would read as a passing measurement. The honest substitute is the VOLUME OF RENDERED
//      PROSE, which is deterministic, is what a height is a proxy for anyway, and cannot be
//      zero by accident. Both are asserted below: the zero, so the limitation is on the
//      record, and the volume, so the delta that follows it is real.
// ═══════════════════════════════════════════════════════════════════════════════════════

/** The rails at full density — a governed agent step, so every governance atom exists. */
const FULL_RAILS: PhaseFormRails = {
  order: { index: 2, total: 4 },
  toolOptions: ["search_documents", "execute_code"],
  gates: [{ label: GOVERNANCE_GATE_ROW_LABEL, locked: true }],
  kbTools: ["search_documents"],
}

/** A step config per type, at the fullest shape each type can carry. */
const FULL_CONFIG: Record<string, Record<string, unknown>> = {
  programmatic: { phase_type: "programmatic", fn: "split_topic", input_keys: ["topic"] },
  llm_single: { phase_type: "llm_single", prompt: "x", model: "gpt-5.4", temperature: 0.2, folder_scope: [], skill_ref: "s" },
  llm_agent: { phase_type: "llm_agent", prompt: "x", model: "gpt-5.4", available_tools: ["search_documents"], max_steps: 12, wall_clock_seconds: 60, folder_scope: [], skill_ref: "s" },
  llm_batch_agents: { phase_type: "llm_batch_agents", prompt: "x", model: "gpt-5.4", available_tools: ["search_documents"], max_parallel_agents: 5, merge_strategy: "concat", folder_scope: [] },
  llm_human_input: { phase_type: "llm_human_input", prompt: "x", options: ["a", "b"], timeout_seconds: 300 },
  llm_emit: { phase_type: "llm_emit", prompt: "x", emitter: "render_template", model: "gpt-5.4", citation_policy: "strict", integrity_policy: "strict", folder_scope: [], skill_ref: "s" },
  external_action: { phase_type: "external_action", capability: "" },
}

/**
 * EVERY always-visible helper sentence the panel prints today, per phase type, as literals.
 *
 * ⚠ THE LIST IS THE FLAG-OFF (rails-absent) READING — the shipped Spine surface, which is
 * the surface most authors are actually on. The rails-present reading differs in exactly one
 * sentence (the tool field's), and that one is inventoried separately below because it is the
 * only helper in this panel that is NOT a restatement of its own label: it states a REFUSAL.
 */
const HELPERS_AT_FULL_DENSITY: Record<string, readonly string[]> = {
  programmatic: [
    "The registered function this step runs.",
    "Which earlier outputs feed this function.",
  ],
  llm_single: [
    "What you want the AI to do in this step.",
    "Leave blank to use the run's model.",
    "Higher = more varied wording; lower = more focused.",
    "The knowledge-base folders this step may search.",
    "A saved skill to load for this step (optional).",
  ],
  llm_agent: [
    "What you want the AI to do in this step.",
    "Leave blank to use the run's model.",
    "How many actions the AI may take before it stops.",
    "The tools the AI may use here.",
    "Stop this step after this many seconds (optional).",
    "The knowledge-base folders this step may search.",
    "A saved skill to load for this step (optional).",
  ],
  llm_batch_agents: [
    "What you want the AI to do in this step.",
    "Leave blank to use the run's model.",
    "How many actions the AI may take before it stops.",
    "The tools the AI may use here.",
    "How many copies run at once.",
    "How the parallel results are merged.",
    "The knowledge-base folders this step may search.",
  ],
  llm_human_input: [
    "What the person is asked to review or decide here.",
    "The options the person picks from when this pauses.",
    "How long to wait for the person before giving up.",
  ],
  llm_emit: [
    "What you want the AI to do in this step.",
    "How the deliverable is produced (read-only).",
    "Leave blank to use the run's model.",
    "A saved skill to load for this step (optional).",
    "The knowledge-base folders this step may search.",
    "How strictly the deliverable must cite its sources.",
    "Re-opens the produced file to confirm it's complete (coming in Phase 106).",
  ],
  external_action: [],
}

/**
 * The ONE helper in this panel that is not a restatement — the tool whitelist's. It states
 * that the control REFUSES typed input, which is a rule about what can be done, not guidance
 * about what a field means. It is inventoried apart from the list above because it belongs in
 * `FENCED_IN`, not in the work list.
 */
const TOOL_WHITELIST_REFUSAL =
  "Pick from the tools this workspace allows — you cannot add one by typing."

/**
 * ⚠ THE ONE HELPER THAT WAS CUT OUTRIGHT RATHER THAN FOLDED, and it is named here so the
 * exception is visible in the inventory instead of hiding inside a looser assertion.
 *
 * `ModelField` printed this sentence directly above a `<select>` whose FIRST OPTION reads
 * *"Use the run's model"*. That is not a label restating a field, it is a sentence restating
 * the control's own visible text — the strongest form of the duplication SEED-184 names, and
 * the one case where the purpose provably survives the cut without any disclosure at all,
 * because the surviving copy is inside the thing the person is already looking at. Folding
 * it would have left the picker with a helper that says less than its own first row.
 *
 * The ⓘ on that field is untouched and still carries the precise term.
 */
const MODEL_HELPER_CUT = "Leave blank to use the run's model."

/**
 * ⚠ THE FENCED-IN ATOMS — written down BEFORE any decision about what moves (SEED-184 rule 3,
 * threat T-199-06-03). A person may never be asked to click in order to discover a DECISION:
 * whether the step is governed, which side of the door it is on, whether it is armed, or what
 * it delivers. Everything here is asserted PRESENT at the resting reading, today and after.
 *
 * Each entry is `[what it is, the testid that proves it rendered]`.
 */
const FENCED_IN: ReadonlyArray<readonly [string, string]> = [
  ["the governance section itself", "rail-governance"],
  ["the strict/loose door — the loose side", "governance-dial-loose"],
  ["the strict/loose door — the strict side", "governance-dial-strict"],
  ["why the step is held, when it is", "governance-why"],
  ["the dial's visible REFUSAL", "governance-refusal"],
  ["the tool list IS the control", "governance-tool-control"],
  ["the gate attached to the run", "governance-attached"],
  ["the armed-action switch", "governance-arm"],
  ["what arming costs", "governance-armed-note"],
  ["the checks that run on this step", "rail-gates"],
  ["the order the step runs in", "rail-order"],
]

/** The `llm_emit`-only atoms that state what the step DELIVERS. Same fence, other type. */
const FENCED_IN_DELIVERABLE: ReadonlyArray<readonly [string, string]> = [
  ["the attached template", "rail-template"],
  ["which of the template's fields the steps name", "name-check"],
]

/** A density reading. Deterministic; no layout is involved and none is claimed. */
function densityOf(container: HTMLElement) {
  const aside = container.querySelector("aside")
  if (aside === null) throw new Error("no panel rendered")
  const helps = Array.from(aside.querySelectorAll('[data-testid="field-help"]'))
  return {
    helpLines: helps.length,
    helpChars: helps.reduce((n, el) => n + (el.textContent ?? "").length, 0),
    proseChars: (aside.textContent ?? "").length,
  }
}

function renderAtFullDensity(phase_type: string, rails?: PhaseFormRails) {
  return render(
    <PhaseFormPanel
      // ⚠ `action_risk_armed` is a PhaseSpec-level field, NOT a config key, and it is set
      // deliberately: without it the armed note never renders and "full density" would be
      // measuring a step that has not been armed. Found by the fence below going red on
      // `governance-armed-note` — which is the fence doing its job on its first run.
      phase={phaseOf(FULL_CONFIG[phase_type] as Record<string, unknown>, { action_risk_armed: true })}
      open
      onChange={noop}
      onPersist={noop}
      onClose={noop}
      modelPicker={MODEL_PICKER}
      rails={rails}
      onGovernanceChange={noop}
      template={{ definitionId: "d1", filename: "Renewal_Report_v2.docx", assetId: "a1", onAttached: noop }}
      nameCheck={{ classification: { produced: ["retrieve"], runInput: [], nowhere: ["project_name"] } }}
    />,
  )
}

describe("199-06 Task 1 — the panel's resting atoms at FULL density (pre-change inventory)", () => {
  it("NON-VACUITY — the inventory covers every shipped phase type, and is not empty by accident", () => {
    // A list keyed by a type the product no longer has would silently stop being checked.
    expect(Object.keys(HELPERS_AT_FULL_DENSITY).sort()).toEqual([...PHASE_TYPE_ORDER].sort())
    expect(Object.keys(FULL_CONFIG).sort()).toEqual([...PHASE_TYPE_ORDER].sort())
    // Six of the seven really do print helper prose today; `external_action` really prints none.
    expect(Object.values(HELPERS_AT_FULL_DENSITY).filter((v) => v.length > 0)).toHaveLength(6)
  })

  it("⚠ INVERTED at Task 2 — every helper sentence is ABSENT at the collapsed reading", () => {
    // The Task-1 assertion said PRESENT. It is inverted here, per phase type, over the SAME
    // literals — the list above is untouched. This is the whole subtraction, proved.
    for (const [phase_type, sentences] of Object.entries(HELPERS_AT_FULL_DENSITY)) {
      const { unmount } = renderAtFullDensity(phase_type)
      for (const sentence of sentences) {
        expect(screen.queryByText(sentence), `${phase_type}: ${sentence}`).not.toBeInTheDocument()
      }
      expect(screen.queryAllByTestId("field-help")).toHaveLength(0)
      unmount()
    }
  })

  it("every helper sentence in the inventory returns UNCHANGED at the fully-open reading", () => {
    // ⚠ Nothing was deleted and nothing was re-spelled — the same literals, one click away.
    // ⚠ ONE exception, and it is named rather than absorbed: the model picker's own helper
    // was CUT unconditionally at Task 3 (it duplicated the leading option's visible text),
    // so it is subtracted from the expected set here rather than being quietly tolerated by
    // a looser comparison. `MODEL_HELPER_CUT` is asserted absent at BOTH readings below.
    for (const [phase_type, sentences] of Object.entries(HELPERS_AT_FULL_DENSITY)) {
      const { unmount } = renderAtFullDensity(phase_type)
      fireEvent.click(screen.getByTestId("field-guidance-toggle"))
      const expected = sentences.filter((s) => s !== MODEL_HELPER_CUT)
      for (const sentence of expected) {
        expect(screen.getByText(sentence), `${phase_type}: ${sentence}`).toBeInTheDocument()
      }
      // …and the inventory is still EXHAUSTIVE: no helper renders that this list does not name.
      const rendered = screen.queryAllByTestId("field-help").map((el) => el.textContent ?? "")
      expect(rendered.slice().sort()).toEqual([...expected].sort())
      unmount()
    }
  })

  it("the model picker's helper is gone at BOTH readings — a cut, not a fold", () => {
    for (const open of [false, true]) {
      const { unmount } = renderAtFullDensity("llm_single")
      if (open) fireEvent.click(screen.getByTestId("field-guidance-toggle"))
      expect(screen.queryByText(MODEL_HELPER_CUT)).not.toBeInTheDocument()
      // ⚠ THE PURPOSE SURVIVED THE CUT, which is the only thing that makes it legitimate:
      // the leading option says the same thing, in the control the person is looking at.
      expect(screen.getByLabelText(/^ai model/i).textContent).toContain("Use the run's model")
      unmount()
    }
  })

  it("the tool whitelist's helper is a REFUSAL, not guidance — inventoried apart", () => {
    const { unmount } = renderAtFullDensity("llm_agent", FULL_RAILS)
    expect(screen.getByText(TOOL_WHITELIST_REFUSAL)).toBeInTheDocument()
    unmount()
    // And it really is the rails-only reading: flag-off prints the other sentence instead —
    // ⚠ which is now the OPEN reading, since that one IS guidance and did fold.
    renderAtFullDensity("llm_agent")
    expect(screen.queryByText(TOOL_WHITELIST_REFUSAL)).not.toBeInTheDocument()
    expect(screen.queryByText("The tools the AI may use here.")).not.toBeInTheDocument()
    fireEvent.click(screen.getByTestId("field-guidance-toggle"))
    expect(screen.getByText("The tools the AI may use here.")).toBeInTheDocument()
  })

  it("199-06 — the refusal is NOT foldable while its sibling guidance IS: the two differ", () => {
    // The distinction the fence exists to hold, driven on one render rather than described:
    // in the rails variant the refusal is on screen at rest, and NO helper is.
    const { unmount } = renderAtFullDensity("llm_agent", FULL_RAILS)
    expect(screen.getByText(TOOL_WHITELIST_REFUSAL)).toBeInTheDocument()
    expect(screen.queryAllByTestId("field-help")).toHaveLength(0)
    // …and opening the guidance does not move the refusal, because it never was guidance.
    fireEvent.click(screen.getByTestId("field-guidance-toggle"))
    expect(screen.getAllByText(TOOL_WHITELIST_REFUSAL)).toHaveLength(1)
    unmount()
  })

  it("FENCED IN — every governance / door / armed atom renders at the resting reading", () => {
    // A GOVERNED agent step: a KB tool is on, so the dial is detected-and-locked and its
    // refusal is on screen. This is the render in which every fenced atom exists at once.
    renderAtFullDensity("llm_agent", FULL_RAILS)
    for (const [what, marker] of FENCED_IN) {
      expect(screen.queryByTestId(marker), what).toBeInTheDocument()
    }
    // The door's two sides carry their BINDING words, not a paraphrase.
    expect(screen.getByTestId("governance-dial-loose")).toHaveTextContent(GROUNDING_DIAL_LOOSE_LABEL)
    expect(screen.getByTestId("governance-dial-strict")).toHaveTextContent(GROUNDING_DIAL_STRICT_LABEL)
    // The refusal is REAL DOM TEXT — what makes it a refusal and not a disablement.
    expect(screen.getByTestId("governance-refusal")).toHaveTextContent(GROUNDING_LOCK_REFUSAL)
    expect(screen.getByTestId("governance-arm")).toHaveTextContent(ACTION_RISK_ARM_LABEL)
  })

  it("FENCED IN — the deliverable's own atoms render at the resting reading", () => {
    renderAtFullDensity("llm_emit", FULL_RAILS)
    for (const [what, marker] of FENCED_IN_DELIVERABLE) {
      expect(screen.queryByTestId(marker), what).toBeInTheDocument()
    }
    // The sourcing-strictness CAPTION is a consequence, not guidance: it says what the
    // CHOSEN option does. Fenced in for the same reason the refusal is.
    expect(
      screen.getByText("Every claim must be cited — the deliverable fails if anything is uncited."),
    ).toBeInTheDocument()
  })

  it("⚠ CANNOT-EXPRESS — a rendered HEIGHT is not measurable here; jsdom runs no layout", () => {
    const { container } = renderAtFullDensity("llm_agent", FULL_RAILS)
    const aside = container.querySelector("aside") as HTMLElement
    // Both box metrics are a constant zero. A "height delta" computed from these would be
    // 0 − 0 and would read as a passing measurement, which is why the plan's height figure is
    // REPORTED as cannot-express and the prose-volume reading below is used in its place.
    expect(aside.offsetHeight).toBe(0)
    expect(aside.getBoundingClientRect().height).toBe(0)
    // …and the substitute is emphatically NOT zero, so the delta it produces is real.
    expect(densityOf(container).proseChars).toBeGreaterThan(500)
  })

  /**
   * ⚠ THE PRE-CHANGE READING, PRESERVED VERBATIM AND NEVER RE-BASELINED. These are the exact
   * numbers Task 1 measured and committed one commit before the ceiling existed. They are
   * kept as data so the delta below is COMPUTED against them rather than asserted blind; a
   * pin quietly overwritten to make red go green is a pin that will never fail again.
   */
  const DENSITY_BEFORE = {
    agent: { helpLines: 7, helpChars: 342, proseChars: 1632 },
    emit: { helpLines: 7, helpChars: 339, proseChars: 1684 },
  } as const

  /**
   * ⚠ 200-04 (DES-02, `200-CHECKLIST.md` §1 `SP-MR-02` / `SP-MR-03`) — THE COLLAPSED READING
   * MOVED, AND THE 199-06 FIGURES ARE PRESERVED HERE RATHER THAN OVERWRITTEN.
   *
   * Read the direction before the numbers. 199-06's pin proved a SUBTRACTION — seven helper
   * sentences per step became zero — and **that claim is untouched: `helpLines` and
   * `helpChars` still read an exact 0 on both types below.** What moved is `proseChars`, and
   * it moved UP, because this phase deliberately ADDS sheet c4's card titles. A phase that
   * composes named sections and then reports its prose volume unchanged has either not built
   * them or has silently deleted something else to pay for them.
   *
   * ⚠ THE DELTA ACCOUNTS FOR ITSELF WITH NO RESIDUAL, WHICH IS THE ONLY THING THAT
   * DISTINGUISHES GROWTH FROM DRIFT. Both types moved by exactly `+22`, and both cards are
   * the same two on both types:
   *
   *     "Model"              →  5 chars   (`STEP_CARD_MODEL_TITLE`)
   *     "What it can reach"  → 17 chars   (`STEP_CARD_REACH_TITLE`)
   *                            ──
   *                            22   =  1403 − 1381  =  1385 − 1363  =  1640 − 1618
   *
   * Not one character is unexplained, on any of the three readings. An unexplained `+n` is
   * the thing to worry about, never a bigger number.
   *
   * ⚠ AND THE 199-06 FIGURES ARE KEPT AS DATA, not as a comment: `DENSITY_AT_199_06` below is
   * asserted against, so *"the panel is still quieter than the one that shipped"* stays a
   * COMPUTED claim rather than an inherited one. A pin quietly overwritten to make red go
   * green is a pin that will never fail again — so this one is overwritten LOUDLY, with the
   * arithmetic that justifies each digit, and the reading it replaces still on the page.
   */
  const DENSITY_AT_199_06 = {
    agent: { helpLines: 0, helpChars: 0, proseChars: 1381 },
    emit: { helpLines: 0, helpChars: 0, proseChars: 1363 },
    open: { helpLines: 5, helpChars: 234, proseChars: 1618 },
  } as const

  /** The two card titles 200-04 added, and their exact cost in rendered characters. */
  const CARD_TITLE_CHARS = "Model".length + "What it can reach".length

  /**
   * ⚠ 200 (THE STEP-PANEL PORT) — THE THIRD READING, AND THE 200-04 FIGURES ARE PRESERVED
   * ABOVE RATHER THAN OVERWRITTEN, exactly as 200-04 preserved 199-06's.
   *
   * ⚠ READ WHY THIS MOVED BEFORE READING THE NUMBERS, because "the pin went up again" is the
   * shape of a pin being relaxed and this one is not. 200-04 reported `13/14` atoms on this
   * screen and the operator's verdict on the shipped result was that **it is not what was
   * designed**: measured against `screens/step-panel.html`, the sheet composes SEVEN titled
   * cards and the panel had THREE. The rework ports the sheet's structure directly, so it
   * ADDS the four titles that were missing plus one refusal the sheet draws as a control this
   * product has no seam for. A port that added four named sections and then reported its
   * prose volume unchanged would have either not built them or silently deleted something
   * else to pay for them.
   *
   * ⚠ WHAT THE PIN ACTUALLY GUARDS IS UNTOUCHED, AND THAT IS THE LOAD-BEARING HALF.
   * `helpLines` and `helpChars` still read an EXACT `0` at the collapsed reading and an exact
   * `5 / 234` at the open one — byte-identical to 199-06's and 200-04's readings. 199-06's
   * SUBTRACTION is therefore proven un-reversed: this port re-opened no helper, and the
   * arithmetic below is what separates that claim from a hope.
   *
   * ⚠ THE DELTA ACCOUNTS FOR ITSELF WITH NO RESIDUAL, per type:
   *
   *     llm_agent  1403 → 1508   (+105)  =  "What it does" (12) + the no-add refusal (93)
   *     llm_emit   1385 → 1506   (+121)  =  the same 105, plus "What it delivers" (16)
   *     open       1640 → 1745   (+105)  =  the agent reading, identical
   *
   * Every character is attributed to a NAMED constant below, so a future drift of one
   * character fails with a computable cause rather than with a bigger number.
   */
  /**
   * ⚠ SEED-230 (2026-08-29) — THE FOURTH READING, AND THE PORT FIGURES ABOVE ARE PRESERVED
   * RATHER THAN OVERWRITTEN, exactly as the port preserved 200-04's and 200-04 preserved
   * 199-06's.
   *
   * ⚠ READ WHY THIS MOVED BEFORE READING THE NUMBERS. The operator scrolled past the whole
   * governance section and then spent FOUR FAILED PUBLISHES discovering the rule by
   * experiment. Every sentence that section carried described a STATE — "held strictly", "a
   * check runs on this step" — and none named a CONSEQUENCE, so it read as a quality setting
   * rather than as a gate. `GROUNDING_PUBLISH_CONSEQUENCE` is the one sentence that says what
   * the state does. It is 87 characters, and it is the ENTIRE delta.
   *
   * ⚠ WHAT THE PIN ACTUALLY GUARDS IS UNTOUCHED, AND THAT IS THE LOAD-BEARING HALF.
   * `helpLines` and `helpChars` still read an EXACT `0` collapsed and an exact `5 / 234` open
   * — byte-identical to 199-06's, 200-04's and the port's. **199-06's SUBTRACTION is proven
   * un-reversed: this added a SENTENCE to an existing section, and re-opened no helper.**
   *
   * ⚠ AND `llm_emit` IS UNMOVED AT `1506`, WHICH IS THE PROPERTY WORTH HAVING. The sentence
   * renders on the `detected` arm of the grounding dial, and `GROUNDING_DIAL_TYPES` is
   * `llm_agent` / `llm_batch_agents` only — so a type that carries no dial gains nothing. A
   * change that moved `emit` too would mean the sentence had escaped its arm.
   *
   *     llm_agent  1508 → 1595   (+87)  =  GROUNDING_PUBLISH_CONSEQUENCE
   *     llm_emit   1506 → 1506   (  0)  =  no dial, no sentence
   *     open       1745 → 1832   (+87)  =  the agent reading, identical
   *
   * No residual, per type — which is what distinguishes this from a pin relaxed to make red
   * go green, the failure mode the block above names in as many words.
   */
  const SEED_230_CONSEQUENCE_CHARS = GROUNDING_PUBLISH_CONSEQUENCE.length

  const PORT_WHAT_IT_DOES_CHARS = STEP_CARD_WHAT_IT_DOES_TITLE.length
  const PORT_NO_SOURCE_ADD_CHARS = STEP_CARD_NO_SOURCE_ADD.length
  const PORT_DELIVERS_CHARS = STEP_CARD_DELIVERS_TITLE.length
  /** What EVERY step type gained: the first card's title, and the folders' honest refusal. */
  const PORT_SHARED_CHARS = PORT_WHAT_IT_DOES_CHARS + PORT_NO_SOURCE_ADD_CHARS

  it("DENSITY AFTER — the collapsed reading, measured against the recorded BEFORE", () => {
    const agent = densityOf(renderAtFullDensity("llm_agent", FULL_RAILS).container)
    const emit = densityOf(renderAtFullDensity("llm_emit", FULL_RAILS).container)
    // ⚠ MEASURED, NOT CHOSEN. Re-derive by breaking these literals, never by loosening them
    // to a range — a range is what turns a characterization pin into a decoration.
    expect({ agent, emit }).toEqual({
      agent: { helpLines: 0, helpChars: 0, proseChars: 1595 },
      emit: { helpLines: 0, helpChars: 0, proseChars: 1506 },
    })
    // ⚠ 200-04 — THE SUBTRACTION 199-06 PROVED IS UNTOUCHED, asserted rather than asserted-about.
    expect(agent.helpLines).toBe(0)
    expect(emit.helpLines).toBe(0)
    // …and the ENTIRE prose delta is the four card titles this screen owed plus the folders'
    // one honest refusal. No residual, on either type — the 200-04 accounting, carried
    // forward and extended rather than replaced.
    expect(agent.proseChars - DENSITY_AT_199_06.agent.proseChars).toBe(
      CARD_TITLE_CHARS + PORT_SHARED_CHARS + SEED_230_CONSEQUENCE_CHARS,
    )
    expect(emit.proseChars - DENSITY_AT_199_06.emit.proseChars).toBe(
      CARD_TITLE_CHARS + PORT_SHARED_CHARS + PORT_DELIVERS_CHARS,
    )
    // The delta is NEGATIVE on both types and on every axis that measures prose.
    expect(agent.helpLines).toBeLessThan(DENSITY_BEFORE.agent.helpLines)
    expect(agent.proseChars).toBeLessThan(DENSITY_BEFORE.agent.proseChars)
    expect(emit.helpLines).toBeLessThan(DENSITY_BEFORE.emit.helpLines)
    expect(emit.proseChars).toBeLessThan(DENSITY_BEFORE.emit.proseChars)
  })

  it("199-06 — a FAILED registry read reaches all four model-bearing types, and says so", () => {
    // The widened `Pick` carries the reading through the SAME four mounts — no fifth line,
    // and the source fence below still reads four. This drives the panel, not the picker:
    // what is asserted here is that the panel forwards the caller's answer WHOLE on every
    // type that has a model, which is the only claim the panel owes for this feature.
    for (const phase_type of ["llm_single", "llm_agent", "llm_batch_agents", "llm_emit"]) {
      const { unmount } = render(
        <PhaseFormPanel
          phase={phaseOf({ phase_type, prompt: "x", model: "gpt-5.4", emitter: "render_template" })}
          open
          onChange={noop}
          onPersist={noop}
          onClose={noop}
          modelPicker={{ models: [], runDefaultModel: null, noAnswer: "unavailable" }}
        />,
      )
      expect(screen.getByTestId("model-no-answer").getAttribute("data-reading"), phase_type).toBe("unavailable")
      // ⚠ AUTH-04's core claim survives the new arm on every type: still no typed path.
      expect(screen.queryByRole("textbox", { name: /^ai model/i }), phase_type).not.toBeInTheDocument()
      unmount()
    }
  })

  it("199-06 — a step type with NO model stays untouched by the failed read", () => {
    for (const phase_type of ["programmatic", "llm_human_input"]) {
      const { unmount } = render(
        <PhaseFormPanel
          phase={phaseOf({ phase_type, prompt: "x", fn: "f", input_keys: ["x"] })}
          open
          onChange={noop}
          onPersist={noop}
          onClose={noop}
          modelPicker={{ models: [], runDefaultModel: null, noAnswer: "unavailable" }}
        />,
      )
      // The gate is still the PHASE TYPE. A failed read must not conjure a model field onto
      // a deterministic step or a human pause just because it has something to report.
      expect(screen.queryByTestId("model-no-answer"), phase_type).not.toBeInTheDocument()
      unmount()
    }
  })

  it("DENSITY AT THE OPEN READING — still below BEFORE, because one helper was CUT", () => {
    const { container } = renderAtFullDensity("llm_agent", FULL_RAILS)
    fireEvent.click(screen.getByTestId("field-guidance-toggle"))
    const open = densityOf(container)
    // ⚠ 200-04 read `1618` → `1640` (`+22`, its two card titles). ⚠ THE STEP-PANEL PORT
    // MOVES IT AGAIN, to `1745`, and the `+105` is `What it does` plus the folders' honest
    // no-add refusal — the identical accounting as the agent's collapsed reading, because the
    // port added no GUIDANCE and the two readings therefore diverge by exactly the helpers.
    // `helpLines` and `helpChars` are UNMOVED at `5 / 234` across all three phases, which is
    // what proves each of them added SECTIONS and none quietly re-opened a helper 199-06 folded.
    expect(open).toEqual({ helpLines: 5, helpChars: 234, proseChars: 1832 })
    expect(open.helpLines).toBe(DENSITY_AT_199_06.open.helpLines)
    expect(open.helpChars).toBe(DENSITY_AT_199_06.open.helpChars)
    expect(open.proseChars - DENSITY_AT_199_06.open.proseChars).toBe(
      CARD_TITLE_CHARS + PORT_SHARED_CHARS + SEED_230_CONSEQUENCE_CHARS,
    )
    // Fully open is the DENSEST this panel can now be, and it is still quieter than the
    // panel that shipped — the model helper is gone outright and the whitelist refusal
    // stopped being a helper. Both are subtractions the switch cannot undo.
    expect(open.helpLines).toBeLessThan(DENSITY_BEFORE.agent.helpLines)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════════════
// Phase 200-04 Task 2 (DES-02, sheet `c4-phase-form-panel`) — §1's CARD SECTIONS.
//
// `200-CHECKLIST.md` §1 is this screen's acceptance bar and it was committed BEFORE any
// source byte of this phase changed. Every case below CITES ITS ROW ID, because the
// checklist's own rule is that later plans cite the id rather than re-deriving the atom.
//
// ⚠ THE VERDICTS ARE NOT ALL "BUILD", AND THE DIFFERENCE IS CHECKED. `SP-MR-02`/`03`/`04`
// are blue — BUILD. `SP-MR-05`/`06`/`07` are green — **VERIFY, DO NOT REBUILD**, and
// ⚠ `ALREADY-SHIPPED` IS NOT A PASS IN THIS PHASE (it was 57 of 105 verdicts in 199): a
// green row means DRIVE IT AND SHOW IT RENDERS, so each one below is a render, never a
// source grep.
// ═══════════════════════════════════════════════════════════════════════════════════════

/** The panel's four model-bearing types, in the schema's order. Re-declared locally so this
 *  block reads on its own; the mount fence above owns the canonical copy. */
const CARD_MODEL_TYPES = ["llm_agent", "llm_batch_agents", "llm_emit", "llm_single"]

describe("200-04 §1 — sheet c4's card sections (SP-MR-02 / SP-MR-03 / SP-MR-04)", () => {
  it("SP-MR-02 — a MODEL card frames the picker, on every type that carries a model", () => {
    for (const phase_type of CARD_MODEL_TYPES) {
      const { unmount } = renderAtFullDensity(phase_type, FULL_RAILS)
      const card = screen.getByTestId("card-model")
      expect(card, phase_type).toHaveTextContent(STEP_CARD_MODEL_TITLE)
      // The card FRAMES the shipped control — it does not replace it, and it does not
      // introduce a second one. `within` is what makes that a containment claim.
      expect(within(card).getByLabelText(/^ai model/i).tagName, phase_type).toBe("SELECT")
      unmount()
    }
  })

  it("SP-MR-02 — the fitness reading rides the deliverable's card, and ONLY it (D-12)", () => {
    // The sheet draws `Strong for judging` inside the MODEL card. It is `modelFitness.ts`'s
    // vocabulary, already shipped, and it is gated to `llm_emit` — on the other three types
    // the emission tier predicts nothing about the outcome, and a warning that predicts
    // nothing trains people to ignore the ones that do.
    const { unmount } = renderAtFullDensity("llm_emit", FULL_RAILS)
    const emitCard = screen.getByTestId("card-model")
    expect(emitCard.textContent).not.toBe("")
    unmount()
    for (const phase_type of ["llm_agent", "llm_batch_agents", "llm_single"]) {
      const { unmount: u } = renderAtFullDensity(phase_type, FULL_RAILS)
      // Asserted through the SOURCE fence's own claim, driven: the flag is on one mount.
      expect(screen.getByTestId("card-model"), phase_type).toBeInTheDocument()
      u()
    }
  })

  it("SP-MR-02 — NO empty MODEL card when the caller supplied no registry answer", () => {
    // A card with nothing in it is worse than no card: it reads as a control that failed to
    // load. The gate is the same `modelPicker` prop the four mounts ride, so absence removes
    // the frame and its contents together.
    for (const phase_type of CARD_MODEL_TYPES) {
      const { unmount } = render(
        <PhaseFormPanel
          phase={phaseOf({ phase_type, prompt: "x", model: "gpt-5.4", emitter: "render_template" })}
          open
          onChange={noop}
          onPersist={noop}
          onClose={noop}
        />,
      )
      expect(screen.queryByTestId("card-model"), phase_type).not.toBeInTheDocument()
      unmount()
    }
  })

  it("SP-MR-03 — a WHAT IT CAN REACH card frames the folders, as NAMES and never a path", () => {
    render(
      <PhaseFormPanel
        phase={phaseOf({ phase_type: "llm_agent", prompt: "x", folder_scope: ["f-1", "f-2"] })}
        open
        onChange={noop}
        onPersist={noop}
        onClose={noop}
        folderNames={{ "f-1": "Contracts", "f-2": "Compliance" }}
      />,
    )
    const card = screen.getByTestId("card-reach")
    expect(card).toHaveTextContent(STEP_CARD_REACH_TITLE)
    // The sheet's own two folders, by NAME. The bound id stays reachable via the ⓘ title
    // and is never rendered as visible text — the shipped `folder_scope` contract.
    expect(within(card).getByTestId("folder-scope-display")).toHaveTextContent("Contracts")
    expect(within(card).getByTestId("folder-scope-display")).toHaveTextContent("Compliance")
    expect(card.textContent).not.toContain("/")
  })

  it("SP-MR-04 — a WHAT IT CHANGES OUTSIDE card, its mark and its sentence", () => {
    render(
      <PhaseFormPanel
        phase={phaseOf({ phase_type: "external_action", capability: "send_email" })}
        open
        onChange={noop}
        onPersist={noop}
        onClose={noop}
      />,
    )
    const card = screen.getByTestId("card-outside")
    expect(card).toHaveTextContent(STEP_CARD_OUTSIDE_TITLE)
    expect(screen.getByTestId("card-outside-mark")).toHaveTextContent(STEP_CARD_NEEDS_ARMING)
    expect(screen.getByTestId("card-outside-note")).toHaveTextContent(STEP_CARD_OUTSIDE_SENTENCE)
    // The chosen consequence, as the SENTENCE — never the wire id.
    expect(screen.getByTestId("outside-change")).toHaveTextContent("Sends an email")
    expect(card.innerHTML).not.toContain("send_email")
  })

  it("SP-MR-04 — the consequence line renders NOTHING when nothing is chosen", () => {
    // Absence is `undefined`, never a placeholder: a blank consequence row is
    // byte-indistinguishable from a lookup that failed, and on a governance card those two
    // readings are opposite.
    for (const capability of ["", "a_capability_nobody_declared", "constructor"]) {
      const { unmount } = render(
        <PhaseFormPanel
          phase={phaseOf({ phase_type: "external_action", capability })}
          open
          onChange={noop}
          onPersist={noop}
          onClose={noop}
        />,
      )
      expect(screen.queryByTestId("outside-change"), capability).not.toBeInTheDocument()
      // …and the card itself still renders, because the step type is the fact, not the pick.
      expect(screen.getByTestId("card-outside"), capability).toBeInTheDocument()
      unmount()
    }
  })

  it("SP-MR-04 — the NEEDS ARMING mark is not a second copy of a list that can drift", () => {
    // The mark states a fact about the TYPE (D-04: this step always stops and asks), and the
    // ONE home for that decision is `ARM_PINNED_TYPES` in `GovernanceSection.tsx`. The card
    // renders only on that list's sole member, so the mark is true BY CONSTRUCTION — and this
    // is what stops the two drifting apart silently, which a comment could not.
    expect(governanceSectionSource).toMatch(
      /const ARM_PINNED_TYPES: readonly string\[\] = \["external_action"\]/,
    )
    // NON-VACUITY: the source really loaded and really is that module.
    expect(governanceSectionSource.length).toBeGreaterThan(1000)
  })

  it("the cards use `data-card`, NEVER `data-rail` — the D-14 byte-identity guard is not theirs", () => {
    // `PhaseFormPanel.rails.test.tsx` requires ZERO `[data-rail]` elements in a rails-absent
    // render, because a flag-off author must see today's panel. These cards render on BOTH
    // surfaces, so borrowing the rails' attribute would turn that guard red for a reason that
    // has nothing to do with rails.
    const { container } = render(
      <PhaseFormPanel
        phase={phaseOf({ phase_type: "llm_agent", prompt: "x" })}
        open
        onChange={noop}
        onPersist={noop}
        onClose={noop}
      />,
    )
    expect(container.querySelectorAll("[data-rail]")).toHaveLength(0)
    expect(container.querySelectorAll("[data-card]").length).toBeGreaterThan(0)
  })
})

describe("200-04 §1 — the GREEN rows: VERIFY, do not rebuild (SP-MR-05 / 06 / 07)", () => {
  it("SP-MR-05 — the absent-registry arm still says its shipped sentence, on all four types", () => {
    // ⚠ DRIVEN, not grepped. `ALREADY-SHIPPED` is not a pass in this phase.
    for (const phase_type of CARD_MODEL_TYPES) {
      const { unmount } = render(
        <PhaseFormPanel
          phase={phaseOf({ phase_type, prompt: "x", model: "gpt-5.4", emitter: "render_template" })}
          open
          onChange={noop}
          onPersist={noop}
          onClose={noop}
          modelPicker={{ models: [], runDefaultModel: null, noAnswer: "unavailable" }}
        />,
      )
      expect(screen.getByTestId("model-no-answer"), phase_type).toHaveTextContent(
        "We couldn't load the list of models.",
      )
      unmount()
    }
  })

  it("SP-MNR-04 — a failed registry read yields NO free-text box, inside the card either", () => {
    // AUTH-04 (196), re-asserted from inside the new frame: the card must not become the
    // place a "graceful degradation" reintroduces a typed model path. Absence is the honest
    // degradation; a text box is the regression, and only this tells them apart.
    for (const phase_type of CARD_MODEL_TYPES) {
      const { unmount } = render(
        <PhaseFormPanel
          phase={phaseOf({ phase_type, prompt: "x", model: "gpt-5.4", emitter: "render_template" })}
          open
          onChange={noop}
          onPersist={noop}
          onClose={noop}
          modelPicker={{ models: [], runDefaultModel: null, noAnswer: "unavailable" }}
        />,
      )
      const card = screen.getByTestId("card-model")
      expect(within(card).queryByRole("textbox"), phase_type).not.toBeInTheDocument()
      expect(within(card).queryByRole("combobox"), phase_type).not.toBeInTheDocument()
      expect(screen.queryByRole("textbox", { name: /^ai model/i }), phase_type).not.toBeInTheDocument()
      unmount()
    }
  })

  it("SP-MR-06 — the lock statement renders, and NAMES NOBODY", () => {
    // ⚠ N-7, honoured with its disagreement stated. The sketch draws `Locked — only the
    // person who locked it can release it`; that literal is NOT shipped copy, and this phase
    // does not author it (a fifth spelling of a locked vocabulary is the drift the
    // one-string-home rule exists to prevent). What the checklist's atom actually turns on is
    // that the lock is stated WITHOUT a person, and the shipped one-way grounding dial's
    // refusal is exactly that. Driven here, and checked for the thing that matters.
    renderAtFullDensity("llm_agent", FULL_RAILS)
    const refusal = screen.getByTestId("governance-refusal")
    expect(refusal).toHaveTextContent(GROUNDING_LOCK_REFUSAL)
    // SP-MNR-05 in its positive form: no person, no possessive, no "by".
    expect(refusal.textContent).not.toMatch(/\bLocked by\b/i)
    expect(refusal.textContent).not.toMatch(/\b[A-Z][a-z]+ [A-Z]\.\B/)
  })

  it("SP-MR-07 — the refusal that keeps the tool list closed is on screen at rest", () => {
    // It is NOT guidance and therefore NOT foldable: it states that the control REFUSES typed
    // input. Asserted at the COLLAPSED reading, which is where a person actually meets it.
    renderAtFullDensity("llm_agent", FULL_RAILS)
    expect(screen.getByTestId("tools-no-typing")).toHaveTextContent(TOOL_WHITELIST_REFUSAL)
    expect(screen.queryAllByTestId("field-help")).toHaveLength(0)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════════════
// Phase 200-04 Task 3 (DES-02) — §1.2's `MUST NOT RENDER` FENCE, BUILT TO FIRE.
//
// ⚠ THE MUST-NOT-RENDER HALF IS CHECKED EXACTLY AS STRICTLY AS THE MUST-RENDER HALF. That
// is `200-CHECKLIST.md`'s own rule, and it is what makes a SUBTRACTION provable rather than
// asserted — the thing Phase 199 could not do when it verified 5/5 against criteria derived
// alongside its own work while the operator's verdict was *"nothing changed"*.
//
// ── ⚠ WHY THIS IS NOT A `?raw` SOURCE REGEX, MEASURED RATHER THAN PREFERRED ─────────────
//
// `199-03` planted a LIVE violation — `<a href="/publish?force=1">Proceed to publish anyway</a>`
// — inside the surface it was guarding, and watched **a `?raw` source regex AND a
// `queryAllByRole("button")` filter BOTH pass GREEN.** A source regex cannot see a control
// composed from a variable, and a button scan cannot see a link. **Only a role-SET scan over
// the rendered DOM went red.** So this fence reads what a PERSON sees: the rendered text
// nodes, plus a seven-role control set.
//
// ⚠ AND A FENCE NOBODY DROVE IS A FENCE NOBODY BUILT. Wave 3 of this phase found one that was
// VACUOUS — the assertion was reached and still wrote nothing. So the predicate below was
// PLANTED AGAINST THE REAL COMPONENT (a ligature name and a model literal added to
// `StepCardSection.tsx`), OBSERVED RED, and the plant then restored byte-exactly. The verbatim
// failure is in `200-04-SUMMARY.md`. The two permanent controls below are what keep that
// property true after the plant is gone.
//
// ── ⚠ SCOPE IS WHAT MAKES THE NEEDLES HONEST, AND EACH SCOPE IS ARGUED ──────────────────
//
//   · `SP-MNR-01` (raw tool ids) is scoped to THE TOOL LIST, which is what the atom says.
//     The ⓘ hint deliberately carries the exact technical term — `available_tools`,
//     `search_documents` — in `title`/`aria-label`, and that is shipped Phase-103-ux
//     behaviour, not a defect. A whole-panel scan would fire on it and the honest fix would
//     be to delete a true affordance. So the scan reads TEXT NODES only, never `title` or
//     `aria-label`, and the tool-id class is checked inside the list's own containers.
//   · `SP-MNR-03` (ligature names) splits in two, because half the Material Symbols
//     vocabulary is ordinary English. `lock`, `add`, `search`, `folder`, `person`, `check`
//     appear in honest copy (*"Order is locked"*, *"Folders it can read"*), so those fire
//     ONLY when a text node's ENTIRE trimmed content IS the ligature — which is exactly how
//     an icon font renders one. The underscored names (`check_circle`, `chevron_right`,
//     `priority_high`, …) never occur in prose, so those are matched as substrings.
//     A scan that ignored this would be red on shipped copy, and a fence that cries wolf is
//     removed rather than obeyed.
// ═══════════════════════════════════════════════════════════════════════════════════════

/**
 * Every way a forbidden literal could arrive wearing a CONTROL rather than a text node —
 * `199-03`'s lesson, kept as a role SET rather than as `button` alone.
 */
const PANEL_CONTROL_SELECTOR = [
  "button",
  "a[href]",
  '[role="button"]',
  '[role="link"]',
  '[role="menuitem"]',
  'input[type="submit"]',
  'input[type="button"]',
].join(", ")

/** N-6's three stale model literals. Models come from the registry, never from a literal. */
const FORBIDDEN_MODEL_LITERALS = ["GPT-4o", "Claude 3.5 Sonnet", "Llama 3 Instruct"]

/** N-5, the half that never occurs in English prose — matched anywhere in the text. */
const LIGATURES_UNAMBIGUOUS = [
  "check_circle", "chevron_right", "priority_high", "fit_screen", "account_tree",
  "add_circle", "health_and_safety", "chat_bubble", "arrow_back", "account_circle", "save_as",
]

/** N-5, the half that IS ordinary English — fires only as a whole text node (an icon glyph). */
const LIGATURES_AS_WHOLE_NODE = [
  "description", "bolt", "search", "folder", "lock", "shield", "add", "close", "info",
  "error", "sync", "psychology", "summarize", "widgets", "remove", "warning", "person",
  "output", "menu", "settings", "check", "category", "dataset", "policy",
]

/** The rendered text of every text node under `root`, trimmed, empties dropped. */
function textNodesIn(root: HTMLElement): string[] {
  const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  const out: string[] = []
  for (let n = walker.nextNode(); n !== null; n = walker.nextNode()) {
    const t = (n.textContent ?? "").trim()
    if (t !== "") out.push(t)
  }
  return out
}

/**
 * Every `SP-MNR-01` / `02` / `03` violation visible in `root`, as reasons.
 *
 * ⚠ IT RETURNS THE REASONS, NOT A BOOLEAN. A count alone cannot tell a selector typo from a
 * clean surface, which is why the planted control below asserts it finds **all three classes**
 * rather than "at least one".
 */
function forbiddenVisibleIn(root: HTMLElement, toolIds: readonly string[] = []): string[] {
  const nodes = textNodesIn(root)
  const all = nodes.join(" ")
  const found: string[] = []

  for (const literal of FORBIDDEN_MODEL_LITERALS) {
    if (all.includes(literal)) found.push(`SP-MNR-02 model literal: ${literal}`)
  }
  for (const lig of LIGATURES_UNAMBIGUOUS) {
    if (all.includes(lig)) found.push(`SP-MNR-03 ligature: ${lig}`)
  }
  for (const lig of LIGATURES_AS_WHOLE_NODE) {
    if (nodes.includes(lig)) found.push(`SP-MNR-03 ligature as a whole node: ${lig}`)
  }
  // The CONTROL pass — the half a plain text scan is not trusted to cover on its own, since
  // a control's label can be composed from a variable. Labels only: `title`/`aria-label`
  // carry the technical term on purpose (Phase 103-ux) and are deliberately NOT read.
  for (const el of Array.from(root.querySelectorAll<HTMLElement>(PANEL_CONTROL_SELECTOR))) {
    const label = (el.textContent ?? "").trim()
    for (const id of toolIds) {
      if (label === id) found.push(`SP-MNR-01 raw tool id on a control: ${id}`)
    }
    for (const literal of FORBIDDEN_MODEL_LITERALS) {
      if (label.includes(literal)) found.push(`SP-MNR-02 model literal on a control: ${literal}`)
    }
  }
  return found
}

/** The rails a governed agent step gets, with four tool ids whose phrases really exist —
 *  shared by the fence and the REPORT register below, so both scan the SAME surface. */
const TOOLED_RAILS: PhaseFormRails = {
  order: { index: 2, total: 4 },
  toolOptions: ["search_documents", "execute_code", "query_documents_by_view", "write_todos"],
  gates: [{ label: GOVERNANCE_GATE_ROW_LABEL, locked: true }],
  kbTools: ["search_documents"],
}

describe("200-04 §1.2 — MUST NOT RENDER (SP-MNR-01 / SP-MNR-02 / SP-MNR-03)", () => {
  it("⚠ PERMANENT CONTROL 1 — a PLANTED violation of all three classes is FOUND", () => {
    // Without this the absence assertions below are VACUOUS: a typo in every selector, or a
    // predicate that walks the wrong tree, would read as a clean surface. This is committed
    // permanently for the same reason `PublishGauntlet.test.tsx` commits its own.
    const planted = document.createElement("div")
    planted.innerHTML = [
      '<span>chevron_right</span>',
      '<p>Use the run\'s model — today that would be GPT-4o</p>',
      '<button type="button">search_documents</button>',
    ].join("")
    const found = forbiddenVisibleIn(planted, ["search_documents"])
    // ⚠ ONE PLANT PER FORBIDDEN CLASS, so a selector typo fails THIS case first and names
    // which class it broke — a bare `length > 0` would pass on two working thirds.
    expect(found.length).toBeGreaterThanOrEqual(3)
    expect(found.some((f) => f.startsWith("SP-MNR-01"))).toBe(true)
    expect(found.some((f) => f.startsWith("SP-MNR-02"))).toBe(true)
    expect(found.some((f) => f.startsWith("SP-MNR-03"))).toBe(true)
  })

  it("⚠ PERMANENT CONTROL 2 — the predicate does NOT fire on the honest shipped copy", () => {
    // The other direction, and the one that keeps this fence USABLE: nobody must ever have to
    // delete a true sentence to go green. `Order is locked`, `Folders it can read` and
    // `Locked` all contain ligature words as ENGLISH, and none of them is a violation.
    const honest = document.createElement("div")
    honest.innerHTML = [
      "<h3>Order is locked</h3>",
      "<p>Folders it can read</p>",
      "<p>Reading your files is what this step is for.</p>",
      "<button type=\"button\">Search documents</button>",
    ].join("")
    expect(forbiddenVisibleIn(honest, ["search_documents"])).toEqual([])
  })

  it("SP-MNR-01 — the rails tool list names PHRASES, and no raw id is visible in it", () => {
    const { container } = renderAtFullDensity("llm_agent", TOOLED_RAILS)
    const rail = screen.getByTestId("tools-rail")
    // Scoped to the tool LIST, which is what the atom says — see this block's docblock for
    // why a whole-panel scan would be red on the shipped ⓘ and would deserve to be ignored.
    for (const id of TOOLED_RAILS.toolOptions as string[]) {
      expect(textNodesIn(rail), id).not.toContain(id)
      expect(toolName(id), id).not.toBe(id)
      expect(rail, id).toHaveTextContent(toolName(id))
    }
    // NON-VACUITY, asserted BEFORE the absence is believed: the rail really rendered, and it
    // really rendered these four options. Otherwise every negative above passes on an
    // empty container — the exact vacuity wave 3 found by planting.
    expect(screen.getAllByTestId("tool-option")).toHaveLength(4)
    // ⚠ MEASURED, and stronger than a floor: the rail's text is EXACTLY the four phrases and
    // nothing else. A floor (`length > n`) was the first draft and it failed by one — which
    // is the fence catching its own author before it could catch anything else.
    expect(textNodesIn(rail).slice().sort()).toEqual(
      (TOOLED_RAILS.toolOptions as string[]).map(toolName).slice().sort(),
    )
    // And the whole panel is free of the other two classes.
    expect(forbiddenVisibleIn(container.querySelector("aside") as HTMLElement, [])).toEqual([])
  })

  it("SP-MNR-01 — the rails-ABSENT chip preview names phrases too", () => {
    // The flag-off surface most authors are actually on. D-14 keeps its CONTROLS
    // byte-identical; it never promised the chips would keep printing schema tokens.
    render(
      <PhaseFormPanel
        phase={phaseOf({ phase_type: "llm_agent", prompt: "x", available_tools: ["query_tables", "write_todos"] })}
        open
        onChange={noop}
        onPersist={noop}
        onClose={noop}
      />,
    )
    const chips = screen.getByTestId("tools-chips")
    expect(chips).toHaveTextContent("Query tables")
    expect(chips).toHaveTextContent("Track its to-dos")
    expect(textNodesIn(chips)).not.toContain("query_tables")
    expect(textNodesIn(chips)).not.toContain("write_todos")
  })

  it("SP-MNR-02 / SP-MNR-03 — no model literal and no ligature name, on any of the seven types", () => {
    // ⚠ EVERY shipped phase type, at FULL density, with the registry answered and the
    // guidance OPEN — the densest reading this panel can produce, which is the one most
    // likely to leak a literal.
    for (const phase_type of PHASE_TYPE_ORDER) {
      const { container, unmount } = renderAtFullDensity(phase_type, TOOLED_RAILS)
      fireEvent.click(screen.getByTestId("field-guidance-toggle"))
      const aside = container.querySelector("aside") as HTMLElement
      expect(forbiddenVisibleIn(aside, []), phase_type).toEqual([])
      // NON-VACUITY per type: the panel really rendered something to scan.
      expect(textNodesIn(aside).length, phase_type).toBeGreaterThan(5)
      unmount()
    }
  })
})

// ═══════════════════════════════════════════════════════════════════════════════════════
// Phase 200-04 Task 3 (DES-02) — THE TWO `REPORT` ROWS, §5's register, in executable form.
//
// D-02's rule for an amber row OUTSIDE the named backend slice is **REPORT, with a named
// re-open trigger — never faked, never silently dropped.** These two cases are that register
// made mechanical, so *"found, priced and deferred on purpose"* stays a different statement
// from *"missed"* even after everyone who wrote it has forgotten.
//
// ⚠ NOTHING HERE MAY BE QUIETLY PROMOTED INTO A BUILD. A later plan that finds itself
// building one of these has grown a capability inside a phase that did not scope one — the
// G-7 failure mode, in miniature.
// ═══════════════════════════════════════════════════════════════════════════════════════

describe("200-04 §5 — the REPORT rows, each with its named re-open trigger", () => {
  it("SP-4 / SP-MNR-05 — REPORT: no lock is attributed to a PERSON — ⚠ TRIGGER: a phase that scopes lock ownership", () => {
    // Ledger note, verbatim: *"Who holds a lock is not on the wire."* N-7 measured that the
    // SCREEN and the ledger row disagree and that the SCREEN wins: the person-less form is
    // what ships (`SP-MR-06`, driven above), so nothing is missing from the RENDER — what is
    // missing is the ATTRIBUTION, and rendering a name would be a fabricated claim.
    for (const phase_type of PHASE_TYPE_ORDER) {
      const { container, unmount } = renderAtFullDensity(phase_type, TOOLED_RAILS)
      const text = (container.querySelector("aside")?.textContent ?? "")
      expect(text, phase_type).not.toMatch(/\bLocked by\b/i)
      // No `Firstname L.` initial-form anywhere — the sketch's own `Alex M.` shape.
      expect(text, phase_type).not.toMatch(/\b[A-Z][a-z]+ [A-Z]\.(?!\w)/)
      unmount()
    }
  })

  it("SP-5 / SP-MNR-06 — REPORT: no preflight row count renders — ⚠ TRIGGER: the connections / approval milestone (SEED-146)", () => {
    // Ledger note, verbatim: *"No row count is computed anywhere."* A preflight count is a
    // CAPABILITY (reach the target system, count rows, before acting), not a label, and
    // inventing one here would be exactly the fabricated business figure `199-05` refused —
    // *"the highest-consequence lie this phase could ship."*
    const { container } = render(
      <PhaseFormPanel
        phase={phaseOf({ phase_type: "external_action", capability: "send_email" }, { action_risk_armed: true })}
        open
        onChange={noop}
        onPersist={noop}
        onClose={noop}
        rails={TOOLED_RAILS}
        onGovernanceChange={noop}
      />,
    )
    const text = container.querySelector("aside")?.textContent ?? ""
    // A grouped thousands figure — the sketch's `1,200` shape — and the noun it would wear.
    expect(text).not.toMatch(/\d{1,3}(,\d{3})+/)
    expect(text).not.toMatch(/\b(?:overwrite|overwrites|affect|affects)\s+\d/i)
    expect(text).not.toMatch(/\d+\s+records\b/i)
    // NON-VACUITY: the card really is on screen, so the absence is a scope decision rather
    // than an empty render.
    expect(screen.getByTestId("card-outside")).toBeInTheDocument()
    expect(screen.getByTestId("outside-change")).toHaveTextContent("Sends an email")
  })

  it("⚠ CONTROL — the SP-5 needles really can fire, so their absence above means something", () => {
    const planted = document.createElement("div")
    planted.textContent = "Will overwrite 1,200 records"
    expect(planted.textContent).toMatch(/\d{1,3}(,\d{3})+/)
    expect(planted.textContent).toMatch(/\b(?:overwrite|overwrites|affect|affects)\s+\d/i)
    expect(planted.textContent).toMatch(/\d+\s+records\b/i)
    // …and the SP-4 needle too, on the sketch's own literal.
    expect("Locked by Alex M.").toMatch(/\bLocked by\b/i)
    expect("Locked by Alex M.").toMatch(/\b[A-Z][a-z]+ [A-Z]\.(?!\w)/)
  })
})
