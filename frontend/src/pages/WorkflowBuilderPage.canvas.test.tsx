/**
 * Phase 183-07 Task 2 (CANVAS-01, D-183-02 … D-183-05, T-183-03 / T-183-12) —
 * the Builder's Canvas door.
 *
 * THE LOAD-BEARING HALF IS THE FLAG-OFF HALF. D-181-01 defines flag-off byte-identity
 * OBSERVABLY: with `visual_workflow_canvas` off the Builder's graph column must be the
 * column that shipped — for EVERYONE including operators. That is asserted here in
 * FIVE render variants (absent key / explicit false / operator-like map / no provider
 * at all / still loading), and each one checks three things: the toggle strip is
 * absent, no `.react-flow` root exists anywhere in the container, and the grid's FIRST
 * CHILD is the shipped spine `<section>` itself — no wrapper element, so nothing
 * reserves space for the strip that is not there.
 *
 * The three parts of the gate map 1:1 onto three of those variants: `no provider`
 * pins the null-context-is-fail-closed rule (plan 183-03's one net-new code path),
 * `absent key` pins the strict `=== true` comparison (the `lib/nav-items.ts` VANISH
 * contract — a truthy check would let `undefined` through only if the map lied, so the
 * real mutation proof is the explicit-false and operator-like rows), and `loading`
 * pins the no-flash-then-shift rule.
 *
 * THE CLICK DRIVER, inherited from `WorkflowCanvas.test.tsx:110-121`: node clicks use
 * `fireEvent.click`, never `user-event`. A `user-event` click inside the canvas plane
 * also dispatches a real `mousedown`, which reaches d3-zoom's pan handler; d3-drag
 * then dereferences `event.view.document` and jsdom's synthetic MouseEvent carries a
 * null `view`, so every assertion passes and vitest still exits 1. The toggle buttons
 * sit OUTSIDE the plane and are driven with `fireEvent.click` too, for one driver.
 *
 * WAITFOR IS MANDATORY ON THE CANVAS BRANCH — the component is `React.lazy`, so the
 * chunk resolves on a microtask after the click, and the jsdom `ResizeObserver` mock
 * fires its callback on a `setTimeout(…, 0)`.
 *
 * Phase 183-09 gap closure (GAP-1) added the dismissal block below. The scope fact
 * that shapes it: the step detail panel had NO discoverable close, and that is NOT a
 * Phase 183 regression — it was reproduced live in the `[≣ Spine]` view with the
 * Canvas never opened. `handleSelectNode` + `PhaseFormPanel` are the shipped Spine
 * pair; 183 wired the canvas to the SAME page-level callback and inherited the defect.
 * The fix is therefore view-agnostic and flag-INDEPENDENT, so the block asserts every
 * dismissal path in BOTH views, and runs its Spine half with `visual_workflow_canvas`
 * OFF — on the shipped surface where the defect actually lives. Asserting in only one
 * view is how this stayed invisible through eight plans of gates.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react"

// FILE-LOCAL, never setupTests.ts: the helper mutates HTMLElement.prototype and a
// global install would perturb all ~205 suites, destroying this phase's failing-name
// differential. Call it before the first render.
import { mockReactFlow } from "@/test-utils/mockReactFlow"

// The same api-client seams the shipped `WorkflowBuilderPage.test.tsx` mocks. The two
// draft-mutation mocks are ALSO the T-183-12 tripwire: looking must never write.
const { mockGenerate, mockCreate, mockUpdate, mockListFolders, mockListSkills } = vi.hoisted(() => ({
  mockGenerate: vi.fn(),
  mockCreate: vi.fn(),
  mockUpdate: vi.fn(),
  mockListFolders: vi.fn(),
  mockListSkills: vi.fn(),
}))
// Phase 184-11: the page now composes two MORE api seams — the live validation loop
// (`useLiveValidation`) and the CANVAS-04 palette (`useGroundingBundle`). A whole-module
// factory mock must enumerate every symbol the render path reaches or the hook calls
// `undefined`, so these two are ADDED to the same factory. No assertion below moves.
const { mockValidate, mockBundle } = vi.hoisted(() => ({
  mockValidate: vi.fn(),
  mockBundle: vi.fn(),
}))
vi.mock("@/lib/api", () => ({
  generateWorkflow: mockGenerate,
  createWorkflowDraft: mockCreate,
  updateWorkflowDraft: mockUpdate,
  listFolders: mockListFolders,
  listSkills: mockListSkills,
  validateWorkflow: mockValidate,
  getGroundingBundle: mockBundle,
  publishWorkflow: mockPublish,
}))
// The R12 publish-handoff block below mounts the real gauntlet, whose own module reaches
// one more api symbol. Declared as its own hoisted block so the diff stays additive.
const { mockPublish } = vi.hoisted(() => ({ mockPublish: vi.fn() }))

// The component SOURCE via Vite's ?raw loader — the idiomatic way to make a scope
// fence machine-checkable (the `PhaseSpineGraph.test.tsx:20-22` precedent).
import builderSource from "./WorkflowBuilderPage?raw"
import { WorkflowBuilderPage, type BuilderDefinition } from "./WorkflowBuilderPage"
import { EffectiveFeaturesProvider } from "@/providers/EffectiveFeaturesProvider"
import type { EffectiveFeatures } from "@/lib/api"
import { researchSummarize } from "@/components/workflows/__fixtures__/canvasFixtures"
// Phase 184-11 Task 2: the R12 publish-handoff block mounts the real gauntlet.
import { PublishGauntlet } from "@/components/workflows/PublishGauntlet"
// Phase 184-12, on their own lines so this file's diff stays 0-deletion: a five-step
// shape (so "the middle" is unambiguous), the branching shape whose `skip_to_phase`
// makes R10a's orphaning case reachable, and the plain-language title accessor, read
// rather than hardcoded so an assertion cannot drift from the card's own vocabulary.
import { branching, evalCoverage } from "@/components/workflows/__fixtures__/canvasFixtures"
import { nodeTitle } from "@/components/workflows/phaseVocabulary"

mockReactFlow()

/** A REAL fixture as the working definition — the same shape the projection suites
 *  and the canvas DOM suite use, so this file cannot test a different workflow. */
const definition: BuilderDefinition = {
  slug: "vendor-brief",
  version: 1,
  status: "draft",
  business_requirement: "summarize vendor risk",
  phases: researchSummarize,
}

beforeEach(() => {
  vi.clearAllMocks()
  mockListFolders.mockResolvedValue([])
  mockListSkills.mockResolvedValue([])
  // Phase 184-11 defaults: a complete, empty palette and a clean verdict. Neither is
  // REACHED by any assertion above — the loop stays silent until the first edit
  // (D-184-15) — but a factory-mocked module must still hand back a thenable.
  mockBundle.mockResolvedValue({ tools: [], folders: [], skills: [], degraded: [] })
  mockValidate.mockResolvedValue({ ok: true, verdicts: [] })
  // The ⌥ reveal persists; a leaked value would change the node titles under us.
  window.localStorage.clear()
})

afterEach(() => {
  cleanup()
})

/**
 * The lazy chunk resolves on a dynamic `import()`, and under a FULL-suite parallel run
 * (205 files) that transform can take well past Testing Library's 1 s default. The
 * suite is green in isolation either way; without this the two canvas-mount waits are
 * a load-dependent flake that would show up as a NEW failing name in the phase's own
 * differential. Widening the WAIT changes no assertion — the same DOM must appear.
 */
const LAZY = { timeout: 10_000 } as const

/** Boot the Builder straight into the drafted editing view — `initial` skips the
 *  describe/composing screen entirely, so no generate flow is needed. The sized
 *  wrapper is what stops the canvas plane measuring to nothing. */
function renderBuilder(features?: { features: EffectiveFeatures; loading: boolean }) {
  const page = (
    <div style={{ width: 1200, height: 800 }}>
      <WorkflowBuilderPage initial={{ definition, draftId: "draft-1" }} />
    </div>
  )
  return render(
    features ? (
      <EffectiveFeaturesProvider value={{ ...features, refetch: vi.fn() }}>
        {page}
      </EffectiveFeaturesProvider>
    ) : (
      page
    ),
  )
}

/** The complete flag-off absence set: no strip, no canvas root, the shipped spine
 *  still rendered, and — the "no reserved space" half — the grid's first child IS the
 *  spine section, i.e. no wrapper element was introduced. */
async function expectFlagOffColumn(container: HTMLElement) {
  await waitFor(() => expect(screen.getByTestId("builder-grid")).toBeInTheDocument())
  expect(screen.queryByTestId("builder-view-toggle")).toBeNull()
  expect(screen.queryByTestId("builder-view-spine")).toBeNull()
  expect(screen.queryByTestId("builder-view-canvas")).toBeNull()
  expect(container.querySelector(".react-flow")).toBeNull()
  // The shipped spine is still what renders.
  expect(screen.getByTestId("spine-node-research")).toBeInTheDocument()
  expect(screen.getByTestId("spine-node-summarize")).toBeInTheDocument()
  // NOTHING wraps it — the graph column is the spine element itself, exactly as today.
  const firstChild = screen.getByTestId("builder-grid").firstElementChild
  expect(firstChild?.getAttribute("aria-label")).toBe("Workflow phase spine (read-only)")
}

// ── FLAG OFF, five ways (D-183-03 / D-181-01 / T-183-03) ─────────────────────────

describe("WorkflowBuilderPage canvas door — flag OFF is byte-identical (D-183-03)", () => {
  it("an ABSENT canvas key renders no toggle and no canvas root", async () => {
    const { container } = renderBuilder({ features: {}, loading: false })
    await expectFlagOffColumn(container)
  })

  it("an EXPLICIT false renders no toggle and no canvas root", async () => {
    const { container } = renderBuilder({
      features: { visual_workflow_canvas: false },
      loading: false,
    })
    await expectFlagOffColumn(container)
  })

  it("an OPERATOR-LIKE map (every other governed key true, canvas absent) behaves identically", async () => {
    // D-181-01: flag-off must be byte-identical for EVERYONE including operators.
    const { container } = renderBuilder({
      features: {
        skill_studio: true,
        model_management: true,
        workflow_authoring: true,
        governance_health: true,
      },
      loading: false,
    })
    await expectFlagOffColumn(container)
  })

  it("NO PROVIDER at all is fail-closed — a null context reads exactly like `{}`", async () => {
    // The rule plan 183-03 specified and this is the consumer that implements it. It
    // is also what keeps the shipped WorkflowBuilderPage.test.tsx suite honest: that
    // suite renders the page with no provider and must be unaffected by this plan.
    const { container } = renderBuilder()
    await expectFlagOffColumn(container)
  })

  it("STILL LOADING with the flag true renders no strip — it cannot flash in and shift the layout", async () => {
    const { container } = renderBuilder({
      features: { visual_workflow_canvas: true },
      loading: true,
    })
    await expectFlagOffColumn(container)
  })
})

// ── FLAG ON (D-183-01 / D-183-02) ────────────────────────────────────────────────

describe("WorkflowBuilderPage canvas door — flag ON (D-183-01)", () => {
  const on = { features: { visual_workflow_canvas: true }, loading: false }

  it("renders the toggle strip with EXACTLY two tabs", async () => {
    renderBuilder(on)
    const strip = await screen.findByTestId("builder-view-toggle")
    expect(strip).toHaveAttribute("role", "tablist")
    expect(within(strip).getAllByRole("tab")).toHaveLength(2)
  })

  it("Spine is the DEFAULT view and the spine is what renders (D-183-02)", async () => {
    const { container } = renderBuilder(on)
    await screen.findByTestId("builder-view-toggle")
    expect(screen.getByTestId("builder-view-spine")).toHaveAttribute("aria-selected", "true")
    expect(screen.getByTestId("builder-view-canvas")).toHaveAttribute("aria-selected", "false")
    expect(screen.getByTestId("spine-node-research")).toBeInTheDocument()
    // Cold start on Spine means the lazy canvas chunk is never even requested.
    expect(container.querySelector(".react-flow")).toBeNull()
  })

  it("clicking Canvas flips aria-selected and mounts the canvas; clicking Spine returns", async () => {
    const { container } = renderBuilder(on)
    await screen.findByTestId("builder-view-toggle")

    fireEvent.click(screen.getByTestId("builder-view-canvas"))
    // waitFor — the component is lazily imported.
    await waitFor(() => expect(container.querySelector(".react-flow")).not.toBeNull(), LAZY)
    expect(screen.getByTestId("builder-view-canvas")).toHaveAttribute("aria-selected", "true")
    expect(screen.getByTestId("builder-view-spine")).toHaveAttribute("aria-selected", "false")
    expect(screen.queryByTestId("spine-node-research")).toBeNull()

    fireEvent.click(screen.getByTestId("builder-view-spine"))
    await waitFor(() => expect(screen.getByTestId("spine-node-research")).toBeInTheDocument(), LAZY)
    expect(container.querySelector(".react-flow")).toBeNull()
    expect(screen.getByTestId("builder-view-spine")).toHaveAttribute("aria-selected", "true")
  })
})

// ── SELECTION WIRING (D-183-05) ──────────────────────────────────────────────────

describe("WorkflowBuilderPage canvas door — one selection contract (D-183-05)", () => {
  const on = { features: { visual_workflow_canvas: true }, loading: false }

  /** Switch to the canvas branch and wait for a real node to exist. */
  async function openCanvas() {
    await screen.findByTestId("builder-view-toggle")
    fireEvent.click(screen.getByTestId("builder-view-canvas"))
    await waitFor(() => expect(screen.getByTestId("canvas-node-research")).toBeInTheDocument(), LAZY)
  }

  it("clicking a canvas node opens the shipped 400px form panel on THAT phase", async () => {
    renderBuilder(on)
    await openCanvas()
    // At rest the panel is the collapsed rail.
    expect(screen.getByTestId("phase-form-rail")).toBeInTheDocument()

    fireEvent.click(screen.getByTestId("canvas-node-research"))

    await waitFor(
      () => expect(screen.getByLabelText("Refine step: research")).toBeInTheDocument(),
      LAZY,
    )
    expect(screen.queryByTestId("phase-form-rail")).toBeNull()
  })

  it("clicking the SAME node again closes the panel (the page owns cur === slug ? null : slug)", async () => {
    renderBuilder(on)
    await openCanvas()

    fireEvent.click(screen.getByTestId("canvas-node-research"))
    await waitFor(
      () => expect(screen.getByLabelText("Refine step: research")).toBeInTheDocument(),
      LAZY,
    )

    fireEvent.click(screen.getByTestId("canvas-node-research"))
    await waitFor(() => expect(screen.getByTestId("phase-form-rail")).toBeInTheDocument(), LAZY)
  })

  it("selecting on the canvas and switching back to the Spine keeps the SAME anchor", async () => {
    renderBuilder(on)
    await openCanvas()
    fireEvent.click(screen.getByTestId("canvas-node-summarize"))
    await waitFor(
      () => expect(screen.getByLabelText("Refine step: summarize")).toBeInTheDocument(),
      LAZY,
    )

    fireEvent.click(screen.getByTestId("builder-view-spine"))
    await waitFor(() => expect(screen.getByTestId("spine-node-summarize")).toBeInTheDocument(), LAZY)
    // One `selectedSlug` for both views — the panel never re-anchors on a view swap.
    expect(screen.getByLabelText("Refine step: summarize")).toBeInTheDocument()
  })
})

// ── DISMISSAL (GAP-1, BOTH VIEWS) ────────────────────────────────────────────────

/**
 * This block lives in the file named for the canvas but is deliberately about BOTH
 * views, because the defect is in the SHARED page-level selection contract: the panel's
 * open state has exactly one input (`selectedSlug !== null`) and its only exit was
 * re-activating the same node. A ✕ that only works on the canvas would leave the
 * shipped Spine surface — where the operator actually hit this — still broken.
 */
describe("WorkflowBuilderPage — the step panel can be dismissed (GAP-1, both views)", () => {
  const on = { features: { visual_workflow_canvas: true }, loading: false }
  const off = { features: {}, loading: false }

  /** Canvas view, panel OPEN on `research`. */
  async function openOnCanvas() {
    await screen.findByTestId("builder-view-toggle")
    fireEvent.click(screen.getByTestId("builder-view-canvas"))
    await waitFor(() => expect(screen.getByTestId("canvas-node-research")).toBeInTheDocument(), LAZY)
    fireEvent.click(screen.getByTestId("canvas-node-research"))
    await waitFor(
      () => expect(screen.getByLabelText("Refine step: research")).toBeInTheDocument(),
      LAZY,
    )
    expect(screen.queryByTestId("phase-form-rail")).toBeNull()
  }

  /** Spine view with the canvas flag OFF, panel OPEN on `research`. */
  async function openOnSpine(container: HTMLElement) {
    await waitFor(() => expect(screen.getByTestId("spine-node-research")).toBeInTheDocument())
    // The flag-off half must be provably canvas-free — D-181-01 is untouched here.
    expect(container.querySelector(".react-flow")).toBeNull()
    fireEvent.click(screen.getByTestId("spine-node-research"))
    await waitFor(() => expect(screen.getByLabelText("Refine step: research")).toBeInTheDocument())
    expect(screen.queryByTestId("phase-form-rail")).toBeNull()
  }

  /** The panel is back at its resting rail. The DEFAULT wait budget on purpose: by the
   *  time a dismissal is driven the tree is already mounted, so this is a synchronous
   *  state update — borrowing LAZY's 10 s here would outlive the 5 s test timeout and
   *  report a timeout instead of the DOM expectation that actually went unmet. */
  async function expectDismissed() {
    await waitFor(() => expect(screen.getByTestId("phase-form-rail")).toBeInTheDocument())
    expect(screen.queryByLabelText("Refine step: research")).toBeNull()
  }

  it("the header ✕ closes the panel — CANVAS view", async () => {
    renderBuilder(on)
    await openOnCanvas()

    fireEvent.click(screen.getByTestId("phase-form-close"))
    await expectDismissed()

    // T-183-12 — a dismissal must not mint a draft row or PATCH a version.
    expect(mockCreate).toHaveBeenCalledTimes(0)
    expect(mockUpdate).toHaveBeenCalledTimes(0)
    expect(mockGenerate).toHaveBeenCalledTimes(0)
  })

  it("the header ✕ closes the panel — SPINE view with the canvas flag OFF", async () => {
    // THE load-bearing test: it proves the fix lands on the pre-183 shipped surface
    // where the defect lives, with no canvas mounted anywhere.
    const { container } = renderBuilder(off)
    await openOnSpine(container)

    fireEvent.click(screen.getByTestId("phase-form-close"))
    await expectDismissed()

    expect(mockCreate).toHaveBeenCalledTimes(0)
    expect(mockUpdate).toHaveBeenCalledTimes(0)
    expect(mockGenerate).toHaveBeenCalledTimes(0)
  })

  it("Escape closes the panel — CANVAS view", async () => {
    renderBuilder(on)
    await openOnCanvas()

    fireEvent.keyDown(window, { key: "Escape" })
    await expectDismissed()
  })

  it("Escape closes the panel — SPINE view with the canvas flag OFF", async () => {
    const { container } = renderBuilder(off)
    await openOnSpine(container)

    fireEvent.keyDown(window, { key: "Escape" })
    await expectDismissed()
  })

  it("clicking the empty canvas pane clears the selection", async () => {
    // `fireEvent`, never `user-event` — a real mousedown inside the plane reaches
    // d3-zoom, whose d3-drag dereferences a null `event.view` under jsdom.
    const { container } = renderBuilder(on)
    await openOnCanvas()

    const pane = container.querySelector(".react-flow__pane")
    expect(pane).not.toBeNull()
    fireEvent.click(pane!)
    await expectDismissed()
  })
})

// ── NO WRITES (D-183-04 / G-6 / T-183-12) ────────────────────────────────────────

describe("WorkflowBuilderPage canvas door — looking writes nothing (D-183-04)", () => {
  it("mounting the Builder and switching to Canvas calls NEITHER draft mutation", async () => {
    renderBuilder({ features: { visual_workflow_canvas: true }, loading: false })
    await screen.findByTestId("builder-view-toggle")

    fireEvent.click(screen.getByTestId("builder-view-canvas"))
    await waitFor(() => expect(screen.getByTestId("canvas-node-research")).toBeInTheDocument(), LAZY)
    fireEvent.click(screen.getByTestId("canvas-node-research"))
    await waitFor(
      () => expect(screen.getByLabelText("Refine step: research")).toBeInTheDocument(),
      LAZY,
    )

    // Opening a view must not mint a workflow_definitions row or bump a version.
    expect(mockCreate).toHaveBeenCalledTimes(0)
    expect(mockUpdate).toHaveBeenCalledTimes(0)
    expect(mockGenerate).toHaveBeenCalledTimes(0)
  })
})

// ── SOURCE GUARDS ────────────────────────────────────────────────────────────────

describe("WorkflowBuilderPage canvas door — source guards", () => {
  it("persists no view preference (D-183-02 — session state only)", () => {
    expect(builderSource).not.toMatch(/localStorage/)
    expect(builderSource).not.toMatch(/sessionStorage/)
  })

  it("uses tablist semantics only — never mixed with a pressed state", () => {
    expect(builderSource).not.toMatch(/aria-pressed/)
  })

  it("never names the frozen React Flow v11 package", () => {
    // `@xyflow/react` v12 is the dependency; `reactflow` is the frozen v11 name.
    expect(builderSource).not.toMatch(/reactflow/)
  })

  it("gates on the OPTIONAL accessor with a STRICT true comparison", () => {
    expect(builderSource).toMatch(/useEffectiveFeaturesOptional\(\)/)
    expect(builderSource).not.toMatch(/useEffectiveFeaturesContext\(/)
    expect(builderSource).toMatch(/visual_workflow_canvas === true/)
  })

  it("code-splits the canvas at module scope", () => {
    expect(builderSource).toMatch(
      /const WorkflowCanvas = lazy\(\(\) => import\("@\/components\/workflows\/WorkflowCanvas"\)/,
    )
  })
})

// ══════════════════════════════════════════════════════════════════════════════════
// Phase 184-11 Task 1 — the composed session: R3, D-184-15 and D-14
//
// APPENDED, never interleaved. Everything above this line is the 183 canvas door and
// its 22 assertions, all of which pass unmodified; the only edits this plan made to the
// file above are two ADDED mock symbols and their two default resolutions, because a
// whole-module factory mock has to enumerate what the render path reaches.
// ══════════════════════════════════════════════════════════════════════════════════

const FLAG_ON = { features: { visual_workflow_canvas: true }, loading: false } as const
const FLAG_OFF = { features: {}, loading: false } as const

/**
 * The R3 walk, in the shape `canvasModel.purity.test.ts` shipped it.
 *
 * It is COPIED rather than imported, and that is deliberate: importing another test
 * module would register its ~79 `it(...)` blocks into this file as well, doubling the
 * per-file counts `scripts/vitest-count-gate.cjs` exists to pin. A copy plus a POSITIVE
 * CONTROL (below) is the honest way to reuse a walk across suites — the control is what
 * makes "zero forbidden keys" evidence instead of a typo.
 */
const FORBIDDEN_DEFINITION_KEYS = ["position", "x", "y", "layout"]
const forbiddenKeysIn = (value: unknown, found: string[] = []): string[] => {
  if (Array.isArray(value)) {
    for (const item of value) forbiddenKeysIn(item, found)
  } else if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) {
      if (FORBIDDEN_DEFINITION_KEYS.includes(k)) found.push(k)
      forbiddenKeysIn(v, found)
    }
  }
  return found
}

describe("WorkflowBuilderPage 184-11 — no positional key can reach a draft payload (R3)", () => {
  it("the serialized create AND patch bodies carry zero position / x / y / layout keys", async () => {
    mockCreate.mockResolvedValue({ id: "created-1", version: 1 })
    mockUpdate.mockResolvedValue({})
    renderBuilder(FLAG_ON)
    await screen.findByTestId("builder-view-toggle")

    // An edit, then two saves: the first PATCHes the pre-seeded row, and a second one
    // proves the body shape holds across repeats rather than only on the first write.
    fireEvent.click(screen.getByTestId("spine-node-research"))
    const field = await screen.findByLabelText(/instructions/i)
    fireEvent.change(field, { target: { value: "a nudged, reordered, still-flat draft" } })
    fireEvent.click(screen.getByTestId("builder-save-draft"))
    await waitFor(() => expect(mockUpdate).toHaveBeenCalledTimes(1))
    fireEvent.click(screen.getByTestId("builder-save-draft"))
    await waitFor(() => expect(mockUpdate).toHaveBeenCalledTimes(2))

    const bodies = [
      ...mockCreate.mock.calls.map((c) => c[0]),
      ...mockUpdate.mock.calls.map((c) => c[1]),
    ]
    expect(bodies.length).toBeGreaterThan(0)
    for (const body of bodies) expect(forbiddenKeysIn(body)).toEqual([])
  })

  it("POSITIVE CONTROL — the walk really does find a planted positional key", () => {
    const planted = { phases: [{ slug: "a", config: { phase_type: "llm_single" }, position: { x: 1, y: 2 } }] }
    expect(forbiddenKeysIn(planted).sort()).toEqual(["position", "x", "y"])
  })
})

describe("WorkflowBuilderPage 184-11 — nothing validates before the first edit (D-184-15)", () => {
  it("mounting a draft calls validateWorkflow ZERO times and renders no verdict mark", async () => {
    renderBuilder(FLAG_ON)
    await screen.findByTestId("builder-view-toggle")
    fireEvent.click(screen.getByTestId("builder-view-canvas"))
    await waitFor(() => expect(screen.getByTestId("canvas-node-research")).toBeInTheDocument(), LAZY)

    // Long enough to clear the loop's own 500 ms debounce — an assertion taken before it
    // would be green on a loop that simply had not fired YET.
    await new Promise((resolve) => setTimeout(resolve, 700))
    expect(mockValidate).toHaveBeenCalledTimes(0)
    expect(screen.queryAllByTestId("phase-node-verdict")).toHaveLength(0)
  })

  it("the FIRST edit starts the loop — one call, after the debounce", async () => {
    renderBuilder(FLAG_ON)
    await screen.findByTestId("builder-view-toggle")

    fireEvent.click(screen.getByTestId("spine-node-research"))
    const field = await screen.findByLabelText(/instructions/i)
    fireEvent.change(field, { target: { value: "search the vendor corpus" } })

    await waitFor(() => expect(mockValidate).toHaveBeenCalledTimes(1), { timeout: 3000 })
  })
})

describe("WorkflowBuilderPage 184-11 — with the flag OFF the panel receives NO rails key (D-14)", () => {
  /** Reach the panel's OUTGOING props by wrapping one export of the mocked module and
   *  rendering the real component — the 184-10 idiom, so every other assertion in this
   *  file still runs against a genuinely-rendered tree. */
  async function railsPropOf(features: { features: EffectiveFeatures; loading: boolean }) {
    vi.resetModules()
    const seen: Array<Record<string, unknown>> = []
    vi.doMock("@/components/workflows/PhaseFormPanel", async () => {
      const actual = await vi.importActual<typeof import("@/components/workflows/PhaseFormPanel")>(
        "@/components/workflows/PhaseFormPanel",
      )
      return {
        ...actual,
        PhaseFormPanel: (props: Record<string, unknown>) => {
          seen.push(props)
          return actual.PhaseFormPanel(props as never)
        },
      }
    })
    const { WorkflowBuilderPage: Page } = await import("./WorkflowBuilderPage")
    // The provider MUST come from the same post-reset module graph as the page. Importing
    // it from this file's top-level binding hands the page a DIFFERENT React context
    // object, `useEffectiveFeaturesOptional()` reads null, and both assertions below then
    // pass for the wrong reason — the flag-off one vacuously, the positive control not at
    // all. That is exactly how the control earned its place: it caught this on the first
    // run rather than letting a green guard ship.
    const { EffectiveFeaturesProvider: Provider } = await import(
      "@/providers/EffectiveFeaturesProvider"
    )
    render(
      <Provider value={{ ...features, refetch: vi.fn() }}>
        <div style={{ width: 1200, height: 800 }}>
          <Page initial={{ definition, draftId: "draft-1" }} />
        </div>
      </Provider>,
    )
    await waitFor(() => expect(seen.length).toBeGreaterThan(0))
    vi.doUnmock("@/components/workflows/PhaseFormPanel")
    return seen[seen.length - 1]
  }

  it("the rails prop is ABSENT — not present-and-undefined — on the flag-off path", async () => {
    const props = await railsPropOf(FLAG_OFF)
    // `in` distinguishes the two: a spread-conditional omits the key entirely, while
    // `rails={cond ? r : undefined}` would leave it present with an undefined value.
    expect("rails" in props).toBe(false)
    expect(Object.keys(props)).not.toContain("rails")
  })

  it("POSITIVE CONTROL — with the flag ON the very same read finds the key", async () => {
    const props = await railsPropOf(FLAG_ON)
    expect("rails" in props).toBe(true)
    expect(props.rails).toMatchObject({ order: { total: definition.phases.length } })
  })

  it("no editing affordance is anywhere in the flag-off DOM", async () => {
    const { container } = renderBuilder(FLAG_OFF)
    await waitFor(() => expect(screen.getByTestId("builder-grid")).toBeInTheDocument())
    expect(container.querySelector("[data-rail]")).toBeNull()
    expect(screen.queryByTestId("canvas-announcer")).toBeNull()
    expect(screen.queryByTestId("publish-blocked-reason")).toBeNull()
    expect(container.querySelector(".react-flow")).toBeNull()
  })
})

// ── Task 2 — R12: publish blocks in the header that ALREADY EXISTS ────────────────

describe("WorkflowBuilderPage 184-11 — a blocked publish NAMES its reason (R12)", () => {
  /** The real gauntlet, mounted through the shipped `renderPublish` seam exactly as
   *  `WorkflowsPage` mounts it — so this measures the composed surface, not a stub. */
  function renderWithPublish(
    features: { features: EffectiveFeatures; loading: boolean },
    def: BuilderDefinition = definition,
  ) {
    return render(
      <EffectiveFeaturesProvider value={{ ...features, refetch: vi.fn() }}>
        <div style={{ width: 1200, height: 800 }}>
          <WorkflowBuilderPage
            initial={{ definition: def, draftId: "draft-1" }}
            renderPublish={(d, id, blockedReason) => (
              <PublishGauntlet
                definitionId={id ?? "draft-1"}
                definition={d as never}
                blockedReason={blockedReason}
              />
            )}
          />
        </div>
      </EffectiveFeaturesProvider>,
    )
  }

  const emptyDraft: BuilderDefinition = { ...definition, phases: [] }

  /** Make one edit so the loop runs, and wait for the server's answer to land. */
  async function editAndSettle() {
    fireEvent.click(await screen.findByTestId("spine-node-research"))
    const field = await screen.findByLabelText(/instructions/i)
    fireEvent.change(field, { target: { value: "search the vendor corpus" } })
    await waitFor(() => expect(mockValidate).toHaveBeenCalled(), { timeout: 3000 })
  }

  it("an EMPTY draft reads as an invitation, not a verdict (D-184-15)", async () => {
    renderWithPublish(FLAG_ON, emptyDraft)
    const trigger = await screen.findByTestId("publish-trigger")
    expect(trigger).toBeDisabled()
    const reason = screen.getByTestId("publish-blocked-reason")
    expect(reason.textContent).toBe("Add a step to get started")
    // R12: greying alone is not enough — the reason must be REACHABLE from the control.
    expect(trigger.getAttribute("aria-describedby")).toBe(reason.getAttribute("id"))
    // …and no server was asked about a workflow with no steps.
    expect(mockValidate).toHaveBeenCalledTimes(0)
  })

  it("with the flag OFF the very same empty draft keeps today's enabled trigger (D-14)", async () => {
    renderWithPublish(FLAG_OFF, emptyDraft)
    const trigger = await screen.findByTestId("publish-trigger")
    expect(trigger).not.toBeDisabled()
    expect(trigger.getAttribute("aria-describedby")).toBeNull()
    expect(screen.queryByTestId("publish-blocked-reason")).toBeNull()
  })

  it("the reason is the FIRST verdict's message VERBATIM, with error ordered before incomplete", async () => {
    mockValidate.mockResolvedValue({
      ok: false,
      verdicts: [
        { code: "missing_prompt", phase: "research", message: "This step still needs instructions.", severity: "incomplete" },
        { code: "no_terminal", phase: null, message: "Nothing in this workflow produces a deliverable.", severity: "error" },
      ],
    })
    renderWithPublish(FLAG_ON)
    await editAndSettle()

    const reason = await screen.findByTestId("publish-blocked-reason")
    // The ERROR wins even though the server listed the incomplete one first, and the
    // message is byte-identical to what the server sent — never rewritten or mapped.
    expect(reason.textContent).toBe("Nothing in this workflow produces a deliverable.")
    expect(screen.getByTestId("publish-trigger")).toBeDisabled()
  })

  it("a DEGRADED check keeps publish blocked and says which kind of failure it was (D-184-14)", async () => {
    mockValidate.mockRejectedValue(
      Object.assign(new Error("422"), { name: "WorkflowValidateUnreadableError" }),
    )
    renderWithPublish(FLAG_ON)
    await editAndSettle()

    const reason = await screen.findByTestId("publish-blocked-reason")
    expect(reason.textContent).toBe(
      "We couldn't check this — the workflow's shape isn't something we can read yet.",
    )
    // A check that did NOT RUN must never unblock a publish.
    expect(screen.getByTestId("publish-trigger")).toBeDisabled()
  })

  it("an ok:true answer leaves publish exactly as it is today", async () => {
    mockValidate.mockResolvedValue({ ok: true, verdicts: [] })
    renderWithPublish(FLAG_ON)
    await editAndSettle()

    await waitFor(() => expect(screen.getByTestId("publish-trigger")).not.toBeDisabled())
    expect(screen.queryByTestId("publish-blocked-reason")).toBeNull()
  })

  it("publish is in the EXISTING header — the same one that carries the save state, no new band", async () => {
    renderWithPublish(FLAG_ON, emptyDraft)
    const trigger = await screen.findByTestId("publish-trigger")
    const header = trigger.closest("header")
    expect(header).not.toBeNull()
    // 141-B's operator correction: one header, both controls. A net-new band would put
    // these two in different ancestors.
    expect(header!.contains(screen.getByTestId("builder-save-state"))).toBe(true)
    expect(screen.getAllByRole("banner")).toHaveLength(1)
  })
})

describe("WorkflowBuilderPage 184-11 — the page source fences hold with the loop composed", () => {
  it("still names no browser storage, no aria-pressed, no v11 package and no authored grounding field", () => {
    // The nudge's storage lives in `canvasNudge.ts` and the page only calls its two
    // functions; Phase 185's authored field is not invented here.
    expect(builderSource).not.toMatch(/localStorage/)
    expect(builderSource).not.toMatch(/sessionStorage/)
    expect(builderSource).not.toMatch(/aria-pressed/)
    expect(builderSource).not.toMatch(/reactflow/)
    expect(builderSource).not.toMatch(/grounding_mode/)
  })

  it("passes rails SPREAD-CONDITIONALLY so the flag-off prop is absent by construction", () => {
    expect(builderSource).toMatch(/canvasEnabled \? \{ rails \}/)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// Plan 184-12 — R1's INSERT AND DELETE, R10a's REFUSAL, AND THE INLINE UNDO.
//
// Appended; nothing above this line was edited.
//
// WHY THESE LIVE HERE RATHER THAN IN THE CANVAS SUITE. The plan assigns the index-by-
// index insert proof, the moved count, the orphaning refusal and the Undo restore to
// `WorkflowCanvas.editing.test.tsx`. None of them is a behaviour of that component:
// `WorkflowCanvas` holds no store, evaluates no predicate and computes no message — it
// reports a gesture and renders what the page hands back. Asserting them there would
// mean re-implementing this page's two handlers inside a test file and then measuring
// the copy, which is the "a gate that lies" failure this phase has now named in five
// plans. They are asserted here instead, against the REAL store, the REAL
// `definitionOps` predicates and the REAL canvas, driven through the actual DOM.
//
// HOW THE DEFINITION IS READ. Through the shipped `renderPublish` seam, which the page
// calls on every render with its live `BuilderDefinition`. That is a genuine observable
// of the page's state — no private field is reached into, and the same seam the
// Workflows shell uses in production is the one the assertions read.
// ═══════════════════════════════════════════════════════════════════════════════

/** Five phases, so "the middle" is unambiguous and four steps can move. */
const fiveStep: BuilderDefinition = { ...definition, phases: evalCoverage }

/** `assess` sends its failures to `escalate` — so removing `escalate` is R10a's
 *  orphaning case, and removing `draft` is the control that proceeds. */
const withFallback: BuilderDefinition = { ...definition, phases: branching }

describe("WorkflowBuilderPage 184-12 — growing the flow, and the two refusals", () => {
  const FLAG_ON_184_12 = { features: { visual_workflow_canvas: true }, loading: false }

  /** Every definition the page has rendered, newest last. */
  let seen: BuilderDefinition[]

  function renderCanvasBuilder(def: BuilderDefinition) {
    seen = []
    return render(
      <EffectiveFeaturesProvider value={{ ...FLAG_ON_184_12, refetch: vi.fn() }}>
        <div style={{ width: 1200, height: 800 }}>
          <WorkflowBuilderPage
            initial={{ definition: def, draftId: "draft-1" }}
            renderPublish={(d) => {
              seen.push(d as BuilderDefinition)
              return null
            }}
          />
        </div>
      </EffectiveFeaturesProvider>,
    )
  }

  /** The page's CURRENT working definition. */
  const latest = () => seen[seen.length - 1]
  /** `phase_index` in render order — the array R1 is a statement about. */
  const indices = () => latest().phases.map((p) => p.phase_index)
  const slugs = () => latest().phases.map((p) => p.slug)

  async function openCanvasOn(def: BuilderDefinition) {
    renderCanvasBuilder(def)
    await screen.findByTestId("builder-view-toggle")
    fireEvent.click(screen.getByTestId("builder-view-canvas"))
    await waitFor(
      () => expect(screen.getByTestId(`canvas-node-${def.phases[0].slug}`)).toBeInTheDocument(),
      LAZY,
    )
  }

  // ── R1 — the insert renumbers, and every downstream index moves by exactly one ──

  it("R1 — inserting in the middle leaves phase_index exactly [0..n-1]", async () => {
    await openCanvasOn(fiveStep)
    expect(indices()).toEqual([0, 1, 2, 3, 4])

    fireEvent.click(screen.getByTestId("canvas-insert-2"))
    fireEvent.click(screen.getByTestId("step-type-choice-llm_single"))

    await waitFor(() => expect(latest().phases).toHaveLength(6))
    expect(indices()).toEqual([0, 1, 2, 3, 4, 5])
  })

  it("R1 — every DOWNSTREAM step incremented by exactly 1, asserted index by index", async () => {
    await openCanvasOn(fiveStep)
    const before = new Map(latest().phases.map((p) => [p.slug, p.phase_index]))

    fireEvent.click(screen.getByTestId("canvas-insert-2"))
    fireEvent.click(screen.getByTestId("step-type-choice-llm_single"))
    await waitFor(() => expect(latest().phases).toHaveLength(6))

    for (const phase of latest().phases) {
      const was = before.get(phase.slug)
      if (was === undefined) {
        // The new step took the slot that was asked for, and only that slot.
        expect(phase.phase_index).toBe(2)
        continue
      }
      // Aggregate arithmetic would hide an off-by-one that cancels out; each step is
      // named and checked on its own.
      expect(phase.phase_index).toBe(was < 2 ? was : was + 1)
    }
  })

  it("D-184-11 — the new step is SELECTED and the form panel opens on it", async () => {
    await openCanvasOn(fiveStep)

    fireEvent.click(screen.getByTestId("canvas-insert-2"))
    fireEvent.click(screen.getByTestId("step-type-choice-llm_single"))

    // `slugForType` derives `write` for `llm_single` on this shape, and the panel is
    // anchored on it — the type is chosen at add time precisely because the panel
    // conditions on `phase.config.phase_type` and offers no control that writes it.
    await waitFor(() => expect(screen.getByLabelText("Refine step: write")).toBeInTheDocument(), LAZY)
    expect(slugs()).toContain("write")
  })

  it("the surface says how many steps moved, in the delete message's vocabulary", async () => {
    await openCanvasOn(fiveStep)

    fireEvent.click(screen.getByTestId("canvas-insert-2"))
    fireEvent.click(screen.getByTestId("step-type-choice-llm_single"))

    const message = await screen.findByTestId("canvas-notice-action")
    // split(0) and fanout(1) stay put; deep_dive, confirm and summarize each move one.
    expect(message.textContent).toContain("3 steps renumbered")
  })

  // ── R1 — the delete re-stitches, and the message counts what actually moved ─────

  it("R1 — deleting a middle step leaves [0..n-1] with no hole and no duplicate", async () => {
    await openCanvasOn(fiveStep)

    fireEvent.click(screen.getByTestId("canvas-remove-deep_dive"))

    await waitFor(() => expect(latest().phases).toHaveLength(4))
    expect(indices()).toEqual([0, 1, 2, 3])
    expect(new Set(indices()).size).toBe(4)
    expect(slugs()).not.toContain("deep_dive")
  })

  it("the delete message names the step and the CORRECT moved count", async () => {
    await openCanvasOn(fiveStep)

    fireEvent.click(screen.getByTestId("canvas-remove-deep_dive"))

    const message = await screen.findByTestId("canvas-notice-action")
    // The title is the plain-language one, never the slug — the slug lives behind the
    // ⌥ Technical-names reveal. Read through `nodeTitle` so the assertion cannot drift
    // from the vocabulary the card itself renders.
    expect(message.textContent).toContain(`Removed ${nodeTitle(evalCoverage[2])}`)
    // confirm 3→2 and summarize 4→3. Counted from the before/after comparison, not
    // assumed from "everything downstream".
    expect(message.textContent).toContain("2 steps renumbered")
  })

  it("deleting the LAST step moves nothing, and says so rather than reporting a zero", async () => {
    await openCanvasOn(fiveStep)

    fireEvent.click(screen.getByTestId("canvas-remove-summarize"))

    const message = await screen.findByTestId("canvas-notice-action")
    expect(message.textContent).toContain("nothing else moved")
    expect(indices()).toEqual([0, 1, 2, 3])
  })

  it("NO confirm dialog is rendered at any point of a successful delete (D-184-12)", async () => {
    await openCanvasOn(fiveStep)

    expect(screen.queryByRole("dialog")).toBeNull()
    fireEvent.click(screen.getByTestId("canvas-remove-deep_dive"))
    expect(screen.queryByRole("dialog")).toBeNull()
    expect(screen.queryByRole("alertdialog")).toBeNull()
    await waitFor(() => expect(latest().phases).toHaveLength(4))
    expect(screen.queryByRole("dialog")).toBeNull()
  })

  it("selection moves to the FOLLOWING step after a delete", async () => {
    await openCanvasOn(fiveStep)

    fireEvent.click(screen.getByTestId("canvas-remove-deep_dive"))

    await waitFor(() => expect(screen.getByLabelText("Refine step: confirm")).toBeInTheDocument(), LAZY)
  })

  it("…and to the PRECEDING one when the deleted step was last", async () => {
    await openCanvasOn(fiveStep)

    fireEvent.click(screen.getByTestId("canvas-remove-summarize"))

    await waitFor(() => expect(screen.getByLabelText("Refine step: confirm")).toBeInTheDocument(), LAZY)
  })

  // ── D-184-12 — the inline Undo, and it writes nothing ──────────────────────────

  it("Undo restores the pre-delete phases EXACTLY", async () => {
    await openCanvasOn(fiveStep)
    const beforeDelete = structuredClone(latest().phases)

    fireEvent.click(screen.getByTestId("canvas-remove-deep_dive"))
    await waitFor(() => expect(latest().phases).toHaveLength(4))

    fireEvent.click(screen.getByTestId("canvas-notice-undo"))

    await waitFor(() => expect(latest().phases).toHaveLength(5))
    expect(latest().phases).toStrictEqual(beforeDelete)
  })

  it("Undo dismisses the message it was attached to", async () => {
    await openCanvasOn(fiveStep)

    fireEvent.click(screen.getByTestId("canvas-remove-deep_dive"))
    fireEvent.click(await screen.findByTestId("canvas-notice-undo"))

    await waitFor(() => expect(screen.queryByTestId("canvas-notice-action")).toBeNull())
  })

  it("D-184-03 — neither the delete nor the Undo writes to the server", async () => {
    await openCanvasOn(fiveStep)

    fireEvent.click(screen.getByTestId("canvas-remove-deep_dive"))
    fireEvent.click(await screen.findByTestId("canvas-notice-undo"))
    await waitFor(() => expect(latest().phases).toHaveLength(5))

    expect(mockCreate).toHaveBeenCalledTimes(0)
    expect(mockUpdate).toHaveBeenCalledTimes(0)
  })

  // ── R10a — the orphaning delete is REFUSED, and it is not a confirm ────────────

  it("R10a — an orphaning delete does NOT delete, and the phases are unchanged", async () => {
    await openCanvasOn(withFallback)
    const before = structuredClone(latest().phases)

    // `assess`'s validator sends failures to `escalate`; removing it would leave a
    // `skip_to_phase` naming a slug no phase provides — the backend's unsatisfiable_skip.
    fireEvent.click(screen.getByTestId("canvas-remove-escalate"))

    expect(await screen.findByTestId("canvas-notice-refusal")).toBeInTheDocument()
    expect(latest().phases).toStrictEqual(before)
    expect(screen.getByTestId("canvas-node-escalate")).toBeInTheDocument()
  })

  it("R10a — the refusal STATES its reason and offers no delete-anyway", async () => {
    await openCanvasOn(withFallback)

    fireEvent.click(screen.getByTestId("canvas-remove-escalate"))

    const refusal = await screen.findByTestId("canvas-notice-refusal")
    // The sentence is `canRemovePhase`'s own — the page authors none of it — and it
    // names the REFERRING step by its plain title so the author knows what to fix.
    expect(refusal.textContent).toContain("Remove that fallback first.")
    expect(refusal.textContent).toContain(nodeTitle(branching[1]))
    // A refusal is a different act from a confirm: nothing here proceeds.
    expect(refusal.querySelectorAll("button")).toHaveLength(0)
    expect(screen.queryByTestId("canvas-notice-undo")).toBeNull()
    expect(screen.queryByRole("dialog")).toBeNull()
    expect(screen.queryByRole("alertdialog")).toBeNull()
  })

  it("R10 — the refusal consults the server ZERO times", async () => {
    await openCanvasOn(withFallback)
    const validateCallsBefore = mockValidate.mock.calls.length

    fireEvent.click(screen.getByTestId("canvas-remove-escalate"))
    await screen.findByTestId("canvas-notice-refusal")
    // Well past the live loop's debounce, so "zero" is not "not yet".
    await new Promise((resolve) => setTimeout(resolve, 700))

    expect(mockValidate.mock.calls.length).toBe(validateCallsBefore)
    expect(mockValidate).toHaveBeenCalledTimes(0)
    expect(mockUpdate).toHaveBeenCalledTimes(0)
  })

  it("the CONTRAST — a non-orphaning delete on the very same definition proceeds", async () => {
    // Asserted in the same block on purpose: a refusal test that never shows the
    // allowed case is compatible with a surface that refuses everything.
    await openCanvasOn(withFallback)

    fireEvent.click(screen.getByTestId("canvas-remove-draft"))

    await waitFor(() => expect(latest().phases).toHaveLength(3))
    expect(slugs()).not.toContain("draft")
    expect(screen.getByTestId("canvas-notice-action")).toBeInTheDocument()
    expect(screen.queryByTestId("canvas-notice-refusal")).toBeNull()
  })
})
