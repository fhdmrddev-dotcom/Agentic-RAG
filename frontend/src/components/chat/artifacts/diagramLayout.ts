/**
 * Phase 292-02 (D-16 · D-19 · UI-D-292-05 / -06 / -27) — THE DIAGRAM LAYOUT, AND IT IS OURS.
 *
 * `layoutDiagram(spec, width)` is a PURE function of the validated spec and the body width: no UI
 * framework, no page access, no clock, no randomness. The model sends no coordinates; the same
 * stored spec at the same width always lays out the same way, which is what keeps live == reload
 * (I-2). No layout library is used (D-19); this is the UI-SPEC's 14-step algorithm:
 *
 *   1. back edges by an ITERATIVE depth-first walk — roots are the nodes with no incoming edge (a
 *      self-loop does not count), in spec order, then any unvisited node in spec order; an edge to
 *      a node on the walk's stack is a back edge, and a self-loop is always one;
 *   2. ranks = the longest path over FORWARD edges, in topological (Kahn) order — O(N + E);
 *   3. spec order within a rank (no crossing minimisation: the approved sketch's behaviour);
 *   4. usable width = body width − 48 when any back edge exists (the right-hand gutter);
 *   5. rows of at most `perRow` nodes (88px minimum + 16px gap), one width `nw` for the whole diagram;
 *   6. centred spread with step `max(nw + 16, min(Wn / k, nw + 96))` — never overlaps;
 *   7. node height from a 6.6px-per-character line estimate, 44px + 16px a line, at most 4 lines;
 *   8. rows 36px apart, 8px padding top and bottom;
 *   9-12. edge paths and label anchors (forward cubic, gutter back edge, labelled self-loop arc).
 *
 * ⚠ Model node ids are used here ONLY as map keys while laying out. Everything returned is a plain
 * number, a path string built from numbers, or an array index — the renderer never needs an id for
 * a DOM id, a reference or a key (T-292-13).
 */
import type { DiagramEncoding, NodeKind } from "./artifactSpec"

export const GUTTER = 48
export const NODE_GAP = 16
export const MIN_NODE_WIDTH = 88
export const MAX_NODE_WIDTH = 192
export const MAX_DECISION_WIDTH = 160
export const ROW_GAP = 36
export const PAD_Y = 8
export const BASE_NODE_HEIGHT = 44
export const LINE_HEIGHT = 16
export const MAX_LINES = 4
/** The per-character width estimate for 12px Inter (so the layout needs no measuring pass). */
export const CHAR_WIDTH = 6.6
/** Horizontal label padding: `px-3` each side for step / start / end, `px-5` for a decision. */
const PAD_X: Record<NodeKind, number> = { step: 24, start: 24, end: 24, decision: 40 }

export interface PlacedNode {
  index: number
  kind: NodeKind
  rank: number
  /** The visual row (a wide rank wraps onto several rows). */
  row: number
  x: number
  y: number
  width: number
  height: number
  cx: number
  cy: number
  lines: number
  rowTop: number
  rowHeight: number
}

export interface PlacedEdge {
  index: number
  /** Spec indexes of the two ends. */
  from: number
  to: number
  back: boolean
  selfLoop: boolean
  path: string
  labelX: number
  labelY: number
  /** How the label sits on its anchor: centred (forward), ending at it (back), starting at it (loop). */
  labelAlign: "center" | "end" | "start"
  /** The gutter x a back edge bends through; null for a forward edge or a self-loop. */
  gutterX: number | null
}

export interface DiagramLayout {
  width: number
  height: number
  /** The width nodes may occupy: `width` minus the gutter when there is a back edge. */
  usableWidth: number
  hasBack: boolean
  nodes: PlacedNode[]
  edges: PlacedEdge[]
  /** Spec indexes in reading order: rank, then left to right. */
  order: number[]
}

/** Two decimals in a path string, so the output is stable and short. */
function r2(v: number): number {
  return Math.round(v * 100) / 100
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v))
}

/** Step 1: which edges are back edges (iterative DFS; deterministic for a given spec). */
function findBackEdges(n: number, from: number[], to: number[], out: number[][]): boolean[] {
  const back = from.map(() => false)
  const state = new Array<number>(n).fill(0) // 0 unseen · 1 on the stack · 2 done
  const indeg = new Array<number>(n).fill(0)
  for (let k = 0; k < from.length; k++) if (from[k] !== to[k]) indeg[to[k]]++
  const roots: number[] = []
  for (let i = 0; i < n; i++) if (indeg[i] === 0) roots.push(i)
  for (let i = 0; i < n; i++) roots.push(i)

  for (const root of roots) {
    if (state[root] !== 0) continue
    const stack: Array<{ u: number; next: number }> = [{ u: root, next: 0 }]
    state[root] = 1
    while (stack.length > 0) {
      const frame = stack[stack.length - 1]
      if (frame.next < out[frame.u].length) {
        const k = out[frame.u][frame.next++]
        const v = to[k]
        if (state[v] === 1) back[k] = true // on the stack — includes a self-loop
        else if (state[v] === 0) {
          state[v] = 1
          stack.push({ u: v, next: 0 })
        }
      } else {
        state[frame.u] = 2
        stack.pop()
      }
    }
  }
  return back
}

/** Step 2: longest-path ranks over forward edges, in Kahn order. */
function rankNodes(n: number, from: number[], to: number[], out: number[][], back: boolean[]): number[] {
  const rank = new Array<number>(n).fill(0)
  const indeg = new Array<number>(n).fill(0)
  for (let k = 0; k < from.length; k++) if (!back[k]) indeg[to[k]]++
  const queue: number[] = []
  for (let i = 0; i < n; i++) if (indeg[i] === 0) queue.push(i)
  for (let head = 0; head < queue.length; head++) {
    const u = queue[head]
    for (const k of out[u]) {
      if (back[k]) continue
      const v = to[k]
      rank[v] = Math.max(rank[v], rank[u] + 1)
      if (--indeg[v] === 0) queue.push(v)
    }
  }
  return rank
}

export function layoutDiagram(spec: DiagramEncoding, width: number): DiagramLayout {
  const n = spec.nodes.length
  const indexOf = new Map<string, number>()
  spec.nodes.forEach((node, i) => indexOf.set(node.id, i))
  // The guard already proved every end names a node; a miss falls back to 0 rather than throwing.
  const from = spec.edges.map((e) => indexOf.get(e.from) ?? 0)
  const to = spec.edges.map((e) => indexOf.get(e.to) ?? 0)
  const out: number[][] = spec.nodes.map(() => [])
  from.forEach((u, k) => out[u].push(k))

  const back = findBackEdges(n, from, to, out)
  const rank = rankNodes(n, from, to, out, back)
  const hasBack = back.some(Boolean)

  // Steps 4-5: usable width, row capacity, wrapped rows, one node width.
  const usable = width - (hasBack ? GUTTER : 0)
  const perRow = Math.max(1, Math.floor((usable + NODE_GAP) / (MIN_NODE_WIDTH + NODE_GAP)))
  const maxRank = n > 0 ? Math.max(...rank) : 0
  const rows: number[][] = []
  const rankOfRow: number[] = []
  for (let r = 0; r <= maxRank; r++) {
    const inRank: number[] = []
    for (let i = 0; i < n; i++) if (rank[i] === r) inRank.push(i)
    for (let s = 0; s < inRank.length; s += perRow) {
      rows.push(inRank.slice(s, s + perRow))
      rankOfRow.push(r)
    }
  }
  const kMax = Math.max(1, ...rows.map((row) => row.length))
  const nw = clamp(Math.floor((usable - (kMax - 1) * NODE_GAP) / kMax), MIN_NODE_WIDTH, MAX_NODE_WIDTH)

  // Steps 6-8: sizes and positions.
  const placed: PlacedNode[] = new Array(n)
  let top = PAD_Y
  rows.forEach((row, ri) => {
    const k = row.length
    const sizes = row.map((i) => {
      const node = spec.nodes[i]
      const w = node.kind === "decision" ? Math.min(nw, MAX_DECISION_WIDTH) : nw
      const cpl = Math.max(1, Math.floor((w - PAD_X[node.kind]) / CHAR_WIDTH))
      const lines = Math.min(MAX_LINES, Math.max(1, Math.ceil(node.label.length / cpl)))
      return { w, lines, h: BASE_NODE_HEIGHT + LINE_HEIGHT * (lines - 1) }
    })
    const rowHeight = Math.max(...sizes.map((s) => s.h))
    const step = Math.max(nw + NODE_GAP, Math.min(usable / k, nw + 96))
    row.forEach((i, j) => {
      const { w, lines, h } = sizes[j]
      const cx = usable / 2 + (j - (k - 1) / 2) * step
      const y = top + (rowHeight - h) / 2
      placed[i] = {
        index: i,
        kind: spec.nodes[i].kind,
        rank: rankOfRow[ri],
        row: ri,
        x: cx - w / 2,
        y,
        width: w,
        height: h,
        cx,
        cy: y + h / 2,
        lines,
        rowTop: top,
        rowHeight,
      }
    })
    top += rowHeight + ROW_GAP
  })
  const height = rows.length > 0 ? top - ROW_GAP + PAD_Y : PAD_Y * 2

  // Steps 9-12: edges.
  let backIndex = 0
  const edges: PlacedEdge[] = spec.edges.map((_edge, k) => {
    const a = placed[from[k]]
    const b = placed[to[k]]
    const selfLoop = from[k] === to[k]
    if (selfLoop) {
      // A self-loop arcs off its own node; it takes no gutter lane, so it does not advance `j`.
      const x = a.x + a.width
      const y1 = a.cy - 8
      const y2 = a.cy + 8
      return {
        index: k,
        from: from[k],
        to: to[k],
        back: true,
        selfLoop: true,
        path: `M${r2(x)},${r2(y1)} C${r2(x + 16)},${r2(y1)} ${r2(x + 16)},${r2(y2)} ${r2(x + 4)},${r2(y2)}`,
        labelX: x + 16 + 4,
        labelY: a.cy,
        labelAlign: "start",
        gutterX: null,
      }
    }
    if (back[k]) {
      const j = backIndex++
      const rx = width - 8 - 8 * (j % 4)
      const sx = a.x + a.width
      const sy = a.cy
      const tx = b.x + b.width + 4
      const ty = b.cy
      return {
        index: k,
        from: from[k],
        to: to[k],
        back: true,
        selfLoop: false,
        path: `M${r2(sx)},${r2(sy)} C${r2(rx)},${r2(sy)} ${r2(rx)},${r2(ty)} ${r2(tx)},${r2(ty)}`,
        labelX: rx,
        labelY: (sy + ty) / 2,
        labelAlign: "end",
        gutterX: rx,
      }
    }
    const sx = a.cx
    const sy = a.y + a.height
    const tx = b.cx
    const ty = b.y - 3
    const my = (sy + ty) / 2
    // An edge that skips a row bows toward the side its source sits on, off intermediate nodes.
    const dx = b.row - a.row > 1 ? (a.cx <= usable / 2 ? -1 : 1) * (nw / 2 + 12) : 0
    return {
      index: k,
      from: from[k],
      to: to[k],
      back: false,
      selfLoop: false,
      path: `M${r2(sx)},${r2(sy)} C${r2(sx + dx)},${r2(my)} ${r2(tx + dx)},${r2(my)} ${r2(tx)},${r2(ty)}`,
      labelX: (sx + tx) / 2,
      labelY: (sy + ty) / 2,
      labelAlign: "center",
      gutterX: null,
    }
  })

  const order = rows.flat()
  return { width, height, usableWidth: usable, hasBack, nodes: placed, edges, order }
}
