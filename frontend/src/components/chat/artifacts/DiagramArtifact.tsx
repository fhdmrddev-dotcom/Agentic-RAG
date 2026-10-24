/**
 * Phase 292-02 (D-04 · D-16 · D-07 · I-3 · sketch 2A · UI-SPEC §DiagramArtifact) — the top-down flow.
 *
 * Positioned HTML node boxes over ONE SVG edge layer (UI-D-292-07): SVG text cannot wrap and node
 * labels must, so labels live in HTML. Both layers are plain React elements — every model string
 * (node label, edge label) and every server excerpt renders as a React TEXT node, never as markup.
 *
 * Layout comes from the pure `layoutDiagram(spec, width)`; the width is the body's own content width,
 * measured in a layout effect (so the first paint is already laid out) and re-measured by a guarded
 * ResizeObserver, re-laying out on a width change only. The diagram NEVER scrolls sideways (D-16).
 *
 * Interaction (UI-D-292-08): one tab stop with a roving tabindex through reading order (rank, then
 * left to right); hover or focus on a node lights exactly its edges and neighbours in the reserved
 * accent and dims the rest; Escape clears the highlight and the tooltip and keeps focus; a node with
 * a resolved source shows the shared `ArtifactTooltip`.
 *
 * T-292-13: marker ids derive from `useId()` plus the validated record id, so two diagrams on one
 * page never share a `<marker>`; model node ids never become a DOM id, a reference or a key — keys
 * and attributes use array indexes.
 */
import { useId, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from "react"
import { cn } from "@/lib/utils"
import { ArtifactTooltip } from "./ArtifactTooltip"
import { DIAGRAM_ROLE_DESCRIPTION, diagramAriaLabel, nodeAriaLabel, type NodeRelation } from "./artifactCopy"
import { isResolvedSource, type ArtifactBodyProps, type DiagramEncoding } from "./artifactSpec"
import { layoutDiagram } from "./diagramLayout"

/** Laid out at the phone body width until the real width is measured (and where none exists). */
const FALLBACK_WIDTH = 311

const HEXAGON = "polygon(16px 0, calc(100% - 16px) 0, 100% 50%, calc(100% - 16px) 100%, 16px 100%, 0 50%)"
const TRANSITION = "transition-[opacity,border-color,background-color,stroke] duration-[120ms] motion-reduce:transition-none"
const EDGE_REST = "hsl(var(--muted-foreground) / 0.7)"
const EDGE_HOT = "hsl(var(--primary))"

/** The accessible name of each node, from the spec's own relations (edge order). */
function nodeNames(spec: DiagramEncoding, back: boolean[]): string[] {
  return spec.nodes.map((node, i) => {
    const leads: NodeRelation[] = []
    const loops: NodeRelation[] = []
    const from: string[] = []
    spec.edges.forEach((e, k) => {
      const fromIdx = spec.nodes.findIndex((n) => n.id === e.from)
      const toIdx = spec.nodes.findIndex((n) => n.id === e.to)
      if (fromIdx === i) {
        const rel = { label: spec.nodes[toIdx]?.label ?? "", edgeLabel: e.label }
        if (back[k]) loops.push(rel)
        else leads.push(rel)
      }
      if (toIdx === i && fromIdx !== i) from.push(spec.nodes[fromIdx]?.label ?? "")
    })
    return nodeAriaLabel(node.label, node.kind, leads, loops, from)
  })
}

export function DiagramArtifact({ record }: ArtifactBodyProps) {
  const spec = record.spec.diagram
  const rootRef = useRef<HTMLDivElement>(null)
  const nodeRefs = useRef<Array<HTMLDivElement | null>>([])
  const [width, setWidth] = useState(0)
  // The active node and the element the tooltip anchors to (held in state, never read from a ref
  // during render).
  const [hover, setHover] = useState<{ index: number; el: HTMLElement } | null>(null)
  const active = hover?.index ?? null
  const setActive = (index: number | null, el?: HTMLElement) => setHover(index === null || !el ? null : { index, el })
  const [roving, setRoving] = useState<number | null>(null)

  const uid = useId().replace(/[^A-Za-z0-9_-]/g, "")
  const markerId = `${record.id}-${uid}-ah`
  const markerHotId = `${record.id}-${uid}-ah-hot`
  const tipId = `${record.id}-tip`

  useLayoutEffect(() => {
    const el = rootRef.current
    if (!el) return
    const measure = () => {
      const w = el.clientWidth
      setWidth((prev) => (prev === w ? prev : w))
    }
    measure()
    if (typeof ResizeObserver === "undefined") return
    const observer = new ResizeObserver(() => measure())
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const layout = useMemo(() => (spec ? layoutDiagram(spec, width > 0 ? width : FALLBACK_WIDTH) : null), [spec, width])
  const names = useMemo(
    () => (spec && layout ? nodeNames(spec, layout.edges.map((e) => e.back)) : []),
    [spec, layout],
  )

  if (!spec || !layout) return null

  const hotEdge = (k: number) => active !== null && (layout.edges[k].from === active || layout.edges[k].to === active)
  const hotNodes = new Set<number>()
  if (active !== null) {
    hotNodes.add(active)
    layout.edges.forEach((e, k) => {
      if (hotEdge(k)) {
        hotNodes.add(e.from)
        hotNodes.add(e.to)
      }
    })
  }
  const tabTarget = roving ?? layout.order[0] ?? 0
  const activeSource = active !== null ? spec.nodes[active]?.source ?? null : null
  const tipAnchor = hover !== null && isResolvedSource(activeSource) ? hover.el : null

  const focusAt = (i: number | undefined) => {
    if (i === undefined) return
    nodeRefs.current[i]?.focus()
  }

  const onKeyDown = (i: number) => (e: KeyboardEvent<HTMLDivElement>) => {
    const pos = layout.order.indexOf(i)
    switch (e.key) {
      case "ArrowRight":
      case "ArrowDown":
        e.preventDefault()
        focusAt(layout.order[Math.min(pos + 1, layout.order.length - 1)])
        break
      case "ArrowLeft":
      case "ArrowUp":
        e.preventDefault()
        focusAt(layout.order[Math.max(pos - 1, 0)])
        break
      case "Home":
        e.preventDefault()
        focusAt(layout.order[0])
        break
      case "End":
        e.preventDefault()
        focusAt(layout.order[layout.order.length - 1])
        break
      case "Escape":
        setActive(null)
        break
    }
  }

  return (
    <div
      ref={rootRef}
      data-testid="artifact-diagram"
      role="group"
      aria-roledescription={DIAGRAM_ROLE_DESCRIPTION}
      aria-label={diagramAriaLabel(record.spec.title, spec.nodes.length, spec.edges.length)}
      className="relative w-full"
      style={{ height: layout.height }}
    >
      <svg
        aria-hidden="true"
        focusable="false"
        width={layout.width}
        height={layout.height}
        className="absolute inset-0 overflow-visible"
      >
        <defs>
          <marker id={markerId} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0,1 L9,5 L0,9 z" fill="hsl(var(--muted-foreground))" />
          </marker>
          <marker id={markerHotId} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0,1 L9,5 L0,9 z" fill={EDGE_HOT} />
          </marker>
        </defs>
        {layout.edges.map((e, k) => {
          const hot = hotEdge(k)
          return (
            <path
              key={k}
              data-edge={k}
              data-hot={hot ? "true" : undefined}
              d={e.path}
              fill="none"
              stroke={hot ? EDGE_HOT : EDGE_REST}
              strokeWidth={hot ? 2 : 1.5}
              strokeDasharray={e.back ? "4 4" : undefined}
              markerEnd={`url(#${hot ? markerHotId : markerId})`}
              className={cn(TRANSITION, active !== null && !hot && "opacity-25")}
            />
          )
        })}
      </svg>

      {layout.edges.map((e, k) => {
        const label = spec.edges[k].label
        if (!label) return null
        const hot = hotEdge(k)
        return (
          <span
            key={k}
            data-testid="diagram-edge-label"
            aria-hidden="true"
            className={cn(
              "absolute -translate-y-1/2 whitespace-nowrap rounded-sm bg-card px-1 text-xs leading-[1.4]",
              e.labelAlign === "center" && "-translate-x-1/2",
              e.labelAlign === "end" && "-translate-x-full",
              TRANSITION,
              hot ? "text-foreground" : "text-muted-foreground",
              active !== null && !hot && "opacity-30",
            )}
            style={{ left: e.labelX, top: e.labelY }}
          >
            {label}
          </span>
        )
      })}

      {layout.nodes.map((p, i) => {
        const node = spec.nodes[i]
        const hot = hotNodes.has(i)
        const dim = active !== null && !hot
        const decision = node.kind === "decision"
        const showsTip = tipAnchor !== null && active === i
        return (
          // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- UI-D-292-08: a node is role=img (the UI-SPEC's screen-reader contract) AND the roving focus target; focus/hover only reveal its edges and source, so the keyboard reaches what the pointer does (WCAG 2.1.1)
          <div
            key={i}
            ref={(el) => {
              nodeRefs.current[i] = el
            }}
            data-testid="diagram-node"
            data-kind={node.kind}
            data-hot={hot ? "true" : undefined}
            role="img"
            aria-label={names[i]}
            aria-describedby={showsTip ? tipId : undefined}
            tabIndex={i === tabTarget ? 0 : -1}
            onPointerEnter={(e) => setActive(i, e.currentTarget)}
            onPointerLeave={() => setActive(null)}
            onFocus={(e) => {
              setRoving(i)
              setActive(i, e.currentTarget)
            }}
            onBlur={() => setActive(null)}
            onKeyDown={onKeyDown(i)}
            className={cn(
              "absolute flex items-center justify-center text-center",
              TRANSITION,
              decision ? "px-5" : "border px-3",
              node.kind === "step" && "rounded-lg",
              (node.kind === "start" || node.kind === "end") && "rounded-full",
              !decision && (hot ? "border-primary bg-primary/10" : "border-muted-foreground/40 bg-muted"),
              dim && "opacity-45",
            )}
            style={{ left: p.x, top: p.y, width: p.width, height: p.height }}
          >
            {decision && (
              <>
                <div
                  data-hexagon=""
                  aria-hidden="true"
                  className={cn("absolute inset-0", TRANSITION, hot ? "bg-primary" : "bg-muted-foreground/40")}
                  style={{ clipPath: HEXAGON }}
                />
                <div aria-hidden="true" className="absolute inset-px bg-card" style={{ clipPath: HEXAGON }} />
                <div
                  aria-hidden="true"
                  className={cn("absolute inset-px", TRANSITION, hot ? "bg-primary/10" : "bg-muted")}
                  style={{ clipPath: HEXAGON }}
                />
              </>
            )}
            <span className="relative line-clamp-4 break-words text-xs leading-[1.4] text-foreground">{node.label}</span>
          </div>
        )
      })}

      {tipAnchor && activeSource && (
        <ArtifactTooltip id={tipId} anchor={tipAnchor} source={activeSource} onDismiss={() => setActive(null)} />
      )}
    </div>
  )
}
