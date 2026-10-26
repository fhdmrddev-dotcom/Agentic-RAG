/**
 * Phase 292-02 Task 2 (D-07 · UI-D-292-09 · I-3) — the ONE shared source tooltip.
 *
 * Anchored to the element (never the cursor), portalled into document.body with role=tooltip and a
 * stable id, header `{document ≤ 40} · p.{page}`, excerpt in OUR curly quotes truncated at 280, all
 * React text; Escape dismisses it (WCAG 1.4.13).
 */
import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { ArtifactTooltip, tooltipPosition } from "../ArtifactTooltip"

afterEach(() => cleanup())

function anchor(): HTMLElement {
  const el = document.createElement("button")
  document.body.appendChild(el)
  return el
}

describe("ArtifactTooltip — content", () => {
  it("renders role=tooltip with the id, header and quoted excerpt, portalled into document.body", () => {
    const el = anchor()
    render(
      <ArtifactTooltip
        id="a_dg1nv0c3x8-tip"
        anchor={el}
        source={{ document: "Procurement_Policy_v4.pdf", page: 2, excerpt: "All new vendors must be requested through the Vendor Request form." }}
        onDismiss={() => {}}
      />,
    )
    const tip = screen.getByRole("tooltip")
    expect(tip.id).toBe("a_dg1nv0c3x8-tip")
    expect(tip.parentElement).toBe(document.body)
    expect(screen.getByTestId("artifact-tooltip-header").textContent).toBe("Procurement_Policy_v4.pdf · p.2")
    expect(screen.getByTestId("artifact-tooltip-excerpt").textContent).toBe(
      "“All new vendors must be requested through the Vendor Request form.”",
    )
    expect(tip.className).toContain("pointer-events-none")
    expect(tip.className).toContain("bg-popover")
    expect(tip.querySelector("svg")).toHaveAttribute("aria-hidden", "true")
  })

  it("omits the page segment when there is none and truncates the document at 40", () => {
    const el = anchor()
    const long = "Northwind_Master_Services_Agreement_Final_v7_signed.pdf"
    render(<ArtifactTooltip id="t" anchor={el} source={{ document: long, page: null, excerpt: "x" }} onDismiss={() => {}} />)
    expect(screen.getByTestId("artifact-tooltip-header").textContent).toBe(`${long.slice(0, 39)}…`)
  })

  it("truncates the excerpt at 280 with an ellipsis, inside our quotes", () => {
    const el = anchor()
    const excerpt = "a".repeat(300)
    render(<ArtifactTooltip id="t" anchor={el} source={{ document: "d.pdf", page: null, excerpt }} onDismiss={() => {}} />)
    expect(screen.getByTestId("artifact-tooltip-excerpt").textContent).toBe(`“${"a".repeat(279)}…”`)
  })

  it("model or document markup stays text", () => {
    const el = anchor()
    render(
      <ArtifactTooltip
        id="t"
        anchor={el}
        source={{ document: "<img src=x onerror=alert(1)>", page: null, excerpt: "<script>alert(1)</script>" }}
        onDismiss={() => {}}
      />,
    )
    const tip = screen.getByRole("tooltip")
    expect(tip.querySelector("img")).toBeNull()
    expect(tip.querySelector("script")).toBeNull()
    expect(tip.textContent).toContain("<script>alert(1)</script>")
  })

  it("an excerpt-less source shows the header alone", () => {
    const el = anchor()
    render(<ArtifactTooltip id="t" anchor={el} source={{ document: "d.pdf", page: 4, excerpt: null }} onDismiss={() => {}} />)
    expect(screen.queryByTestId("artifact-tooltip-excerpt")).toBeNull()
    expect(screen.getByRole("tooltip").textContent).toBe("d.pdf · p.4")
  })

  it("Escape anywhere dismisses it", () => {
    const el = anchor()
    const onDismiss = vi.fn()
    render(<ArtifactTooltip id="t" anchor={el} source={{ document: "d.pdf", page: null, excerpt: "x" }} onDismiss={onDismiss} />)
    fireEvent.keyDown(document, { key: "Enter" })
    expect(onDismiss).not.toHaveBeenCalled()
    fireEvent.keyDown(document, { key: "Escape" })
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })
})

describe("ArtifactTooltip — 296-04 (292-IN-01): it follows its anchor while mounted", () => {
  function rect(top: number, left = 100): DOMRect {
    return { top, left, bottom: top + 40, right: left + 100, width: 100, height: 40, x: left, y: top, toJSON: () => ({}) } as DOMRect
  }

  it("a scroll re-places it at the anchor's new position, through one animation frame", () => {
    const el = anchor()
    let top = 400
    vi.spyOn(el, "getBoundingClientRect").mockImplementation(() => rect(top))
    const raf = vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
      cb(0)
      return 1
    })
    render(<ArtifactTooltip id="t" anchor={el} source={{ document: "d.pdf", page: 1, excerpt: "x" }} onDismiss={() => {}} />)
    const tip = screen.getByRole("tooltip")
    const before = tip.style.top
    top = 300
    fireEvent.scroll(window)
    expect(raf).toHaveBeenCalled()
    expect(tip.style.top).not.toBe(before)
    raf.mockRestore()
  })

  it("a resize re-places it too", () => {
    const el = anchor()
    let left = 100
    vi.spyOn(el, "getBoundingClientRect").mockImplementation(() => rect(400, left))
    const raf = vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
      cb(0)
      return 1
    })
    render(<ArtifactTooltip id="t" anchor={el} source={{ document: "d.pdf", page: 1, excerpt: "x" }} onDismiss={() => {}} />)
    const tip = screen.getByRole("tooltip")
    const before = tip.style.left
    left = 300
    fireEvent(window, new Event("resize"))
    expect(tip.style.left).not.toBe(before)
    raf.mockRestore()
  })

  it("dismisses when the anchor scrolls out of the viewport", () => {
    const el = anchor()
    let top = 400
    vi.spyOn(el, "getBoundingClientRect").mockImplementation(() => rect(top))
    const raf = vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
      cb(0)
      return 1
    })
    const onDismiss = vi.fn()
    render(<ArtifactTooltip id="t" anchor={el} source={{ document: "d.pdf", page: 1, excerpt: "x" }} onDismiss={onDismiss} />)
    top = -500
    fireEvent.scroll(window)
    expect(onDismiss).toHaveBeenCalledTimes(1)
    raf.mockRestore()
  })

  it("removes its scroll and resize listeners on unmount (T-296-13)", () => {
    const el = anchor()
    const remove = vi.spyOn(window, "removeEventListener")
    const { unmount } = render(
      <ArtifactTooltip id="t" anchor={el} source={{ document: "d.pdf", page: 1, excerpt: "x" }} onDismiss={() => {}} />,
    )
    unmount()
    const kinds = remove.mock.calls.map((c) => c[0])
    expect(kinds).toContain("scroll")
    expect(kinds).toContain("resize")
    remove.mockRestore()
  })
})

describe("tooltipPosition — anchored, deterministic placement", () => {
  const viewport = { width: 1000, height: 800 }
  const tip = { width: 200, height: 60 }

  it("above the element, left-aligned with it", () => {
    expect(tooltipPosition({ left: 100, top: 300, bottom: 344, right: 200 }, tip, viewport)).toEqual({ left: 100, top: 300 - 60 - 6 })
  })

  it("flips below when there are fewer than 8px above", () => {
    expect(tooltipPosition({ left: 100, top: 40, bottom: 84, right: 200 }, tip, viewport)).toEqual({ left: 100, top: 84 + 6 })
  })

  it("clamps 8px inside the viewport horizontally", () => {
    expect(tooltipPosition({ left: 900, top: 300, bottom: 344, right: 990 }, tip, viewport).left).toBe(1000 - 200 - 8)
    expect(tooltipPosition({ left: -20, top: 300, bottom: 344, right: 40 }, tip, viewport).left).toBe(8)
  })
})
