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
import { fireEvent, render, screen } from "@testing-library/react"
// Read the component SOURCE via Vite's ?raw loader (typechecks under `vite/client`).
import phaseFormPanelSource from "./PhaseFormPanel?raw"
import { PhaseFormPanel } from "./PhaseFormPanel"
import { minimalPhaseFor, PHASE_TYPE_ORDER } from "./definitionOps"
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

  it("every field shows an ALWAYS-VISIBLE plain-English helper line under its label (not a title attr)", () => {
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
    // The helper sentences are rendered as plain VISIBLE text (queryable via getByText),
    // not hidden behind a hover-only `title`/ⓘ tooltip.
    expect(screen.getByText("What you want the AI to do in this step.")).toBeInTheDocument()
    // ⚠ 196-08 (D-06): this line read "Leave blank to use the workspace default." from Phase 103
    // until now, and the sentence was WRONG rather than merely old — there is no workspace
    // default in the code. A run inherits whatever model STARTED it, which is knowable at run
    // time and not while somebody is authoring, so the picker's helper says that instead. The
    // assertion is updated to the shipped honest copy rather than loosened to a regex.
    expect(screen.getByText("Leave blank to use the run's model.")).toBeInTheDocument()
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
        <PhaseFormPanel phase={phaseOf(config)} open onChange={noop} onPersist={noop} onClose={noop} />,
      )
      expect(screen.getByText(helper)).toBeInTheDocument()
      unmount()
    }
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
