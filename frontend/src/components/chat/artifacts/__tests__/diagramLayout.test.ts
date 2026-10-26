/**
 * Phase 292-02 Task 2 (D-16 · UI-D-292-05 / -06) — the pure diagram layout.
 *
 * `layoutDiagram(spec, width)` is a pure function of the spec and the body width: DFS back edges,
 * longest-path ranks over forward edges, spec order within a rank, row wrap at the 88px minimum,
 * a 48px right gutter only when there is a back edge, and node heights from a per-line estimate.
 * These tests assert GEOMETRY a person would see break (overlap, overflow, dashed loops), not the
 * presence of fields.
 */
import { describe, expect, it } from "vitest"
import { CHAR_WIDTH, LABEL_PAD_X, layoutDiagram, type DiagramLayout } from "../diagramLayout"
import { parseArtifactRecord, type DiagramEncoding, type DiagramNode } from "../artifactSpec"
import { diagramInvoice } from "./fixtures"

function invoice(): DiagramEncoding {
  const r = parseArtifactRecord(diagramInvoice)
  if (!r.ok || !r.record.spec.diagram) throw new Error("fixture must parse")
  return r.record.spec.diagram
}

function node(id: string, label = `Step ${id}`, kind: DiagramNode["kind"] = "step"): DiagramNode {
  return { id, label, kind, source: null }
}

function edge(from: string, to: string, label: string | null = null) {
  return { from, to, label }
}

function intersects(a: DiagramLayout["nodes"][number], b: DiagramLayout["nodes"][number]): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height
}

function assertNoOverlapAndInside(l: DiagramLayout, width: number) {
  for (let i = 0; i < l.nodes.length; i++) {
    const n = l.nodes[i]
    expect(n.x, `node ${i} left`).toBeGreaterThanOrEqual(0)
    expect(n.x + n.width, `node ${i} right`).toBeLessThanOrEqual(width)
    for (let j = i + 1; j < l.nodes.length; j++) {
      expect(intersects(n, l.nodes[j]), `nodes ${i} and ${j} overlap`).toBe(false)
    }
  }
  expect(l.width).toBe(width)
}

describe("layoutDiagram — fits the body without overlap", () => {
  for (const width of [311, 862]) {
    it(`the invoice flow at ${width}px: no overlap, inside [0, width], height = last bottom + 8`, () => {
      const l = layoutDiagram(invoice(), width)
      expect(l.nodes).toHaveLength(8)
      expect(l.edges).toHaveLength(9)
      assertNoOverlapAndInside(l, width)
      const bottom = Math.max(...l.nodes.map((n) => n.rowTop + n.rowHeight))
      expect(l.height).toBe(bottom + 8)
    })
  }

  it("is pure and deterministic: two calls give identical results", () => {
    expect(layoutDiagram(invoice(), 311)).toEqual(layoutDiagram(invoice(), 311))
    expect(JSON.stringify(layoutDiagram(invoice(), 862))).toBe(JSON.stringify(layoutDiagram(invoice(), 862)))
  })

  it("a wide diagram (5 options per rank, 25 nodes) never overlaps at either width", () => {
    const nodes = Array.from({ length: 25 }, (_, i) => node(`n${i}`, `A fairly long step label number ${i}`))
    const edges = Array.from({ length: 20 }, (_, i) => edge(`n${Math.floor(i / 5)}`, `n${5 + i}`))
    for (const width of [311, 375, 862]) {
      assertNoOverlapAndInside(layoutDiagram({ nodes, edges }, width), width)
    }
  })
})

describe("layoutDiagram — back edges", () => {
  it("in a → b → c → a, c → a is back; forward edges are not", () => {
    const l = layoutDiagram({ nodes: [node("a"), node("b"), node("c")], edges: [edge("a", "b"), edge("b", "c"), edge("c", "a")] }, 862)
    expect(l.edges.map((e) => e.back)).toEqual([false, false, true])
    expect(l.hasBack).toBe(true)
  })

  it("the invoice flow: the corrected-invoice return and the labelled self-loop are back edges", () => {
    const l = layoutDiagram(invoice(), 862)
    const back = l.edges.filter((e) => e.back).map((e) => e.index)
    expect(back).toEqual([3, 5])
    expect(l.edges[5].selfLoop).toBe(true)
    expect(l.edges[3].selfLoop).toBe(false)
  })

  it("the 48px gutter is reserved only when a back edge exists", () => {
    const chain = layoutDiagram({ nodes: [node("a"), node("b")], edges: [edge("a", "b")] }, 311)
    expect(chain.hasBack).toBe(false)
    expect(chain.usableWidth).toBe(311)
    const loop = layoutDiagram({ nodes: [node("a"), node("b")], edges: [edge("a", "b"), edge("b", "a", "Again")] }, 311)
    expect(loop.usableWidth).toBe(311 - 48)
    // Every node sits left of the gutter.
    for (const n of loop.nodes) expect(n.x + n.width).toBeLessThanOrEqual(311 - 48)
  })

  it("a back edge bends through the gutter at rx = width − 8 − 8·(j mod 4); a self-loop takes no lane", () => {
    const l = layoutDiagram(
      { nodes: [node("a"), node("b"), node("c")], edges: [edge("a", "b"), edge("b", "c"), edge("c", "a"), edge("c", "c", "Retry"), edge("c", "b")] },
      862,
    )
    expect(l.edges.map((e) => e.back)).toEqual([false, false, true, true, true])
    expect(l.edges[2].gutterX).toBe(862 - 8)
    expect(l.edges[3].gutterX).toBeNull()
    expect(l.edges[4].gutterX).toBe(862 - 16)
    expect(l.edges[2].path).toContain(`${862 - 8}`)
    expect(l.edges[2].labelAlign).toBe("end")
  })
})

describe("layoutDiagram — ranks and rows", () => {
  it("ranks follow the longest path over forward edges; order within a rank follows the spec", () => {
    const l = layoutDiagram(invoice(), 862)
    // log 0 · match 1 · query 2 · reject 3 · approve 2 · pay 3 · post 4 · paid 5
    expect(l.nodes.map((n) => n.rank)).toEqual([0, 1, 2, 3, 2, 3, 4, 5])
    // Rank 2 holds query (spec index 2) before approve (spec index 4).
    const rank2 = l.order.filter((i) => l.nodes[i].rank === 2)
    expect(rank2).toEqual([2, 4])
    expect(l.nodes[2].x).toBeLessThan(l.nodes[4].x)
  })

  it("a longest path wins over a short cut", () => {
    const l = layoutDiagram({ nodes: [node("a"), node("b"), node("c")], edges: [edge("a", "c"), edge("a", "b"), edge("b", "c")] }, 862)
    expect(l.nodes.map((n) => n.rank)).toEqual([0, 1, 2])
  })

  it("5 nodes at rank 0 in 311px wrap into rows of 3 then 2", () => {
    const l = layoutDiagram({ nodes: ["a", "b", "c", "d", "e"].map((id) => node(id)), edges: [] }, 311)
    expect(l.nodes.map((n) => n.row)).toEqual([0, 0, 0, 1, 1])
    expect(l.nodes.every((n) => n.rank === 0)).toBe(true)
    expect(l.nodes[3].y).toBeGreaterThan(l.nodes[0].y)
  })

  it("reading order is rank, then left to right", () => {
    const l = layoutDiagram(invoice(), 862)
    expect(l.order).toEqual([0, 1, 2, 4, 3, 5, 6, 7])
  })
})

describe("layoutDiagram — node sizes", () => {
  it("node width clamps to 88..192, decisions to ≤ 160", () => {
    const wide = layoutDiagram({ nodes: [node("a", "Go", "decision"), node("b")], edges: [edge("a", "b")] }, 862)
    expect(wide.nodes[1].width).toBe(192)
    expect(wide.nodes[0].width).toBe(160)
    const many = layoutDiagram({ nodes: ["a", "b", "c", "d", "e"].map((id) => node(id)), edges: [] }, 311)
    for (const n of many.nodes) expect(n.width).toBeGreaterThanOrEqual(88)
    expect(many.nodes[0].width).toBe(93) // perRow 3 at 311px: floor((311 − 32) / 3)
  })

  it("height = 44 + 16·(lines − 1), at most 4 lines", () => {
    const short = layoutDiagram({ nodes: [node("a", "Pay"), node("b")], edges: [edge("a", "b")] }, 311)
    expect(short.nodes[0].height).toBe(44)
    expect(short.nodes[0].lines).toBe(1)
    const long = layoutDiagram({ nodes: [node("a", "x".repeat(48)), node("b", "y".repeat(48)), node("c", "z".repeat(48))], edges: [] }, 311)
    // 93px wide, padX 24 → floor(69 / 6.6) = 10 characters a line → ceil(48 / 10) = 5 → clamped to 4.
    expect(long.nodes[0].lines).toBe(4)
    expect(long.nodes[0].height).toBe(44 + 16 * 3)
  })

  it("a row's height is its tallest node, and shorter nodes centre in it", () => {
    const l = layoutDiagram({ nodes: [node("a", "x".repeat(40)), node("b", "Pay")], edges: [] }, 311)
    expect(l.nodes[0].rowHeight).toBe(l.nodes[0].height)
    expect(l.nodes[1].y + l.nodes[1].height / 2).toBe(l.nodes[0].y + l.nodes[0].height / 2)
  })
})

describe("layoutDiagram — edge cases", () => {
  it("1 node renders centred with no edges", () => {
    const l = layoutDiagram({ nodes: [node("a")], edges: [] }, 311)
    expect(l.nodes).toHaveLength(1)
    expect(l.edges).toHaveLength(0)
    expect(l.nodes[0].cx).toBe(311 / 2)
    expect(l.height).toBe(8 + 44 + 8)
  })

  it("several nodes with no edges sit at rank 0", () => {
    const l = layoutDiagram({ nodes: [node("a"), node("b")], edges: [] }, 862)
    expect(l.nodes.map((n) => n.rank)).toEqual([0, 0])
  })

  it("a 25-node chain renders 25 rows", () => {
    const nodes = Array.from({ length: 25 }, (_, i) => node(`n${i}`))
    const edges = Array.from({ length: 24 }, (_, i) => edge(`n${i}`, `n${i + 1}`))
    const l = layoutDiagram({ nodes, edges }, 311)
    expect(new Set(l.nodes.map((n) => n.row)).size).toBe(25)
    expect(l.height).toBe(8 + 25 * 44 + 24 * 36 + 8)
  })

  it("forward edges run from the source's bottom to 3px above the target's top", () => {
    const l = layoutDiagram({ nodes: [node("a"), node("b")], edges: [edge("a", "b", "Next")] }, 311)
    const [a, b] = l.nodes
    const e = l.edges[0]
    expect(e.path.startsWith(`M${a.cx},${a.y + a.height} C`)).toBe(true)
    expect(e.path.endsWith(`${b.cx},${b.y - 3}`)).toBe(true)
    expect(e.labelX).toBe((a.cx + b.cx) / 2)
    expect(e.labelY).toBe((a.y + a.height + b.y - 3) / 2)
    expect(e.labelAlign).toBe("center")
  })

  it("a labelled self-loop arcs off the node's right edge and labels to its right", () => {
    const l = layoutDiagram({ nodes: [node("a"), node("b")], edges: [edge("a", "b"), edge("a", "a", "Retry")] }, 311)
    const loop = l.edges[1]
    const a = l.nodes[0]
    expect(loop.selfLoop).toBe(true)
    expect(loop.back).toBe(true)
    expect(loop.path.startsWith(`M${a.x + a.width},${a.cy - 8}`)).toBe(true)
    expect(loop.labelAlign).toBe("start")
    expect(loop.labelX).toBeGreaterThan(a.x + a.width)
  })

  it("292-REVIEW WR-04: every edge label's drawn extent stays inside [0, width]", () => {
    const est = (label: string) => label.length * CHAR_WIDTH + LABEL_PAD_X
    const check = (l: DiagramLayout, labels: Array<string | null>, width: number) => {
      l.edges.forEach((e, k) => {
        const label = labels[k]
        if (!label) return
        const drawn = Math.min(est(label), e.labelMaxWidth)
        expect(e.labelMaxWidth, `edge ${k} max width`).toBeGreaterThan(0)
        const [lo, hi] =
          e.labelAlign === "start" ? [e.labelX, e.labelX + drawn]
          : e.labelAlign === "end" ? [e.labelX - drawn, e.labelX]
          : [e.labelX - drawn / 2, e.labelX + drawn / 2]
        expect(lo, `edge ${k} left`).toBeGreaterThanOrEqual(0)
        expect(hi, `edge ${k} right`).toBeLessThanOrEqual(width)
      })
    }
    // The review's case: one self-looped node per row at 311px with a 24-character loop label.
    const loopLabel = "Reminder after five days"
    expect(loopLabel).toHaveLength(24)
    const lonely = { nodes: [node("a"), node("b")], edges: [edge("a", "b"), edge("b", "b", loopLabel)] }
    const l311 = layoutDiagram(lonely, 311)
    check(l311, lonely.edges.map((e) => e.label), 311)
    expect(l311.edges[1].labelMaxWidth).toBeLessThan(est(loopLabel)) // it is truncated, not clipped
    // Long back-edge and forward labels, and the invoice flow, at both widths.
    const busy = {
      nodes: [node("a"), node("b"), node("c")],
      edges: [edge("a", "b", "Approved by the budget"), edge("b", "c", "x".repeat(24)), edge("c", "a", "Sent back for correction")],
    }
    for (const width of [311, 862]) {
      check(layoutDiagram(busy, width), busy.edges.map((e) => e.label), width)
      check(layoutDiagram(invoice(), width), invoice().edges.map((e) => e.label), width)
    }
  })

  it("296-04 (292-WR-04-res): no back-edge label box intersects any node box at 311px or 640px", () => {
    // A label is text-xs at line-height 1.4 (16.8px), centred on labelY; its drawn width is the
    // estimate, truncated at labelMaxWidth. Measured as boxes, never as a field's presence.
    const LABEL_H = 17
    const est = (label: string) => label.length * CHAR_WIDTH + LABEL_PAD_X
    const busy = {
      nodes: [node("a"), node("b"), node("c")],
      edges: [edge("a", "b", "Approved by the budget"), edge("b", "c", "x".repeat(24)), edge("c", "a", "Sent back for correction")],
    }
    const specs: DiagramEncoding[] = [invoice(), busy]
    for (const spec of specs) {
      for (const width of [311, 640]) {
        const l = layoutDiagram(spec, width)
        let backLabels = 0
        l.edges.forEach((e, k) => {
          const label = spec.edges[k].label
          if (!label || !e.back || e.selfLoop) return
          backLabels++
          const drawn = Math.min(est(label), e.labelMaxWidth)
          expect(drawn, `edge ${k} at ${width}px has no room to draw`).toBeGreaterThan(0)
          const box = { x: e.labelX - drawn, y: e.labelY - LABEL_H / 2, width: drawn, height: LABEL_H }
          for (const n of l.nodes) {
            const hit = box.x < n.x + n.width && n.x < box.x + box.width && box.y < n.y + n.height && n.y < box.y + box.height
            expect(hit, `back-edge label ${k} ("${label}") sits on node ${n.index} at ${width}px`).toBe(false)
          }
        })
        expect(backLabels, "the fixture must carry a labelled back edge").toBeGreaterThan(0)
      }
    }
  })
})
