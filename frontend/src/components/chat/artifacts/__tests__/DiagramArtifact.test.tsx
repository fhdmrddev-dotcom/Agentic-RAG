/**
 * Phase 292-02 Task 2 (D-16 · D-07 · I-3 · UI-D-292-07 / -08 / -27) — the 2A flow renderer.
 *
 * HTML node boxes over ONE SVG edge layer, laid out by the pure `layoutDiagram`. These tests assert
 * what a person reads and touches: label TEXT (hostile markup stays text), the kind shape, the
 * dashed back edges, exactly a node's own edges lighting on hover AND focus, the roving tab stop,
 * the accessible names, and per-artifact marker ids. jsdom has no layout and no ResizeObserver, so
 * the body width is stubbed on `clientWidth` and the guarded observer path is skipped.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import { DiagramArtifact } from "../DiagramArtifact"
import { parseArtifactRecord, type ArtifactRecord } from "../artifactSpec"
import { diagramInvoice, mutable } from "./fixtures"

function rec(raw: unknown): ArtifactRecord {
  const r = parseArtifactRecord(raw)
  if (!r.ok) throw new Error(`fixture failed to parse: ${r.reason}`)
  return r.record
}

const original = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "clientWidth")

function stubWidth(px: number) {
  Object.defineProperty(HTMLElement.prototype, "clientWidth", { configurable: true, get: () => px })
}

beforeEach(() => stubWidth(862))

afterEach(() => {
  cleanup()
  if (original) Object.defineProperty(HTMLElement.prototype, "clientWidth", original)
})

function nodes() {
  return screen.getAllByTestId("diagram-node")
}

function paths(container: HTMLElement) {
  return Array.from(container.querySelectorAll<SVGPathElement>("path[data-edge]"))
}

function hotPaths(container: HTMLElement) {
  return paths(container).filter((p) => p.getAttribute("data-hot") === "true")
}

describe("DiagramArtifact — structure", () => {
  it("one node element per node, labels as TEXT, one edge path per edge", () => {
    const { container } = render(<DiagramArtifact record={rec(diagramInvoice)} />)
    expect(nodes().map((n) => n.textContent)).toEqual([
      "Invoice logged in the AP inbox",
      "Matches the purchase order?",
      "Query the supplier",
      "Invoice rejected",
      "Budget holder approves",
      "Schedule payment",
      "Post to the ledger",
      "Invoice paid",
    ])
    expect(paths(container)).toHaveLength(9)
    const group = screen.getByRole("group")
    expect(group).toHaveAttribute("aria-roledescription", "flow diagram")
    expect(group).toHaveAttribute("aria-label", "Flow diagram: How an invoice gets approved. 8 steps, 9 links.")
  })

  it("a hostile label renders verbatim as text and creates no element", () => {
    const hostile = mutable(diagramInvoice)
    hostile.spec.diagram.nodes[2].label = "<img src=x onerror=alert(1)>"
    hostile.spec.diagram.edges[1].label = "<b>x</b>"
    const { container } = render(<DiagramArtifact record={rec(hostile)} />)
    expect(nodes()[2].textContent).toBe("<img src=x onerror=alert(1)>")
    expect(container.querySelector("img")).toBeNull()
    expect(container.querySelector("b")).toBeNull()
    expect(container.textContent).toContain("<b>x</b>")
  })

  it("the kind is carried by the shape: pill for start / end, hexagon for decision, rounded rect for step", () => {
    render(<DiagramArtifact record={rec(diagramInvoice)} />)
    const [start, decision, step, end] = nodes()
    expect(start).toHaveAttribute("data-kind", "start")
    expect(start.className).toContain("rounded-full")
    expect(end.className).toContain("rounded-full")
    expect(step.className).toContain("rounded-lg")
    expect(decision).toHaveAttribute("data-kind", "decision")
    expect(decision.querySelector("[data-hexagon]")).not.toBeNull()
    expect((decision.querySelector("[data-hexagon]") as HTMLElement).style.clipPath).toContain("polygon(")
  })

  it("back edges, and only back edges, are dashed", () => {
    const { container } = render(<DiagramArtifact record={rec(diagramInvoice)} />)
    const dashed = paths(container).filter((p) => p.getAttribute("stroke-dasharray") === "4 4")
    expect(dashed.map((p) => p.getAttribute("data-edge"))).toEqual(["3", "5"])
  })

  it("edge labels are aria-hidden text; the svg is hidden from assistive tech", () => {
    const { container } = render(<DiagramArtifact record={rec(diagramInvoice)} />)
    const svg = container.querySelector("svg")!
    expect(svg).toHaveAttribute("aria-hidden", "true")
    expect(svg).toHaveAttribute("focusable", "false")
    const labels = screen.getAllByTestId("diagram-edge-label")
    expect(labels.map((l) => l.textContent)).toEqual([
      "Matches",
      "Doesn't match",
      "Corrected invoice",
      "Supplier disputes",
      "Reminder after 3 days",
    ])
    for (const l of labels) expect(l).toHaveAttribute("aria-hidden", "true")
  })

  it("292-REVIEW WR-04: edge labels are bounded, truncated with a title, and painted after the nodes", () => {
    const { container } = render(<DiagramArtifact record={rec(diagramInvoice)} />)
    const labels = screen.getAllByTestId("diagram-edge-label")
    for (const l of labels) {
      expect(l.className).toContain("truncate")
      expect(l.getAttribute("title")).toBe(l.textContent)
      expect(Number.parseFloat(l.style.maxWidth)).toBeGreaterThan(0)
    }
    // Painted after every node, so a back-edge label crossing the node area stays readable.
    const all = Array.from(container.querySelectorAll('[data-testid="diagram-node"], [data-testid="diagram-edge-label"]'))
    const lastNode = Math.max(...all.map((el, i) => (el.getAttribute("data-testid") === "diagram-node" ? i : -1)))
    const firstLabel = all.findIndex((el) => el.getAttribute("data-testid") === "diagram-edge-label")
    expect(firstLabel).toBeGreaterThan(lastNode)
  })

  it("marker ids come from useId and differ between two diagrams on one page; no fixed id", () => {
    const { container } = render(
      <>
        <DiagramArtifact record={rec(diagramInvoice)} />
        <DiagramArtifact record={rec(diagramInvoice)} />
      </>,
    )
    const ids = Array.from(container.querySelectorAll("marker")).map((m) => m.id)
    expect(ids).toHaveLength(4)
    expect(new Set(ids).size).toBe(4)
    expect(ids).not.toContain("ah")
    for (const id of ids) expect(id).toMatch(/^[A-Za-z0-9_-]+$/)
    const first = paths(container)[0].getAttribute("marker-end")
    expect(first).toBe(`url(#${ids[0]})`)
  })

  it("model node ids never reach a DOM id or attribute", () => {
    const { container } = render(<DiagramArtifact record={rec(diagramInvoice)} />)
    const html = container.innerHTML
    for (const id of ["approve", "match", "reject"]) {
      expect(html).not.toContain(`"${id}"`)
      expect(html).not.toContain(`#${id}`)
    }
  })

  it("lays out to the measured width and never scrolls sideways", () => {
    stubWidth(311)
    const { container } = render(<DiagramArtifact record={rec(diagramInvoice)} />)
    const root = screen.getByTestId("artifact-diagram")
    expect(root.className).not.toMatch(/overflow-x/)
    for (const n of nodes()) {
      const left = parseFloat(n.style.left)
      const width = parseFloat(n.style.width)
      expect(left).toBeGreaterThanOrEqual(0)
      expect(left + width).toBeLessThanOrEqual(311)
    }
    expect(container.querySelector("svg")).toHaveAttribute("width", "311")
  })

  it("a 1-node diagram renders one centred node and no edges", () => {
    const one = mutable(diagramInvoice)
    one.spec.diagram.nodes = [one.spec.diagram.nodes[0]]
    one.spec.diagram.edges = []
    one.row_count = 1
    one.caption.row_count = 1
    const { container } = render(<DiagramArtifact record={rec(one)} />)
    expect(nodes()).toHaveLength(1)
    expect(paths(container)).toHaveLength(0)
  })
})

describe("DiagramArtifact — highlight on hover AND focus", () => {
  it("hovering a node lights exactly its incident edges and dims the rest", () => {
    const { container } = render(<DiagramArtifact record={rec(diagramInvoice)} />)
    const match = nodes()[1] // log → match, match → approve, match → query
    fireEvent.pointerEnter(match)
    expect(hotPaths(container).map((p) => p.getAttribute("data-edge"))).toEqual(["0", "1", "2"])
    const cold = paths(container).filter((p) => p.getAttribute("data-hot") !== "true")
    for (const p of cold) expect(p.getAttribute("class")).toContain("opacity-25")
    // It and its neighbours are lit; the others dim.
    const lit = nodes().filter((n) => n.getAttribute("data-hot") === "true")
    expect(lit.map((n) => n.textContent)).toEqual([
      "Invoice logged in the AP inbox",
      "Matches the purchase order?",
      "Query the supplier",
      "Budget holder approves",
    ])
    expect(nodes()[7].className).toContain("opacity-45")
    fireEvent.pointerLeave(match)
    expect(hotPaths(container)).toHaveLength(0)
    expect(nodes()[7].className).not.toContain("opacity-45")
  })

  it("focusing a node lights its edges (count == degree); blur returns to rest", () => {
    const { container } = render(<DiagramArtifact record={rec(diagramInvoice)} />)
    const approve = nodes()[4] // match → approve, approve ↺, approve → pay
    act(() => approve.focus())
    expect(hotPaths(container)).toHaveLength(3)
    act(() => approve.blur())
    expect(hotPaths(container)).toHaveLength(0)
  })

  it("Escape clears the highlight and the tooltip, keeping focus", () => {
    const { container } = render(<DiagramArtifact record={rec(diagramInvoice)} />)
    const log = nodes()[0]
    act(() => log.focus())
    expect(screen.getByRole("tooltip")).toBeInTheDocument()
    fireEvent.keyDown(log, { key: "Escape" })
    expect(hotPaths(container)).toHaveLength(0)
    expect(screen.queryByRole("tooltip")).toBeNull()
    expect(document.activeElement).toBe(log)
  })
})

describe("DiagramArtifact — keyboard: one tab stop, roving through reading order", () => {
  it("only one node is in the tab order; arrows, Home and End move it", () => {
    render(<DiagramArtifact record={rec(diagramInvoice)} />)
    const all = nodes()
    expect(all.filter((n) => n.tabIndex === 0)).toHaveLength(1)
    expect(all[0].tabIndex).toBe(0)
    act(() => all[0].focus())
    fireEvent.keyDown(all[0], { key: "ArrowDown" })
    expect(document.activeElement).toBe(all[1])
    fireEvent.keyDown(all[1], { key: "ArrowRight" })
    expect(document.activeElement).toBe(all[2]) // rank 2: query first
    fireEvent.keyDown(all[2], { key: "ArrowRight" })
    expect(document.activeElement).toBe(all[4]) // then approve (reading order, not spec order)
    fireEvent.keyDown(all[4], { key: "ArrowLeft" })
    expect(document.activeElement).toBe(all[2])
    fireEvent.keyDown(all[2], { key: "End" })
    expect(document.activeElement).toBe(all[7])
    fireEvent.keyDown(all[7], { key: "Home" })
    expect(document.activeElement).toBe(all[0])
    fireEvent.keyDown(all[0], { key: "ArrowUp" })
    expect(document.activeElement).toBe(all[0])
    expect(nodes().filter((n) => n.tabIndex === 0)).toEqual([all[0]])
  })

  it("the last focused node keeps the tab stop", () => {
    render(<DiagramArtifact record={rec(diagramInvoice)} />)
    const all = nodes()
    act(() => all[5].focus())
    act(() => all[5].blur())
    expect(nodes().filter((n) => n.tabIndex === 0)).toEqual([all[5]])
  })
})

describe("DiagramArtifact — screen readers", () => {
  it("each node is role=img with a name naming its kind and its relations", () => {
    render(<DiagramArtifact record={rec(diagramInvoice)} />)
    const all = nodes()
    for (const n of all) expect(n).toHaveAttribute("role", "img")
    expect(all[0]).toHaveAttribute(
      "aria-label",
      "Invoice logged in the AP inbox. Start. Leads to Matches the purchase order?. Comes from Query the supplier.",
    )
    expect(all[1]).toHaveAttribute(
      "aria-label",
      'Matches the purchase order?. Decision. Leads to Budget holder approves, "Matches"; Query the supplier, "Doesn\'t match". Comes from Invoice logged in the AP inbox.',
    )
    expect(all[2]).toHaveAttribute(
      "aria-label",
      'Query the supplier. Step. Leads to Invoice rejected, "Supplier disputes". Loops back to Invoice logged in the AP inbox, "Corrected invoice". Comes from Matches the purchase order?.',
    )
    expect(all[4]).toHaveAttribute(
      "aria-label",
      'Budget holder approves. Step. Leads to Schedule payment. Loops back to Budget holder approves, "Reminder after 3 days". Comes from Matches the purchase order?.',
    )
    expect(all[7]).toHaveAttribute("aria-label", "Invoice paid. End. Comes from Post to the ledger.")
  })
})

describe("DiagramArtifact — the source tooltip", () => {
  it("focus on a sourced node shows the tooltip, linked by aria-describedby", () => {
    render(<DiagramArtifact record={rec(diagramInvoice)} />)
    const log = nodes()[0]
    act(() => log.focus())
    const tip = screen.getByRole("tooltip")
    expect(tip.id).toBe("a_dg1nv0c3x8-tip")
    expect(log).toHaveAttribute("aria-describedby", "a_dg1nv0c3x8-tip")
    expect(within(tip).getByText("Invoice_Policy.pdf · p.3")).toBeInTheDocument()
    expect(tip.textContent).toContain("“Every supplier invoice is logged in the AP inbox on the day it arrives.”")
    // Portalled out of the card, so the card's overflow-hidden never clips it.
    expect(tip.parentElement).toBe(document.body)
    act(() => log.blur())
    expect(screen.queryByRole("tooltip")).toBeNull()
    expect(log).not.toHaveAttribute("aria-describedby")
  })

  it("hovering a node with no source shows no tooltip but still lights its edges", () => {
    const { container } = render(<DiagramArtifact record={rec(diagramInvoice)} />)
    const query = nodes()[2]
    fireEvent.pointerEnter(query)
    expect(screen.queryByRole("tooltip")).toBeNull()
    expect(hotPaths(container)).toHaveLength(3)
  })
})
