/**
 * Phase 103-04 Task 2 (REQ-5 / WFAUTH-01, sketch 019-D D9) — PhaseFormPanel tests.
 *
 * The 400px push panel + the SIX phase_type-conditioned forms. These tests pin the
 * locked contract:
 *  - each of the 6 phase types renders ONLY its real fields; the others are ABSENT
 *    (programmatic/llm_human_input show NO model/tools/scope; only llm_emit has
 *    citation_policy).
 *  - on llm_emit, integrity_policy is present but DISABLED/read-only (greyed); it
 *    appears on NO other type, and citation_policy is editable.
 *  - folder_scope renders the folder NAME + bound UUID, NEVER a path.
 *  - the panel is NOT position:absolute/fixed — it is a grid track (push, not overlay).
 *  - a field change calls onChange; a blur/save calls onPersist.
 */
import { describe, it, expect, vi } from "vitest"
import { render, screen, within } from "@testing-library/react"
import { readFileSync } from "node:fs"
import path from "node:path"
import { PhaseFormPanel } from "./PhaseFormPanel"
import type { PhaseSpecJSON } from "./PhaseSpineGraph"

const SOURCE_PATH = path.resolve(
  process.cwd(),
  "src/components/workflows/PhaseFormPanel.tsx",
)

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

describe("PhaseFormPanel — 6 phase_type-conditioned forms", () => {
  it("programmatic: renders fn + input_keys; NO model/tools/scope/prompt", () => {
    render(
      <PhaseFormPanel
        phase={phaseOf({ phase_type: "programmatic", fn: "split_topic", input_keys: ["topic"] })}
        open
        onChange={noop}
        onPersist={noop}
      />,
    )
    expect(screen.getByLabelText(/fn/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/input_keys/i)).toBeInTheDocument()
    expect(screen.queryByLabelText(/^model/i)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/available_tools/i)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/folder_scope/i)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/^prompt/i)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/citation_policy/i)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/integrity_policy/i)).not.toBeInTheDocument()
  })

  it("llm_single: renders prompt + model + temperature + folder_scope + skill_ref; NO tools/max_steps", () => {
    render(
      <PhaseFormPanel
        phase={phaseOf({ phase_type: "llm_single", prompt: "write it", model: "claude-opus-4-8", temperature: 0.2 })}
        open
        onChange={noop}
        onPersist={noop}
      />,
    )
    expect(screen.getByLabelText(/^prompt/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/^model/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/temperature/i)).toBeInTheDocument()
    expect(screen.queryByLabelText(/available_tools/i)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/max_steps/i)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/citation_policy/i)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/integrity_policy/i)).not.toBeInTheDocument()
  })

  it("llm_agent: adds available_tools + max_steps (default 12) + wall_clock_seconds", () => {
    render(
      <PhaseFormPanel
        phase={phaseOf({ phase_type: "llm_agent", prompt: "search", available_tools: ["search_documents"] })}
        open
        onChange={noop}
        onPersist={noop}
      />,
    )
    expect(screen.getByLabelText(/^prompt/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/available_tools/i)).toBeInTheDocument()
    const maxSteps = screen.getByLabelText(/max_steps/i) as HTMLInputElement
    expect(maxSteps).toBeInTheDocument()
    expect(maxSteps.value).toBe("12") // default
    expect(screen.getByLabelText(/wall_clock_seconds/i)).toBeInTheDocument()
    expect(screen.queryByLabelText(/citation_policy/i)).not.toBeInTheDocument()
  })

  it("llm_batch_agents: adds max_parallel_agents (default 5) + merge_strategy", () => {
    render(
      <PhaseFormPanel
        phase={phaseOf({ phase_type: "llm_batch_agents", prompt: "fan out", available_tools: ["search_documents"] })}
        open
        onChange={noop}
        onPersist={noop}
      />,
    )
    const maxParallel = screen.getByLabelText(/max_parallel_agents/i) as HTMLInputElement
    expect(maxParallel).toBeInTheDocument()
    expect(maxParallel.value).toBe("5") // default
    expect(screen.getByLabelText(/merge_strategy/i)).toBeInTheDocument()
  })

  it("llm_human_input: renders prompt + options + timeout_seconds (default 300); NO model/tools/scope", () => {
    render(
      <PhaseFormPanel
        phase={phaseOf({ phase_type: "llm_human_input", prompt: "confirm?", options: ["yes", "no"] })}
        open
        onChange={noop}
        onPersist={noop}
      />,
    )
    expect(screen.getByLabelText(/^prompt/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/options/i)).toBeInTheDocument()
    const timeout = screen.getByLabelText(/timeout_seconds/i) as HTMLInputElement
    expect(timeout).toBeInTheDocument()
    expect(timeout.value).toBe("300") // default
    expect(screen.queryByLabelText(/^model/i)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/available_tools/i)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/folder_scope/i)).not.toBeInTheDocument()
  })

  it("llm_emit: renders citation_policy (editable) + integrity_policy (greyed/read-only)", () => {
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
    expect(screen.getByLabelText(/^prompt/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/emitter/i)).toBeInTheDocument()
    const citation = screen.getByLabelText(/citation_policy/i) as HTMLSelectElement
    expect(citation).toBeInTheDocument()
    expect(citation.disabled).toBe(false) // editable
    const integrity = screen.getByLabelText(/integrity_policy/i) as HTMLSelectElement
    expect(integrity).toBeInTheDocument()
    expect(integrity.disabled).toBe(true) // greyed/read-only (shown-but-inert)
  })

  it("integrity_policy is ABSENT on every non-llm_emit type", () => {
    const nonEmit = ["programmatic", "llm_single", "llm_agent", "llm_batch_agents", "llm_human_input"]
    for (const pt of nonEmit) {
      const config: Record<string, unknown> = { phase_type: pt }
      if (pt !== "programmatic") config.prompt = "x"
      if (pt === "programmatic") config.fn = "f"
      if (pt === "llm_agent" || pt === "llm_batch_agents") config.available_tools = []
      const { unmount } = render(
        <PhaseFormPanel phase={phaseOf(config)} open onChange={noop} onPersist={noop} />,
      )
      expect(screen.queryByLabelText(/integrity_policy/i)).not.toBeInTheDocument()
      expect(screen.queryByLabelText(/citation_policy/i)).not.toBeInTheDocument()
      unmount()
    }
  })

  it("folder_scope renders the folder NAME + bound UUID, never a path", () => {
    const uuid = "8c1a0000-0000-4000-8000-000000000001"
    render(
      <PhaseFormPanel
        phase={phaseOf({ phase_type: "llm_single", prompt: "x", folder_scope: [uuid] })}
        open
        folderName="Vendors — 2025 Assessments"
        onChange={noop}
        onPersist={noop}
      />,
    )
    const scope = screen.getByTestId("folder-scope-display")
    expect(scope.textContent).toContain("Vendors — 2025 Assessments")
    expect(scope.textContent).toContain(uuid)
    // Never a filesystem path.
    expect(scope.textContent).not.toMatch(/\/[A-Za-z]/)
    expect(scope.textContent).not.toMatch(/[A-Za-z]:\\/)
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
    const prompt = screen.getByLabelText(/^prompt/i)
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
    expect(screen.queryByLabelText(/^prompt/i)).not.toBeInTheDocument()
  })

  it("the SOURCE is push (not overlay) — no position:absolute/fixed inset", () => {
    const src = readFileSync(SOURCE_PATH, "utf8")
    expect(src).not.toMatch(/position:\s*(absolute|fixed)/)
    expect(src).not.toMatch(/fixed inset|absolute inset/)
  })
})
