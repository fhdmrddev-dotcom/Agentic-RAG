/**
 * Phase 186-12 (GAP-2 / WR-01) — the save region's own suite.
 *
 * ── WHY THIS FILE IS NET-NEW, AND WHY THAT IS THE CHEAP OPTION ────────────────────
 *
 * `BuilderSaveRegion` shipped in 186-07 without a co-located suite; every assertion about
 * it lives in `WorkflowBuilderPage.canvas.test.tsx` / `.session.test.tsx`, which reach it by
 * rendering the whole Builder, mocking the API, opening the form panel and waiting out a
 * 1000 ms debounce. That is the right shape for an INTEGRATION claim (the banner really is
 * reachable from a real refusal) and the wrong shape for the claims below, which are about
 * one component's props.
 *
 * NOTHING WAS MOVED HERE. The page suites keep every assertion they had — the Phase 177
 * lesson is that a "net-new" file which quietly replaces a suite looks identical to one that
 * adds to it unless you count. This file only adds.
 *
 * ── THE REGRESSION IT EXISTS TO MAKE VISIBLE ──────────────────────────────────────
 *
 * `overwrite()` sets `{kind:"saving"}` synchronously. A banner gated on `state.kind ===
 * "conflict"` alone therefore UNMOUNTS on the first click, so a `disabled` binding on its
 * controls could never be seen and a double-click stayed an ordinary thing to do — which is
 * precisely how the conflict resolver came to manufacture conflicts (WR-01). The third test
 * below is the one that pins the second clause of the render condition.
 */
import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"

import { BuilderSaveRegion } from "./BuilderSaveRegion"
import { SAVED_STILL_A_DRAFT } from "./builderStore"
import { HOLD_PUBLISHING_MANUAL, type PersistState } from "@/hooks/useDraftPersistence"

/**
 * Every prop, defaulted to REST. Each test overrides only what it is about, so a test that
 * says nothing about `dirty` is not silently depending on a value it never named.
 */
function renderRegion(
  patch: {
    state?: PersistState
    dirty?: boolean
    autosaveEnabled?: boolean
    resolving?: boolean
  } = {},
) {
  const onSaveNow = vi.fn()
  const onReload = vi.fn()
  const onOverwrite = vi.fn()
  const view = render(
    <BuilderSaveRegion
      state={patch.state ?? { kind: "idle" }}
      dirty={patch.dirty ?? false}
      autosaveEnabled={patch.autosaveEnabled ?? true}
      resolving={patch.resolving ?? false}
      onSaveNow={onSaveNow}
      onReload={onReload}
      onOverwrite={onOverwrite}
    />,
  )
  return { view, onSaveNow, onReload, onOverwrite }
}

const CONFLICTED: PersistState = { kind: "conflict", currentToken: "T-SERVER" }

/**
 * The REAL flag-off hold sentence, imported rather than invented. The component authors no
 * copy and selects nothing — the hook picks between `HOLD_PUBLISHING` and this one on
 * `enabled` — so using the actual string makes these assertions the end-to-end claim: the
 * exact words a person on the flag-off surface receives when they press Save mid-publish.
 */
const HELD_SENTENCE = HOLD_PUBLISHING_MANUAL

describe("BuilderSaveRegion — the conflict banner (D-186-08 · 186-12)", () => {
  it("a conflict renders the banner with Reload FIRST in DOM order, both controls live", () => {
    renderRegion({ state: CONFLICTED })

    const banner = screen.getByTestId("builder-conflict-banner")
    const reload = screen.getByTestId("builder-conflict-reload")
    const overwrite = screen.getByTestId("builder-conflict-overwrite")

    // D-186-08 — asserted POSITIONALLY, never by a class: reading order and tab order are
    // the recommendation, so the safe act has to be the one a person reaches first.
    const controls = [...banner.querySelectorAll("button")]
    expect(controls).toEqual([reload, overwrite])
    expect(
      reload.compareDocumentPosition(overwrite) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()

    expect(reload).toBeEnabled()
    expect(overwrite).toBeEnabled()
  })

  it("`resolving` disables BOTH controls — neither exit is pressable twice", () => {
    renderRegion({ state: CONFLICTED, resolving: true })

    expect(screen.getByTestId("builder-conflict-reload")).toBeDisabled()
    expect(screen.getByTestId("builder-conflict-overwrite")).toBeDisabled()
  })

  it("`resolving` KEEPS the banner mounted once the state has moved to `saving`", () => {
    // THE REGRESSION THIS FILE EXISTS FOR. `overwrite()` flips the loop to `saving`
    // synchronously, so this is the state the surface is actually in for the whole
    // resolution. Gated on `conflict` alone, the banner is gone and there is nothing left
    // to disable.
    renderRegion({ state: { kind: "saving" }, resolving: true })

    expect(screen.getByTestId("builder-conflict-banner")).toBeInTheDocument()
    expect(screen.getByTestId("builder-conflict-reload")).toBeDisabled()
    expect(screen.getByTestId("builder-conflict-overwrite")).toBeDisabled()
  })

  it("at rest the banner is absent from the DOM and the only control is Save draft", () => {
    // The D-181-01 identity claim, measured here as a shape rather than as the literal
    // markup `WorkflowBuilderPage.header.test.tsx:302-306` pins byte for byte. Two
    // measurements of one promise: that one owns the bytes, this one owns the reason.
    const { view } = renderRegion()

    expect(screen.queryByTestId("builder-conflict-banner")).toBeNull()
    expect(screen.queryByTestId("builder-save-confirm")).toBeNull()
    expect(screen.queryByTestId("builder-save-error")).toBeNull()
    expect(screen.queryByTestId("builder-autosave-status")).toBeNull()

    const controls = [...view.container.querySelectorAll("button")]
    expect(controls).toEqual([screen.getByTestId("builder-save-draft")])
  })
})

/**
 * 186-13 (WR-04) — the flag gates AUTOSAVE NARRATING ITSELF, and nothing else.
 *
 * Both halves of that rule are asserted together on purpose. Before 186-13 the `held`
 * sentence sat behind the same gate as `Saving…`/`Saved · just now`, so on the flag-off
 * surface a Save-draft press during a publish reached `{kind:"held"}`, chose a sentence, and
 * rendered nothing — a control that stated no outcome at all, which is worse than the
 * pre-186 button it replaced. Asserting only the hiding half is what let that ship.
 */
describe("BuilderSaveRegion — the quiet line is flag-gated, but the HOLD is not (WR-04)", () => {
  it("`autosaveEnabled: false` hides the quiet line for BOTH `saving` and `saved`", () => {
    const saving = renderRegion({ state: { kind: "saving" }, autosaveEnabled: false })
    expect(screen.queryByTestId("builder-autosave-status")).toBeNull()
    // The BUTTON still reports the write — the flag gates the quiet line, not the control.
    expect(screen.getByTestId("builder-save-draft")).toBeDisabled()
    saving.view.unmount()

    renderRegion({ state: { kind: "saved", at: Date.now() }, autosaveEnabled: false })
    expect(screen.queryByTestId("builder-autosave-status")).toBeNull()
    // …and the 184-11 receipt beside it is NOT flag-gated, which is the distinction.
    expect(screen.getByTestId("builder-save-confirm")).toHaveTextContent(SAVED_STILL_A_DRAFT)
  })

  it("`autosaveEnabled: false` STILL renders the hold sentence — a press always states an outcome", () => {
    // The sentence is the LOOP'S, verbatim. This component neither authors nor selects it:
    // the hook picks HOLD_PUBLISHING or HOLD_PUBLISHING_MANUAL on the same `enabled` that
    // decides whether the flush happens, and this asserts only that whatever it picked
    // reaches the DOM on the surface where the quiet line does not.
    renderRegion({ state: { kind: "held", sentence: HELD_SENTENCE }, autosaveEnabled: false })

    expect(screen.getByTestId("builder-autosave-status")).toHaveTextContent(HELD_SENTENCE)
  })

  it("a hold renders through ONE span, on both surfaces", () => {
    // There is one quiet-line element, not a second one added for the flag-off case: two
    // homes for one reading is how two readings drift apart.
    const off = renderRegion({
      state: { kind: "held", sentence: HELD_SENTENCE },
      autosaveEnabled: false,
    })
    expect(off.view.container.querySelectorAll('[data-testid="builder-autosave-status"]')).toHaveLength(1)
    off.view.unmount()

    const on = renderRegion({ state: { kind: "held", sentence: HELD_SENTENCE } })
    expect(on.view.container.querySelectorAll('[data-testid="builder-autosave-status"]')).toHaveLength(1)
    expect(screen.getByTestId("builder-autosave-status")).toHaveTextContent(HELD_SENTENCE)
  })

  it("at rest with the flag OFF the only control is Save draft, and no quiet line exists", () => {
    // The guard on `header.test.tsx:305`. `held` is unreachable at rest — it needs a publish
    // in flight or an unreadable verdict — so moving its branch ahead of the flag gate adds
    // nothing to the resting markup. This is the assertion that would red if it ever did.
    const { view } = renderRegion({ autosaveEnabled: false })

    expect(screen.queryByTestId("builder-autosave-status")).toBeNull()
    expect(screen.queryByTestId("builder-save-confirm")).toBeNull()
    expect(screen.queryByTestId("builder-save-error")).toBeNull()
    expect(screen.queryByTestId("builder-conflict-banner")).toBeNull()

    const controls = [...view.container.querySelectorAll("button")]
    expect(controls).toEqual([screen.getByTestId("builder-save-draft")])
  })
})
