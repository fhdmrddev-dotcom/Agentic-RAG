/**
 * Phase 184-13 Task 1 (CANVAS-02 · R6 · R9 · Pitfall 7 / zundo #207) — the toolbar's
 * proof suite.
 *
 * THE LOAD-BEARING TEST IS THE REACTIVITY ONE. Everything else here is ordinary DOM
 * assertion; *"Undo becomes enabled without a remount"* is the one that discharges the
 * React-19 landmine, and it is the one that was FALSIFIED (the component temporarily
 * rewritten to read `store.temporal.getState().pastStates.length`, the suite re-run, the
 * reds recorded in the plan's SUMMARY, the component restored). An assertion that has
 * only ever passed is not evidence.
 *
 * THE DRIVER. This file uses the user-simulation driver on purpose and may: the toolbar
 * sits OUTSIDE the React Flow plane, and this suite mounts no plane at all — none of the
 * d3-zoom / null-`event.view` hazard that forces `fireEvent` inside
 * `WorkflowCanvas.editing.test.tsx` exists here. There is no `@xyflow` import in this
 * file and no `mockReactFlow()` call.
 *
 * THE STORE IS REAL. A `createBuilderStore` instance inside a real `BuilderStoreProvider`
 * — not a mock — because what is under test is a SUBSCRIPTION to zundo's temporal store,
 * and a hand-rolled fake would be free to be reactive in a way the real one is not.
 */
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach, type MockInstance } from "vitest"
import { act, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { BuilderStoreProvider } from "./BuilderStoreProvider"
import { CanvasToolbar, type ToolbarSaveState } from "./CanvasToolbar"
import { createBuilderStore, SAVED_STILL_A_DRAFT, type BuilderStore } from "./builderStore"
import { evalCoverage } from "./__fixtures__/canvasFixtures"
// The component SOURCE via Vite's ?raw loader — the idiomatic way to make a scope fence
// machine-checkable (the `PhaseSpineGraph.test.tsx:20-22` precedent).
import toolbarSource from "./CanvasToolbar?raw"

/** R6 / D-184-03's tripwire: nothing this toolbar does may reach the network. */
let fetchSpy: MockInstance

beforeAll(() => {
  fetchSpy = vi.spyOn(globalThis, "fetch")
})

afterAll(() => {
  fetchSpy.mockRestore()
})

beforeEach(() => {
  fetchSpy.mockClear()
})

/** A store already in the DRAFTED view — the structural actions bail otherwise, so a
 *  store built from `null` would have no way to grow a history at all. */
function draftedStore(): BuilderStore {
  return createBuilderStore({ slug: "vendor-brief", version: 1, phases: [...evalCoverage] })
}

function renderToolbar(
  store: BuilderStore,
  opts: {
    saveState?: ToolbarSaveState
    errorMessage?: string | null
    onSave?: () => void
    onTidyUp?: () => void
  } = {},
) {
  return render(
    <BuilderStoreProvider store={store}>
      <CanvasToolbar
        saveState={opts.saveState ?? "idle"}
        errorMessage={opts.errorMessage}
        onSave={opts.onSave ?? vi.fn()}
        onTidyUp={opts.onTidyUp ?? vi.fn()}
      />
    </BuilderStoreProvider>,
  )
}

describe("CanvasToolbar — Pitfall 7 / zundo #207: the enabled state is a SUBSCRIPTION", () => {
  it("Undo starts disabled and becomes enabled on a structural edit WITHOUT a remount", () => {
    const store = draftedStore()
    renderToolbar(store)

    const undo = screen.getByTestId("canvas-toolbar-undo")
    expect(undo).toBeDisabled()

    // The same element instance is checked after the edit. If the component had read the
    // history with `getState()` this would still be the same node and would still be
    // disabled — which is precisely the failure the falsification run reproduced.
    act(() => {
      store.getState().addPhaseOfType("llm_single")
    })

    expect(screen.getByTestId("canvas-toolbar-undo")).toBe(undo)
    expect(undo).not.toBeDisabled()
  })

  it("Redo is disabled until an undo happens, and disabled AGAIN after a new edit", async () => {
    const user = userEvent.setup()
    const store = draftedStore()
    renderToolbar(store)

    const redo = screen.getByTestId("canvas-toolbar-redo")
    expect(redo).toBeDisabled()

    act(() => {
      store.getState().addPhaseOfType("llm_single")
    })
    // An edit alone does not make a redo available — there is nothing to go forward to.
    expect(redo).toBeDisabled()

    await user.click(screen.getByTestId("canvas-toolbar-undo"))
    expect(redo).not.toBeDisabled()

    // zundo clears `futureStates` on every push, so a NEW edit throws the forward branch
    // away. The button must follow it down, not stay stuck enabled.
    act(() => {
      store.getState().addPhaseOfType("programmatic")
    })
    expect(redo).toBeDisabled()
  })

  it("selector reads are used for the RENDERED values and getState() only for side effects", () => {
    // ⚠ COMMENTS ARE STRIPPED FIRST, and this is not a convenience — it is the
    // D-ITEM-183-02 trap, hit for the seventh time in this phase. The component's
    // docblock has to NAME the forbidden form (`…getState().pastStates`) in order to
    // explain why it is forbidden, and a fence run over the raw file therefore goes red
    // on the paragraph that documents it. The only ways to pass such a fence are to
    // delete the explanation or to make it lie. Scoping the scan to CODE is the third
    // way, and it is the honest one.
    const code = toolbarSource.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")

    // ≥ 2: one for `canUndo`, one for `canRedo`.
    expect((code.match(/useBuilderTemporal\(/g) ?? []).length).toBeGreaterThanOrEqual(2)

    // Every `temporal.getState()` in the CODE is immediately followed by a temporal
    // ACTION call — i.e. it is a side effect, never a value that gets rendered. The
    // pattern is anchored so a rendered `…getState().pastStates` cannot satisfy it.
    const getStateReads = code.match(/temporal\.getState\(\)\.\w+/g) ?? []
    expect(getStateReads.length).toBeGreaterThan(0)
    for (const read of getStateReads) {
      expect(read).toMatch(/temporal\.getState\(\)\.(undo|redo)$/)
    }

    // POSITIVE CONTROL 1 — the pattern really does reject the rendered form, so a typo in
    // the regex turns this line red rather than making the fence vacuous.
    expect(
      "store.temporal.getState().pastStates".match(/temporal\.getState\(\)\.\w+/)?.[0] ?? "",
    ).not.toMatch(/temporal\.getState\(\)\.(undo|redo)$/)

    // POSITIVE CONTROL 2 — the comment stripper really does strip, so it cannot be
    // silently emptying the whole file and passing every line above by measuring nothing.
    expect(toolbarSource).toContain("getState().pastStates")
    expect(code).not.toContain("getState().pastStates")
    expect(code).toContain("useBuilderTemporal")
  })
})

describe("CanvasToolbar — what it does when a control is pressed", () => {
  it("Undo steps the definition back through the store", async () => {
    const user = userEvent.setup()
    const store = draftedStore()
    const before = store.getState().phases.length
    renderToolbar(store)

    act(() => {
      store.getState().addPhaseOfType("llm_single")
    })
    expect(store.getState().phases.length).toBe(before + 1)

    await user.click(screen.getByTestId("canvas-toolbar-undo"))
    expect(store.getState().phases.length).toBe(before)
  })

  it("Redo steps it forward again", async () => {
    const user = userEvent.setup()
    const store = draftedStore()
    const before = store.getState().phases.length
    renderToolbar(store)

    act(() => {
      store.getState().addPhaseOfType("llm_single")
    })
    await user.click(screen.getByTestId("canvas-toolbar-undo"))
    expect(store.getState().phases.length).toBe(before)

    await user.click(screen.getByTestId("canvas-toolbar-redo"))
    expect(store.getState().phases.length).toBe(before + 1)
  })

  it("Tidy up calls its caller exactly once and touches nothing else", async () => {
    const user = userEvent.setup()
    const store = draftedStore()
    const onTidyUp = vi.fn()
    renderToolbar(store, { onTidyUp })

    await user.click(screen.getByTestId("canvas-toolbar-tidy"))
    expect(onTidyUp).toHaveBeenCalledTimes(1)
    expect(store.getState().phases).toStrictEqual([...evalCoverage])
  })

  it("Save draft calls its caller, and is disabled while a save is in flight", async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    renderToolbar(draftedStore(), { onSave })

    await user.click(screen.getByTestId("canvas-toolbar-save"))
    expect(onSave).toHaveBeenCalledTimes(1)

    render(
      <BuilderStoreProvider store={draftedStore()}>
        <CanvasToolbar saveState="saving" onSave={vi.fn()} onTidyUp={vi.fn()} />
      </BuilderStoreProvider>,
    )
    expect(screen.getAllByTestId("canvas-toolbar-save")[1]).toBeDisabled()
  })

  it("nothing this toolbar does reaches the network", () => {
    expect(fetchSpy).toHaveBeenCalledTimes(0)
  })
})

describe("CanvasToolbar — R6: the save state never implies published", () => {
  it("`saved` renders EXACTLY the locked sentence", () => {
    renderToolbar(draftedStore(), { saveState: "saved" })
    expect(screen.getByTestId("canvas-toolbar-save-chip").textContent).toBe(SAVED_STILL_A_DRAFT)
    expect(SAVED_STILL_A_DRAFT).toBe("Saved · still a draft")
  })

  it("no rendered string anywhere in the toolbar implies a release", () => {
    const forbidden = /publish|published|live|shipped/i
    // The 409 sentence, which legitimately contains the word — because it is the SERVER's
    // news ABOUT the row, not a claim this toolbar makes about the save.
    const conflict = "This version is published and can't be edited — use Tweak to start a new draft"

    for (const saveState of ["idle", "dirty", "saving", "saved", "error"] as ToolbarSaveState[]) {
      const { container, unmount } = renderToolbar(draftedStore(), {
        saveState,
        errorMessage: conflict,
      })
      // Excluded BY IDENTITY, never by loosening the pattern — everything else in the
      // same render is still scanned, chrome and copy alike.
      const html = container.innerHTML.split(conflict).join("")
      expect(html).not.toMatch(forbidden)
      // …and the exclusion is proven to have been necessary rather than decorative.
      if (saveState === "error") expect(container.innerHTML).toContain(conflict)
      unmount()
    }
  })

  it("`dirty` and `saving` read as themselves", () => {
    const { unmount } = renderToolbar(draftedStore(), { saveState: "dirty" })
    expect(screen.getByTestId("canvas-toolbar-save-chip").textContent).toBe("Not saved yet")
    unmount()

    renderToolbar(draftedStore(), { saveState: "saving" })
    expect(screen.getByTestId("canvas-toolbar-save-chip").textContent).toBe("Saving…")
  })

  it("`idle` says NOTHING — there is no true sentence about a save that never happened", () => {
    renderToolbar(draftedStore(), { saveState: "idle" })
    expect(screen.queryByTestId("canvas-toolbar-save-chip")).toBeNull()
    expect(screen.queryByTestId("canvas-toolbar-save-error")).toBeNull()
    // The region itself is present at load so an assistive technology has already picked
    // it up before the first transition.
    expect(screen.getByTestId("canvas-toolbar-save-state")).toBeInTheDocument()
  })

  it("`error` renders the CALLER's sentence verbatim, and falls back to the dirty words", () => {
    const { unmount } = renderToolbar(draftedStore(), {
      saveState: "error",
      errorMessage: "Couldn't save",
    })
    expect(screen.getByTestId("canvas-toolbar-save-error").textContent).toBe("Couldn't save")
    unmount()

    renderToolbar(draftedStore(), { saveState: "error" })
    // A save that failed IS a draft that is not saved yet — a true sentence this
    // component already owns, rather than a second spelling of a generic one it does not.
    expect(screen.getByTestId("canvas-toolbar-save-error").textContent).toBe("Not saved yet")
  })

  it("R9 — the error treatment spends RAW hsl literals, never the destructive token", () => {
    const { container } = renderToolbar(draftedStore(), {
      saveState: "error",
      errorMessage: "Couldn't save",
    })
    expect(container.innerHTML).not.toContain("destructive")
    // POSITIVE CONTROL: the raw literal really is what dresses it, so the assertion above
    // is not passing on a chip that has no colour at all.
    expect(screen.getByTestId("canvas-toolbar-save-error").className).toContain("hsl(0_85%_74%)")
  })
})

// ── 199-05 Task 3 — the toolbar's marks, against icon-convention §4 ─────────────
//
// Sheet `c1-canvas-plane` §3 draws a floating control cluster. The shipped chrome is split
// in two: the LIBRARY's zoom/fit cluster (pinned in `WorkflowCanvas.test.tsx`) and this
// toolbar. §4 lists `↶` / `↷` for undo / redo and names this file as their source of
// truth, so the audit that closes §4's loop has to run here too — a mark invented on the
// toolbar teaches the wrong vocabulary just as effectively as one invented on the plane.

describe("CanvasToolbar 199-05 — every drawn mark traces to icon-convention §4", () => {
  /** §4's two rows for this file, and nothing else. */
  const SECTION_4_ROWS: Record<string, string> = {
    "↶": "undo — icon-convention §4, sourced to CanvasToolbar.tsx",
    "↷": "redo — icon-convention §4, sourced to CanvasToolbar.tsx",
  }

  /** Key NAMES rather than canvas concepts — the accelerators in the two aria-labels. */
  const KEY_NAMES = new Set(["⌘", "⇧"])

  /**
   * A MARK, not a piece of punctuation. General Punctuation (U+2000–U+206F) is excluded
   * because it is where the em dash, the ellipsis and the curly quotes live — this suite
   * measured `U+2014` in the tidy-up tooltip, which is a sentence, not a symbol. Excluding
   * the block by RANGE rather than listing the characters it happened to see means the
   * next em dash somebody types does not turn this fence red for a prose reason.
   */
  const isMark = (ch: string) => {
    const cp = ch.codePointAt(0)!
    return cp > 0x2000 && !(cp >= 0x2000 && cp <= 0x206f)
  }

  function drawnMarks(container: HTMLElement): Set<string> {
    const marks = new Set<string>()
    const consider = (text: string | null) => {
      for (const ch of text ?? "") if (isMark(ch)) marks.add(ch)
    }
    consider(container.textContent)
    for (const el of Array.from(container.querySelectorAll("[aria-label], [title]"))) {
      consider(el.getAttribute("aria-label"))
      consider(el.getAttribute("title"))
    }
    return marks
  }

  it("draws exactly §4's two marks, plus the key names its accelerators need", () => {
    const { container } = renderToolbar(draftedStore(), { saveState: "saved" })
    const marks = drawnMarks(container)

    // NON-VACUITY FIRST — the toolbar really does paint marks.
    expect(marks.size).toBeGreaterThan(0)
    expect(marks.has("↶")).toBe(true)
    expect(marks.has("↷")).toBe(true)

    const unaccounted = Array.from(marks).filter(
      (m) => !(m in SECTION_4_ROWS) && !KEY_NAMES.has(m),
    )
    expect(unaccounted.map((m) => `U+${m.codePointAt(0)!.toString(16).toUpperCase()}`)).toEqual([])
  })

  it("puts NO phase-type glyph and no category icon on the toolbar", () => {
    // §4's worst recorded drift is a phase-type glyph pressed into service as a category
    // icon. A toolbar is exactly the place that temptation arrives.
    const { container } = renderToolbar(draftedStore(), { saveState: "saved" })
    expect(container.textContent ?? "").not.toMatch(/[\u{1F300}-\u{1FAFF}]/u)
    // POSITIVE CONTROL — the matcher really does catch a 3D-map glyph.
    expect("\u{1F916}").toMatch(/[\u{1F300}-\u{1FAFF}]/u)
  })

  it("the two marks are aria-hidden — the WORD in the label carries the meaning", () => {
    // A mark that reaches the accessible name would be read aloud as an unknown
    // character, so each button's name comes from `aria-label` and the glyph is hidden.
    renderToolbar(draftedStore())
    for (const testId of ["canvas-toolbar-undo", "canvas-toolbar-redo"]) {
      const button = screen.getByTestId(testId)
      expect(button.getAttribute("aria-label")).toBeTruthy()
      const glyph = button.querySelector("span")
      expect(glyph).not.toBeNull()
      expect(glyph!.getAttribute("aria-hidden")).toBe("true")
    }
  })

  it("adds NO zoom control of its own — the sheet's cluster has ONE home", () => {
    // The sheet draws zoom out / percentage / zoom in / fit / lock as one floating pill.
    // Three of those five ship, in the library's own `<Controls>`; a second zoom control
    // here would be two homes for one concern.
    const { container } = renderToolbar(draftedStore())
    const text = (container.textContent ?? "").toLowerCase()
    expect(text).not.toContain("zoom")
    expect(text).not.toMatch(/\d+\s*%/)
    expect(container.querySelector(".react-flow__controls")).toBeNull()
  })
})
