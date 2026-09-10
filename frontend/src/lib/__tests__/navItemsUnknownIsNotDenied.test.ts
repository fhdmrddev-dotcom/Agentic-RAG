/**
 * Reported by the operator 2026-09-09: *"sometimes when I refresh, settings and control room does
 * not load"*, with a screenshot of a rail missing Workflows, Settings AND Control Room.
 *
 * ⛔ THE CAUSE: `visibleNavItems` filtered on `features[key] === true`, so while the
 * effective-features fetch was in flight — or after it FAILED — every governed key read
 * `undefined` and every governed door vanished. **"Not yet known" was rendered as "not allowed."**
 */
import { describe, expect, it } from "vitest"

import { NAV_ITEMS, visibleNavItems } from "../nav-items"

const governed = NAV_ITEMS.filter((i) => i.feature)

describe("visibleNavItems — unknown is not denied", () => {
  it("shows governed items while the features answer is still unknown", () => {
    // The reported bug, as one assertion: an empty features object is LOADING, not DENIED.
    const shown = visibleNavItems({} as never)
    for (const item of governed) {
      expect(shown, `${item.label} vanished while features were unknown`).toContainEqual(item)
    }
  })

  it("still hides an item the server has explicitly denied", () => {
    // ⚠ The positive control. Without it, "unknown shows" could mean "everything always shows",
    //   which would throw away the dead-click avoidance these entries were tagged for.
    const target = governed[0]
    const shown = visibleNavItems({ [target.feature!]: false } as never)
    expect(shown).not.toContainEqual(target)
  })

  it("shows an item the server has explicitly allowed", () => {
    const target = governed[0]
    const shown = visibleNavItems({ [target.feature!]: true } as never)
    expect(shown).toContainEqual(target)
  })

  it("never hides an ungoverned item, whatever the features say", () => {
    const ungoverned = NAV_ITEMS.filter((i) => !i.feature)
    expect(visibleNavItems({} as never)).toEqual(expect.arrayContaining(ungoverned))
  })
})
