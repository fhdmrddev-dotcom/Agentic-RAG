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
vi.mock("@/lib/api", () => ({
  generateWorkflow: mockGenerate,
  createWorkflowDraft: mockCreate,
  updateWorkflowDraft: mockUpdate,
  listFolders: mockListFolders,
  listSkills: mockListSkills,
}))

// The component SOURCE via Vite's ?raw loader — the idiomatic way to make a scope
// fence machine-checkable (the `PhaseSpineGraph.test.tsx:20-22` precedent).
import builderSource from "./WorkflowBuilderPage?raw"
import { WorkflowBuilderPage, type BuilderDefinition } from "./WorkflowBuilderPage"
import { EffectiveFeaturesProvider } from "@/providers/EffectiveFeaturesProvider"
import type { EffectiveFeatures } from "@/lib/api"
import { researchSummarize } from "@/components/workflows/__fixtures__/canvasFixtures"

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
