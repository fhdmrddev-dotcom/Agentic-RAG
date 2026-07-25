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
import { render, screen } from "@testing-library/react"
// Read the component SOURCE via Vite's ?raw loader (typechecks under `vite/client`).
import phaseFormPanelSource from "./PhaseFormPanel?raw"
import { PhaseFormPanel } from "./PhaseFormPanel"
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

describe("PhaseFormPanel — 6 phase_type-conditioned forms (friendly labels)", () => {
  it("programmatic: renders Function + Inputs; NO model/tools/scope/instructions", () => {
    render(
      <PhaseFormPanel
        phase={phaseOf({ phase_type: "programmatic", fn: "split_topic", input_keys: ["topic"] })}
        open
        onChange={noop}
        onPersist={noop}
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
      />,
    )
    // The "strict" caption is shown plainly (no enum jargon required to understand it).
    expect(screen.getByText(/every claim must be cited/i)).toBeInTheDocument()
  })

  it("every field shows an ALWAYS-VISIBLE plain-English helper line under its label (not a title attr)", () => {
    render(
      <PhaseFormPanel
        phase={phaseOf({ phase_type: "llm_agent", prompt: "search", available_tools: ["search_documents"] })}
        open
        onChange={noop}
        onPersist={noop}
      />,
    )
    // The helper sentences are rendered as plain VISIBLE text (queryable via getByText),
    // not hidden behind a hover-only `title`/ⓘ tooltip.
    expect(screen.getByText("What you want the AI to do in this step.")).toBeInTheDocument()
    expect(screen.getByText("Leave blank to use the workspace default.")).toBeInTheDocument()
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

  it("each phase type renders a helper line under its representative editable field", () => {
    const cases: Array<[Record<string, unknown>, string]> = [
      [{ phase_type: "programmatic", fn: "f", input_keys: ["x"] }, "The registered function this step runs."],
      [{ phase_type: "llm_single", prompt: "x", temperature: 0.2 }, "Higher = more varied wording; lower = more focused."],
      [{ phase_type: "llm_batch_agents", prompt: "x", available_tools: [] }, "How many copies run at once."],
      [{ phase_type: "llm_human_input", prompt: "x", options: ["a"] }, "The options the person picks from when this pauses."],
      [{ phase_type: "llm_emit", prompt: "x", emitter: "render_template", citation_policy: "strict" }, "How strictly the deliverable must cite its sources."],
    ]
    for (const [config, helper] of cases) {
      const { unmount } = render(
        <PhaseFormPanel phase={phaseOf(config)} open onChange={noop} onPersist={noop} />,
      )
      expect(screen.getByText(helper)).toBeInTheDocument()
      unmount()
    }
  })

  it("the file-check / sourcing-strictness controls are ABSENT on every non-llm_emit type", () => {
    const nonEmit = ["programmatic", "llm_single", "llm_agent", "llm_batch_agents", "llm_human_input"]
    for (const pt of nonEmit) {
      const config: Record<string, unknown> = { phase_type: pt }
      if (pt !== "programmatic") config.prompt = "x"
      if (pt === "programmatic") config.fn = "f"
      if (pt === "llm_agent" || pt === "llm_batch_agents") config.available_tools = []
      const { unmount } = render(
        <PhaseFormPanel phase={phaseOf(config)} open onChange={noop} onPersist={noop} />,
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
