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
import { createElement } from "react"
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
  // Phase 186-07: `useDraftPersistence` reaches one more symbol — the drafts read its
  // Reload exit reuses. Enumerated here rather than left undefined, because a whole-module
  // factory mock that omits a symbol the composed tree can reach fails far from its cause
  // (the shipped mock-completeness rule this file's own docblock states).
  listDraftWorkflows: mockListDrafts,
}))
const { mockListDrafts } = vi.hoisted(() => ({ mockListDrafts: vi.fn() }))
// The R12 publish-handoff block below mounts the real gauntlet, whose own module reaches
// one more api symbol. Declared as its own hoisted block so the diff stays additive.
const { mockPublish } = vi.hoisted(() => ({ mockPublish: vi.fn() }))

/**
 * Phase 187-15 Task 1 — THE SPINE PROP RECORDER.
 *
 * D-14's spread-conditional promise ("with the flag off the prop must be genuinely
 * ABSENT, not present-and-undefined") is not observable from the DOM: an undefined prop
 * and an absent one render the same bytes, which is exactly why a source guard alone
 * would be the weaker instrument. So the spine is wrapped rather than replaced — the
 * wrapper RECORDS the props object it was handed and then renders the REAL component
 * through `createElement`, so every shipped spine assertion in this file keeps passing
 * against the real element while `'nameContext' in props` becomes directly measurable.
 */
const { spineProps } = vi.hoisted(() => ({ spineProps: [] as Array<Record<string, unknown>> }))
vi.mock("@/components/workflows/PhaseSpineGraph", async () => {
  const actual = await vi.importActual<Record<string, unknown>>(
    "@/components/workflows/PhaseSpineGraph",
  )
  const Real = actual.PhaseSpineGraph as React.ComponentType<Record<string, unknown>>
  return {
    ...actual,
    PhaseSpineGraph: (props: Record<string, unknown>) => {
      spineProps.push(props)
      return createElement(Real, props)
    },
  }
})

// The component SOURCE via Vite's ?raw loader — the idiomatic way to make a scope
// fence machine-checkable (the `PhaseSpineGraph.test.tsx:20-22` precedent).
import builderSource from "./WorkflowBuilderPage?raw"
// 193.1-05 (D-01) — the SECOND half of the 187-22 adjacency fence's subject. `setDrafted(def)`
// left this page for `useTemplateFirstDraft` under G-5, so a fence that reads ONE source can no
// longer see the property it guards; it is RE-SCOPED to the seam rather than deleted or weakened.
import templateFirstDraftSource from "@/components/workflows/useTemplateFirstDraft?raw"
// Phase 193 fast-fix (AUTH-01): the CTA is queried by its GOVERNED id, never by a literal —
// a hard-coded name here is what let the page's copy go stale without any suite reddening.
import { DESCRIBE_CTA } from "@/components/workflows/doorVocabulary"
import { WorkflowBuilderPage, type BuilderDefinition } from "./WorkflowBuilderPage"
// Plan 186-16 (WR-10), on its own line so this file's diff stays 0-deletion: the empty
// draft's sentence, IMPORTED rather than re-typed, so the precedence row below compares
// character-identity against the page's own constant instead of a second copy of it.
import { EMPTY_DRAFT_INVITATION, SAVING_PUBLISH_WAIT } from "./WorkflowBuilderPage"
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
// Phase 187-15, on their own line so this file's diff stays additive: the corpus's two
// bindable ids, READ rather than re-typed, so the fixtures below and the shipped
// `branching` fixture cannot disagree about which skill `assess` is bound to.
import {
  CORPUS_FOLDER_ID,
  CORPUS_SKILL_ID,
} from "@/components/workflows/__fixtures__/canvasFixtures"
import { nodeTitle, PHASE_TYPE_SENTENCES } from "@/components/workflows/phaseVocabulary"
// Phase 185-08: the ONE home of the locked-row sentence. IMPORTED, never re-typed, so
// the assertions below are character-identity rather than a second copy of the copy.
import { GOVERNANCE_GATE_ROW_LABEL } from "@/components/workflows/definitionOps"
// Phase 187-27 (GAP B), on its own line so this file's diff stays additive: the sentence
// a surface says when no check has run. Compared by IDENTITY below, never re-typed.
import { DEGRADED_SENTENCE } from "@/components/workflows/verdictModel"

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
  // Phase 186-07: the write seam reads the PATCH response's token, so a mock that resolves
  // `undefined` would land every autosave in the loop's refusal branch. These are DEFAULTS;
  // the rows that pin call counts still pin them.
  mockListDrafts.mockResolvedValue([])
  mockCreate.mockResolvedValue({ id: "created-1", version: 1, token: "tok-created" })
  mockUpdate.mockResolvedValue({ id: "draft-1", version: 1, token: "tok-patched" })
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

describe("WorkflowBuilderPage 184-11 — what starts the loop (D-184-15, narrowed by 187-27)", () => {
  /**
   * REWRITTEN IN PLACE by 187-27 (GAP B), not deleted — and named here because a rewrite
   * of a shipped guard has to be visible rather than discovered.
   *
   * As shipped this case asserted ZERO validate calls on a drafted definition WITH steps,
   * which is precisely the fail-open GAP B measured: the canvas then rendered *"the static
   * checks pass · checked by the server"* and left Publish ENABLED over a check nobody had
   * made. The case was asserting the DEFECT. D-184-15's own stated reason is about a draft
   * with NO steps — and that reason is preserved exactly, asserted still at ZERO, in the
   * 187-27 block at the end of this file.
   *
   * The rest of the case is untouched: a check that has been ISSUED still claims no
   * verdict, so no mark may render before an answer lands.
   */
  it("mounting a draft ISSUES the check (187-27) and still claims no verdict until it answers", async () => {
    renderBuilder(FLAG_ON)
    await screen.findByTestId("builder-view-toggle")
    fireEvent.click(screen.getByTestId("builder-view-canvas"))
    await waitFor(() => expect(screen.getByTestId("canvas-node-research")).toBeInTheDocument(), LAZY)

    // Long enough to clear the loop's own 500 ms debounce — an assertion taken before it
    // would be green on a loop that simply had not fired YET.
    await new Promise((resolve) => setTimeout(resolve, 700))
    expect(mockValidate.mock.calls.length).toBeGreaterThanOrEqual(1)
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
    // Phase 185-08 widened the payload: `onGovernanceChange` rides the SAME conditional.
    // The guard is therefore anchored on the CONDITIONAL with `rails` leading it, not on
    // the object being exactly one key wide — the property being defended is "every
    // canvas-only prop is absent with the flag off", not the key count.
    expect(builderSource).toMatch(/canvasEnabled \? \{ rails[,\s}]/)
    // …and the governance handler is INSIDE it, never a second always-on prop line.
    expect(builderSource).toMatch(/canvasEnabled \? \{ rails, onGovernanceChange \}/)
    expect(builderSource).not.toMatch(/^\s*onGovernanceChange=\{/m)
    // POSITIVE CONTROL — the escaped form really would be caught.
    expect("          onGovernanceChange={onGovernanceChange}").toMatch(
      /^\s*onGovernanceChange=\{/m,
    )
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
    // 187-27 rewrote the INSTRUMENT, not the property. The open now issues one check of
    // its own, so "the refusal asked nothing" can no longer be carried by an absolute
    // count over the whole mount — it is a DIFFERENTIAL across the gesture. The open's
    // own check is settled first, so the count cannot move for a reason that has nothing
    // to do with the gesture being measured.
    await waitFor(() => expect(mockValidate).toHaveBeenCalledTimes(1), { timeout: 3000 })
    const validateCallsBefore = mockValidate.mock.calls.length

    fireEvent.click(screen.getByTestId("canvas-remove-escalate"))
    await screen.findByTestId("canvas-notice-refusal")
    // Well past the live loop's debounce, so "zero" is not "not yet".
    await new Promise((resolve) => setTimeout(resolve, 700))

    expect(mockValidate.mock.calls.length).toBe(validateCallsBefore)
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

// ═══════════════════════════════════════════════════════════════════════════════
// Plan 184-13 — D-184-04's FOUR KEY BINDINGS, behind ONE gated listener.
//
// Appended; nothing above this line was edited.
//
// WHY THESE LIVE HERE. The listener is a behaviour of THIS PAGE: it is mounted by this
// page's effect, gated on this page's flag + view state, and it moves this page's store.
// `CanvasToolbar` owns the buttons and its own suite owns their proof; nothing about a
// window listener is observable from inside that component. This is the same
// where-the-behaviour-lives split 184-12 recorded as its Deviation 3.
//
// HOW "UNDONE" IS OBSERVED. Through the same `renderPublish` seam the 184-12 block uses
// — the page's live `BuilderDefinition`, a genuine observable, never a private field.
// ═══════════════════════════════════════════════════════════════════════════════

describe("WorkflowBuilderPage 184-13 — the undo/redo keys (D-184-04)", () => {
  const FLAG_ON_184_13 = { features: { visual_workflow_canvas: true }, loading: false }

  let seen: BuilderDefinition[]

  function renderKeyBuilder(features: { features: EffectiveFeatures; loading: boolean }) {
    seen = []
    return render(
      <EffectiveFeaturesProvider value={{ ...features, refetch: vi.fn() }}>
        <div style={{ width: 1200, height: 800 }}>
          <WorkflowBuilderPage
            initial={{ definition: { ...definition, phases: evalCoverage }, draftId: "draft-1" }}
            renderPublish={(d) => {
              seen.push(d as BuilderDefinition)
              return null
            }}
          />
        </div>
      </EffectiveFeaturesProvider>,
    )
  }

  const latestPhases = () => seen[seen.length - 1].phases

  /** Open the canvas and make ONE structural edit, so there is a history to step through.
   *  The edit is a delete, which is the shortest path to a changed `phases` array. */
  async function canvasWithOneEdit() {
    renderKeyBuilder(FLAG_ON_184_13)
    await screen.findByTestId("builder-view-toggle")
    fireEvent.click(screen.getByTestId("builder-view-canvas"))
    await waitFor(() => expect(screen.getByTestId("canvas-node-split")).toBeInTheDocument(), LAZY)
    expect(latestPhases()).toHaveLength(5)

    fireEvent.click(screen.getByTestId("canvas-remove-deep_dive"))
    await waitFor(() => expect(latestPhases()).toHaveLength(4))
  }

  it("Ctrl+Z steps the last structural edit back", async () => {
    await canvasWithOneEdit()

    fireEvent.keyDown(window, { key: "z", ctrlKey: true })

    await waitFor(() => expect(latestPhases()).toHaveLength(5))
    expect(latestPhases().map((p) => p.slug)).toContain("deep_dive")
  })

  it("Meta+Z works too — the binding is not Windows-only", async () => {
    await canvasWithOneEdit()

    fireEvent.keyDown(window, { key: "z", metaKey: true })

    await waitFor(() => expect(latestPhases()).toHaveLength(5))
  })

  it("Ctrl+Y and Shift+Meta+Z BOTH redo", async () => {
    await canvasWithOneEdit()

    fireEvent.keyDown(window, { key: "z", ctrlKey: true })
    await waitFor(() => expect(latestPhases()).toHaveLength(5))

    fireEvent.keyDown(window, { key: "y", ctrlKey: true })
    await waitFor(() => expect(latestPhases()).toHaveLength(4))

    // …and the other spelling of the same act, from the same state.
    fireEvent.keyDown(window, { key: "z", ctrlKey: true })
    await waitFor(() => expect(latestPhases()).toHaveLength(5))

    fireEvent.keyDown(window, { key: "Z", metaKey: true, shiftKey: true })
    await waitFor(() => expect(latestPhases()).toHaveLength(4))
  })

  it("it YIELDS to a text field — an undo press inside an input reverts nothing", async () => {
    await canvasWithOneEdit()
    const before = latestPhases().map((p) => p.slug)

    // Attached to the document so the event really bubbles to the window listener; the
    // TARGET is what the handler must read, and it must bail on it.
    const input = document.createElement("input")
    document.body.appendChild(input)
    fireEvent.keyDown(input, { key: "z", ctrlKey: true })

    const textarea = document.createElement("textarea")
    document.body.appendChild(textarea)
    fireEvent.keyDown(textarea, { key: "z", metaKey: true })

    const rich = document.createElement("div")
    Object.defineProperty(rich, "isContentEditable", { value: true })
    document.body.appendChild(rich)
    fireEvent.keyDown(rich, { key: "z", ctrlKey: true })

    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(latestPhases().map((p) => p.slug)).toEqual(before)

    input.remove()
    textarea.remove()
    rich.remove()

    // POSITIVE CONTROL — the very same press outside a field DOES undo, so the three
    // rows above measure the YIELD rather than a listener that never fires at all.
    fireEvent.keyDown(window, { key: "z", ctrlKey: true })
    await waitFor(() => expect(latestPhases()).toHaveLength(5))
  })

  it("an auto-REPEAT press is one step, not thirty", async () => {
    await canvasWithOneEdit()
    const before = latestPhases().map((p) => p.slug)

    fireEvent.keyDown(window, { key: "z", ctrlKey: true, repeat: true })

    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(latestPhases().map((p) => p.slug)).toEqual(before)
  })

  it("an UNMODIFIED z does nothing — the modifier is part of the binding", async () => {
    await canvasWithOneEdit()
    const before = latestPhases().map((p) => p.slug)

    fireEvent.keyDown(window, { key: "z" })

    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(latestPhases().map((p) => p.slug)).toEqual(before)
  })

  it("with the flag OFF no keydown listener is registered from this path, and the keys revert nothing", async () => {
    const addSpy = vi.spyOn(window, "addEventListener")
    renderKeyBuilder({ features: {}, loading: false })
    await screen.findByTestId("builder-grid")

    expect(addSpy.mock.calls.filter(([type]) => type === "keydown")).toHaveLength(0)

    const before = latestPhases().map((p) => p.slug)
    fireEvent.keyDown(window, { key: "z", ctrlKey: true })
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(latestPhases().map((p) => p.slug)).toEqual(before)

    addSpy.mockRestore()
  })

  it("on the SPINE view — flag on — no keydown listener is registered either", async () => {
    const addSpy = vi.spyOn(window, "addEventListener")
    renderKeyBuilder(FLAG_ON_184_13)
    await screen.findByTestId("builder-view-toggle")
    // The Builder cold-starts on the Spine (D-183-02), so nothing has been switched.
    expect(addSpy.mock.calls.filter(([type]) => type === "keydown")).toHaveLength(0)

    // POSITIVE CONTROL — switching to the canvas registers one, so the two assertions
    // above measure the GATE rather than a spy that never sees anything.
    fireEvent.click(screen.getByTestId("builder-view-canvas"))
    await waitFor(() => expect(screen.getByTestId("canvas-node-split")).toBeInTheDocument(), LAZY)
    expect(addSpy.mock.calls.filter(([type]) => type === "keydown").length).toBeGreaterThanOrEqual(1)

    addSpy.mockRestore()
  })

  it("an undo NEVER writes to the server (D-184-03)", async () => {
    await canvasWithOneEdit()
    mockCreate.mockClear()
    mockUpdate.mockClear()

    fireEvent.keyDown(window, { key: "z", ctrlKey: true })
    await waitFor(() => expect(latestPhases()).toHaveLength(5))
    // Well past the coalescing window, so "zero" is not "not yet".
    await new Promise((resolve) => setTimeout(resolve, 700))

    expect(mockCreate).toHaveBeenCalledTimes(0)
    expect(mockUpdate).toHaveBeenCalledTimes(0)
    // ⚠ `validateWorkflow` is deliberately NOT pinned at zero here, and the reason is
    // worth stating: an undo genuinely CHANGES the definition, so the live loop
    // re-checking it is the loop doing its job (D-184-15), not the listener reaching for
    // the network. Pinning it at zero would be asserting the loop OFF, and would go red
    // the first time somebody fixed a bug in it. What must be zero is the WRITE — which
    // is exactly what the two lines above measure.
  })

  // ── UAT-found: a notice must not outlive the act it describes ──────────────────
  //
  // Found in the Phase 184 live UAT. Delete a step: the canvas says "Removed X · 1 step
  // renumbered". Press Ctrl+Z or the toolbar Undo — the step comes back, and the message
  // STAYS, indefinitely, still saying it was removed. Only the notice's OWN inline Undo
  // cleared it (`setCanvasNotice(null)` lives in that one handler), so the two OTHER
  // paths through the same history left a sentence on screen that had become false.
  //
  // The page's own docblock already stated the contract — "cleared by an Undo — a message
  // about an edit that has been taken back is a message that has started lying" — so this
  // is the documented rule going unenforced on two of its three paths, not a new rule.
  //
  // All three paths are asserted, and the last test is the OVER-clearing guard: a fix that
  // simply cleared the notice whenever history moved would also wipe the message a new act
  // just set, which is the opposite defect.

  it("Ctrl+Z clears the message describing the edit it just took back", async () => {
    await canvasWithOneEdit()
    expect(screen.getByTestId("canvas-notice-action").textContent).toContain("Removed")

    fireEvent.keyDown(window, { key: "z", ctrlKey: true })

    await waitFor(() => expect(latestPhases()).toHaveLength(5))
    await waitFor(() => expect(screen.queryByTestId("canvas-notice-action")).toBeNull())
  })

  it("the TOOLBAR's Undo clears it too — same history, same rule", async () => {
    await canvasWithOneEdit()
    expect(screen.getByTestId("canvas-notice-action").textContent).toContain("Removed")

    fireEvent.click(screen.getByTestId("canvas-toolbar-undo"))

    await waitFor(() => expect(latestPhases()).toHaveLength(5))
    await waitFor(() => expect(screen.queryByTestId("canvas-notice-action")).toBeNull())
  })

  it("a REDO clears it as well — the message is stale in both directions", async () => {
    await canvasWithOneEdit()

    fireEvent.keyDown(window, { key: "z", ctrlKey: true })
    await waitFor(() => expect(latestPhases()).toHaveLength(5))
    // Redo re-applies the delete. The old message happened to describe that delete, but a
    // message is a report of an ACT the author just performed, not a caption for the
    // current state — leaving it up would be luck, not correctness.
    fireEvent.keyDown(window, { key: "y", ctrlKey: true })

    await waitFor(() => expect(latestPhases()).toHaveLength(4))
    await waitFor(() => expect(screen.queryByTestId("canvas-notice-action")).toBeNull())
  })

  it("but a NEW act still gets its message — the clear is not indiscriminate", async () => {
    await canvasWithOneEdit()

    fireEvent.keyDown(window, { key: "z", ctrlKey: true })
    await waitFor(() => expect(screen.queryByTestId("canvas-notice-action")).toBeNull())

    // A fresh structural edit pushes history AND must speak. A fix that cleared on every
    // temporal change would swallow this one and pass the three tests above.
    fireEvent.click(screen.getByTestId("canvas-remove-confirm"))

    await waitFor(() =>
      expect(screen.getByTestId("canvas-notice-action").textContent).toContain("Removed"),
    )
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// Plan 184-13 — R12's OTHER half: no net-new header band, and the bottom region is
// somewhere else entirely.
//
// Appended; nothing above this line was edited.
//
// WHY HERE AND NOT IN `WorkflowCanvas.composition.test.tsx`. "No net-new band" is a
// statement about the PAGE's chrome — the header the Builder already had, and where the
// bottom region did NOT land. `WorkflowCanvas` cannot see either. The composition suite
// owns the region's own structure; this owns the page's. Same where-the-behaviour-lives
// split 184-12 recorded as its Deviation 3.
// ═══════════════════════════════════════════════════════════════════════════════

describe("WorkflowBuilderPage 184-13 — R12: the bottom region adds no band to the page", () => {
  const FLAG_ON_R12 = { features: { visual_workflow_canvas: true }, loading: false }

  function renderR12() {
    return render(
      <EffectiveFeaturesProvider value={{ ...FLAG_ON_R12, refetch: vi.fn() }}>
        <div style={{ width: 900, height: 700 }}>
          <WorkflowBuilderPage
            initial={{ definition: { ...definition, phases: evalCoverage }, draftId: "draft-1" }}
            renderPublish={() => <button data-testid="publish-trigger-r12">Publish</button>}
          />
        </div>
      </EffectiveFeaturesProvider>,
    )
  }

  async function openCanvas() {
    renderR12()
    await screen.findByTestId("builder-view-toggle")
    fireEvent.click(screen.getByTestId("builder-view-canvas"))
    await waitFor(() => expect(screen.getByTestId("canvas-bottom-region")).toBeInTheDocument(), LAZY)
  }

  it("the page still has exactly ONE banner, with the same TWO direct children it shipped with", async () => {
    await openCanvas()

    // The pre-plan baseline: one `<header>`, and inside it exactly two groups — the
    // identity cluster on the left and the save/publish cluster on the right. A net-new
    // band would show up either as a second banner or as a third child here.
    const banners = screen.getAllByRole("banner")
    expect(banners).toHaveLength(1)
    expect(banners[0].children).toHaveLength(2)

    // Publish is INSIDE it — 141-B's operator correction, still true with the bottom
    // region mounted.
    expect(banners[0].contains(screen.getByTestId("publish-trigger-r12"))).toBe(true)
    expect(banners[0].contains(screen.getByTestId("builder-save-state"))).toBe(true)
  })

  it("the bottom region lives on the CANVAS, not in the header", async () => {
    await openCanvas()

    const region = screen.getByTestId("canvas-bottom-region")
    expect(region.closest("header")).toBeNull()
    // POSITIVE CONTROL — `closest("header")` really does resolve on this page, so the
    // null above is a real absence rather than a query that finds nothing anywhere.
    expect(screen.getByTestId("builder-save-state").closest("header")).not.toBeNull()

    // …and it is inside the canvas section, which is where editing happens (141-B).
    expect(region.closest('section[aria-label="Workflow canvas"]')).not.toBeNull()
  })

  it("switching back to the Spine takes the whole region with it", async () => {
    await openCanvas()

    fireEvent.click(screen.getByTestId("builder-view-spine"))
    await waitFor(() => expect(screen.queryByTestId("canvas-bottom-region")).toBeNull())
    expect(screen.queryByTestId("canvas-toolbar")).toBeNull()
    expect(screen.queryByTestId("problems-tray")).toBeNull()
    // The header is untouched by the swap.
    expect(screen.getAllByRole("banner")).toHaveLength(1)
    expect(screen.getByTestId("builder-save-state")).toBeInTheDocument()
  })

  it("a tray row jumps to that step — the panel opens on it", async () => {
    mockValidate.mockResolvedValue({
      ok: false,
      verdicts: [
        {
          code: "missing_instructions",
          phase: "deep_dive",
          message: "This step still needs instructions.",
          severity: "incomplete",
        },
      ],
    })
    await openCanvas()

    // D-184-15: nothing is checked until the author edits. Make one.
    fireEvent.click(screen.getByTestId("canvas-remove-confirm"))
    await waitFor(
      () => expect(screen.getByTestId("problems-tray-counts").textContent).toContain("1 thing"),
      { timeout: 5000 },
    )

    fireEvent.click(screen.getByTestId("problems-tray-summary"))
    fireEvent.click(await screen.findByTestId("problems-tray-row-deep_dive-0"))

    await waitFor(() =>
      expect(screen.getByLabelText("Refine step: deep_dive")).toBeInTheDocument(),
    )
  })

  it("the toolbar's save reading follows the page's own save state", async () => {
    mockUpdate.mockResolvedValue({})
    await openCanvas()

    // A clean, untouched draft says nothing at all — there is no true sentence about a
    // save that has not happened.
    expect(screen.queryByTestId("canvas-toolbar-save-chip")).toBeNull()

    fireEvent.click(screen.getByTestId("canvas-remove-confirm"))
    await waitFor(() =>
      expect(screen.getByTestId("canvas-toolbar-save-chip").textContent).toBe("Not saved yet"),
    )

    fireEvent.click(screen.getByTestId("canvas-toolbar-save"))
    await waitFor(() =>
      expect(screen.getByTestId("canvas-toolbar-save-chip").textContent).toBe(
        "Saved · still a draft",
      ),
    )
    // ONE save path, two entry points: the toolbar's trigger and the header's shipped one
    // both call `onSaveDraft`, so the row was PATCHed exactly once.
    expect(mockUpdate).toHaveBeenCalledTimes(1)
  })
})

// ── Phase 185-08 (GOVERN-01 / GOVERN-02 · D-185-11 / D-185-19) ───────────────────────
//
// The author-time `🔒` row and the governance write chain, asserted on the PAGE because
// the page is where both are composed: `gatesFor` synthesizes the row from data the
// client already holds, and `onGovernanceChange` closes the four-layer chain
// (page useCallback → builderStore.setGovernance → definitionOps.setPhaseGovernance →
// the definition).
//
// THE LOAD-BEARING ONE IS THE NEGATIVE. D-185-19: `POST /workflows/validate` returns
// PROBLEMS, with no channel for "here is a gate that will run", so nothing may wait on
// it for this row. That is asserted with a positive control, because a spy that could
// never fire proves nothing at all.

describe("WorkflowBuilderPage 185-08 — the client-synthesized locked gate row", () => {
  /** The SERVER's answer, as the wire serves it. The client hardcodes no tool name;
   *  these arrive on `GET /workflows/grounding-bundle` (D-185-09). */
  const SERVER_KB_TOOLS = [
    "search_documents",
    "list_documents",
    "get_document",
    "search_folder",
    "read_file",
  ]

  /** Two steps, the first an agent. `available_tools` is the only thing that differs
   *  between the two readings below, so nothing else can explain a changed verdict. */
  function draftWithTools(tools: string[]): BuilderDefinition {
    return {
      ...definition,
      phases: [
        {
          slug: "research",
          phase_index: 0,
          config: { phase_type: "llm_agent", prompt: "look it up", available_tools: tools },
        },
        { slug: "summarize", phase_index: 1, config: { phase_type: "llm_single", prompt: "write it" } },
      ],
    }
  }

  const seen: BuilderDefinition[] = []
  const latest = () => seen[seen.length - 1]

  /** Render the Builder with the flag on, observing the live definition through the
   *  shipped `renderPublish` seam — the 184-12 idiom, so the write chain is asserted on
   *  what the page actually holds rather than on a mocked store. */
  function renderGoverned(def: BuilderDefinition) {
    seen.length = 0
    mockBundle.mockResolvedValue({
      tools: ["search_documents", "execute_code"],
      kb_tools: SERVER_KB_TOOLS,
      folders: [],
      skills: [],
      degraded: [],
    })
    return render(
      <EffectiveFeaturesProvider value={{ ...FLAG_ON, refetch: vi.fn() }}>
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

  /** Open the step's form and wait for the palette to land, so an assertion about the
   *  KB reading is never taken on the pre-fetch frame. */
  async function openResearch(tools: string[], cause: string) {
    renderGoverned(draftWithTools(tools))
    fireEvent.click(await screen.findByTestId("spine-node-research"))
    const section = await screen.findByTestId("rail-governance")
    await waitFor(() => expect(section.getAttribute("data-cause")).toBe(cause))
    return section
  }

  it("a KB-reading step shows EXACTLY ONE locked row, carrying the one constant", async () => {
    await openResearch(["search_documents"], "detected")

    const rows = await screen.findAllByTestId("gate-row")
    expect(rows).toHaveLength(1)
    expect(rows[0].textContent).toContain(GOVERNANCE_GATE_ROW_LABEL)
    expect(rows[0].getAttribute("data-locked")).toBe("true")
    // Locked means locked: a Remove button that could remove nothing would be the lie
    // the row union exists to make un-representable.
    expect(rows[0].querySelectorAll('button, [role="button"], input')).toHaveLength(0)
  })

  it("the SAME step with only non-KB tools produces ZERO rows", async () => {
    // The contrast case, in the same block on purpose: a test that only ever shows the
    // row is compatible with a page that shows it unconditionally.
    await openResearch(["execute_code"], "none")

    expect(screen.queryAllByTestId("gate-row")).toHaveLength(0)
    expect(screen.getByTestId("rail-gates").textContent).not.toContain(GOVERNANCE_GATE_ROW_LABEL)
  })

  it("D-185-19 — the row is synthesized LOCALLY; /workflows/validate is never asked for it", async () => {
    // 187-27 rewrote the INSTRUMENT, not the property. The open now issues a check of its
    // own, so an absolute "zero calls" can no longer carry "nothing waits on the server
    // for this row". The property is now measured DIRECTLY and more strongly: the check
    // is held UNANSWERED for the whole case, so nothing the server said can possibly be
    // the row's source — the row is on screen with the transport having replied nothing.
    mockValidate.mockReturnValue(new Promise<never>(() => {}))

    await openResearch(["search_documents"], "detected")
    expect((await screen.findAllByTestId("gate-row"))[0].textContent).toContain(
      GOVERNANCE_GATE_ROW_LABEL,
    )

    // Well past the live loop's 500 ms debounce: the request has been issued and has
    // answered nothing, and the row is there regardless.
    await new Promise((resolve) => setTimeout(resolve, 700))
    expect(screen.getAllByTestId("gate-row")).toHaveLength(1)

    // POSITIVE CONTROL — the very same spy DOES fire AGAIN once the page has a new reason
    // to ask. Without this the reading above would be green on a spy wired to nothing.
    const askedBefore = mockValidate.mock.calls.length
    const field = await screen.findByLabelText(/instructions/i)
    fireEvent.change(field, { target: { value: "search the vendor corpus" } })
    await waitFor(() => expect(mockValidate.mock.calls.length).toBeGreaterThan(askedBefore), {
      timeout: 3000,
    })
  })

  it("the dial writes through the store, and every other phase stays toBe-identical", async () => {
    // A LOOSE agent, so the strict side is pressable — a detected step's dial is already
    // strict and clicking it writes nothing (that is D-185-07, asserted in 185-07).
    const section = await openResearch(["execute_code"], "none")

    const before = latest().phases
    expect(before[0].grounding_escalated ?? false).toBe(false)
    const untouched = before[1]

    fireEvent.click(screen.getByTestId("governance-dial-strict"))

    await waitFor(() => expect(latest().phases[0].grounding_escalated).toBe(true))
    // The write landed at PhaseSpec level on the NAMED slug only. Reference identity is
    // the strongest available statement that the merge did not go one layer down or
    // rebuild a neighbour.
    expect(latest().phases[1]).toBe(untouched)
    expect(latest().phases).toHaveLength(2)
    expect(latest().phases.map((p) => p.phase_index)).toEqual([0, 1])

    // …and the synthesized row follows the new cause, with no reload and no server ask.
    await waitFor(() => expect(section.getAttribute("data-cause")).toBe("escalated"))
    const rows = await screen.findAllByTestId("gate-row")
    expect(rows).toHaveLength(1)
    expect(rows[0].textContent).toContain(GOVERNANCE_GATE_ROW_LABEL)
  })

  it("the arming switch writes action_risk_armed and changes no step count or index", async () => {
    await openResearch(["execute_code"], "none")
    const untouched = latest().phases[1]

    fireEvent.click(screen.getByTestId("governance-arm"))

    await waitFor(() => expect(latest().phases[0].action_risk_armed).toBe(true))
    // SPEC Req 8: arming is a gate ON the step, never an extra step.
    expect(latest().phases).toHaveLength(2)
    expect(latest().phases.map((p) => p.phase_index)).toEqual([0, 1])
    expect(latest().phases[1]).toBe(untouched)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// Plan 186-07 (CONCUR-01 / CONCUR-02 · D-186-03 / D-186-08) — the two surfaces the
// composed write loop earns, asserted on the PAGE because the page is where they mount.
//
// Appended; nothing above this line was edited except the module mock's completeness and
// the two write-response defaults in `beforeEach`.
//
// WHY HERE AND NOT IN THE HOOK'S SUITE. `useDraftPersistence.test.tsx` owns the LOOP —
// single-flight, the token chain, the hold, the halt. What it cannot see is whether the
// header says anything true about any of that, or whether the flag-off surface stays the
// one that shipped. That is this file's half, and it is the same where-the-behaviour-lives
// split 184-12 and 184-13 recorded before it.
// ═══════════════════════════════════════════════════════════════════════════════

describe("WorkflowBuilderPage 186-07 — the quiet autosave line", () => {
  const FLAG_ON_186 = { features: { visual_workflow_canvas: true }, loading: false }

  it("says NOTHING at rest — a draft nobody has touched makes no claim", async () => {
    renderBuilder(FLAG_ON_186)
    await screen.findByTestId("builder-view-toggle")

    expect(screen.queryByTestId("builder-autosave-status")).toBeNull()
    expect(screen.queryByTestId("builder-conflict-banner")).toBeNull()
    expect(screen.queryByTestId("builder-save-confirm")).toBeNull()
  })

  it("reports a CONFIRMED autosave, and the receipt is retired by the next edit", async () => {
    renderBuilder(FLAG_ON_186)
    await screen.findByTestId("builder-view-toggle")

    fireEvent.click(screen.getByTestId("spine-node-research"))
    const field = await screen.findByLabelText(/instructions/i)
    fireEvent.change(field, { target: { value: "an edit nobody pressed Save for" } })

    const line = await screen.findByTestId("builder-autosave-status", undefined, { timeout: 4000 })
    expect(line.getAttribute("role")).toBe("status")
    await waitFor(() => expect(line.textContent).toBe("Saved · just now"))
    expect(mockUpdate).toHaveBeenCalledTimes(1)

    // The receipt is not a clock — the next change retires it, which is what makes the
    // shipped `Saved · still a draft` unable to sit there while the author types.
    fireEvent.change(field, { target: { value: "and then another one" } })
    await waitFor(() => expect(screen.queryByTestId("builder-save-confirm")).toBeNull())
  })

  it("the line is FLAG-GATED — with the canvas off the header is the one that shipped", async () => {
    // D-181-01. The explicit Save still works with the flag off (its own row above proves
    // that); what must not appear is the autosave voice, because the loop it describes is
    // not running. `header.test.tsx` pins the same promise as literal markup.
    renderBuilder({ features: {}, loading: false })
    await screen.findByTestId("builder-save-draft")

    fireEvent.click(screen.getByTestId("spine-node-research"))
    const field = await screen.findByLabelText(/instructions/i)
    fireEvent.change(field, { target: { value: "an edit on the flag-off surface" } })

    await new Promise((resolve) => setTimeout(resolve, 2200))
    expect(screen.queryByTestId("builder-autosave-status")).toBeNull()
    expect(mockUpdate).toHaveBeenCalledTimes(0)
  })
})

describe("WorkflowBuilderPage 186-07 — the conflict banner (D-186-08)", () => {
  const FLAG_ON_186 = { features: { visual_workflow_canvas: true }, loading: false }

  class StaleToken extends Error {
    currentToken: string | null
    constructor(currentToken: string | null) {
      super("this draft changed somewhere else")
      this.name = "WorkflowStaleTokenError"
      this.currentToken = currentToken
    }
  }

  async function conflicted() {
    mockUpdate.mockRejectedValue(new StaleToken("newer-token"))
    renderBuilder(FLAG_ON_186)
    await screen.findByTestId("builder-view-toggle")
    fireEvent.click(screen.getByTestId("spine-node-research"))
    const field = await screen.findByLabelText(/instructions/i)
    fireEvent.change(field, { target: { value: "the losing tab's edit" } })
    return screen.findByTestId("builder-conflict-banner", undefined, { timeout: 4000 })
  }

  it("offers Reload FIRST and Overwrite SECOND, in DOM order", async () => {
    const banner = await conflicted()

    const controls = [...banner.querySelectorAll("button")]
    const reload = screen.getByTestId("builder-conflict-reload")
    const overwrite = screen.getByTestId("builder-conflict-overwrite")
    expect(controls).toHaveLength(2)
    expect(controls[0]).toBe(reload)
    expect(controls[1]).toBe(overwrite)
    expect(
      reload.compareDocumentPosition(overwrite) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
  })

  it("states the cause in real DOM text and files no receipt", async () => {
    const banner = await conflicted()

    expect(banner.getAttribute("role")).toBe("alert")
    expect(banner.textContent).toContain("changed somewhere else")
    // The reason is TEXT, not a tooltip — a `title` is unreachable by keyboard and by
    // most reading modes (the shipped refusal-copy rule).
    expect(banner.getAttribute("title")).toBeNull()
    expect(screen.queryByTestId("builder-save-confirm")).toBeNull()
  })

  it("it does NOT add a header band — the merged row still has its TWO children", async () => {
    await conflicted()

    // The 184-13 pin, re-measured while the alert is on screen: it mounts INSIDE the
    // existing action group, so the header's structure is untouched and no band appeared.
    //
    // (Measured on `builder-header-bar` rather than on the banner ROLE, because reaching
    // a conflict requires opening the form panel and that panel contributes a `<header>`
    // of its own. The subject here is the Builder's row, not how many headers a panel
    // brings with it.)
    const bar = screen.getByTestId("builder-header-bar")
    expect(bar.children).toHaveLength(2)
    expect(bar.contains(screen.getByTestId("builder-conflict-banner"))).toBe(true)
    expect(bar.contains(screen.getByTestId("builder-save-state"))).toBe(true)
    // …and the alert is a sibling of the save cluster, not a wrapper around it.
    expect(screen.getByTestId("builder-conflict-banner").contains(screen.getByTestId("builder-save-state"))).toBe(false)
  })

  it("RELOAD re-reads the owner-scoped drafts list rather than adding a route", async () => {
    mockListDrafts.mockResolvedValue([
      { id: "draft-1", slug: "vendor-brief", version: 1, name: "Vendor brief", definition, token: "server-token" },
    ])
    await conflicted()
    expect(mockListDrafts).not.toHaveBeenCalled()

    fireEvent.click(screen.getByTestId("builder-conflict-reload"))
    await waitFor(() => expect(mockListDrafts).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(screen.queryByTestId("builder-conflict-banner")).toBeNull())
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// Plan 186-16 (WR-10) — A PUBLISH CANNOT START ON TOP OF AN OUTSTANDING WRITE.
//
// Appended; nothing above this line was edited.
//
// WHAT IS BEING MEASURED HERE, and why it is the page rather than the gauntlet. The
// component half — that a supplied reason refuses the INNER Publish button and states
// itself inside the modal — is `PublishGauntlet.test.tsx`'s. This half is the page's
// COMPOSITION: that the write loop's own `saving` reading reaches the publish seam as a
// reason at all. So the loop is driven for real — an edit, the shipped 1000 ms debounce,
// and a deferred `updateWorkflowDraft` that is issued and never answered, which IS the
// outstanding-PATCH window WR-10 describes. Stubbing `useDraftPersistence` would have
// proved nothing about the page that composes it.
// ═══════════════════════════════════════════════════════════════════════════════

describe("WorkflowBuilderPage 186-16 — an outstanding write blocks publish (WR-10)", () => {
  const FLAG_ON_186_16 = { features: { visual_workflow_canvas: true }, loading: false }
  const FLAG_OFF_186_16 = { features: {}, loading: false }

  /** The empty draft — the branch the saving one has to OUTRANK. */
  const emptyDraft186: BuilderDefinition = { ...definition, phases: [] }

  const FOLDER = { id: "0d1f4b6e-0000-4000-8000-00000000f01d", name: "Vendor contracts" }

  /**
   * Mount the page and CAPTURE every `blockedReason` it hands the shipped `renderPublish`
   * seam. The seam is a genuine observable of the page's state — the same third argument
   * `WorkflowsPage` passes into the real gauntlet in production — so no private field is
   * reached into and no hook is stubbed.
   */
  function renderCapturing(
    features: { features: EffectiveFeatures; loading: boolean },
    def: BuilderDefinition = definition,
  ) {
    const seen: (string | null)[] = []
    render(
      <EffectiveFeaturesProvider value={{ ...features, refetch: vi.fn() }}>
        <div style={{ width: 1200, height: 800 }}>
          <WorkflowBuilderPage
            initial={{ definition: def, draftId: "draft-1" }}
            renderPublish={(_d, _id, blockedReason) => {
              seen.push(blockedReason ?? null)
              return <span data-testid="publish-seam">{blockedReason ?? ""}</span>
            }}
          />
        </div>
      </EffectiveFeaturesProvider>,
    )
    return { seen, latest: () => seen[seen.length - 1] ?? null }
  }

  /** A PATCH that is issued and never answered — the window itself. Returns its release. */
  function deferUpdate() {
    let release: (() => void) | null = null
    mockUpdate.mockImplementation(
      () =>
        new Promise((resolve) => {
          release = () => resolve({ id: "draft-1", version: 2, token: "tok-after" })
        }),
    )
    return () => {
      expect(release).not.toBeNull()
      release!()
    }
  }

  /** One real edit through the shipped form panel, so the loop's `dirty` gate opens. */
  async function editOnce(text: string) {
    fireEvent.click(await screen.findByTestId("spine-node-research"))
    const field = await screen.findByLabelText(/instructions/i)
    fireEvent.change(field, { target: { value: text } })
  }

  it("names the outstanding write while it is outstanding, and stops naming it when it lands", async () => {
    const releaseWrite = deferUpdate()
    const { latest } = renderCapturing(FLAG_ON_186_16)
    await screen.findByTestId("builder-view-toggle")

    // The reading BEFORE the write, captured rather than assumed: this row is about the
    // saving branch, not about what the fixture's validation happens to say.
    //
    // 187-27 STRENGTHENED this capture rather than weakening the equality below. The open
    // now issues its own check, so a baseline taken on the first frame would catch the
    // TRANSIENT never-ran sentence and the equality at the end would then be comparing two
    // different moments. Waiting for that check to answer makes `before` a SETTLED reading,
    // which is what "returns to whatever it was before the write" was always meant to say.
    await waitFor(() => expect(latest()).toBeNull(), { timeout: 3000 })
    const before = latest()

    await editOnce("search the vendor corpus")
    await waitFor(() => expect(mockUpdate).toHaveBeenCalledTimes(1), { timeout: 5000 })

    // WR-10: the PATCH is in flight and unanswered — exactly the window in which a
    // gauntlet's stage-0 token read is already doomed.
    await waitFor(() => expect(latest()).toBe(SAVING_PUBLISH_WAIT))
    // The wording is pinned as a literal exactly ONCE, here, so a re-wording has to be
    // deliberate — and it reads as a WAIT, never as a fault the author has to fix.
    expect(SAVING_PUBLISH_WAIT).toBe("Saving your last change — Publish will be ready in a moment")

    // …and the block is momentary, not a lock-out: the answer lands and the reading
    // returns to whatever it was before the write, measured as an equality.
    releaseWrite()
    await waitFor(() => expect(latest()).toBe(before))
  })

  it("with the flag OFF nothing writes and nothing blocks (D-181-01)", async () => {
    deferUpdate()
    const { latest } = renderCapturing(FLAG_OFF_186_16)
    await waitFor(() => expect(screen.getByTestId("builder-grid")).toBeInTheDocument())

    await editOnce("an edit on the flag-off surface")
    // The shipped debounce plus a margin — long enough that a write WOULD have been
    // issued had the loop been running at all.
    await new Promise((resolve) => setTimeout(resolve, 2200))

    expect(mockUpdate).toHaveBeenCalledTimes(0)
    expect(latest()).toBeNull()
    expect(screen.queryByTestId("publish-blocked-reason")).toBeNull()
  })

  it("the saving reason OUTRANKS the empty-draft invitation — the nearest obstacle is the one named", async () => {
    mockListFolders.mockResolvedValue([FOLDER])
    const releaseWrite = deferUpdate()
    const { latest } = renderCapturing(FLAG_ON_186_16, emptyDraft186)
    await screen.findByTestId("builder-view-toggle")

    // A draft with no steps: today's reason is the invitation.
    await waitFor(() => expect(latest()).toBe(EMPTY_DRAFT_INVITATION))

    // Bind a knowledge base — an author edit that arms `dirty` on a workflow with no
    // steps, which is how an empty draft can have a write outstanding at all.
    const picker = await screen.findByTestId("project-folder-picker")
    await waitFor(() =>
      expect(Array.from((picker as HTMLSelectElement).options).map((o) => o.value)).toEqual([
        "",
        FOLDER.id,
      ]),
    )
    fireEvent.change(picker, { target: { value: FOLDER.id } })
    await waitFor(() => expect(mockUpdate).toHaveBeenCalledTimes(1), { timeout: 5000 })

    // Both branches are true at once. The one the author can act on RIGHT NOW is the
    // wait — adding a step will not make Publish go until the write has landed.
    await waitFor(() => expect(latest()).toBe(SAVING_PUBLISH_WAIT))

    releaseWrite()
    await waitFor(() => expect(latest()).toBe(EMPTY_DRAFT_INVITATION))
  })

  // ── CR-03 (186-18) ────────────────────────────────────────────────────────────
  // The row above proves nothing WRITES on the flag-off surface by ITSELF. It says
  // nothing about the write a person CHOOSES, and that gap is the defect: D-186-03
  // deliberately leaves `saveNow` ungated on the canvas flag (its docblock:
  // "automatic writes obey the flag, chosen ones obey the person"), while `actionGroup`
  // mounts BOTH `builder-save-draft` and `renderPublish` on BOTH header branches. So a
  // real outstanding PATCH exists on the reverted surface, and until this row the
  // refusal that guards it sat one line BELOW a flag short-circuit that returned null.
  // The premise is ASSERTED here (call count), not argued — if the flag-off Save does
  // not write, the whole fix is mis-derived and must stop.
  it("a CHOSEN save on the flag-OFF surface blocks publish too (CR-03) — D-186-03's asymmetry cuts both ways", async () => {
    const releaseWrite = deferUpdate()
    const { latest } = renderCapturing(FLAG_OFF_186_16)
    // `builder-grid` is the flag-off surface's landmark — `builder-view-toggle` exists
    // only with the flag on.
    await waitFor(() => expect(screen.getByTestId("builder-grid")).toBeInTheDocument())

    // Captured, never assumed: this row is about the saving branch, not about what the
    // fixture's validation happens to say on this surface.
    const before = latest()

    await editOnce("an edit the author then chooses to commit")
    fireEvent.click(screen.getByTestId("builder-save-draft"))

    // The premise, measured: the chosen write really is reachable with the flag OFF.
    await waitFor(() => expect(mockUpdate).toHaveBeenCalledTimes(1), { timeout: 5000 })

    // CR-03: while that PATCH is unanswered the publish seam must be told to refuse —
    // on this surface too. A gauntlet started here would burn a golden run and come
    // back with an after-the-fact `draft_changed`.
    await waitFor(() => expect(latest()).toBe(SAVING_PUBLISH_WAIT))

    // …and it is a momentary wait, not a lock-out.
    releaseWrite()
    await waitFor(() => expect(latest()).toBe(before))
  })
})

// ══════════════════════════════════════════════════════════════════════════════════
// Phase 187-15 Task 1 (VOCAB-01 / Req 1 / D-187-05) — THE ONE NAME CONTEXT, THREADED
//
// APPENDED, never interleaved. Plans 187-04 / 187-08 / 187-09 built the ladder and the
// two optional props; NOTHING passed them. This block is the page's half: one memoised
// context, built from values the page already holds, reaching the canvas, the spine and
// both `canvasNotice` announcement sites — and reaching `definitionOps.canRemovePhase`
// deliberately NOT AT ALL, which is asserted below so the deferral cannot be closed by
// accident and then quietly reopened.
// ══════════════════════════════════════════════════════════════════════════════════

const SKILL_NAME = "Invoice Checker"
const FOLDER_NAME = "Supplier Contracts"
const TEMPLATE_FILE = "quarterly-brief.docx"

/**
 * Three steps, each reaching a DIFFERENT derived tier (D-187-04's most-specific-first
 * order): a bound skill, a single scoped folder, and an `llm_emit` that can only be
 * named by the DEFINITION's template. The third is the whole point of this plan — the
 * template tier has had no producer since 187-04 shipped it.
 */
const vocabularyPhases = [
  { slug: "research", phase_index: 0, config: { phase_type: "llm_agent", skill_ref: CORPUS_SKILL_ID } },
  // 187-17 (WR-02) — RETYPED from `llm_single`. The folder tier is gated on
  // `GROUNDING_DIAL_TYPES`, because `folder_scope` rides every LLM config member for
  // shape symmetry and is INERT on the ones with no tools (`LlmSinglePhaseConfig`
  // says so itself), so the shipped fixture asked the page to prove a face that is a
  // fabricated capability claim. `llm_batch_agents` keeps this row a real folder-tier
  // witness AND covers the half of the gated set that had no page coverage at all.
  { slug: "scan", phase_index: 1, config: { phase_type: "llm_batch_agents", folder_scope: [CORPUS_FOLDER_ID] } },
  // 187-17 (WR-02) — the NEGATIVE witness, added without changing the phase count so
  // no other row of this suite moves. `llm_emit` is deliberately outside the gate:
  // `_exec_llm_emit` is a sealed forced emit that never builds a phase tool context
  // and never reads `folder_scope`. With a template present tier (2) wins anyway; the
  // malformed-`assets` rows below are where this binding is the only thing the face
  // could over-claim from.
  { slug: "brief", phase_index: 2, config: { phase_type: "llm_emit", folder_scope: [CORPUS_FOLDER_ID] } },
]

/** The definition, with whatever `assets` the row under test wants — including the two
 *  malformed shapes a hand-editable JSONB column can actually hold. */
function vocabularyDef(assets?: unknown): BuilderDefinition {
  return {
    ...definition,
    phases: structuredClone(vocabularyPhases),
    ...(assets === undefined ? {} : { assets }),
  } as BuilderDefinition
}

/** The `assets[]` shape `AssetRef` declares (`backend/app/models/harness.py:255-282`):
 *  a `kind` of `"template" | "reference"` and a `filename`. The reference row is FIRST
 *  so a `find` that ignored `kind` would pick the wrong file and the assertion would
 *  say so. */
const REAL_ASSETS = [
  { kind: "reference", filename: "last-quarter.pdf" },
  { kind: "template", filename: TEMPLATE_FILE },
]

describe("WorkflowBuilderPage 187-15 — one name context, two graph views (Req 1)", () => {
  const ON = { features: { visual_workflow_canvas: true }, loading: false }
  const OFF = { features: {}, loading: false }

  /** The maps the page fetches once on mount. Resolved BEFORE the render so the settle
   *  is not what is being measured here — Pitfall 1 has its own row below. */
  function withMaps() {
    mockListFolders.mockResolvedValue([{ id: CORPUS_FOLDER_ID, name: FOLDER_NAME }])
    mockListSkills.mockResolvedValue([{ id: CORPUS_SKILL_ID, name: SKILL_NAME }])
  }

  function renderVocab(
    def: BuilderDefinition,
    features: { features: EffectiveFeatures; loading: boolean } = ON,
  ) {
    return render(
      <EffectiveFeaturesProvider value={{ ...features, refetch: vi.fn() }}>
        <div style={{ width: 1200, height: 800 }}>
          <WorkflowBuilderPage initial={{ definition: def, draftId: "draft-1" }} />
        </div>
      </EffectiveFeaturesProvider>,
    )
  }

  const spineFace = (slug: string) => screen.getByTestId(`spine-node-${slug}`).textContent ?? ""
  const canvasFace = (slug: string) => screen.getByTestId(`canvas-node-${slug}`).textContent ?? ""

  async function openCanvas() {
    fireEvent.click(screen.getByTestId("builder-view-canvas"))
    await waitFor(() => expect(screen.getByTestId("canvas-node-research")).toBeInTheDocument(), LAZY)
  }

  it("a bound skill names the step on the canvas AND on the spine, identically", async () => {
    withMaps()
    renderVocab(vocabularyDef(REAL_ASSETS))
    await screen.findByTestId("builder-view-toggle")
    await waitFor(() => expect(spineFace("research")).toContain(`Run the ${SKILL_NAME}`))

    // The two surfaces are read one after the other and compared as STRINGS — this is
    // the card↔spine agreement, not two calls of one function.
    const onTheSpine = spineFace("research")
    await openCanvas()
    expect(canvasFace("research")).toContain(`Run the ${SKILL_NAME}`)
    expect(onTheSpine).toContain(`Run the ${SKILL_NAME}`)
    // The derived face is the card's TITLE, so it leads the node's text. (The card's
    // SUBTITLE still carries the plain type sentence — that is 187-09's shape, and
    // asserting its absence here would be asserting the wrong thing.)
    expect(canvasFace("research").startsWith(`Run the ${SKILL_NAME}`)).toBe(true)
    expect(canvasFace("research")).not.toContain(CORPUS_SKILL_ID)
  })

  it("a single scoped folder names its step on both views", async () => {
    withMaps()
    renderVocab(vocabularyDef(REAL_ASSETS))
    await screen.findByTestId("builder-view-toggle")
    await waitFor(() => expect(spineFace("scan")).toContain(`Search ${FOLDER_NAME}`))
    await openCanvas()
    expect(canvasFace("scan")).toContain(`Search ${FOLDER_NAME}`)
  })

  it("the DEFINITION's template asset names the llm_emit step — the tier that had no producer", async () => {
    withMaps()
    renderVocab(vocabularyDef(REAL_ASSETS))
    await screen.findByTestId("builder-view-toggle")
    // `assets[]` is definition-level and the entry is chosen by `kind === "template"`,
    // never by position: the reference row sits FIRST in the fixture.
    await waitFor(() => expect(spineFace("brief")).toContain(`Fill ${TEMPLATE_FILE}`))
    expect(spineFace("brief")).not.toContain("last-quarter.pdf")
    await openCanvas()
    expect(canvasFace("brief")).toContain(`Fill ${TEMPLATE_FILE}`)
  })

  it("BEFORE the maps resolve both views render the plain type sentence — never an id-shaped face", async () => {
    // Pitfall 1, ACCEPTED and asserted: the mount fetch is left hanging, which is exactly
    // the first paint. The floor is that a miss falls THROUGH to the type sentence; an
    // id-shaped face is worse than a generic one, and a placeholder is never available.
    mockListFolders.mockReturnValue(new Promise(() => {}))
    mockListSkills.mockReturnValue(new Promise(() => {}))
    const { container } = renderVocab(vocabularyDef(REAL_ASSETS))
    await screen.findByTestId("builder-view-toggle")

    expect(spineFace("research")).not.toContain(SKILL_NAME)
    expect(spineFace("scan")).not.toContain(FOLDER_NAME)
    expect(container.textContent ?? "").not.toContain(CORPUS_SKILL_ID)
    expect(container.textContent ?? "").not.toContain(CORPUS_FOLDER_ID)
    // The template tier is DEFINITION-level and needs no fetch, so it is already there.
    expect(spineFace("brief")).toContain(`Fill ${TEMPLATE_FILE}`)
  })

  for (const [label, assets] of [
    ["a NULL assets", null],
    ["a non-array assets", { kind: "template", filename: "not-a-list.docx" }],
    ["an ABSENT assets", undefined],
    ["an assets whose rows are not objects", ["quarterly-brief.docx", 7, null]],
  ] as Array<[string, unknown]>) {
    it(`${label} renders without throwing and produces no template face`, async () => {
      withMaps()
      renderVocab(vocabularyDef(assets))
      await screen.findByTestId("builder-view-toggle")
      await waitFor(() => expect(spineFace("research")).toContain(`Run the ${SKILL_NAME}`))
      expect(spineFace("brief")).not.toContain("Fill ")
      expect(spineFace("brief")).not.toContain("not-a-list.docx")
      // 187-17 (WR-02) — …and no FOLDER face either. `brief` carries a sole RESOLVABLE
      // `folder_scope` and the maps ARE resolved here, so with tier (2) missing this is
      // the one place on the page where only the gate stands between the user and a
      // claim the step cannot honour. The floor is the plain type sentence, never a
      // search and never an id.
      expect(spineFace("brief")).toContain(PHASE_TYPE_SENTENCES.llm_emit)
      expect(spineFace("brief")).not.toContain(`Search ${FOLDER_NAME}`)
      expect(spineFace("brief")).not.toContain(CORPUS_FOLDER_ID)
    })
  }

  it("with the flag OFF the spine element carries NO nameContext KEY at all (D-14)", async () => {
    withMaps()
    spineProps.length = 0
    renderVocab(vocabularyDef(REAL_ASSETS), OFF)
    await waitFor(() => expect(screen.getByTestId("builder-grid")).toBeInTheDocument())
    await waitFor(() => expect(spineProps.length).toBeGreaterThan(0))

    // Present-and-undefined is NOT absent. The spread-conditional is what makes this
    // true, and this is the assertion that can tell the two apart.
    for (const props of spineProps) {
      expect("nameContext" in props).toBe(false)
    }
  })

  it("with the flag ON the spine IS handed the context, and its identity is stable", async () => {
    withMaps()
    spineProps.length = 0
    renderVocab(vocabularyDef(REAL_ASSETS))
    await screen.findByTestId("builder-view-toggle")
    await waitFor(() => expect(spineFace("research")).toContain(`Run the ${SKILL_NAME}`))

    const withKey = spineProps.filter((p) => "nameContext" in p)
    expect(withKey.length).toBeGreaterThan(0)
    const ctx = withKey[withKey.length - 1].nameContext as {
      folderNames?: Record<string, string>
      skillNames?: Record<string, string>
      templateFilename?: string
    }
    expect(ctx.skillNames?.[CORPUS_SKILL_ID]).toBe(SKILL_NAME)
    expect(ctx.folderNames?.[CORPUS_FOLDER_ID]).toBe(FOLDER_NAME)
    expect(ctx.templateFilename).toBe(TEMPLATE_FILE)

    // MEMOISED: once the maps have landed, a re-render that changes none of the three
    // inputs must hand back the SAME object — `toCanvas` is memoised on its options and
    // a fresh context every render would re-project the whole canvas.
    const settled = withKey[withKey.length - 1].nameContext
    fireEvent.click(screen.getByTestId("spine-node-research"))
    await waitFor(() => expect(screen.getByLabelText("Refine step: research")).toBeInTheDocument())
    const later = spineProps.filter((p) => "nameContext" in p)
    expect(later.length).toBeGreaterThan(withKey.length)
    expect(later[later.length - 1].nameContext).toBe(settled)
  })
})

describe("WorkflowBuilderPage 187-15 — the announcements name a step the way its card does", () => {
  const ON = { features: { visual_workflow_canvas: true }, loading: false }

  function renderNoticeBuilder(def: BuilderDefinition) {
    return render(
      <EffectiveFeaturesProvider value={{ ...ON, refetch: vi.fn() }}>
        <div style={{ width: 1200, height: 800 }}>
          <WorkflowBuilderPage initial={{ definition: def, draftId: "draft-1" }} />
        </div>
      </EffectiveFeaturesProvider>,
    )
  }

  async function openCanvasFor(def: BuilderDefinition) {
    renderNoticeBuilder(def)
    await screen.findByTestId("builder-view-toggle")
    fireEvent.click(screen.getByTestId("builder-view-canvas"))
    await waitFor(
      () => expect(screen.getByTestId(`canvas-node-${def.phases[0].slug}`)).toBeInTheDocument(),
      LAZY,
    )
  }

  it("REMOVED names the deleted step with the SAME face its card showed", async () => {
    // `assess` carries `skill_ref`, so the derived tier fires — untouched, this notice
    // announces the generic sentence for a card that reads "Run the Invoice Checker".
    mockListFolders.mockResolvedValue([])
    mockListSkills.mockResolvedValue([{ id: CORPUS_SKILL_ID, name: SKILL_NAME }])
    await openCanvasFor({ ...definition, phases: structuredClone(branching) } as BuilderDefinition)
    await waitFor(() =>
      expect(screen.getByTestId("canvas-node-assess").textContent ?? "").toContain(
        `Run the ${SKILL_NAME}`,
      ),
    )

    fireEvent.click(screen.getByTestId("canvas-remove-assess"))
    const message = await screen.findByTestId("canvas-notice-action")
    expect(message.textContent).toContain(`Removed Run the ${SKILL_NAME}`)
    // …and NOT the pre-187 generic sentence the shipped call site produced.
    expect(message.textContent).not.toContain(`Removed ${nodeTitle(branching[1])}`)
  })

  it("ADDED names the new step with the SAME face its freshly-drawn card shows", async () => {
    mockListFolders.mockResolvedValue([])
    mockListSkills.mockResolvedValue([])
    await openCanvasFor({ ...definition, phases: structuredClone(evalCoverage) } as BuilderDefinition)

    /** Every canvas node's testid, so the ADDED one is FOUND rather than guessed — the
     *  slug `slugForType` derives is not this test's to assume. */
    const nodeIds = () =>
      Array.from(document.querySelectorAll("[data-testid^='canvas-node-']")).map(
        (n) => n.getAttribute("data-testid") ?? "",
      )
    const before = new Set(nodeIds())

    fireEvent.click(screen.getByTestId("canvas-insert-2"))
    fireEvent.click(screen.getByTestId("step-type-choice-llm_human_input"))

    const message = await screen.findByTestId("canvas-notice-action")
    const subject = message.querySelector("strong")?.textContent ?? ""
    expect(subject.length).toBeGreaterThan(0)

    // Two surfaces compared, not one function compared with itself: whatever the notice
    // called the step, the card it just drew must call it the same.
    await waitFor(() => expect(nodeIds().filter((id) => !before.has(id))).toHaveLength(1))
    const addedId = nodeIds().filter((id) => !before.has(id))[0]
    expect(screen.getByTestId(addedId).textContent ?? "").toContain(subject)
  })

  it("THE DEFERRAL, ASSERTED — a refusal still names its referrer with the undecorated title", async () => {
    /**
     * `definitionOps.canRemovePhase` is deliberately NOT threaded (187-15 Task 1): widening
     * that pure module's signature is a separate decision, and its refusal sentence is a
     * SHAPE predicate rather than a node face. The consequence is real and is named rather
     * than buried — a user can be told "Run the Invoice Checker" on one notice and the
     * generic sentence on the next, in the same notice surface.
     *
     * RE-OPEN TRIGGER: Phase 188's `WorkflowCanvas.tsx` extraction, which reopens these
     * seams anyway. This row exists so the gap cannot be closed silently and then quietly
     * reopened — closing it reds this test, which is the point.
     */
    mockListFolders.mockResolvedValue([])
    mockListSkills.mockResolvedValue([{ id: CORPUS_SKILL_ID, name: SKILL_NAME }])
    await openCanvasFor({ ...definition, phases: structuredClone(branching) } as BuilderDefinition)
    await waitFor(() =>
      expect(screen.getByTestId("canvas-node-assess").textContent ?? "").toContain(
        `Run the ${SKILL_NAME}`,
      ),
    )

    fireEvent.click(screen.getByTestId("canvas-remove-escalate"))
    const refusal = await screen.findByTestId("canvas-notice-refusal")
    expect(refusal.textContent).toContain(nodeTitle(branching[1]))
    expect(refusal.textContent).not.toContain(`Run the ${SKILL_NAME}`)
  })
})

describe("WorkflowBuilderPage 187-15 — source guards for the thread", () => {
  it("the spine's context rides the SPREAD-CONDITIONAL, never a bare prop (D-14)", () => {
    expect(builderSource).toMatch(/canvasEnabled \? \{ nameContext \}/)
  })

  it("no second fetch was added for the maps", () => {
    // The context is built from data the mount effect already fetched once.
    expect(builderSource.match(/listFolders\(|listSkills\(/g) ?? []).toHaveLength(3)
  })

  it("both announcement callbacks re-declared their dependencies", () => {
    expect(builderSource).toMatch(/nodeTitle\(added, nameContext\)/)
    expect(builderSource).toMatch(/nodeTitle\(before\[at\], nameContext\)/)
    expect(builderSource.match(/\[store, nameContext\]/g) ?? []).toHaveLength(2)
  })
})

// ══════════════════════════════════════════════════════════════════════════════════
// Phase 187-15 Task 2 (VOCAB-02 / Req 5 / D-187-09) — THE SEED RECEIPT, MOUNTED
//
// APPENDED. Plan 187-13 built the component and mounted it nowhere; this block is the
// page's half — one boolean set beside the SINGLE `setDrafted` transition, so the receipt
// arrives in the same DOM batch as the graph and cannot imply progress, and one
// `canvasEnabled`-gated mount.
//
// THE GATE IS A CORRECTNESS REQUIREMENT, NOT SCOPE HYGIENE. `useGroundingBundle` is called
// with `canvasEnabled`, so flag-off `kbTools` is `[]` and every step would read as
// ungrounded — the receipt would claim zero grounded steps on a workflow that IS gated at
// run time. That is actively misleading.
// ══════════════════════════════════════════════════════════════════════════════════

describe("WorkflowBuilderPage 187-15 — the seed receipt arrives with the draft (Req 5)", () => {
  const ON = { features: { visual_workflow_canvas: true }, loading: false }
  const OFF = { features: {}, loading: false }

  /** A generated definition whose FIRST step reads the knowledge base, so the receipt has
   *  something honest to name. The tool id is the server's, handed in through the bundle. */
  const seededPhases = [
    {
      slug: "research",
      phase_index: 0,
      config: { phase_type: "llm_agent", available_tools: ["search_documents"] },
    },
    { slug: "brief", phase_index: 1, config: { phase_type: "llm_emit" } },
  ]
  const seededDef = { ...definition, phases: structuredClone(seededPhases) } as BuilderDefinition

  function renderFresh(
    features: { features: EffectiveFeatures; loading: boolean } = ON,
    props: Record<string, unknown> = {},
  ) {
    return render(
      <EffectiveFeaturesProvider value={{ ...features, refetch: vi.fn() }}>
        <div style={{ width: 1200, height: 800 }}>
          <WorkflowBuilderPage {...props} />
        </div>
      </EffectiveFeaturesProvider>,
    )
  }

  /**
   * Type a requirement and press the shipped CTA — the ONE forward path.
   *
   * ⚠ PHASE 193-08 (2026-08-13) — THIS LITERAL IS **CORRECT AS IT STANDS**, and the check was
   * run rather than assumed. `193-08` re-worded every governed door string to variant D and
   * re-captured three suites; this one stayed 128/128 green, unedited. The CTA named here is
   * `WorkflowBuilderPage.tsx:1527`'s OWN literal — this suite mounts the page DIRECTLY, never
   * through `WorkflowDoorSwitch` — so it is a genuinely different string from the door's
   * `DESCRIBE_CTA`, which now reads variant D. Two homes for the same words; only one moved.
   * Recorded as a deferred item with its trigger in `193-08-SUMMARY.md` § Deferred. Do NOT
   * "fix" this to the door's wording without moving the page's literal in the same commit —
   * that would red this row for a reason the page does not have.
   *
   * ── ✅ CLOSED SAME DAY (`294a2ac8`, operator-approved) — 193 REVIEW WR-03 ─────────────────
   *
   * **The condition the paragraph above set was met exactly.** The operator took the fix rather
   * than the deferral, and the page's own literal MOVED — so this query moved with it *in the
   * same commit*, which is precisely what that paragraph required before anyone touched it.
   *
   * What is true now: there is **no literal here and no second home**. The query below reads
   * `DESCRIBE_CTA` from `doorVocabulary`, the page renders the same id, and the deferral in
   * `193-08-SUMMARY.md` § Deferred is **spent**.
   *
   * ⚠ The paragraph above is kept rather than rewritten because its REASONING is still the rule:
   * a literal here and a literal on the page are two homes for one string, and moving either
   * alone reds this row for a reason the page does not have. The guard that now makes that
   * impossible is the D-24(a) copy fence, which gained `WorkflowBuilderPage.tsx` as its third
   * swept source (193 REVIEW WR-01) — a re-typed governed word in the page reds there first.
   */
  async function draftIt(text = "summarise the supplier renewals every week") {
    await screen.findByTestId("describe-hint")
    fireEvent.change(screen.getByLabelText("business requirement"), { target: { value: text } })
    fireEvent.click(screen.getByRole("button", { name: DESCRIBE_CTA }))
  }

  beforeEach(() => {
    // The SERVER's KB-tool list rides on the bundle; the receipt derives nothing of its own.
    mockBundle.mockResolvedValue({
      tools: ["search_documents"],
      folders: [],
      skills: [],
      degraded: [],
      kb_tools: ["search_documents"],
    })
    mockGenerate.mockResolvedValue({ ok: true, definition: structuredClone(seededDef) })
  })

  it("appears after a successful draft, naming the steps and the grounded one", async () => {
    renderFresh()
    await draftIt()

    const receipt = await screen.findByTestId("seed-receipt")
    expect(within(receipt).getByTestId("seed-receipt-heading").textContent ?? "").toContain("2")
    // The grounded step is named — per-step with its cause, never a summary count.
    expect(within(receipt).getByTestId("seed-receipt-step-research")).toBeInTheDocument()
    expect(within(receipt).queryByTestId("seed-receipt-step-brief")).toBeNull()
    // It arrives WITH the graph, in one batch — no timed reveal, nothing still deciding.
    expect(screen.getByTestId("builder-grid")).toBeInTheDocument()
  })

  it("dismissing hides it, and it does not come back while you keep working", async () => {
    renderFresh()
    await draftIt()
    const receipt = await screen.findByTestId("seed-receipt")

    fireEvent.click(within(receipt).getByTestId("seed-receipt-dismiss"))
    await waitFor(() => expect(screen.queryByTestId("seed-receipt")).toBeNull())

    // Keep working: flip to the canvas and back. The receipt stays gone.
    fireEvent.click(screen.getByTestId("builder-view-canvas"))
    await waitFor(() => expect(screen.getByTestId("canvas-node-research")).toBeInTheDocument(), LAZY)
    expect(screen.queryByTestId("seed-receipt")).toBeNull()
    fireEvent.click(screen.getByTestId("builder-view-spine"))
    expect(screen.queryByTestId("seed-receipt")).toBeNull()
  })

  it("appears on the autoDraft hand-off path too — it is a genuine AI seed", async () => {
    // D-187-14 / CONTEXT's open discretion, DECIDED here rather than discovered in UAT.
    // Both paths funnel through `onDraft`'s success branch, so this costs no extra line.
    renderFresh(ON, {
      initialDescribe: "summarise the supplier renewals every week",
      autoDraft: true,
    })
    expect(await screen.findByTestId("seed-receipt")).toBeInTheDocument()
    expect(mockGenerate).toHaveBeenCalledTimes(1)
  })

  it("with the canvas flag OFF it never renders — an ungated receipt would claim zero grounded steps", async () => {
    renderFresh(OFF)
    await draftIt()
    await waitFor(() => expect(screen.getByTestId("builder-grid")).toBeInTheDocument())
    expect(screen.queryByTestId("seed-receipt")).toBeNull()
    expect(screen.queryByTestId("seed-receipt-heading")).toBeNull()
  })

  it("a draft with NOTHING grounded still gets a receipt, with no grounded list (D-187-10)", async () => {
    mockGenerate.mockResolvedValue({
      ok: true,
      definition: {
        ...definition,
        phases: [{ slug: "brief", phase_index: 0, config: { phase_type: "llm_emit" } }],
      },
    })
    renderFresh()
    await draftIt()

    const receipt = await screen.findByTestId("seed-receipt")
    expect(within(receipt).getByTestId("seed-receipt-heading")).toBeInTheDocument()
    expect(within(receipt).queryByTestId("seed-receipt-grounded-list")).toBeNull()
    expect(within(receipt).queryByTestId("seed-receipt-grounding")).toBeNull()
  })

  it("an HONEST generate failure produces no receipt at all", async () => {
    mockGenerate.mockResolvedValue({ ok: false, error: "Couldn't generate the workflow." })
    renderFresh()
    await draftIt()

    await screen.findByTestId("generate-error")
    expect(screen.queryByTestId("seed-receipt")).toBeNull()
  })
})

// ══════════════════════════════════════════════════════════════════════════════════
// Phase 187-22 Task 1 (VOCAB-02 / Req 5) — CR-04: THE RECEIPT DESCRIBES ITS OWN
// GENERATION, AND NOTHING THAT HAPPENED AFTERWARDS
//
// APPENDED, a sibling of the 187-15 block above. Every sentence on the card is
// PAST-TENSE and FIRST-PERSON — "Here's what I built", "so I set them to must prove
// it", "N steps were already set". The shipped wiring handed the card the LIVE store
// selector, and `PhaseFormPanel` sits on the same screen writing the very field the
// card's grounding classification reads. So the author could switch a knowledge-base
// tool on ten seconds after the receipt arrived and watch it claim their own act as
// the AI's — CR-01's failure shape for the third time, on the one surface (SC#3) whose
// entire purpose is that safety is attributed to whoever actually applied it.
//
// THE FALSIFICATION LIVES HERE, AT THE PAGE, and not in `SeedReceipt.test.tsx`. The
// component is a PURE PROJECTION: every count and sentence is recomputed from the
// `phases` prop on every render. Hand it a mutated array directly and it recomputes,
// correctly, forever — so a component-level "the card must not change" case could only
// ever be made green by giving the leaf a hidden cache of its first props, which breaks
// a second generation's receipt and hides the caller bug instead of fixing it. The
// defect is in WHERE THE CARD READS FROM, which is the page's, so the fence is the
// page's. `SeedReceipt.test.tsx` carries the two properties the component genuinely
// owns (it is a pure projection, and a NEW snapshot replaces the old one).
//
// EACH CASE COMPARES AGAINST A CAPTURED ARRIVAL BASELINE, never a hand-typed sentence —
// a hand-typed expectation drifts in exactly the same silence the copy module exists to
// break. And each case asserts ITS EDIT LANDED before it asserts the card did not move:
// without that positive control the case passes trivially on the day the edit path stops
// working, which is a fence that measures nothing (WR-12).
// ══════════════════════════════════════════════════════════════════════════════════

describe("WorkflowBuilderPage 187-22 — CR-04: nothing the author does afterwards may change the receipt", () => {
  const ON = { features: { visual_workflow_canvas: true }, loading: false }

  /** The one KB-reading tool in this block's server palette — the tool the author
   *  switches ON in case 1, and the reason the agent step is UNGROUNDED at arrival. */
  const KB_TOOL = "search_documents"
  /** A tool that reads no documents, so naming it grounds nothing. */
  const PLAIN_TOOL = "execute_code"

  /**
   * A generated definition with ZERO sealed steps, so all three counts start at 0 and
   * each mutation below moves exactly one of them.
   *
   *  - `gather` is `programmatic` — no dial, nothing to prove.
   *  - `judge` is `llm_agent` reaching ONLY for a non-KB tool, so `groundingCauseOf` is
   *    `null`: not detected (no intersection) and not escalated (no stored bit). It is
   *    the step case 1 grounds and the step case 3 escalates.
   *  - `brief` is `llm_emit` carrying `citation_policy: "draft"` — a member of the
   *    backend Literal `["strict","flag","partial","draft"]` (`harness.py`), chosen
   *    because the SHIPPED DEFAULT `"strict"` would make it `already-set` and the draft
   *    would not start at zero.
   */
  const cr04Phases = [
    { slug: "gather", phase_index: 0, config: { phase_type: "programmatic" } },
    {
      slug: "judge",
      phase_index: 1,
      config: { phase_type: "llm_agent", available_tools: [PLAIN_TOOL] },
    },
    { slug: "brief", phase_index: 2, config: { phase_type: "llm_emit", citation_policy: "draft" } },
  ]
  const cr04Def = { ...definition, phases: structuredClone(cr04Phases) } as BuilderDefinition

  beforeEach(() => {
    // The SERVER's palette: both tools are offerable, only one of them reads documents.
    mockBundle.mockResolvedValue({
      tools: [KB_TOOL, PLAIN_TOOL],
      folders: [],
      skills: [],
      degraded: [],
      kb_tools: [KB_TOOL],
    })
    mockGenerate.mockResolvedValue({ ok: true, definition: structuredClone(cr04Def) })
  })

  /** Everything the card says, and every number it exposes — read as ONE value so a
   *  case cannot accidentally assert on three of the four things that can move. */
  type Arrival = {
    text: string
    grounded: string | null
    detected: string | null
    carried: string | null
  }
  function readReceipt(): Arrival {
    const card = screen.getByTestId("seed-receipt")
    return {
      text: card.textContent ?? "",
      grounded: card.getAttribute("data-grounded-count"),
      detected: card.getAttribute("data-detected-count"),
      carried: card.getAttribute("data-carried-count"),
    }
  }

  /** The node ROOTS only. `[data-testid^='canvas-node-']` alone also matches a card's
   *  `canvas-node-seal` / `-verdict` / `-technical-line` children, so the `[data-slug]`
   *  qualifier is what makes "one more node" a statement about steps. */
  const nodeSlugs = () =>
    Array.from(document.querySelectorAll("[data-testid^='canvas-node-'][data-slug]")).map(
      (n) => n.getAttribute("data-slug") ?? "",
    )

  /** The KB chip in the open inspector, RESOLVED rather than assumed. */
  function kbChip(): HTMLElement {
    const found = screen
      .getAllByTestId("tool-option")
      .find((el) => el.getAttribute("data-tool") === KB_TOOL)
    if (!found) throw new Error(`the panel offers no "${KB_TOOL}" chip`)
    return found
  }

  /**
   * Draft through the ONE shipped forward path, capture the arrival baseline the moment
   * the card lands, then switch to the canvas so the shipped edit affordances are
   * reachable. Switching views is not an edit — the baseline is taken before it anyway.
   */
  async function draftAndOpenCanvas(): Promise<Arrival> {
    render(
      <EffectiveFeaturesProvider value={{ ...ON, refetch: vi.fn() }}>
        <div style={{ width: 1200, height: 800 }}>
          <WorkflowBuilderPage />
        </div>
      </EffectiveFeaturesProvider>,
    )
    await screen.findByTestId("describe-hint")
    fireEvent.change(screen.getByLabelText("business requirement"), {
      target: { value: "summarise the supplier renewals every week" },
    })
    fireEvent.click(screen.getByRole("button", { name: DESCRIBE_CTA }))

    await screen.findByTestId("seed-receipt")
    const arrival = readReceipt()
    // The draft really did start at zero — otherwise a mutation could move a count that
    // was already non-zero and the comparison would be weaker than it looks.
    expect(arrival.grounded).toBe("0")
    expect(arrival.detected).toBe("0")
    expect(arrival.carried).toBe("0")

    fireEvent.click(screen.getByTestId("builder-view-canvas"))
    await waitFor(() => expect(screen.getByTestId("canvas-node-judge")).toBeInTheDocument(), LAZY)
    return arrival
  }

  /** Select a step the way this suite always does: click its card, wait for its panel. */
  async function selectStep(slug: string) {
    fireEvent.click(screen.getByTestId(`canvas-node-${slug}`))
    await waitFor(
      () => expect(screen.getByLabelText(`Refine step: ${slug}`)).toBeInTheDocument(),
      LAZY,
    )
  }

  it("CR-04 path 1 — switching a KB tool ON afterwards does not make the card claim it", async () => {
    const arrival = await draftAndOpenCanvas()
    await selectStep("judge")

    expect(kbChip()).toHaveAttribute("aria-pressed", "false")
    fireEvent.click(kbChip())

    // POSITIVE CONTROL — the edit LANDED, in the panel and on the canvas both. A case
    // that skipped this would go green the day the whitelist rail stopped committing.
    await waitFor(() => expect(kbChip()).toHaveAttribute("aria-pressed", "true"))
    await waitFor(() =>
      expect(
        within(screen.getByTestId("canvas-node-judge")).getByTestId("canvas-node-seal"),
      ).toBeInTheDocument(),
    )

    // …and the receipt is a statement about the generation, so it did not move.
    expect(readReceipt()).toEqual(arrival)
  })

  it("CR-04 path 2 — a step the AUTHOR adds is not counted by the card's heading", async () => {
    const arrival = await draftAndOpenCanvas()
    const before = nodeSlugs()
    expect(before).toHaveLength(3)

    fireEvent.click(screen.getByTestId("canvas-insert-2"))
    fireEvent.click(screen.getByTestId("step-type-choice-llm_single"))

    // POSITIVE CONTROL — the graph really gained a step.
    await waitFor(() => expect(nodeSlugs()).toHaveLength(4))

    expect(readReceipt()).toEqual(arrival)
  })

  it("CR-04 path 3 — flipping the grounding dial ON afterwards does not join the carried count", async () => {
    const arrival = await draftAndOpenCanvas()
    await selectStep("judge")

    const strict = screen.getByTestId("governance-dial-strict")
    expect(strict).toHaveAttribute("aria-pressed", "false")
    fireEvent.click(strict)

    // POSITIVE CONTROL — the author's escalation landed, and the canvas seal followed.
    await waitFor(() =>
      expect(screen.getByTestId("governance-dial-strict")).toHaveAttribute("aria-pressed", "true"),
    )
    await waitFor(() =>
      expect(
        within(screen.getByTestId("canvas-node-judge")).getByTestId("canvas-node-seal"),
      ).toBeInTheDocument(),
    )

    // The carried paragraph stays ABSENT and its count stays at its arrival value: the
    // author turned this on, and the card must not say "was already set to".
    expect(screen.queryByTestId("seed-receipt-carried")).toBeNull()
    expect(readReceipt()).toEqual(arrival)
  })

  it("SOURCE FENCE — the card is handed the arrival snapshot, and the snapshot is taken beside setDrafted", () => {
    /**
     * 187-22 Task 3. The three cases above catch the defect through behaviour. This
     * catches the REVERT: swapping the prop back to the live selector changes no DOM any
     * render test notices until an edit happens, so a future refactor could undo the fix
     * and only these three cases — which a hurried author might delete as "flaky canvas
     * tests" — would object. A source pin costs one assertion and objects immediately.
     *
     * The needles are ASSEMBLED FROM PARTS, this file's shipped idiom, so a grep of the
     * guard cannot satisfy the guard.
     */
    const LIVE_SELECTOR = ["phases={", "phases}"].join("")
    const SNAPSHOT_PROP = ["phases={", "receiptPhases}"].join("")
    const SETTER = ["setReceipt", "Phases(def.phases)"].join("")
    const TRANSITION = ["setDrafted", "(def)"].join("")

    // The `<SeedReceipt …/>` element, extracted rather than searched for file-wide: the
    // live selector is CORRECT on the canvas and the spine, which are the live ledger of
    // current governance. It is wrong on exactly one element, so the fence reads exactly
    // that one.
    const element = builderSource.match(/<SeedReceipt\b[\s\S]*?\/>/)?.[0] ?? ""
    // A regex that matched nothing would make every assertion below vacuous.
    expect(element).toContain("kbTools")

    expect(element).not.toContain(LIVE_SELECTOR)
    expect(element).toContain(SNAPSHOT_PROP)

    // POSITIVE CONTROL — the pattern really would have fired on the shipped-before wiring.
    const OLD_MOUNT = `<SeedReceipt\n        ${LIVE_SELECTOR}\n        kbTools={kbTools}\n      />`
    expect(OLD_MOUNT).toContain(LIVE_SELECTOR)
    expect(OLD_MOUNT).not.toContain(SNAPSHOT_PROP)

    // …and the snapshot is taken in `onDraft`'s success branch, beside the SINGLE state
    // transition — not in an effect that could observe an already-edited store.
    //
    // ⚠ 193.1-05 (D-01) — THE FENCE IS RE-SCOPED, NOT WEAKENED, AND THE REASON IS THE WHOLE
    // POINT OF RE-SCOPING IT. `onDraft` and its `setDrafted(def)` transition moved to
    // `useTemplateFirstDraft` when G-5 was honoured on this page, so `builderSource.indexOf`
    // returned **-1** and this assertion failed loudly — which is the fence working. It could
    // have been "fixed" by deleting the adjacency half, and that would have retired the only
    // guard against the snapshot drifting into an effect. Instead the property is restated
    // ACROSS the seam, in the two places its two halves now live:
    //
    //   in the HOOK — the raise happens beside the transition, in the same batch;
    //   on the PAGE — the raise IS the snapshot write, and there is exactly one of it.
    //
    // A fence whose subject moved and which was not re-scoped is the WR-01 failure one
    // surface over: it keeps passing, against nothing.
    const RAISE = ["onDrafted", "Ref.current(def)"].join("")
    const atTransition = templateFirstDraftSource.indexOf(TRANSITION)
    expect(atTransition).toBeGreaterThan(-1)
    // 500 chars is "the next few lines, comments included" — measured, not guessed: the
    // shipped comment block between the transition and the raise runs to ~330 characters on
    // its own. Wide enough to survive a re-worded comment, far too narrow to reach another
    // function.
    expect(templateFirstDraftSource.slice(atTransition, atTransition + 500)).toContain(RAISE)
    // POSITIVE CONTROL — the window really can miss, so the pass above is a measurement
    // rather than an artefact of an over-wide slice.
    expect(templateFirstDraftSource.slice(atTransition, atTransition + 20)).not.toContain(RAISE)
    // Exactly one raise, so no second site can hand the page a later state…
    expect(
      templateFirstDraftSource.match(new RegExp(RAISE.replace(/[().]/g, "\\$&"), "g")) ?? [],
    ).toHaveLength(1)
    // …and exactly one write on the page, inside the callback that raise reaches.
    expect(builderSource.match(new RegExp(SETTER.replace(/[().]/g, "\\$&"), "g")) ?? []).toHaveLength(1)
    const CALLBACK = ["onDrafted", ": (def) => {"].join("")
    const atCallback = builderSource.indexOf(CALLBACK)
    expect(atCallback).toBeGreaterThan(-1)
    expect(builderSource.slice(atCallback, atCallback + 200)).toContain(SETTER)
  })
})

describe("WorkflowBuilderPage 187-15 — source guards for the two mounts", () => {
  it("still names NO browser-storage API — D-187-09's useState is structural", () => {
    // The shipped guard, restated where the receipt's dismissal decision lives: a
    // `localStorage` key per draft id would fail here, which is why the in-memory boolean
    // is required rather than merely preferred.
    expect(builderSource).not.toMatch(/localStorage/)
    expect(builderSource).not.toMatch(/sessionStorage/)
    expect(builderSource).not.toMatch(/indexedDB/)
    expect(builderSource).not.toMatch(/document\.cookie/)
  })

  it("the graph keeps the fillable row even when the receipt renders NOTHING", () => {
    /**
     * A LAYOUT BUG JSDOM CANNOT SEE, so it is pinned at the source. The receipt sits in the
     * graph column's grid, and a DISMISSED receipt returns `null` — no DOM node — so grid
     * auto-placement would drop the graph into the second `auto` row and collapse it. The
     * column therefore declares three rows AND pins its LAST child (always the graph) to
     * the `minmax(0,1fr)` one, rather than trusting the receipt to occupy a slot.
     */
    expect(builderSource).toMatch(/grid-rows-\[auto_auto_minmax\(0,1fr\)\]/)
    expect(builderSource).toMatch(/\[&>\*:last-child\]:row-start-3/)
  })

  it("mounts each surface exactly once, and adds no helper or component beside them", () => {
    expect(builderSource.match(/<SeedReceipt\b/g) ?? []).toHaveLength(1)
    expect(builderSource.match(/<StarterTemplatePicker\b/g) ?? []).toHaveLength(1)
    // The door writes into the describe box and nothing else — the seam is `setDescribe`,
    // never `initialDescribe` (an UPSTREAM prop that is not settable from inside the page).
    expect(builderSource).toMatch(/onChoose=\{setDescribe\}/)
  })
})

// ══════════════════════════════════════════════════════════════════════════════════
// Phase 187-27 (GAP B · VOCAB-02) — THE CHECK RUNS ON OPEN, AND UNTIL IT ANSWERS
// PUBLISH SAYS SO
//
// APPENDED; everything above this line is untouched except one added import statement
// and the in-place rewrite of the two shipped cases that PINNED the defect (each named
// in the plan's summary, none deleted).
//
// THE MEASURED DEFECT. Opening an existing draft into the canvas issued ZERO
// `POST /workflows/validate` calls — the operator's own session recorded
// `validateCallsMade: 0` — and yet the tray read *"Nothing to fix — the static checks
// pass · checked by the server"* and Publish stayed ENABLED, for a definition the server
// marks `ok:false` the moment it is asked. That is verbatim the shape the page's own
// `blockedReason` docblock forbids: *a check that did NOT RUN must never unblock a
// publish (D-184-14, fail-closed)*. The rule as shipped covered `degraded` and did not
// cover NEVER-RAN.
//
// BOTH HALVES SHIP TOGETHER, because either alone is wrong. Fail-closed alone would
// leave every opened draft permanently unpublishable until the author made a pointless
// edit — a fail-closed state a person cannot escape is a new defect, not a fix.
// Validate-on-open alone leaves the debounce-plus-request window lying, and leaves the
// lie standing outright while the first request is in flight.
//
// D-184-15 IS NARROWED, DELIBERATELY AND IN THE OPEN, NOT OVERRULED. Its stated reason
// is that *a brand-new zero-step draft is never greeted with a not-ok envelope and a
// full problems tray* — a statement about an EMPTY draft. `phases.length > 0` preserves
// it exactly, and the zero-step case below proves it rather than claiming it. D-181-01 is
// preserved by `canvasEnabled &&`, and that half-line gets its own falsification.
// ══════════════════════════════════════════════════════════════════════════════════

describe("WorkflowBuilderPage 187-27 — GAP B: opening a draft ASKS, and the window fails closed", () => {
  /** A promise this file settles by hand, so "while the answer is outstanding" is a state
   *  the case CONTROLS rather than a race it hopes to win. */
  function deferred<T>() {
    let settle!: (value: T) => void
    const promise = new Promise<T>((resolve) => {
      settle = resolve
    })
    return { promise, settle }
  }

  /** The real gauntlet through the shipped `renderPublish` seam — the same composition
   *  the 184-11 R12 block uses, so the trigger and its reason are the composed surface. */
  function renderPublishable(
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

  const zeroStepDraft: BuilderDefinition = { ...definition, phases: [] }

  it("VALIDATE-ON-OPEN — mounting a drafted definition WITH steps asks the server, on no edit at all", async () => {
    renderPublishable(FLAG_ON)
    await screen.findByTestId("builder-view-toggle")

    // The measurement that returned 0 in the operator's session. `waitFor` clears the
    // loop's own 500 ms debounce, so a green here is an issued request and not a guess.
    await waitFor(() => expect(mockValidate.mock.calls.length).toBeGreaterThanOrEqual(1), {
      timeout: 3000,
    })
    // …and nothing was EDITED to cause it: no field was changed and no write was made.
    expect(mockUpdate).toHaveBeenCalledTimes(0)
    expect(mockCreate).toHaveBeenCalledTimes(0)
    expect(mockGenerate).toHaveBeenCalledTimes(0)
  })

  it("THE FAIL-CLOSED WINDOW — while the answer is outstanding, Publish is DISABLED and names why", async () => {
    const answer = deferred<{ ok: boolean; verdicts: never[] }>()
    mockValidate.mockReturnValue(answer.promise)

    renderPublishable(FLAG_ON)
    const trigger = await screen.findByTestId("publish-trigger")

    // Before the debounce even elapses — nobody has asked yet, so nothing may be claimed.
    expect(trigger).toBeDisabled()
    const reason = screen.getByTestId("publish-blocked-reason")
    expect(reason.textContent).toBe(DEGRADED_SENTENCE["not-run"])
    // R12: greying alone is not enough — the reason must be REACHABLE from the control.
    expect(trigger.getAttribute("aria-describedby")).toBe(reason.getAttribute("id"))

    // …and it is STILL the reason once the request is genuinely in flight, which is the
    // half validate-on-open alone would have left lying.
    await waitFor(() => expect(mockValidate).toHaveBeenCalled(), { timeout: 3000 })
    expect(screen.getByTestId("publish-blocked-reason").textContent).toBe(
      DEGRADED_SENTENCE["not-run"],
    )
    expect(screen.getByTestId("publish-trigger")).toBeDisabled()
  })

  it("…and an ok:true answer RELEASES it — the window closes on its own, with no author edit", async () => {
    // The half that makes fail-closed liveable: an author who opens a healthy draft is
    // never asked to make a pointless edit to escape a refusal.
    mockValidate.mockResolvedValue({ ok: true, verdicts: [] })
    renderPublishable(FLAG_ON)

    await waitFor(() => expect(screen.getByTestId("publish-trigger")).not.toBeDisabled(), {
      timeout: 3000,
    })
    expect(screen.queryByTestId("publish-blocked-reason")).toBeNull()
  })

  it("…and an ok:false answer names the VERDICT verbatim, never the unchecked sentence", async () => {
    // `unbound_retrieval` is the finding that made this window routinely non-empty — a
    // freshly-opened draft commonly carries it, which is why the lie was not rare.
    const message = "This step reads your documents, but no knowledge base is bound."
    mockValidate.mockResolvedValue({
      ok: false,
      verdicts: [
        { code: "unbound_retrieval", phase: "research", message, severity: "error" },
      ],
    })
    renderPublishable(FLAG_ON)

    await waitFor(
      () => expect(screen.getByTestId("publish-blocked-reason").textContent).toBe(message),
      { timeout: 3000 },
    )
    expect(screen.getByTestId("publish-trigger")).toBeDisabled()
    expect(screen.getByTestId("publish-blocked-reason").textContent).not.toBe(
      DEGRADED_SENTENCE["not-run"],
    )
  })

  it("D-181-01 — with the flag OFF the VERY SAME open issues ZERO validate requests", async () => {
    // THE PIN THAT GUARDS THE HALF-LINE. Without `canvasEnabled &&` in the enabled
    // expression a flag-off Builder would issue a request it does not issue today, and
    // "byte-identical to today" would be false. Observed RED by deleting that guard.
    renderPublishable(FLAG_OFF)
    await waitFor(() => expect(screen.getByTestId("builder-grid")).toBeInTheDocument())

    // Well past the 500 ms debounce, so "zero" is not "not yet".
    await new Promise((resolve) => setTimeout(resolve, 900))
    expect(mockValidate).toHaveBeenCalledTimes(0)

    // …and the flag-off publish trigger is the control that shipped: enabled, unexplained.
    expect(screen.getByTestId("publish-trigger")).not.toBeDisabled()
    expect(screen.queryByTestId("publish-blocked-reason")).toBeNull()
  })

  it("D-184-15 SURVIVES — a ZERO-STEP draft still asks nothing, and still gets its invitation", async () => {
    // The narrowing is PROVED here rather than claimed: the empty canvas keeps its
    // invitation, which is not a claimed verdict and therefore not client-side validation.
    renderPublishable(FLAG_ON, zeroStepDraft)
    const trigger = await screen.findByTestId("publish-trigger")

    await new Promise((resolve) => setTimeout(resolve, 900))
    expect(mockValidate).toHaveBeenCalledTimes(0)
    expect(trigger).toBeDisabled()
    expect(screen.getByTestId("publish-blocked-reason").textContent).toBe(EMPTY_DRAFT_INVITATION)
    expect(screen.getByTestId("publish-blocked-reason").textContent).not.toBe(
      DEGRADED_SENTENCE["not-run"],
    )
  })

  it("THE TRAY AGREES WITH THE TRIGGER — one never-ran state, never two stories", async () => {
    const answer = deferred<{ ok: boolean; verdicts: never[] }>()
    mockValidate.mockReturnValue(answer.promise)

    renderPublishable(FLAG_ON)
    await screen.findByTestId("builder-view-toggle")
    fireEvent.click(screen.getByTestId("builder-view-canvas"))
    await waitFor(() => expect(screen.getByTestId("problems-tray")).toBeInTheDocument(), LAZY)

    // The canvas session carries the SAME cause the publish trigger is reading, so the
    // bottom of the screen and the top of it cannot tell a person two different things.
    expect(screen.getByTestId("problems-tray").getAttribute("data-degraded")).toBe("not-run")
    expect(screen.getByTestId("problems-tray-degraded").textContent).toBe(
      DEGRADED_SENTENCE["not-run"],
    )
    // The two affordances the operator actually saw on this screen are both gone.
    expect(screen.queryByTestId("problems-tray-counts")).toBeNull()
    expect(screen.getByTestId("problems-tray").textContent ?? "").not.toContain(
      "checked by the server",
    )
    expect(screen.getByTestId("publish-trigger")).toBeDisabled()
    expect(screen.getByTestId("publish-blocked-reason").textContent).toBe(
      DEGRADED_SENTENCE["not-run"],
    )
  })
})

// ══════════════════════════════════════════════════════════════════════════════════
// Phase 187-28 (GAP C · VOCAB-02) — A ROUTE-ASSIGNED VERDICT GATES THE PUBLISH CONTROL
//
// APPENDED; everything above this line is untouched.
//
// THE CLAIM THIS BLOCK EXISTS TO PIN. `backend/app/api/workflows.py`'s comment above
// `_ROUTE_ASSIGNED_CODES` used to say those three codes were confined to the canvas and
// therefore left publishing untouched from the author's seat. Measured live on 2026-08-04:
// a draft whose SOLE verdict is `unbound_retrieval` renders `publish-trigger.disabled ===
// true` with the server's message verbatim beside it. The operator's decision was that the
// BEHAVIOUR is right — blocking an unbound retrieval workflow before a golden run is spent
// is what `BUG-260731-03` asked for — and the COMMENT was wrong. 187-28 corrected the
// comment; this block is the half of the evidence that keeps it corrected.
//
// WHY THIS IS NOT COVERED BY WHAT ALREADY SHIPS. Two nearby cases look like it and are not:
//   * 184-11's "the reason is the FIRST verdict's message VERBATIM" sends a MIXED list, so
//     the `.find(v => v.severity !== "incomplete")` arm matches and the fallback is never
//     exercised.
//   * 187-27's "…an ok:false answer names the VERDICT verbatim" sends `unbound_retrieval`
//     at severity `"error"` — again the `.find` arm.
// The route classifies `unbound_retrieval` as `incomplete` (D-182-03 / D-187-11), so the
// SHIPPING shape is an `incomplete`-ONLY envelope, which reaches the button only through
// `?? validation.verdicts[0]`. That half-expression is the entire mechanism of GAP C and
// nothing was measuring it. Observed RED by deleting it (probe P-27).
//
// THE CONTROLS ARE THE POINT. A single green case here would not distinguish "an
// incomplete-only ok:false blocks" from "a non-empty tray blocks" or from "the page blocks
// whenever the loop has answered at all". The two controls below rule both out.
// ══════════════════════════════════════════════════════════════════════════════════

describe("WorkflowBuilderPage 187-28 — a route-assigned verdict GATES the Publish control", () => {
  /** The real gauntlet through the shipped `renderPublish` seam — the composed surface the
   *  184-11 R12 and 187-27 blocks both measure, so the trigger and its reason are real. */
  function renderPublishable(features: { features: EffectiveFeatures; loading: boolean }) {
    return render(
      <EffectiveFeaturesProvider value={{ ...features, refetch: vi.fn() }}>
        <div style={{ width: 1200, height: 800 }}>
          <WorkflowBuilderPage
            initial={{ definition, draftId: "draft-1" }}
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

  /** The route's OWN wording for the D-187-11 verdict, kept in the shape
   *  `backend/app/api/workflows.py` mints it (`phase '<slug>' reads your documents, but
   *  this workflow is not bound to a knowledge base — it would search everything`). The
   *  string matters only in that the client must reproduce it BYTE FOR BYTE: the page never
   *  rewrites, maps or re-words a server verdict (D-182-06 — the client never classifies). */
  const UNBOUND_MESSAGE =
    "phase 'research' reads your documents, but this workflow is not bound to a knowledge " +
    "base — it would search everything"

  it("an ok:false whose SOLE verdict is an INCOMPLETE route-assigned code disables Publish", async () => {
    // The exact envelope the live Builder receives for an unbound retrieval draft: one
    // verdict, severity `incomplete`, nothing else. This is the shape the old comment said
    // could not reach publishing.
    mockValidate.mockResolvedValue({
      ok: false,
      verdicts: [
        {
          code: "unbound_retrieval",
          phase: "research",
          message: UNBOUND_MESSAGE,
          severity: "incomplete",
        },
      ],
    })
    renderPublishable(FLAG_ON)

    const reason = await screen.findByTestId("publish-blocked-reason", undefined, {
      timeout: 3000,
    })
    await waitFor(() => expect(reason.textContent).toBe(UNBOUND_MESSAGE), { timeout: 3000 })

    // VERBATIM — not rewritten, not mapped, not softened because the severity is grey.
    expect(reason.textContent).toBe(UNBOUND_MESSAGE)
    const trigger = screen.getByTestId("publish-trigger")
    expect(trigger).toBeDisabled()
    // R12: greying alone is not enough — the reason must be REACHABLE from the control.
    expect(trigger.getAttribute("aria-describedby")).toBe(reason.getAttribute("id"))
    // …and it is the SERVER's sentence, never the never-ran one: the check DID run here.
    expect(reason.textContent).not.toBe(DEGRADED_SENTENCE["not-run"])
  })

  it("CONTROL A — a MIXED list still leads with the error, so incompletes are not merely 'first'", async () => {
    // Ranked ordering is the shipped behaviour (184-11 R12) and it is asserted HERE too, so
    // the case above cannot be "fixed" later by dropping incompletes from consideration: any
    // such change reds the case above, and this one proves the ordering it would claim to
    // protect is already intact without it.
    mockValidate.mockResolvedValue({
      ok: false,
      verdicts: [
        {
          code: "unbound_retrieval",
          phase: "research",
          message: UNBOUND_MESSAGE,
          severity: "incomplete",
        },
        {
          code: "orphan_phase",
          phase: "draft",
          message: "Nothing leads to this step.",
          severity: "error",
        },
      ],
    })
    renderPublishable(FLAG_ON)

    await waitFor(
      () =>
        expect(screen.getByTestId("publish-blocked-reason").textContent).toBe(
          "Nothing leads to this step.",
        ),
      { timeout: 3000 },
    )
    // The error wins even though the server listed the incomplete one FIRST.
    expect(screen.getByTestId("publish-blocked-reason").textContent).not.toBe(UNBOUND_MESSAGE)
    expect(screen.getByTestId("publish-trigger")).toBeDisabled()
  })

  it("CONTROL B — ok:true with ZERO verdicts leaves Publish ENABLED on the very same mount", async () => {
    // Rules out the vacuous reading of the first case. Same definition, same composition,
    // same settled loop — only the envelope differs. So the block above is provably about
    // `ok:false`, and not about "the loop answered" or "the tray is non-empty".
    mockValidate.mockResolvedValue({ ok: true, verdicts: [] })
    renderPublishable(FLAG_ON)

    await waitFor(() => expect(screen.getByTestId("publish-trigger")).not.toBeDisabled(), {
      timeout: 3000,
    })
    expect(screen.queryByTestId("publish-blocked-reason")).toBeNull()
  })

  it("the SERVER gate is a different surface — the client shows a reason, it does not judge", async () => {
    // The other half of the corrected comment, from the client's side. The page renders the
    // server's string and nothing else: no severity is re-derived, no code is interpreted,
    // and the message is not assembled locally (D-182-06 — the client never classifies).
    // A page that built this sentence itself would keep working with the server silent,
    // which is exactly the drift `blockedReason` must never acquire.
    expect(builderSource).not.toMatch(/unbound_retrieval/)
    expect(builderSource).not.toMatch(/not bound to a knowledge base/)
    // POSITIVE CONTROL — the matcher really would catch a locally-authored copy.
    expect("      if (code === \"unbound_retrieval\") return LOCAL_COPY").toMatch(
      /unbound_retrieval/,
    )
  })
})

// ── BUG-260809-02 — the business requirement is REACHABLE from the canvas door ────
//
// Quick task 260809-klo. APPENDED; no existing `it(` above is edited or renamed.
//
// THE BUG. A workflow authored on the CANVAS could never be published. The publish
// gauntlet's stage 1 refuses without `business_requirement`, and the field was reachable
// from the NL door (the model emits it) and the template door (the seed row carries it)
// and from NOWHERE ELSE. The operator hit it on live cloud minutes after the v3.6 deploy,
// on a draft they had built by hand, and the refusal named an internal field with no
// control anywhere to satisfy it.
//
// WHAT THESE ROWS ASSERT, AND WHY IT IS THE PAYLOAD AND NOT THE DOM. The load-bearing
// case reads the argument actually handed to `updateWorkflowDraft`. A controlled input
// echoing its own prop proves only that React works; the claim that closes this bug is
// that the typed sentence reaches the PATCH BODY — because that is what the publish
// gauntlet later reads back off the stored row.
//
// ⚠ `WorkflowBuilderPage.header.test.tsx` gets NO edit. Its byte-for-byte flag-off
// `<header>` pin passing UNCHANGED is the evidence D-181-01 still holds; if it reds, the
// `canvasEnabled` gate on the new control is wrong — fix the gate, never the pin.

describe("WorkflowBuilderPage — the business requirement reaches the PATCH body (BUG-260809-02)", () => {
  /** The bug's own starting condition: a hand-built draft with no requirement at all. */
  function withoutRequirement(): BuilderDefinition {
    const { business_requirement: _omitted, ...rest } = definition
    return rest as BuilderDefinition
  }

  function renderRequirement(
    features: { features: EffectiveFeatures; loading: boolean },
    def: BuilderDefinition = withoutRequirement(),
  ) {
    return render(
      <EffectiveFeaturesProvider value={{ ...features, refetch: vi.fn() }}>
        <div style={{ width: 1200, height: 800 }}>
          <WorkflowBuilderPage initial={{ definition: def, draftId: "draft-1" }} />
        </div>
      </EffectiveFeaturesProvider>,
    )
  }

  it("THE BEHAVIOUR GUARD — the typed sentence is in the argument handed to updateWorkflowDraft", async () => {
    renderRequirement(FLAG_ON)
    const input = await screen.findByTestId("business-requirement-input")

    fireEvent.change(input, { target: { value: "Summarise vendor risk each Monday." } })
    await waitFor(() => expect(mockUpdate).toHaveBeenCalledTimes(1), { timeout: 5000 })

    // Asserted on the RECORDED CALL ARGUMENT, never on a DOM value — a controlled input
    // echoing its own prop would pass a DOM read while the payload stayed empty.
    const [, sent] = mockUpdate.mock.calls[0] as [string, BuilderDefinition, unknown]
    expect(sent.business_requirement).toBe("Summarise vendor risk each Monday.")
    // The endpoint takes a COMPLETE WorkflowDefinition with `phases` required, so a write
    // that truncated them would trade this bug for a worse one.
    expect(sent.phases).toHaveLength(definition.phases.length)
  })

  it("THE RELOAD ROUND TRIP — a stored requirement renders back into the control", async () => {
    // Open seeds the store through the same `{ phases, ...initialMeta }` destructure the
    // PATCH body is rebuilt from, so this is what proves the field SURVIVES a reload
    // rather than merely being sent once.
    renderRequirement(FLAG_ON, { ...withoutRequirement(), business_requirement: "Draft the board risk memo." })

    const input = (await screen.findByTestId("business-requirement-input")) as HTMLInputElement
    expect(input.value).toBe("Draft the board risk memo.")
  })

  it("the SERVER's requirement verdict is relayed verbatim and un-blocks on the SERVER's answer", async () => {
    // The verdict is the SERVER's (`workflows.py:712-721`) and the client adds no rule of
    // its own — D-182-06. So the block is driven by the stub, and it clears when the STUB
    // flips, never because the client decided the sentence was long enough.
    const message = "a workflow must declare exactly one business_requirement before publish"
    mockValidate.mockResolvedValue({
      ok: false,
      verdicts: [
        { code: "business_requirement", phase: null, severity: "incomplete", message },
      ],
    })

    render(
      <EffectiveFeaturesProvider value={{ ...FLAG_ON, refetch: vi.fn() }}>
        <div style={{ width: 1200, height: 800 }}>
          <WorkflowBuilderPage
            initial={{ definition: withoutRequirement(), draftId: "draft-1" }}
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

    await waitFor(
      () => expect(screen.getByTestId("publish-blocked-reason").textContent).toBe(message),
      { timeout: 3000 },
    )
    expect(screen.getByTestId("publish-trigger")).toBeDisabled()

    // The server changes its mind — the only thing that may release the gate.
    mockValidate.mockResolvedValue({ ok: true, verdicts: [] })
    fireEvent.change(await screen.findByTestId("business-requirement-input"), {
      target: { value: "Summarise vendor risk each Monday." },
    })

    await waitFor(() => expect(screen.queryByTestId("publish-blocked-reason")).toBeNull(), {
      timeout: 5000,
    })
    expect(screen.getByTestId("publish-trigger")).not.toBeDisabled()
  })

  it("D-181-01 — the control is ABSENT with the flag OFF, and PRESENT with it ON", async () => {
    // The negative WITH its positive control, in one test: a `queryByTestId(...) === null`
    // assertion alone passes just as happily against a control that was never built.
    renderRequirement(FLAG_OFF)
    await waitFor(() => expect(screen.getByTestId("builder-grid")).toBeInTheDocument())
    expect(screen.queryByTestId("builder-business-requirement")).toBeNull()
    expect(screen.queryByTestId("business-requirement-input")).toBeNull()

    cleanup()

    renderRequirement(FLAG_ON)
    expect(await screen.findByTestId("builder-business-requirement")).toBeInTheDocument()
    expect(screen.getByTestId("business-requirement-input")).toBeInTheDocument()
  })

  it("typing flips hasEdited — the live check starts on a Builder that had issued none", async () => {
    // A zero-step draft is the one open that issues NO validate on mount (the loop's
    // enable is `hasEdited || (canvasEnabled && phases.length > 0)`), which is what makes
    // "had issued none" a measured premise rather than a hopeful one.
    renderRequirement(FLAG_ON, { ...withoutRequirement(), phases: [] })
    await screen.findByTestId("builder-view-toggle")
    expect(mockValidate).toHaveBeenCalledTimes(0)

    fireEvent.change(await screen.findByTestId("business-requirement-input"), {
      target: { value: "Summarise vendor risk each Monday." },
    })

    // Without the call-site `setHasEdited(true)` a fresh Open plus one requirement edit
    // would leave the loop silent for the rest of the session.
    await waitFor(() => expect(mockValidate.mock.calls.length).toBeGreaterThanOrEqual(1), {
      timeout: 5000,
    })
  })
})
