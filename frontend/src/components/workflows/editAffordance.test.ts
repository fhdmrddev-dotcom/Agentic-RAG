/**
 * `BUG-260807-02` (the CLIPPING half, `/gsd:quick 260807-x9p`) — editAffordance's
 * geometry pin.
 *
 * ⚠ THE FIRST TEST FILE THIS MODULE HAS EVER HAD. `editAffordance.ts` shipped at
 * 188.1-03 as a verbatim CUT out of `WorkflowCanvas.tsx` and carried forward whatever
 * guard the original had, which was none — the same property that made
 * `verticalOffsetFor` WR-04 sink SIX (`BUG-260807-01`). It lands inside the count gate's
 * `TARGETS` automatically: `src/components/workflows` is a DIRECTORY entry, so this file
 * RUNS the moment it exists, and the two knobs are separate — `TARGETS` decides what
 * runs, `BASELINE` what is pinned. It is pinned in the same commit that creates it.
 *
 * ── WHAT IS BEING PINNED, AND WHY A CONSTANT COULD NOT DO IT ──────────────────
 *
 * `BUG-260807-02`: the `StepTypePicker` menu renders inside `.react-flow`, which is
 * `overflow-y: hidden`, so a row past the container's bottom edge is clipped away with
 * NO SCROLL PATH TO IT. Row 7 is `external_action` — the type Phase 189 exists to ship.
 *
 * A static `max-height` WAS TRIED on 2026-08-07 and reverted. The CSS applied exactly as
 * written (`overflowY: auto`, `maxHeight: 309.856px`, `scrollHeight > clientHeight`) and
 * the rows were STILL unreachable, because bounding the panel's HEIGHT says nothing about
 * where its TOP sits: the report measured `panelBottom 682 > reactFlowBottom 597`. Door 1
 * got WORSE — 2 clipped rows became 7. So the bound has to be THE SPACE ACTUALLY
 * AVAILABLE, which is a measured quantity, and when the smaller side is below, the panel
 * has to open upward instead. `pickerPlacement` is that measurement, and this file is
 * what stops it from silently becoming a constant again.
 *
 * ── THE ONE CASE THIS FILE EXISTS FOR: the two coordinate spaces ─────────────
 *
 * The picker wrapper lives inside `.react-flow__viewport` (`scale(zoom)`) and carries
 * `scale(1/zoom)` of its own, so NET SCALE ON THE PANEL'S CONTENT IS 1 — one panel CSS px
 * is one screen px at every zoom, and `maxHeightPx` needs NO zoom conversion. But the
 * wrapper's `translate(...)` is applied in the wrapper's PARENT space (flow coords) and so
 * IS multiplied by zoom, which makes `PICKER_DROP: 22` twenty-two FLOW px — eleven screen
 * px at zoom 0.5. The zoom cases below assert BOTH spaces in the same breath, over
 * fixtures chosen so a height that was multiplied or divided by zoom gives a visibly
 * different number. A test that pinned only one of the two spaces would pass under the
 * wrong model, which is exactly how this quirk survives a refactor.
 */
import { describe, it, expect } from "vitest"

import {
  EDIT_AFFORDANCE,
  PICKER_MARGIN,
  PICKER_MIN_HEIGHT,
  nextRovingIndex,
  pickerPlacement,
  scrollTopToReveal,
  type PickerPlacementInput,
} from "./editAffordance"

/** A roomy desktop canvas, overridden per case. `container` is `.react-flow`'s OWN box
 *  in screen px — the library's store keeps `width`/`height` current through its own
 *  ResizeObserver, which is where the caller reads them. */
const base: PickerPlacementInput = {
  anchorFlowY: 100,
  panelFlowX: 100,
  transform: [0, 0, 1],
  container: { width: 1200, height: 800 },
}

const at = (over: Partial<PickerPlacementInput>): PickerPlacementInput => ({
  ...base,
  ...over,
})

/** Every field, so a case can assert the WHOLE placement rather than one member and
 *  leave the rest free to be NaN. */
const fields = ["side", "flowY", "offsetXPx", "maxHeightPx"] as const

describe("editAffordance — the two placement constants", () => {
  it("declares the margin and the floor as standalone exports, not EDIT_AFFORDANCE keys", () => {
    // `EDIT_AFFORDANCE`'s own docblock defines that table as "every placement number …
    // derived from `CANVAS_LAYOUT` and from nothing else". These two are not, so putting
    // them there would make that sentence false — the identical argument the file already
    // makes for `AFFORDANCE_Z`, which is the precedent this follows.
    expect(PICKER_MARGIN).toBe(8)
    expect(PICKER_MIN_HEIGHT).toBe(120)
    expect(EDIT_AFFORDANCE).not.toHaveProperty("PICKER_MARGIN")
    expect(EDIT_AFFORDANCE).not.toHaveProperty("PICKER_MIN_HEIGHT")
    // The two numbers the arithmetic below is written against, pinned so a case that
    // hand-computes from them cannot quietly drift from the shipped table.
    expect(EDIT_AFFORDANCE.PICKER_DROP).toBe(22)
    expect(EDIT_AFFORDANCE.PICKER_WIDTH).toBe(300)
  })
})

describe("editAffordance — pickerPlacement chooses the side with more room", () => {
  it("opens BELOW on a roomy canvas, and budgets the whole gap to the bottom edge", () => {
    const placement = pickerPlacement(at({}))

    // belowFlowY = 100 + 22 = 122; at zoom 1 / ty 0 that is 122px from the container top.
    expect(placement.side).toBe("below")
    expect(placement.flowY).toBe(122)
    // 800 − 122 − 8 = 670.
    expect(placement.maxHeightPx).toBe(670)
    expect(placement.offsetXPx).toBe(0)
  })

  it("FLIPS UP at the reverted attempt's own measurement — the reported failure", () => {
    // ⚠ THIS FIXTURE IS THE BUG REPORT, not an invented shape. The reverted `/gsd:fast`
    // attempt measured `panelBottom 682 > reactFlowBottom 597` at `innerHeight 674` with a
    // static `maxHeight: 309.856px`. `.react-flow` therefore spanned roughly 77..597 —
    // height 520 — and the panel's top sat at screen 372.14, i.e. 295.14 from the
    // container top (rounded to 295 here, which changes no verdict).
    //
    // So the space below the anchor was ~217px while the static bound asked for 309.86:
    // the panel overflowed by ~93px and the last rows were clipped away with no scroll
    // path. Bounding the HEIGHT could not fix that. Choosing the OTHER SIDE can.
    const placement = pickerPlacement(
      at({ anchorFlowY: 273, container: { width: 1200, height: 520 } }),
    )

    // spaceBelow = 520 − (273 + 22) − 8 = 217   ← what the static 309.856 overflowed
    // spaceAbove = (273 − 22) − 8       = 243   ← more room, so the panel opens upward
    expect(placement.side).toBe("above")
    expect(placement.flowY).toBe(251)
    expect(placement.maxHeightPx).toBe(243)
  })

  it("keeps the SHIPPED side on a tie — below wins when the two gaps are equal", () => {
    // H = 2 × anchor makes the two spaces identical at zoom 1 / ty 0:
    // spaceBelow = 600 − 322 − 8 = 270 ; spaceAbove = 278 − 8 = 270.
    const placement = pickerPlacement(
      at({ anchorFlowY: 300, container: { width: 1200, height: 600 } }),
    )

    expect(placement.side).toBe("below")
    expect(placement.flowY).toBe(322)
    expect(placement.maxHeightPx).toBe(270)
  })

  it("never budgets below PICKER_MIN_HEIGHT — a 30px menu is not a menu", () => {
    // A 200px-tall canvas: spaceBelow = 200 − 112 − 8 = 80, spaceAbove = 68 − 8 = 60.
    // Below still wins (80 > 60) and the raw gap is under the floor, so the floor answers.
    const placement = pickerPlacement(
      at({ anchorFlowY: 90, container: { width: 1200, height: 200 } }),
    )

    expect(placement.side).toBe("below")
    expect(placement.maxHeightPx).toBe(PICKER_MIN_HEIGHT)
  })

  it("floors a NEGATIVE gap too — an anchor already past the bottom edge", () => {
    // belowTopPx 530 is BELOW the container's own bottom (520): spaceBelow = −18. The
    // flip is what saves this, and the floor is what stops a negative max-height reaching
    // the DOM as a collapsed panel.
    const placement = pickerPlacement(
      at({ anchorFlowY: 508, container: { width: 1200, height: 520 } }),
    )

    expect(placement.side).toBe("above")
    expect(placement.maxHeightPx).toBe(478)
    expect(placement.maxHeightPx).toBeGreaterThanOrEqual(PICKER_MIN_HEIGHT)
  })
})

describe("editAffordance — pickerPlacement at zoom != 1 (the counter-scale trap)", () => {
  // ⚠ THE POINT OF THIS FILE. Each case asserts BOTH spaces from ONE call: `flowY` is a
  // FLOW value and carries the un-scaled `PICKER_DROP`, while `maxHeightPx` is a SCREEN
  // gap and is neither multiplied nor divided by zoom. The comments name what the wrong
  // models would have produced, so the fixtures are demonstrably discriminating rather
  // than merely present.

  it("zoom 0.5 — the drop scales, the height budget does not", () => {
    const placement = pickerPlacement(
      at({
        anchorFlowY: 400,
        panelFlowX: 200,
        transform: [0, 0, 0.5],
        container: { width: 1200, height: 600 },
      }),
    )

    // FLOW space: 400 + 22 = 422, un-scaled, exactly as the wrapper's translate wants it.
    expect(placement.flowY).toBe(422)
    // SCREEN space: belowTopPx = 422 × 0.5 = 211 ; 600 − 211 − 8 = 381.
    //   · a budget DIVIDED by zoom would read 762
    //   · a budget MULTIPLIED by zoom would read 190.5
    //   · treating PICKER_DROP as SCREEN px (400×0.5 + 22 = 222) would read 370
    // All three are visibly different from 381, so this assertion cannot pass under the
    // wrong model.
    expect(placement.side).toBe("below")
    expect(placement.maxHeightPx).toBe(381)
    expect(placement.offsetXPx).toBe(0)
  })

  it("zoom 2 — same two spaces, the other direction", () => {
    const placement = pickerPlacement(
      at({
        anchorFlowY: 100,
        panelFlowX: 100,
        transform: [0, 0, 2],
        container: { width: 1200, height: 600 },
      }),
    )

    expect(placement.flowY).toBe(122)
    // belowTopPx = 122 × 2 = 244 ; 600 − 244 − 8 = 348.
    //   · divided by zoom → 174 · multiplied → 696 · drop-as-screen-px → 370
    expect(placement.side).toBe("below")
    expect(placement.maxHeightPx).toBe(348)
  })

  it("carries the pan offset ty into the space, at zoom", () => {
    // A panned canvas: ty = −100 lifts everything, so there is MORE room below.
    const placement = pickerPlacement(
      at({
        anchorFlowY: 400,
        transform: [0, -100, 0.5],
        container: { width: 1200, height: 600 },
      }),
    )

    // belowTopPx = 422 × 0.5 − 100 = 111 ; 600 − 111 − 8 = 481.
    expect(placement.side).toBe("below")
    expect(placement.maxHeightPx).toBe(481)
  })
})

describe("editAffordance — pickerPlacement clamps the panel horizontally", () => {
  it("pushes RIGHT when the panel's left edge is under the margin", () => {
    // leftPx = −50 ; clamped to PICKER_MARGIN 8 ; correction = 8 − (−50) = 58.
    const placement = pickerPlacement(at({ panelFlowX: -50 }))
    expect(placement.offsetXPx).toBe(58)
  })

  it("pushes LEFT when the panel's right edge passes the container", () => {
    // maxLeft = 1200 − 300 − 8 = 892 ; leftPx 1000 ; correction = 892 − 1000 = −108.
    const placement = pickerPlacement(at({ panelFlowX: 1000 }))
    expect(placement.offsetXPx).toBe(-108)
  })

  it("corrects by exactly 0 when it already fits", () => {
    const placement = pickerPlacement(at({ panelFlowX: 400 }))
    expect(placement.offsetXPx).toBe(0)
    // Not merely falsy — `-0` and `NaN` are both wrong answers here, and `NaN` is the one
    // that would take the whole `translate(...)` declaration down with it.
    expect(Object.is(placement.offsetXPx, 0)).toBe(true)
  })

  it("pins the left edge at the margin when the MARGINS no longer fit", () => {
    // maxLeft = 300 − 300 − 8 = −8, i.e. below the margin. The clamp's upper bound is
    // held at PICKER_MARGIN rather than allowed to invert, so a tight canvas shows the
    // panel from its left edge instead of from an arbitrary negative offset.
    const placement = pickerPlacement(
      at({ panelFlowX: 400, container: { width: 300, height: 800 } }),
    )
    expect(placement.offsetXPx).toBe(PICKER_MARGIN - 400)
  })

  it("carries the pan offset tx into the clamp", () => {
    // leftPx = 100 + (−200) = −100 ; clamped to 8 ; correction = 108.
    const placement = pickerPlacement(at({ transform: [-200, 0, 1] }))
    expect(placement.offsetXPx).toBe(108)
  })
})

describe("editAffordance — pickerPlacement is unmeasured-safe and total", () => {
  it("returns the SHIPPED geometry when the container has not been measured", () => {
    // jsdom, and the very first paint in a browser, both report 0. Returning the shipped
    // placement byte-for-byte is what keeps every existing suite — and the first frame —
    // unchanged: `maxHeightPx: null` means DO NOT BOUND, which is what shipped.
    const placement = pickerPlacement(at({ container: { width: 1200, height: 0 } }))

    expect(placement).toEqual({
      side: "below",
      flowY: 122,
      offsetXPx: 0,
      maxHeightPx: null,
    })
  })

  it("does the same for an unmeasured WIDTH — an incoherent box is no measurement", () => {
    const placement = pickerPlacement(at({ container: { width: 0, height: 800 } }))
    expect(placement.maxHeightPx).toBeNull()
    expect(placement.side).toBe("below")
    expect(placement.offsetXPx).toBe(0)
  })

  it("treats THE JSDOM MOCK'S 1×1 CONTAINER as unmeasured — `=== 0` would not have", () => {
    // ⚠ THE CASE THAT WAS MISSING FROM THIS PLAN'S OWN ARITHMETIC, and it was found by
    // the estate rather than reasoned about: `test-utils/mockReactFlow.ts:92-105` defines
    // `offsetWidth`/`offsetHeight` as `parseFloat(this.style.width) || 1`, and
    // `.react-flow` carries no inline size — so `@xyflow`'s `useResizeHandler` reads
    // 1 × 1 and writes it to the store as a perfectly POSITIVE measurement. A `<= 0` gate
    // does not catch it, and the first draft of this function duly computed a placement
    // against a one-pixel canvas: flipped upward, slid 452px left. That is not a fallback,
    // it is nonsense — and it is what `WorkflowCanvas.editing.test.tsx`'s
    // `AFFORDANCE_SHAPE_BASELINE` refused, correctly.
    const placement = pickerPlacement(at({ container: { width: 1, height: 1 } }))

    expect(placement).toEqual({
      side: "below",
      flowY: 122,
      offsetXPx: 0,
      maxHeightPx: null,
    })
  })

  it("declines the VERTICAL bound below the panel's own floor, and says so as null", () => {
    // 119 is one px under `PICKER_MIN_HEIGHT`: the budget could only ever BE the floor, so
    // the measurement carries no information and the shipped panel is the honest answer.
    const under = pickerPlacement(at({ container: { width: 1200, height: 119 } }))
    expect(under.maxHeightPx).toBeNull()
    expect(under.side).toBe("below")

    // …and one px the other side of the threshold it is a real budget again, so the
    // boundary is asserted rather than assumed.
    const over = pickerPlacement(at({ anchorFlowY: 0, container: { width: 1200, height: 120 } }))
    expect(over.maxHeightPx).toBe(PICKER_MIN_HEIGHT)
  })

  it("keeps the VERTICAL bound on a container too narrow to correct horizontally", () => {
    // ⚠ THE TWO AXES ARE DECIDED SEPARATELY, and this is why. A canvas narrower than the
    // panel can only ever pin it at the margin — but it can still CLIP it vertically,
    // which is the entire defect. Folding the two decisions together would have thrown
    // the fix away on exactly the small viewports the bug reproduces at.
    const placement = pickerPlacement(at({ container: { width: 100, height: 800 } }))
    expect(placement.offsetXPx).toBe(0)
    expect(placement.maxHeightPx).toBe(670)
    expect(placement.side).toBe("below")
  })

  it.each([
    ["zoom 0", { transform: [0, 0, 0] as [number, number, number] }],
    ["zoom NaN", { transform: [0, 0, Number.NaN] as [number, number, number] }],
    ["zoom negative", { transform: [0, 0, -1] as [number, number, number] }],
    ["ty NaN", { transform: [0, Number.NaN, 1] as [number, number, number] }],
    ["ty Infinity", { transform: [0, Number.POSITIVE_INFINITY, 1] as [number, number, number] }],
    ["tx NaN", { transform: [Number.NaN, 0, 1] as [number, number, number] }],
    ["anchorFlowY NaN", { anchorFlowY: Number.NaN }],
    ["panelFlowX NaN", { panelFlowX: Number.NaN }],
    ["container height NaN", { container: { width: 1200, height: Number.NaN } }],
    ["container width NaN", { container: { width: Number.NaN, height: 800 } }],
  ])("returns NO NaN in any field for %s", (_name, over) => {
    // ⚠ WHY NaN IS WORTH ITS OWN BLOCK, and it is the mechanism `verticalOffsetFor`'s
    // docblock records rather than one inherited from it: every number here is
    // interpolated straight into `translate(...)`. A single NaN term makes the WHOLE
    // declaration invalid, so the browser drops the entire transform and renders the
    // element untransformed — and since 188.2 gave these style objects `zIndex: 1002`
    // (`AFFORDANCE_Z`, for `BUG-260806-01`), a mispositioned affordance now lands ABOVE
    // every card instead of behind it. Totality is a property of the function, not of its
    // current callers.
    const placement = pickerPlacement(at(over as Partial<PickerPlacementInput>))

    for (const field of fields) {
      const value = placement[field]
      if (typeof value === "number") {
        expect(Number.isFinite(value)).toBe(true)
      }
    }
    expect(placement.side === "above" || placement.side === "below").toBe(true)
    expect(Number.isFinite(placement.flowY)).toBe(true)
    expect(Number.isFinite(placement.offsetXPx)).toBe(true)
  })

  it("treats zoom 0 as 1 — the same floor the shipped `1 / (zoom || 1)` already applies", () => {
    // Not a new convention: `PlaneEditingLayer` has always written `scale(1 / (zoom || 1))`,
    // and `NaN || 1` is 1 because NaN is falsy. This mirrors it so the two cannot disagree.
    const zeroed = pickerPlacement(at({ transform: [0, 0, 0] }))
    const unity = pickerPlacement(at({ transform: [0, 0, 1] }))
    expect(zeroed).toEqual(unity)
  })

  it("mutates nothing it is handed", () => {
    const input = at({})
    const frozen = JSON.stringify(input)
    pickerPlacement(input)
    expect(JSON.stringify(input)).toBe(frozen)
  })
})

// ── `BUG-260807-02`, the KEYBOARD half — the roving key map ────────────────────
//
// Measured RED on the live app before a line of this was written (2026-08-08, the
// `Compliance Gap Report` draft at 1280 × 666, door `canvas-insert-0`): opening the menu
// left `document.activeElement` on the `＋` (`canvas-insert-0`), a REAL `ArrowDown` moved
// it NOWHERE, and a REAL `Tab` jumped straight PAST the open menu to the next door
// (`canvas-insert-1`). All seven `[role=menuitem]`s carried `tabindex: null`. So focus
// never entered a `role="menu"` whose ARIA contract requires arrow-key roving focus.
//
// THE COUNT IS SEVEN because the seventh row is `external_action` — the capability Phase
// 189 exists to ship — so the wrap cases below are not abstract: `ArrowDown` × 6 is the
// only route a keyboard user has to it.

const KEY_COUNT = 7
const LAST = KEY_COUNT - 1

describe("editAffordance — nextRovingIndex walks a VERTICAL menu, and wraps", () => {
  it("ArrowDown advances, and WRAPS off the last row back to the first", () => {
    expect(nextRovingIndex("ArrowDown", 0, KEY_COUNT)).toBe(1)
    expect(nextRovingIndex("ArrowDown", 5, KEY_COUNT)).toBe(6)
    // The wrap the driven row walks: row 7 (`external_action`) → row 1.
    expect(nextRovingIndex("ArrowDown", LAST, KEY_COUNT)).toBe(0)
  })

  it("ArrowUp retreats, and WRAPS off the first row to the last", () => {
    expect(nextRovingIndex("ArrowUp", 3, KEY_COUNT)).toBe(2)
    // The other wrap — and the CHEAPEST route to row 7 for a keyboard user, which is why
    // it is worth having rather than merely symmetric.
    expect(nextRovingIndex("ArrowUp", 0, KEY_COUNT)).toBe(LAST)
  })

  it("Home lands on the first row and End on the last, from the middle", () => {
    expect(nextRovingIndex("Home", 3, KEY_COUNT)).toBe(0)
    expect(nextRovingIndex("End", 3, KEY_COUNT)).toBe(LAST)
  })

  // ⚠ THE FALSIFICATION CONTROL FOR THE WHOLE KEYBOARD CLAIM, and it is a LIST rather
  // than a spot check on purpose. Two of these six are load-bearing for reasons that have
  // nothing to do with symmetry:
  //
  //   · `Escape` — the shipped dismissal is a GATED `window` keydown listener
  //     (`StepTypePicker.tsx`). The picker's container handler must fall through on this
  //     key WITHOUT calling `preventDefault`, or the menu becomes inescapable again — the
  //     defect the operator already hit once, from the other direction.
  //   · `ArrowLeft` / `ArrowRight` — UNMAPPED DELIBERATELY. `ExternalActionSection` maps
  //     them because it is a `radiogroup`, where APG makes Right/Left synonyms of Down/Up.
  //     This is a vertical `menu`, where Right/Left belong to submenus and menubars —
  //     neither of which exists here. The two ARIA patterns genuinely differ, and this is
  //     the assertion that keeps the difference deliberate rather than accidental.
  //
  // `Enter` and `" "` fall through so the button's own NATIVE activation still fires, and
  // `Tab` so the roving stop still hands the tab order onward.
  it.each(["Escape", "Enter", " ", "Tab", "ArrowLeft", "ArrowRight"])(
    "returns null for %j — a key this pattern does not own",
    (key) => {
      expect(nextRovingIndex(key, 3, KEY_COUNT)).toBeNull()
    },
  )

  it("owns no key it was not asked to — an unrecognised name is null, never 0", () => {
    // Non-vacuity for the block above: `null` must mean "not mine", not "index 0".
    expect(nextRovingIndex("PageDown", 3, KEY_COUNT)).toBeNull()
    expect(nextRovingIndex("", 3, KEY_COUNT)).toBeNull()
    expect(nextRovingIndex("arrowdown", 3, KEY_COUNT)).toBeNull()
  })
})

describe("editAffordance — nextRovingIndex is TOTAL over a degenerate menu", () => {
  // Why totality is not ceremony here: the answer is fed straight to
  // `itemRefs[next]?.focus()`. A NaN or out-of-range index focuses `undefined`, which
  // strands the keyboard user mid-menu with no visible cause and no way back in — the
  // same class of silent-nothing failure the live RED above measured.
  it.each([
    ["count 0", 0],
    ["count negative", -3],
    ["count non-integer", 6.5],
    ["count NaN", Number.NaN],
  ])("returns null rather than a number for %s", (_name, count) => {
    expect(nextRovingIndex("ArrowDown", 0, count)).toBeNull()
    expect(nextRovingIndex("Home", 0, count)).toBeNull()
    expect(nextRovingIndex("End", 0, count)).toBeNull()
  })

  it("returns null for a NaN or infinite index", () => {
    expect(nextRovingIndex("ArrowDown", Number.NaN, KEY_COUNT)).toBeNull()
    expect(nextRovingIndex("ArrowDown", Number.POSITIVE_INFINITY, KEY_COUNT)).toBeNull()
  })

  it("CLAMPS an out-of-range index instead of escaping the array", () => {
    // A `-1` index is what an unmeasured/reset menu can hold for one frame, and a `99`
    // is what a shrinking `choices` array leaves behind. Both must still produce an
    // in-range answer rather than focusing nothing.
    expect(nextRovingIndex("ArrowDown", -1, KEY_COUNT)).toBe(1)
    expect(nextRovingIndex("ArrowDown", 99, KEY_COUNT)).toBe(0)
    expect(nextRovingIndex("ArrowUp", -1, KEY_COUNT)).toBe(LAST)
    expect(nextRovingIndex("ArrowUp", 99, KEY_COUNT)).toBe(LAST - 1)
    expect(nextRovingIndex("ArrowDown", 2.7, KEY_COUNT)).toBe(3)
  })

  it("answers in range for EVERY index the menu can hold, on every owned key", () => {
    for (const key of ["ArrowDown", "ArrowUp", "Home", "End"]) {
      for (let i = 0; i < KEY_COUNT; i++) {
        const next = nextRovingIndex(key, i, KEY_COUNT)
        expect(Number.isInteger(next)).toBe(true)
        expect(next).toBeGreaterThanOrEqual(0)
        expect(next).toBeLessThanOrEqual(LAST)
      }
    }
  })

  it("degenerates to a single-row menu without wrapping off it", () => {
    expect(nextRovingIndex("ArrowDown", 0, 1)).toBe(0)
    expect(nextRovingIndex("ArrowUp", 0, 1)).toBe(0)
    expect(nextRovingIndex("End", 0, 1)).toBe(0)
  })
})

// ── `scrollTopToReveal` — THE PANEL, AND NOTHING BUT THE PANEL ────────────────
//
// ⚠ THIS FUNCTION EXISTS BECAUSE `scrollIntoView` AND THE DEFAULT `focus()` SCROLL BOTH
// CHEAT, and that is a measurement rather than a worry. Both walk up and scroll the
// NEAREST SCROLLABLE ANCESTOR — and `.react-flow` is `overflow: hidden`, i.e.
// PROGRAMMATICALLY scrollable while no user gesture can move it. The clipping half's own
// probe used `scrollIntoView` on 2026-08-07 and manufactured a false 7/7; the tell was
// that its falsification control refused to swing.
//
// So the answer is a NUMBER for ONE element's `scrollTop`. There is no ancestor it could
// move, because there is no element in its signature at all — the panel-only property is
// a consequence of the TYPE, not of a promise in a comment.
//
// THE FIXTURE IS THE SHIPPED PANEL, not an invented one. The clipping half measured
// `max-height: 210.612px`, `scrollHeight 377 > clientHeight 209`, seven ~48px rows: a
// 41px header band plus 7 × 48 = 377. Row i therefore opens at `41 + 48i`.
const PANEL = { clientHeight: 209, scrollHeight: 377, header: 41, rowHeight: 48 }
const rowTopAt = (i: number) => PANEL.header + i * PANEL.rowHeight

describe("editAffordance — scrollTopToReveal moves the PANEL and nothing else", () => {
  it("leaves a row that is already fully visible exactly where it is", () => {
    // Row 1 at the top of an unscrolled panel: 41..89, inside 0..209.
    expect(
      scrollTopToReveal({
        scrollTop: 0,
        clientHeight: PANEL.clientHeight,
        rowTop: rowTopAt(0),
        rowHeight: PANEL.rowHeight,
      }),
    ).toBe(0)
  })

  it("reveals a row BELOW the fold by exactly `bottom − clientHeight`", () => {
    // Row 7 — `external_action`, the row this bug is named for: 329..377.
    // 377 − 209 = 168, which is ALSO the panel's own maximum scrollTop
    // (`scrollHeight − clientHeight`) and the exact figure the clipping half's driven
    // wheel measured (`scrollTop 0 → 168`). The fixture reproducing a live measurement
    // is what makes this an arithmetic pin rather than a plausible-looking one.
    expect(
      scrollTopToReveal({
        scrollTop: 0,
        clientHeight: PANEL.clientHeight,
        rowTop: rowTopAt(6),
        rowHeight: PANEL.rowHeight,
      }),
    ).toBe(168)
    expect(168).toBe(PANEL.scrollHeight - PANEL.clientHeight)
  })

  it("reveals a row ABOVE the fold by landing on the row's own top", () => {
    // Walking back up from row 7 (panel scrolled to 168) to row 1 at 41.
    expect(
      scrollTopToReveal({
        scrollTop: 168,
        clientHeight: PANEL.clientHeight,
        rowTop: rowTopAt(0),
        rowHeight: PANEL.rowHeight,
      }),
    ).toBe(41)
  })

  it("does not move for a row already visible in a SCROLLED panel", () => {
    // Row 5 (233..281) with the panel at 168 spans 65..113 of the visible box.
    expect(
      scrollTopToReveal({
        scrollTop: 168,
        clientHeight: PANEL.clientHeight,
        rowTop: rowTopAt(4),
        rowHeight: PANEL.rowHeight,
      }),
    ).toBe(168)
  })

  it("REFUSES TO MOVE an unmeasured panel — clientHeight 0 is jsdom and first paint", () => {
    // ⚠ NOT a rounding concern: with `clientHeight` 0 every row is "below the fold", so a
    // naive `bottom − clientHeight` would slam the panel to the bottom of its content on
    // the very first arrow press, before layout exists. jsdom reports 0 for every box, so
    // this branch is the one the whole component suite takes.
    expect(
      scrollTopToReveal({ scrollTop: 12, clientHeight: 0, rowTop: 329, rowHeight: 48 }),
    ).toBe(12)
    expect(
      scrollTopToReveal({ scrollTop: 0, clientHeight: 0, rowTop: 329, rowHeight: 48 }),
    ).toBe(0)
  })

  it("never returns a negative scrollTop, even for a row above the content box", () => {
    // A negative `rowTop` is what a mid-animation rect delta can produce. `scrollTop` is
    // clamped by the DOM anyway, but a negative here would silently mean "top" on one
    // browser and throw off any arithmetic layered on it later.
    expect(
      scrollTopToReveal({ scrollTop: 100, clientHeight: 209, rowTop: -40, rowHeight: 48 }),
    ).toBe(0)
    expect(
      scrollTopToReveal({ scrollTop: -50, clientHeight: 209, rowTop: 41, rowHeight: 48 }),
    ).toBe(0)
  })

  it("treats a negative row height as zero rather than as a reveal upward", () => {
    // `rowHeight` comes from a rect delta too. A negative one would make `bottom < top`
    // and could scroll the panel PAST the row it was asked to reveal.
    expect(
      scrollTopToReveal({ scrollTop: 0, clientHeight: 209, rowTop: 100, rowHeight: -80 }),
    ).toBe(0)
  })

  it.each([
    ["scrollTop NaN", { scrollTop: Number.NaN }],
    ["clientHeight NaN", { clientHeight: Number.NaN }],
    ["rowTop NaN", { rowTop: Number.NaN }],
    ["rowHeight NaN", { rowHeight: Number.NaN }],
    ["clientHeight Infinity", { clientHeight: Number.POSITIVE_INFINITY }],
    ["rowTop -Infinity", { rowTop: Number.NEGATIVE_INFINITY }],
  ])("returns a finite, non-negative number for %s", (_name, over) => {
    // ⚠ A NaN reaching `panel.scrollTop` is COERCED TO 0 by the DOM, silently — so the
    // menu would jump to the top on every single arrow press with no error anywhere. That
    // is a defect nothing would report and everything would blame on the animation.
    const out = scrollTopToReveal({
      scrollTop: 100,
      clientHeight: 209,
      rowTop: 329,
      rowHeight: 48,
      ...over,
    })
    expect(Number.isFinite(out)).toBe(true)
    expect(out).toBeGreaterThanOrEqual(0)
  })

  it("mutates nothing it is handed", () => {
    const input = { scrollTop: 0, clientHeight: 209, rowTop: 329, rowHeight: 48 }
    const frozen = JSON.stringify(input)
    scrollTopToReveal(input)
    expect(JSON.stringify(input)).toBe(frozen)
  })
})
