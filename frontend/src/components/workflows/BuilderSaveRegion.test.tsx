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
import type { PersistState } from "@/hooks/useDraftPersistence"

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

describe("BuilderSaveRegion — the quiet autosave line is flag-gated", () => {
  it("`autosaveEnabled: false` hides the quiet line for BOTH `saving` and `saved`", () => {
    // Pins the CURRENT behaviour, deliberately. 186-13 changes the `held` case (WR-04 — a
    // Save-draft press during a publish currently looks like a control that did nothing)
    // and will edit this file; `saving` and `saved` are not its subject and must not drift
    // while it works.
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
})
