/**
 * Phase 184-09 Task 3 — the D-14 and R11 proofs for the governance rails.
 *
 * A NET-NEW suite. It does NOT absorb, replace or re-implement `PhaseFormPanel.test.tsx`:
 * those 19 assertions are the regression net for the panel as it ships, they all render
 * WITHOUT `rails`, and Phase 177's coverage-loss lesson (a "net-new" file that quietly
 * replaced an existing one) is why `scripts/vitest-count-gate.cjs` pins that file at 19.
 *
 * WHY THE D-14 GUARD LIVES HERE AND NOT IN `revertByteIdentical.test.tsx`. That suite is
 * the flag-off byte-identity net for the Builder, and it never renders `PhaseFormPanel` at
 * all — an assertion added there would guard nothing. This panel is a SINGLE instance
 * serving BOTH the shipped Spine view and the flagged Canvas view, so the only thing
 * standing between a rails feature and a changed flag-off surface is that `rails` is
 * optional and its absence renders today. That property is observable exactly here.
 * (184-VALIDATION.md records this reasoning; the file split is deliberate.)
 *
 * The R11 whitelist guard is worded as an OPTION-SET EQUALITY over two different mocked
 * responses, never as a source grep for tool-name literals. A blanket grep would fire on
 * `friendlyToolName` — a display-LABEL map that must survive — and force its docblock to
 * omit the identifiers it exists to translate, which is the D-ITEM-183-02 trap this phase
 * has now hit repeatedly.
 */
import { describe, it, expect, vi } from "vitest"
import { fireEvent, render, screen, within } from "@testing-library/react"

import phaseFormPanelSource from "./PhaseFormPanel?raw"
import { PhaseFormPanel, type PhaseFormRails, type PhaseGateRow } from "./PhaseFormPanel"
import type { PhaseSpecJSON } from "./phaseVocabulary"

function phaseOf(config: Record<string, unknown>): PhaseSpecJSON {
  return {
    slug: "p",
    phase_index: 0,
    name: "A phase",
    config: config as PhaseSpecJSON["config"],
  }
}

const noop = () => {}

function railsOf(over: Partial<PhaseFormRails> = {}): PhaseFormRails {
  return {
    order: { index: 1, total: 3 },
    toolOptions: [],
    gates: [],
    ...over,
  }
}

/** The shipped `llm_agent` shape — the type that actually carries `available_tools`. */
const AGENT = { phase_type: "llm_agent", prompt: "search", available_tools: ["search_documents"] }

function renderPanel(config: Record<string, unknown>, rails?: PhaseFormRails) {
  return render(
    <PhaseFormPanel
      phase={phaseOf(config)}
      open
      onChange={noop}
      onPersist={noop}
      onClose={noop}
      rails={rails}
    />,
  )
}

/**
 * Every marker the rails introduce. The D-14 test asserts NONE of them appears in a
 * rails-absent render, and a positive control asserts EVERY one of them appears in a
 * rails-present render — so the guard cannot pass by naming strings that never render.
 */
const RAIL_MARKERS = [
  "data-rail",
  "rail-order",
  "rail-gates",
  "tool-option",
  "Order is locked",
  "Runs as step",
  "Checks that run on this step",
]

// ── 1. THE D-14 ASSERTION ─────────────────────────────────────────────────────────────

describe("PhaseFormPanel — WITHOUT rails, the panel is today's panel (D-14 / D-181-01)", () => {
  it("renders the shipped free-text available_tools input and NO chip picker", () => {
    renderPanel(AGENT)

    // The shipped comma field, reachable by its friendly accessible name and carrying the
    // RAW ids — exactly what the 19 shipped assertions describe.
    const field = screen.getByLabelText(/what this step can do/i) as HTMLInputElement
    expect(field.tagName).toBe("INPUT")
    expect(field.getAttribute("type")).toBe("text")
    expect(field.value).toContain("search_documents")
    // The read-friendly chip PREVIEW is the shipped one, not the picker.
    expect(screen.getByTestId("tools-chips")).toBeInTheDocument()
    expect(screen.queryByTestId("tools-rail")).not.toBeInTheDocument()
    expect(screen.queryAllByTestId("tool-option")).toHaveLength(0)
  })

  it("renders no rail element and none of the strings the rails introduce", () => {
    const { container } = renderPanel(AGENT)

    expect(container.querySelectorAll("[data-rail]")).toHaveLength(0)
    for (const marker of RAIL_MARKERS) {
      expect(container.innerHTML).not.toContain(marker)
    }
  })

  it("POSITIVE CONTROL — every one of those markers really does render WITH rails", () => {
    // Without this, the assertion above could pass on a typo in every marker string.
    const { container } = renderPanel(
      AGENT,
      railsOf({ toolOptions: ["search_documents"], gates: [{ label: "Must cite its sources", locked: true }] }),
    )
    for (const marker of RAIL_MARKERS) {
      expect(container.innerHTML).toContain(marker)
    }
  })

  it("the rails-absent and rails-present renders are NOT the same DOM (the prop is load-bearing)", () => {
    const without = renderPanel(AGENT).container.innerHTML
    const withRails = renderPanel(AGENT, railsOf({ toolOptions: ["search_documents"] })).container.innerHTML
    expect(without).not.toBe(withRails)
  })
})

// ── 2-5. THE TOOL RAIL (R11) ──────────────────────────────────────────────────────────

describe("PhaseFormPanel rails — the tool whitelist comes from the bundle (R11)", () => {
  it("the rendered option SET equals the supplied array exactly", () => {
    renderPanel(AGENT, railsOf({ toolOptions: ["search_documents", "execute_code"] }))

    const rendered = screen.getAllByTestId("tool-option").map((el) => el.getAttribute("data-tool"))
    expect(rendered).toEqual(["search_documents", "execute_code"])
  })

  it("CHANGE THE MOCKED BUNDLE, CHANGE THE OPTIONS — nothing else moved", () => {
    const first = renderPanel(AGENT, railsOf({ toolOptions: ["search_documents", "execute_code"] }))
    const before = within(first.container)
      .getAllByTestId("tool-option")
      .map((el) => el.getAttribute("data-tool"))
    first.unmount()

    const second = renderPanel(AGENT, railsOf({ toolOptions: ["search_documents", "list_folders", "fetch_url"] }))
    const after = within(second.container)
      .getAllByTestId("tool-option")
      .map((el) => el.getAttribute("data-tool"))

    expect(before).toEqual(["search_documents", "execute_code"])
    expect(after).toEqual(["search_documents", "list_folders", "fetch_url"])
    expect(after).not.toEqual(before)
  })

  it("there is NO free-text box bound to available_tools in the rails variant", () => {
    renderPanel(AGENT, railsOf({ toolOptions: ["search_documents", "execute_code"] }))

    const rail = screen.getByTestId("tools-rail")
    expect(rail.querySelectorAll("input, textarea")).toHaveLength(0)
    // No control anywhere in the panel carries the tool list as an editable value.
    const inputs = Array.from(document.querySelectorAll("input")) as HTMLInputElement[]
    expect(inputs.some((i) => i.value.includes("search_documents"))).toBe(false)
    // The accessible name survives (the rail is a labelled `role="group"`), but it no longer
    // resolves to anything a user can TYPE into — which is the whole of "no free-text box".
    const named = screen.getByLabelText(/what this step can do/i)
    expect(named).toBe(rail)
    expect(["INPUT", "TEXTAREA"]).not.toContain(named.tagName)
  })

  it("a chip toggles through the SAME comma seam the free-text field used", () => {
    const onChange = vi.fn()
    const onPersist = vi.fn()
    render(
      <PhaseFormPanel
        phase={phaseOf(AGENT)}
        open
        onChange={onChange}
        onPersist={onPersist}
        onClose={noop}
        rails={railsOf({ toolOptions: ["search_documents", "execute_code"] })}
      />,
    )

    fireEvent.click(screen.getByTitle("execute_code"))
    expect(onChange).toHaveBeenCalledWith({ available_tools: ["search_documents", "execute_code"] })
    expect(onPersist).toHaveBeenCalledTimes(1)
  })

  it("a named tool the registry LACKS renders struck through — present, never hidden", () => {
    renderPanel(
      { ...AGENT, available_tools: ["search_documents", "web_scrape"] },
      railsOf({ toolOptions: ["search_documents", "execute_code"] }),
    )

    const stray = screen.getByTestId("tools-rail").querySelector('[data-tool="web_scrape"]')
    expect(stray).toBeTruthy()
    expect(stray?.className).toContain("line-through")
    expect(stray?.getAttribute("data-unregistered")).toBe("true")
    // A registered one is NOT struck through — the control that keeps the check meaningful.
    const known = screen.getByTestId("tools-rail").querySelector('[data-tool="search_documents"]')
    expect(known?.className).not.toContain("line-through")
  })

  it("a degraded bundle SAYS SO and renders ZERO options — never an empty-but-normal picker", () => {
    renderPanel(AGENT, railsOf({ toolOptions: "degraded" }))

    const sentence = screen.getByTestId("tools-degraded")
    expect(sentence.textContent ?? "").toMatch(/could ?n[o’']t load/i)
    expect(screen.queryAllByTestId("tool-option")).toHaveLength(0)
    expect(screen.queryByTestId("tools-rail")).not.toBeInTheDocument()
  })

  it("a degraded read still prints what the step already names (a failed read is not a wipe)", () => {
    renderPanel(AGENT, railsOf({ toolOptions: "degraded" }))
    expect(screen.getByTestId("tools-degraded-current").textContent).toContain("Search documents")
  })

  it("an EMPTY registry with a successful read is a different, honest state", () => {
    // We asked and the answer was "none" — distinct from "we could not ask".
    renderPanel({ phase_type: "llm_agent", prompt: "x", available_tools: [] }, railsOf({ toolOptions: [] }))
    expect(screen.getByTestId("tools-empty")).toBeInTheDocument()
    expect(screen.queryByTestId("tools-degraded")).not.toBeInTheDocument()
  })
})

// ── 6-7. THE GATES AND ORDER RAILS ────────────────────────────────────────────────────

describe("PhaseFormPanel rails — gates cannot be wired around", () => {
  const gates: PhaseGateRow[] = [
    { label: "Must cite its sources", locked: true },
    { label: "Output file is valid", locked: false, onRemove: () => {} },
  ]

  it("a LOCKED gate row has zero controls in its DOM subtree", () => {
    renderPanel(AGENT, railsOf({ gates }))

    const rows = screen.getAllByTestId("gate-row")
    const locked = rows.find((r) => r.getAttribute("data-locked") === "true")
    expect(locked).toBeTruthy()
    expect(locked!.querySelectorAll('button, [role="button"], input')).toHaveLength(0)
    expect(locked!.textContent).toContain("Cannot be removed")
  })

  it("an UNLOCKED gate row has exactly one, and it fires the caller's handler", () => {
    const onRemove = vi.fn()
    renderPanel(
      AGENT,
      railsOf({
        gates: [
          { label: "Must cite its sources", locked: true },
          { label: "Output file is valid", locked: false, onRemove },
        ],
      }),
    )

    const rows = screen.getAllByTestId("gate-row")
    const unlocked = rows.find((r) => r.getAttribute("data-locked") === "false")
    expect(unlocked).toBeTruthy()
    const controls = unlocked!.querySelectorAll('button, [role="button"], input')
    expect(controls).toHaveLength(1)

    fireEvent.click(controls[0] as HTMLElement)
    expect(onRemove).toHaveBeenCalledTimes(1)
  })

  it("the order rail reads the locked sentence with the caller's numbers", () => {
    renderPanel(AGENT, railsOf({ order: { index: 1, total: 3 } }))
    expect(screen.getByTestId("rail-order").textContent).toContain(
      "Runs as step 1 of 3 — steps run in order, one after another.",
    )
  })

  it("the order rail carries NO control — moving is a canvas gesture, not a form field", () => {
    renderPanel(AGENT, railsOf({ order: { index: 2, total: 4 } }))
    const rail = screen.getByTestId("rail-order")
    expect(rail.querySelectorAll('button, [role="button"], input, select, a')).toHaveLength(0)
  })
})

// ── 8-9. THE SCOPE FENCES ─────────────────────────────────────────────────────────────

describe("PhaseFormPanel rails — Phase 184 invents no authored grounding field", () => {
  const GROUNDING_MODE = /grounding_mode/

  it("the panel source never names Phase 185's field", () => {
    expect(phaseFormPanelSource).not.toMatch(GROUNDING_MODE)
  })

  it("POSITIVE CONTROL — the pattern really does find that token", () => {
    expect(GROUNDING_MODE.test('const mode = phase.config.grounding_mode')).toBe(true)
  })
})

describe("PhaseFormPanel rails — the per-type conditioning is unchanged WITH rails present", () => {
  it("programmatic still shows no model, no tools and no folder scope", () => {
    renderPanel({ phase_type: "programmatic", fn: "split_topic", input_keys: ["topic"] }, railsOf())

    expect(screen.getByLabelText(/^function/i)).toBeInTheDocument()
    expect(screen.queryByLabelText(/^ai model/i)).not.toBeInTheDocument()
    expect(screen.queryByTestId("tools-rail")).not.toBeInTheDocument()
    expect(screen.queryByTestId("folder-scope-display")).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/sourcing strictness/i)).not.toBeInTheDocument()
  })

  it("llm_human_input still shows no model, no tools and no folder scope", () => {
    renderPanel({ phase_type: "llm_human_input", prompt: "confirm?", options: ["yes"] }, railsOf())

    expect(screen.getByLabelText(/choices to offer the person/i)).toBeInTheDocument()
    expect(screen.queryByLabelText(/^ai model/i)).not.toBeInTheDocument()
    expect(screen.queryByTestId("tools-rail")).not.toBeInTheDocument()
    expect(screen.queryByTestId("folder-scope-display")).not.toBeInTheDocument()
  })

  it("citation_policy still appears ONLY on the deliverable", () => {
    const nonEmit = ["programmatic", "llm_single", "llm_agent", "llm_batch_agents", "llm_human_input"]
    for (const pt of nonEmit) {
      const config: Record<string, unknown> = { phase_type: pt }
      if (pt === "programmatic") config.fn = "f"
      else config.prompt = "x"
      if (pt === "llm_agent" || pt === "llm_batch_agents") config.available_tools = []
      const { unmount } = renderPanel(config, railsOf({ toolOptions: ["search_documents"] }))
      expect(screen.queryByLabelText(/sourcing strictness/i)).not.toBeInTheDocument()
      expect(screen.queryByLabelText(/file check/i)).not.toBeInTheDocument()
      unmount()
    }

    renderPanel(
      { phase_type: "llm_emit", prompt: "render", emitter: "render_template", citation_policy: "strict" },
      railsOf(),
    )
    expect(screen.getByLabelText(/sourcing strictness/i)).toBeInTheDocument()
  })

  it("the rails do not disturb the panel's dismissal or its resting rail", () => {
    const onClose = vi.fn()
    render(
      <PhaseFormPanel
        phase={phaseOf(AGENT)}
        open
        onChange={noop}
        onPersist={noop}
        onClose={onClose}
        rails={railsOf({ toolOptions: ["search_documents"] })}
      />,
    )
    fireEvent.click(screen.getByTestId("phase-form-close"))
    expect(onClose).toHaveBeenCalledTimes(1)

    // The 44px collapsed rail is reached by the SAME early return, before any rail renders.
    const { container } = render(
      <PhaseFormPanel
        phase={null}
        open={false}
        onChange={noop}
        onPersist={noop}
        onClose={noop}
        rails={railsOf({ toolOptions: ["search_documents"], gates: [{ label: "g", locked: true }] })}
      />,
    )
    expect(within(container).getByTestId("phase-form-rail")).toBeInTheDocument()
    expect(container.querySelectorAll("[data-rail]")).toHaveLength(0)
  })
})

// ── 10. EXACTLY ONE FORM COMPONENT ────────────────────────────────────────────────────

/**
 * 140-A won because it does not create a second form surface to keep in step with the
 * Builder's. This is that claim, machine-checked: no module in this directory other than
 * `PhaseFormPanel.tsx` may export a component whose name reads as a phase-config form.
 */
const WORKFLOW_MODULES = import.meta.glob("./*.{ts,tsx}", {
  query: "?raw",
  eager: true,
  import: "default",
}) as Record<string, string>

const FORM_COMPONENT_EXPORT = /export\s+(?:default\s+)?(?:function|const)\s+(?:PhaseForm|PhaseConfigForm|StepForm)\w*/

describe("the canvas is a third way IN to ONE form (CANVAS-03 / R5)", () => {
  it("no module other than PhaseFormPanel.tsx exports a phase-config form component", () => {
    const offenders = Object.entries(WORKFLOW_MODULES)
      .filter(([path]) => !path.endsWith("/PhaseFormPanel.tsx") && !path.includes(".test."))
      .filter(([, source]) => FORM_COMPONENT_EXPORT.test(source))
      .map(([path]) => path)

    expect(offenders).toEqual([])
  })

  it("POSITIVE CONTROL — the scan really does see PhaseFormPanel.tsx, and the glob is not empty", () => {
    expect(Object.keys(WORKFLOW_MODULES).length).toBeGreaterThan(5)
    expect(FORM_COMPONENT_EXPORT.test(WORKFLOW_MODULES["./PhaseFormPanel.tsx"])).toBe(true)
  })
})
