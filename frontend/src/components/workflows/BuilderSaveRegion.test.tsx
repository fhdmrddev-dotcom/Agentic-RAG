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
import {
  HOLD_PUBLISHING_MANUAL,
  RELOAD_FAILED_NOTE,
  // 199-09: the loop's REAL refusal sentence. The failure arm's distinctness is only worth
  // asserting against the words a person actually receives, not against a placeholder.
  SAVE_FAILED_SENTENCE,
  type PersistState,
} from "@/hooks/useDraftPersistence"

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
 * 186-14 (GAP-4 / CR-02) — the banner explains a failed exit WITHOUT costing the exits.
 *
 * The defect this closes was never in this component's copy; it was in the pairing. A
 * `reload()` that could not reach the server replaced the conflict with `{kind:"error"}`, and
 * this banner renders on `conflict || resolving` — so both controls left the DOM in the same
 * commit, while the loop's halt stayed set for the rest of the session. The hook now restores
 * the conflict and carries a NOTE; the claim measured here is the other half of that: the
 * note reaches the DOM and the two exits are still there, still enabled, still in order.
 *
 * The FIRST case below is the one that stops the note becoming furniture. A conflict without
 * a note — the ordinary one, the one the server refused — must render exactly what it always
 * rendered, because the locked sentence already says everything true about it.
 */
describe("BuilderSaveRegion — a failed exit says why, and keeps both exits (GAP-4)", () => {
  const NOTED: PersistState = {
    kind: "conflict",
    currentToken: "T-SERVER",
    note: RELOAD_FAILED_NOTE,
  }

  it("a conflict WITHOUT a note renders no note element at all", () => {
    renderRegion({ state: CONFLICTED })

    expect(screen.queryByTestId("builder-conflict-note")).toBeNull()
    // The resting conflict is unchanged: one sentence, two controls.
    expect(screen.getByTestId("builder-conflict-banner")).toBeInTheDocument()
    expect(screen.getByTestId("builder-conflict-reload")).toBeEnabled()
    expect(screen.getByTestId("builder-conflict-overwrite")).toBeEnabled()
  })

  it("a conflict WITH a note renders it AND keeps both exits mounted, enabled and in order", () => {
    renderRegion({ state: NOTED })

    const banner = screen.getByTestId("builder-conflict-banner")
    const note = screen.getByTestId("builder-conflict-note")
    const reload = screen.getByTestId("builder-conflict-reload")
    const overwrite = screen.getByTestId("builder-conflict-overwrite")

    // The words are the LOOP'S, verbatim — this component authors no copy.
    expect(note).toHaveTextContent(RELOAD_FAILED_NOTE)
    // ADDITIVE, never a replacement: the sentence that offers the exits is still there.
    expect(banner).toHaveTextContent("Reload to get the newer version")

    // The exits survived the failure of one of them. Both present, both PRESSABLE — a
    // disabled exit here would be the same defect wearing a different mask.
    expect(reload).toBeEnabled()
    expect(overwrite).toBeEnabled()

    // D-186-08 order, asserted positionally and never by a class name. The note must not
    // have wedged itself between the two controls.
    const controls = [...banner.querySelectorAll("button")]
    expect(controls).toEqual([reload, overwrite])
    expect(
      reload.compareDocumentPosition(overwrite) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    // …and the note precedes the recommended exit, so it is read before it is acted on.
    expect(note.compareDocumentPosition(reload) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it("`resolving: true` with a note still disables BOTH controls (the 186-12 property is unaffected)", () => {
    renderRegion({ state: NOTED, resolving: true })

    expect(screen.getByTestId("builder-conflict-note")).toHaveTextContent(RELOAD_FAILED_NOTE)
    expect(screen.getByTestId("builder-conflict-reload")).toBeDisabled()
    expect(screen.getByTestId("builder-conflict-overwrite")).toBeDisabled()
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

// ══════════════════════════════════════════════════════════════════════════════════
// 199-09 (DES-01 · sheet `c10-builder-chrome` §2) — THE ARMS READ APART WITH EVERY
// `class` ATTRIBUTE STRIPPED OFF.
//
// ⚠ WHY CLASS-FREE, AND WHY IT IS THE ONLY HONEST FORM OF THIS CLAIM. Sheet c10 draws the
// failure arm in `error` tone and the saved arm in the default one, and colour is where a
// save-state surface is most tempting to stop. A person who cannot see that colour — or a
// theme where the token happens not to compile, which `192.2`'s `bg-warning` no-op proves
// is a real thing in this repo — must still be able to tell "your draft is saved" from
// "your draft is NOT saved". So the comparison discards every class and reads the WORDS.
// That is the strongest form of the T-199-09-02 spoofing claim: an unsaved draft can never
// read as a saved one, on any theme, with no colour at all.
//
// ⚠ AND THE COMPARATOR IS DRIVEN IN BOTH DIRECTIONS. Non-vacuity is asserted before any
// inequality, and a deliberately identical pair proves the comparator can still detect
// sameness — otherwise `not.toEqual` would pass for a comparator that compared nothing.
// ══════════════════════════════════════════════════════════════════════════════════

/**
 * What a person READS: every non-empty text node, in document order, taken from a clone
 * with every `class` attribute physically removed. The removal is ASSERTED, not assumed —
 * a selector typo would leave the classes on and quietly weaken every case below.
 */
function classFreeReading(container: HTMLElement): string[] {
  const clone = container.cloneNode(true) as HTMLElement
  for (const el of clone.querySelectorAll("[class]")) el.removeAttribute("class")
  expect(clone.querySelectorAll("[class]")).toHaveLength(0)

  const out: string[] = []
  const walker = document.createTreeWalker(clone, NodeFilter.SHOW_TEXT)
  let node = walker.nextNode()
  while (node !== null) {
    const text = (node.textContent ?? "").replace(/\s+/g, " ").trim()
    if (text !== "") out.push(text)
    node = walker.nextNode()
  }
  return out
}

/** One arm's class-free reading, taken from its own mount and torn down after. */
function readingFor(patch: Parameters<typeof renderRegion>[0]): string[] {
  const { view } = renderRegion(patch)
  const reading = classFreeReading(view.container)
  view.unmount()
  return reading
}

describe("BuilderSaveRegion — sheet c10 §2: the arms are told apart by WORDS, never by colour", () => {
  it("the FAILURE arm and the SAVED arm cannot be confused with every class stripped", () => {
    const failed = readingFor({ state: { kind: "error", sentence: SAVE_FAILED_SENTENCE } })
    const saved = readingFor({ state: { kind: "saved", at: Date.now() }, dirty: false })

    // NON-VACUITY FIRST. Two empty readings would compare EQUAL and the inequality below
    // would then be measuring the absence of a component rather than a distinction.
    expect(failed.length).toBeGreaterThan(1)
    expect(saved.length).toBeGreaterThan(1)

    expect(failed).not.toEqual(saved)
    // …and stated in the direction that actually matters: the failure arm carries the
    // refusal and carries NO receipt, so nothing on screen can be read as "it saved".
    expect(failed).toContain(SAVE_FAILED_SENTENCE)
    expect(failed).not.toContain(SAVED_STILL_A_DRAFT)
    expect(saved).toContain(SAVED_STILL_A_DRAFT)
    expect(saved).not.toContain(SAVE_FAILED_SENTENCE)
  })

  it("POSITIVE CONTROL — the comparator still detects two readings that ARE the same", () => {
    const once = readingFor({ state: { kind: "saved", at: 1 }, dirty: false })
    const twice = readingFor({ state: { kind: "saved", at: 2 }, dirty: false })
    expect(once).toEqual(twice)
  })

  it("all four reachable arms are pairwise distinct, class-free", () => {
    // Sheet §2 draws four cards. This component reaches four readings — and they are NOT
    // the sheet's four: `saving`, `saved`, `error` and `conflict`, with the sheet's
    // `unsaved changes` absent (see this plan's CE-2) and `conflict` present in its place,
    // carrying two exits the sheet never drew.
    const arms: Array<readonly [string, string[]]> = [
      ["saving", readingFor({ state: { kind: "saving" } })],
      ["saved", readingFor({ state: { kind: "saved", at: Date.now() }, dirty: false })],
      ["error", readingFor({ state: { kind: "error", sentence: SAVE_FAILED_SENTENCE } })],
      ["conflict", readingFor({ state: CONFLICTED })],
    ]
    for (const [name, reading] of arms) {
      expect(`${name}:${reading.length > 0}`).toBe(`${name}:true`)
    }
    const seen = arms.map(([, reading]) => reading.join(" ⏎ "))
    expect(new Set(seen).size).toBe(arms.length)
  })
})
