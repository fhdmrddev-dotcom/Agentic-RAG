/**
 * Phase 184-13 Task 3 (R12 · R9 · VALID-03 · sketch 141-B + 139-A) — the composition
 * proof.
 *
 * WHAT THIS FILE IS FOR, AND WHAT IT DELIBERATELY CANNOT DO. R12 is *"at 900px: exactly
 * one bottom-edge region, no horizontal overflow"*. jsdom applies no stylesheet and lays
 * nothing out: every element it reports is zero by zero, so a `scrollWidth > clientWidth`
 * check here would pass on a surface that overflows catastrophically in a browser and
 * fail on one that does not. Faking a measurement and calling it R12 would be the "gate
 * that lies" failure this phase has now named in six plans.
 *
 * So the split is stated rather than fudged:
 *  - STRUCTURE is asserted here, mechanically — how many bottom regions exist, how many
 *    direct rows each has open and closed, what the region emits, what `editable: false`
 *    renders, and that no element inside the canvas column declares a fixed width wider
 *    than a 900px container.
 *  - The VISUAL half — that nothing actually overflows at 900px, and that the toolbar
 *    really is the bottom-most row with the tray growing upward out of it — is live G-4
 *    UAT, driven by the operator at `/gsd:verify-work`.
 *
 * THE DRIVER. `fireEvent` for anything that touches the React Flow plane (the d3-zoom /
 * null-`event.view` hazard `WorkflowCanvas.editing.test.tsx` documents at length), and
 * the user-simulation driver for the bottom-region controls, which sit outside the plane.
 *
 * THE STORE IS REAL. `CanvasToolbar` subscribes to zundo's temporal store and legitimately
 * throws outside a provider, so this suite mounts a real `createBuilderStore` inside a
 * real `BuilderStoreProvider`. That is also why the `session` prop is OPTIONAL on the
 * component: the two shipped canvas suites render with no provider at all, and the region
 * must be genuinely absent for them rather than half-built.
 */
import { describe, it, expect, vi } from "vitest"
import { act, fireEvent, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

// FILE-LOCAL, never setupTests.ts — the helper mutates HTMLElement.prototype and a global
// install would perturb every suite (`WorkflowCanvas.test.tsx:26-28`).
import { mockReactFlow } from "@/test-utils/mockReactFlow"
import { BuilderStoreProvider } from "./BuilderStoreProvider"
import { createBuilderStore, type BuilderStore, type ServerVerdict } from "./builderStore"
import { VERDICT_DESTRUCTIVE_TOKEN } from "./nodePresentation"
import { groupVerdicts, summaryLine } from "./verdictModel"
import { WorkflowCanvas, type CanvasSession } from "./WorkflowCanvas"
import { evalCoverage } from "./__fixtures__/canvasFixtures"
import workflowCanvasSource from "./WorkflowCanvas?raw"

mockReactFlow()

/** The width the R12 row names. Everything in this file renders inside it. */
const R12_WIDTH = 900

/** Three "not finished yet" findings and no hard problem — the state a canvas spends
 *  most of its life in, and the one R9's colour budget is a statement about. */
const THREE_INCOMPLETE: ServerVerdict[] = [
  { code: "missing_output_contract", phase: "split", message: "This step has no output contract yet.", severity: "incomplete" },
  { code: "missing_instructions", phase: "deep_dive", message: "This step still needs instructions.", severity: "incomplete" },
  { code: "missing_business_requirement", phase: null, message: "This workflow still needs a one-line description.", severity: "incomplete" },
]

/** The same set plus ONE hard problem — the positive control for every R9 scan below. */
const WITH_ONE_ERROR: ServerVerdict[] = [
  { code: "no_deliverable", phase: "summarize", message: "Nothing in this workflow produces a deliverable.", severity: "error" },
  ...THREE_INCOMPLETE,
]

function sessionFor(
  verdicts: ServerVerdict[],
  overrides: Partial<CanvasSession> = {},
): CanvasSession {
  return {
    saveState: "dirty",
    saveErrorMessage: null,
    onSaveDraft: vi.fn(),
    onTidyUp: vi.fn(),
    groups: groupVerdicts(verdicts),
    degraded: null,
    checking: false,
    trayOpen: false,
    onToggleTray: vi.fn(),
    onJumpToStep: vi.fn(),
    ...overrides,
  }
}

function draftedStore(): BuilderStore {
  return createBuilderStore({ slug: "vendor-brief", version: 1, phases: [...evalCoverage] })
}

function renderComposed(opts: {
  editable?: boolean
  session?: CanvasSession
  store?: BuilderStore
} = {}) {
  const store = opts.store ?? draftedStore()
  return render(
    <BuilderStoreProvider store={store}>
      {/* The R12 width, on the canvas COLUMN — the same track the 400px panel shares. */}
      <div style={{ width: R12_WIDTH, height: 700 }}>
        <WorkflowCanvas
          phases={evalCoverage}
          selectedSlug={null}
          onSelectNode={vi.fn()}
          onClearSelection={vi.fn()}
          editable={opts.editable ?? true}
          session={opts.session}
        />
      </div>
    </BuilderStoreProvider>,
  )
}

/** How many times the reserved destructive-token literal appears in a subtree. */
function destructiveTokens(html: string): number {
  return html.split(VERDICT_DESTRUCTIVE_TOKEN).length - 1
}

describe("WorkflowCanvas composition — R12: ONE bottom region, TWO rows maximum", () => {
  it("exactly ONE bottom-edge region exists", () => {
    const { container } = renderComposed({ session: sessionFor(THREE_INCOMPLETE) })

    expect(container.querySelectorAll('[data-testid="canvas-bottom-region"]')).toHaveLength(1)

    // POSITIVE CONTROL — plant a second region and the SAME query catches it. Without
    // this, a typo'd selector would report "exactly one" by finding none and… reporting
    // zero, which is a different failure the length check happens to expose, and by
    // finding a duplicate it would report the real one. Both are pinned.
    const planted = document.createElement("div")
    planted.setAttribute("data-testid", "canvas-bottom-region")
    container.appendChild(planted)
    expect(container.querySelectorAll('[data-testid="canvas-bottom-region"]')).toHaveLength(2)
    planted.remove()
    expect(container.querySelectorAll('[data-testid="canvas-bottom-region"]')).toHaveLength(1)
  })

  it("the region has exactly TWO direct rows — closed AND open", async () => {
    const { rerender } = renderComposed({ session: sessionFor(THREE_INCOMPLETE) })

    const closed = screen.getByTestId("canvas-bottom-region")
    expect(closed.children).toHaveLength(2)
    // Row 1 is the toolbar, row 2 the tray — in SOURCE order. The region is reversed on
    // its main axis so the toolbar owns the actual bottom edge and the tray's summary sits
    // directly above it; which of the two is visually lower is a G-4 row, so what is
    // asserted here is the mechanism rather than a measurement jsdom cannot take.
    expect(closed.children[0]).toBe(screen.getByTestId("canvas-toolbar"))
    expect(closed.children[1]).toBe(screen.getByTestId("problems-tray"))
    expect(closed.className).toContain("flex-col-reverse")
    expect(screen.queryByTestId("problems-tray-list")).toBeNull()

    rerender(
      <BuilderStoreProvider store={draftedStore()}>
        <div style={{ width: R12_WIDTH, height: 700 }}>
          <WorkflowCanvas
            phases={evalCoverage}
            selectedSlug={null}
            onSelectNode={vi.fn()}
            onClearSelection={vi.fn()}
            editable
            session={sessionFor(THREE_INCOMPLETE, { trayOpen: true })}
          />
        </div>
      </BuilderStoreProvider>,
    )

    const open = screen.getByTestId("canvas-bottom-region")
    // The tray grew INSIDE its own row. A third row would mean the tray had pushed the
    // toolbar out of the region rather than expanding upward from its summary.
    expect(open.children).toHaveLength(2)
    expect(screen.getByTestId("problems-tray-list")).toBeInTheDocument()
    expect(screen.getByTestId("problems-tray-list").closest('[data-testid="problems-tray"]')).toBe(
      open.children[1],
    )
  })

  it("`editable: false` renders NO bottom region — even with a session supplied", () => {
    renderComposed({ editable: false, session: sessionFor(WITH_ONE_ERROR) })

    expect(screen.queryByTestId("canvas-bottom-region")).toBeNull()
    expect(screen.queryByTestId("canvas-toolbar")).toBeNull()
    expect(screen.queryByTestId("problems-tray")).toBeNull()
    // …and the read-only surface is otherwise itself.
    expect(screen.getByLabelText("Workflow canvas (read-only)")).toBeInTheDocument()
  })

  it("an editable canvas with NO session renders no region either", () => {
    // This is the shape both shipped canvas suites render — and the reason the prop is
    // optional: they mount no `BuilderStoreProvider`, and a half-built region would need
    // one.
    renderComposed({})
    expect(screen.queryByTestId("canvas-bottom-region")).toBeNull()
  })

  it("no element inside the canvas column declares a fixed width wider than 900px", () => {
    const { container } = renderComposed({ session: sessionFor(THREE_INCOMPLETE, { trayOpen: true }) })

    // ⚠ STRUCTURAL, not a measurement. jsdom lays nothing out, so this reads the DECLARED
    // inline widths — the only width information that exists in this renderer. Real
    // overflow at 900px is live G-4 UAT.
    const wide: string[] = []
    for (const element of Array.from(container.querySelectorAll<HTMLElement>("*"))) {
      const declared = element.style.width
      const px = declared.endsWith("px") ? Number.parseFloat(declared) : Number.NaN
      if (Number.isFinite(px) && px > R12_WIDTH) wide.push(`${element.tagName}:${declared}`)
    }
    expect(wide).toEqual([])

    // The mechanism that keeps the width budget survivable at all: the canvas section can
    // SHRINK inside its grid track. Without `min-w-0` a flex/grid child refuses to go
    // below its content width and the 400px panel pushes the column off screen.
    expect(screen.getByLabelText("Workflow canvas").className).toContain("min-w-0")
  })
})

describe("WorkflowCanvas composition — R9: a mid-build draft spends no strong colour", () => {
  it("3 incomplete / 0 error emits the destructive token ZERO times in the bottom region", () => {
    renderComposed({ session: sessionFor(THREE_INCOMPLETE, { trayOpen: true }) })

    const region = screen.getByTestId("canvas-bottom-region")
    expect(destructiveTokens(region.outerHTML)).toBe(0)
  })

  it("…and zero times in the WHOLE canvas, marks and cards included", () => {
    const { container } = renderComposed({ session: sessionFor(THREE_INCOMPLETE, { trayOpen: true }) })
    expect(destructiveTokens(container.innerHTML)).toBe(0)
  })

  it("POSITIVE CONTROL — one `error` verdict makes the token appear", () => {
    renderComposed({ session: sessionFor(WITH_ONE_ERROR, { trayOpen: true }) })

    const region = screen.getByTestId("canvas-bottom-region")
    expect(destructiveTokens(region.outerHTML)).toBeGreaterThanOrEqual(1)
  })

  it("the closed summary states the two severities in SEPARATE WORDS", () => {
    renderComposed({ session: sessionFor(WITH_ONE_ERROR) })

    const counts = screen.getByTestId("problems-tray-counts")
    // Read through the pure module, so the assertion cannot drift from the wording the
    // tray actually renders.
    expect(counts.textContent).toBe(summaryLine(groupVerdicts(WITH_ONE_ERROR)))
    expect(counts.textContent).toBe("1 problem · 3 things to finish")
    // And it says it BEFORE anything is opened — that is the whole point of the line.
    expect(screen.queryByTestId("problems-tray-list")).toBeNull()
  })
})

describe("WorkflowCanvas composition — the tray, from the bottom edge", () => {
  it("opening it lists every finding, including the one that belongs to no step", async () => {
    const user = userEvent.setup()
    renderComposed({ session: sessionFor(THREE_INCOMPLETE, { trayOpen: true }) })

    const list = screen.getByTestId("problems-tray-list")
    expect(within(list).getByTestId("problems-tray-row-split-0")).toBeInTheDocument()
    expect(within(list).getByTestId("problems-tray-row-deep_dive-1")).toBeInTheDocument()
    // The `phase: null` finding has a home — the recorded reason 139-A beat 139-B.
    expect(within(list).getByTestId("problems-tray-workflow-wide")).toBeInTheDocument()
    expect(within(list).getByTestId("problems-tray-workflow-row-0").textContent).toContain(
      "This workflow still needs a one-line description.",
    )
    await user.click(screen.getByTestId("problems-tray-summary"))
  })

  it("activating a phase row jumps to that step", async () => {
    const user = userEvent.setup()
    const onJumpToStep = vi.fn()
    renderComposed({ session: sessionFor(THREE_INCOMPLETE, { trayOpen: true, onJumpToStep }) })

    await user.click(screen.getByTestId("problems-tray-row-deep_dive-1"))
    expect(onJumpToStep).toHaveBeenCalledTimes(1)
    expect(onJumpToStep).toHaveBeenCalledWith("deep_dive")
  })

  it("the summary line asks the CALLER to toggle — it never opens itself", async () => {
    const user = userEvent.setup()
    const onToggleTray = vi.fn()
    renderComposed({ session: sessionFor(THREE_INCOMPLETE, { onToggleTray }) })

    await user.click(screen.getByTestId("problems-tray-summary"))
    expect(onToggleTray).toHaveBeenCalledTimes(1)
    // The component did NOT open itself — `open` is the caller's, so it is still closed.
    expect(screen.queryByTestId("problems-tray-list")).toBeNull()
  })

  it("a NEW error arriving mid-build does not auto-open the tray", () => {
    const onToggleTray = vi.fn()
    const store = draftedStore()
    const { rerender } = renderComposed({
      store,
      session: sessionFor(THREE_INCOMPLETE, { onToggleTray }),
    })
    expect(screen.queryByTestId("problems-tray-list")).toBeNull()

    rerender(
      <BuilderStoreProvider store={store}>
        <div style={{ width: R12_WIDTH, height: 700 }}>
          <WorkflowCanvas
            phases={evalCoverage}
            selectedSlug={null}
            onSelectNode={vi.fn()}
            onClearSelection={vi.fn()}
            editable
            session={sessionFor(WITH_ONE_ERROR, { onToggleTray })}
          />
        </div>
      </BuilderStoreProvider>,
    )

    // The summary line updated; nothing sprang open, and nobody was asked to open it.
    expect(screen.getByTestId("problems-tray-counts").textContent).toBe(
      "1 problem · 3 things to finish",
    )
    expect(screen.queryByTestId("problems-tray-list")).toBeNull()
    expect(onToggleTray).not.toHaveBeenCalled()
  })

  it("a degraded check never reads as clean, and never blanks the tray", () => {
    renderComposed({
      session: sessionFor(THREE_INCOMPLETE, { degraded: "unreadable", trayOpen: true }),
    })

    expect(screen.getByTestId("problems-tray-degraded").textContent).toBe(
      "We couldn't check this — the workflow's shape isn't something we can read yet.",
    )
    // Held stale, not cleared — replacing findings with silence would read as "all fine".
    expect(screen.getByTestId("problems-tray-row-split-0")).toBeInTheDocument()
  })
})

describe("WorkflowCanvas composition — the toolbar row, in place", () => {
  it("the toolbar's undo enables on a structural edit made through the canvas", () => {
    const store = draftedStore()
    renderComposed({ store, session: sessionFor(THREE_INCOMPLETE) })

    const undo = screen.getByTestId("canvas-toolbar-undo")
    expect(undo).toBeDisabled()

    // The `✕` only REPORTS the request — the predicate and the edit belong to the page,
    // which this suite does not mount. So pressing it must change nothing here, and that
    // is asserted rather than assumed: it is the same boundary 184-12 proved.
    fireEvent.click(screen.getByTestId("canvas-remove-deep_dive"))
    expect(undo).toBeDisabled()

    // …and then the edit is made the way the page makes it. The point under test is that
    // the toolbar, sitting in the composed region, SEES a history it did not cause.
    act(() => {
      store.getState().removePhaseBySlug("deep_dive")
    })
    expect(screen.getByTestId("canvas-toolbar-undo")).toBe(undo)
    expect(undo).not.toBeDisabled()
  })

  it("the save reading and the explicit save both live in the bottom region", async () => {
    const user = userEvent.setup()
    const onSaveDraft = vi.fn()
    const onTidyUp = vi.fn()
    renderComposed({ session: sessionFor(THREE_INCOMPLETE, { onSaveDraft, onTidyUp }) })

    const region = screen.getByTestId("canvas-bottom-region")
    expect(region.contains(screen.getByTestId("canvas-toolbar-save-chip"))).toBe(true)
    expect(screen.getByTestId("canvas-toolbar-save-chip").textContent).toBe("Not saved yet")

    await user.click(screen.getByTestId("canvas-toolbar-save"))
    expect(onSaveDraft).toHaveBeenCalledTimes(1)

    await user.click(screen.getByTestId("canvas-toolbar-tidy"))
    expect(onTidyUp).toHaveBeenCalledTimes(1)
  })
})

describe("WorkflowCanvas composition — the scope fences still hold", () => {
  it("the canvas still names no validation seam and no Phase-185 authoring field", () => {
    expect(workflowCanvasSource).not.toMatch(/workflows\/validate/)
    expect(workflowCanvasSource).not.toMatch(/grounding_mode/)
  })

  it("it still ships no minimap, no attribution removal, and keeps the interactivity lock off", () => {
    expect(workflowCanvasSource).not.toMatch(/MiniMap/)
    expect(workflowCanvasSource).not.toMatch(/hideAttribution/)
    expect(workflowCanvasSource).toContain("showInteractive={false}")
  })

  it("the bottom region composes leaves — it derives no severity of its own", () => {
    // ⚠ COMMENTS STRIPPED FIRST. The component's own docblock has to SAY that this canvas
    // derives no severity, and a fence run over the raw file goes red on the sentence that
    // documents it — the D-ITEM-183-02 trap, which this phase has now hit often enough
    // that stripping is the house answer rather than a one-off.
    const code = workflowCanvasSource
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "")
      .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")

    // `verdictModel` owns the fail-closed severity rule and the tray applies it; this file
    // must not grow a second copy of it.
    expect(code).not.toMatch(/severity/)

    // POSITIVE CONTROLS — the pattern is live, and the stripper really strips rather than
    // silently emptying the file and passing the line above by measuring nothing.
    expect("const s = verdict.severity").toMatch(/severity/)
    expect(workflowCanvasSource).toMatch(/severity/)
    expect(code).toContain("showInteractive={false}")
  })
})
