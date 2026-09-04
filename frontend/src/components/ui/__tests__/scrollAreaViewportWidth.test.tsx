import { describe, expect, it } from "vitest"
import { render } from "@testing-library/react"
import { ScrollArea } from "../scroll-area"

/**
 * ⛔ BUG-260902-02 — 99 PX OF EVERY LINE WAS SILENTLY THROWN AWAY.
 *
 * Operator, 2026-09-02: *"even generated text is extending beyond the available space."*
 * Measured on one assistant message, with a negative control on the SAME message:
 *
 *   panel CLOSED → viewport 974 px, content 896 px  → fits, 39 px slack
 *   panel OPEN   → viewport 718 px, content 865 px  → **99 px discarded**
 *
 * ── THE CAUSE IS RADIX'S OWN INJECTED CHILD, NOT OUR MARKUP ─────────────────────────────
 *
 * `ScrollAreaPrimitive.Viewport` renders a wrapper div we never wrote, carrying
 * `display: table; min-width: 100%`. **A table shrink-wraps to its content**, so a wide
 * child (a fenced code block, a table, a long token) makes that wrapper wider than the
 * viewport instead of forcing the child to wrap. The viewport is `overflow-x: hidden`, so
 * the excess is not scrollable, not ellipsised, and **not reachable** — it is simply gone,
 * with nothing on screen to say so. On the observed message the lost fragment was
 * `for v in r]`: copyable code, truncated in silence.
 *
 * ⚠ Radix uses `display: table` ONLY so the viewport can measure content width for a
 * HORIZONTAL scrollbar. **This application renders none** — `grep 'orientation="horizontal"'`
 * across `frontend/src` returns nothing, and `<ScrollArea` has exactly two call sites
 * (`MessageList.tsx`, `ReadDocumentBody.tsx`), both vertical. So the measurement the table
 * layout exists to enable is measurement nobody consumes, and forcing `display: block`
 * costs this codebase nothing while making the child obey the viewport's width.
 *
 * ⚠ WHAT THIS TEST CAN AND CANNOT PROVE, said plainly rather than implied: **jsdom does not
 * do layout**, so it cannot observe the 99 px. It pins the OVERRIDE — that the viewport
 * carries the class which produces the fix — and nothing more. The clipping itself was
 * verified in a real browser and must be re-verified there after any change here. A test
 * that quietly implied it had measured the pixels would be the worse kind of green.
 */
describe("BUG-260902-02 · the ScrollArea viewport child must not shrink-wrap wider than the viewport", () => {
  it("⭐ forces Radix's injected viewport child to display:block", () => {
    const { container } = render(
      <ScrollArea className="flex-1">
        <div data-testid="content">hello</div>
      </ScrollArea>,
    )
    const viewport = container.querySelector("[data-radix-scroll-area-viewport]")
    expect(viewport).not.toBeNull()
    // ⚠ Asserted on the VIEWPORT's class, because the child it wraps is created by Radix at
    // runtime and is not ours to address directly — the override has to be a descendant
    // selector on the element we DO control.
    expect(viewport!.className).toContain("[&>div]:!block")
  })

  it("still renders its children — the override must not break the primitive", () => {
    const { getByTestId } = render(
      <ScrollArea>
        <div data-testid="content">hello</div>
      </ScrollArea>,
    )
    expect(getByTestId("content")).toBeInTheDocument()
  })
})
