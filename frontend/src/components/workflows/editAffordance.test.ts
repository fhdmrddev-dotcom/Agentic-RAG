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
  pickerPlacement,
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
