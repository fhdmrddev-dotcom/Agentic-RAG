/**
 * Phase 183-06 Task 1 (CANVAS-01, D-183-07 / D-183-10 / D-183-12 / D-183-14,
 * sketch 137-D) — the three canvas node faces.
 *
 * THE VIEW HALF of the projection. `canvasModel.toCanvas` resolves every value a
 * card needs; these three components only PAINT it. They are the values of the
 * module-scope `nodeTypes` map in `WorkflowCanvas.tsx` — `phase`,
 * `unresolvedSkip` and `endCap`, the exact vocabulary `CANVAS_NODE_TYPES` exports.
 *
 * PURE PRESENTATIONAL LEAVES. None of them reads a context, fetches anything, or
 * owns state. The ⌥ Technical-names reveal arrives as a `technical` field merged
 * onto `data` by the canvas shell, so there is exactly ONE technical-names state in
 * the app (the shipped `TechnicalNamesProvider`) and a node still renders in a
 * provider-less unit test.
 *
 * ONE TAB STOP PER NODE (Pattern 3 Option A). The canvas keeps `nodesFocusable` at
 * its `true` default and the node OBJECT already carries a button role plus an
 * accessible label, so React Flow's own node wrapper is the focus target. These
 * components therefore contain NO focusable control of any kind — no inner
 * pressable element, no anchor, no tab-index attribute, no click handler. An inner
 * control would produce two tab stops per node, ten tab presses to traverse the
 * five-phase maximum, and a screen reader announcing every step twice. Selection is
 * handled once, by the canvas's `onNodeClick`.
 *
 * HANDLES ARE MANDATORY, NOT DECORATION (assumption A1, measured in plan 183-01 and
 * recorded verbatim in `183-01-SUMMARY.md`): a custom node that renders no `Handle`
 * paints ZERO edges — silently, with no warning. The identical fixture WITH a target
 * and a source handle paints one. Every node below therefore renders both, hidden
 * (`opacity: 0`, zero-size, no border — sketch 134 found visible connection handles
 * read as a broken editor) and inert (`nodesConnectable={false}` at the shell).
 * They are anchored at `CANVAS_LAYOUT.EDGE_ANCHOR_Y` from the node TOP rather than
 * the default 50%: that IS D-183-12's "edges anchor to a fixed offset from the node
 * top", and it is what lets a gate-heavy tall card grow downward without moving the
 * edge baseline.
 *
 * THE LOOK IS SKETCH 137-D, the locked acceptance bar: a frosted-glass card that
 * stays NEUTRAL, with the 3D mark floating at the LEFT edge over its own contact
 * shadow, one plain-language title, one supporting line, and at most two
 * word-badges. Per-step-type colour is a TINT BEHIND THE ICON ONLY — the colour
 * budget is load-bearing, because Phase 188 paints run state (running / done /
 * waiting-for-you / failed) onto these same nodes and needs the strong colours
 * free. Motion keys off RUN STATE, never off selection (the defect found in the
 * sketch 137 review); 183 has no run state, so the node itself is completely still
 * and any ambient drift belongs to the canvas backdrop.
 *
 * D-183-14 — THE IN-SCOPE ICON FIX AND ITS FENCE. The `llm_batch_agents` mark
 * measures 34.5 average luminance against the rest of the set's 135-185, so it reads
 * as a dark silhouette on a dark canvas. It is fixed CANVAS-LOCALLY, by lightening
 * the icon well: a soft light disc behind the floating mark, applied uniformly to
 * every node so it reads as depth rather than as a special case. NO `PHASE_GLYPHS`
 * slug is swapped here. Those are one-line map changes that alter five shipped
 * surfaces (the workflows-page card, the run and publish soul headers, the gauntlet
 * stages, the live step cards), and D-183-14 reserves them for their own dedicated
 * commit with their own before/after check — so a canvas rollback cannot silently
 * revert an app-wide icon decision.
 *
 * XSS (T-124-01): every authored string (phase names) is rendered as a plain React
 * text child / `title=` attribute value — never `dangerouslySetInnerHTML`.
 *
 * (The house grep guard for that clause is anchored on the JSX PROP FORM — the
 * identifier followed by an assignment — never on the bare identifier, because the
 * clause itself must be quoted verbatim in this docblock, exactly as it is in
 * `PhaseSpine.tsx`, `WorkflowSoul.tsx` and `WorkflowDoorSwitch.tsx`.)
 */
import { Handle, Position, type NodeProps } from "@xyflow/react"

import { StatusChip } from "@/components/org/StatusChip"
import {
  CANVAS_LAYOUT,
  type PhaseCanvasNode,
  type UnresolvedSkipCanvasNode,
} from "@/components/workflows/canvasModel"
import {
  DEFAULT_TINT,
  GROUNDING_TONE,
  ICON_TINT,
  renderPhaseMark,
} from "@/components/workflows/nodePresentation"
import { cn } from "@/lib/utils"

// ── Shared atoms ────────────────────────────────────────────────────────────────

/**
 * The hidden edge anchors. Rendered on EVERY node type because A1 proved an
 * omitted handle costs the edge, not the arrowhead. Zero-size and transparent so
 * nothing reads as a connection affordance; `nodesConnectable={false}` at the shell
 * makes them inert. `top` is the FIXED offset from the node top (D-183-12).
 */
const HIDDEN_HANDLE_STYLE = {
  top: CANVAS_LAYOUT.EDGE_ANCHOR_Y,
  width: 1,
  height: 1,
  minWidth: 0,
  minHeight: 0,
  border: 0,
  opacity: 0,
  background: "transparent",
  pointerEvents: "none",
} as const

function EdgeAnchors() {
  return (
    <>
      <Handle type="target" position={Position.Left} style={HIDDEN_HANDLE_STYLE} isConnectable={false} />
      <Handle type="source" position={Position.Right} style={HIDDEN_HANDLE_STYLE} isConnectable={false} />
    </>
  )
}

// ── PhaseNode — the phase card ──────────────────────────────────────────────────

/**
 * One phase, one card. `llm_batch_agents` gets ONE node: the ×N fan-out is runtime
 * behaviour, not topology (sketch 136), and drawing N lanes would disagree with the
 * server's adjacency.
 */
export function PhaseNode({ data, selected }: NodeProps<PhaseCanvasNode>) {
  // The ⌥ reveal rides on `data` (set by the shell), so this leaf has no context
  // dependency of its own and there can never be a second technical-names state.
  const technical = data.technical === true
  const title = technical ? data.technicalTitle : data.title

  // The 3D mark is resolved by `nodePresentation.renderPhaseMark`, a module-scope
  // helper in another file since the 184-03 split — see its docblock for why the
  // lookup does not live in this body.
  const tint = ICON_TINT[data.phaseType] ?? DEFAULT_TINT

  return (
    <div
      data-testid={`canvas-node-${data.slug}`}
      data-slug={data.slug}
      data-phase-type={data.phaseType}
      data-selected={selected ? "true" : "false"}
      className="relative"
      style={{ width: CANVAS_LAYOUT.NODE_WIDTH, minHeight: CANVAS_LAYOUT.NODE_MIN_HEIGHT }}
    >
      <EdgeAnchors />

      {/* The frosted card. Neutral by construction — no per-type wash anywhere. */}
      <div
        className={cn(
          "ml-6 flex flex-col justify-center rounded-2xl border py-3 pl-10 pr-3",
          "bg-card/30 backdrop-blur-sm",
          "shadow-[0_1px_0_hsl(var(--foreground)/0.06)_inset,0_18px_36px_-22px_rgba(0,0,0,0.95)]",
          selected
            ? "border-primary shadow-[0_0_0_1px_hsl(var(--primary)/0.4)]"
            : "border-border/50",
        )}
        style={{ minHeight: CANVAS_LAYOUT.NODE_MIN_HEIGHT }}
      >
        <p className="truncate font-headline text-[14px] font-semibold leading-tight text-foreground">
          {title}
        </p>

        {data.subtitle ? (
          <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{data.subtitle}</p>
        ) : null}

        {/* At most TWO word-badges (D-183-07). No tool chips, no gate identifiers,
            no phase_index on the face. */}
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span data-grounding={data.grounding.mode}>
            <StatusChip tone={GROUNDING_TONE[data.grounding.mode]} testId="canvas-grounding">
              <span aria-hidden="true" className="mr-1">
                {data.grounding.glyph}
              </span>
              {data.grounding.words}
            </StatusChip>
          </span>

          {data.waitsForYou ? (
            <span data-waits-for-you="true">
              <StatusChip tone="primary" testId="canvas-waits-for-you">
                Waits for you
              </StatusChip>
            </span>
          ) : null}
        </div>
      </div>

      {/* The 3D mark floating at the LEFT edge: a soft light disc behind it (the
          D-183-14 canvas-local icon-well lightening, applied uniformly), the
          per-type tint inside that disc, and its own contact shadow beneath. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute left-0 top-1/2 grid h-14 w-14 -translate-y-1/2 place-items-center"
      >
        <span
          className="absolute inset-0 rounded-full"
          style={{
            background: `radial-gradient(circle, ${tint}, transparent 68%)`,
          }}
        />
        <span
          className="absolute inset-1 rounded-full bg-foreground/10"
          style={{ filter: "blur(2px)" }}
        />
        <span
          className="absolute bottom-0 left-1/2 h-2 w-9 -translate-x-1/2 rounded-[50%] bg-black/50"
          style={{ filter: "blur(5px)" }}
        />
        <span className="relative grid place-items-center text-[20px] leading-none text-foreground drop-shadow-[0_9px_13px_rgba(0,0,0,0.8)]">
          {renderPhaseMark(data.phaseType)}
        </span>
      </span>
    </div>
  )
}

// ── UnresolvedSkipNode — the honest broken reference (D-183-10) ─────────────────

/**
 * The shipped spine DROPS an unresolvable `skip_to_phase` silently (its
 * `slugSet.has(target)` filter); migration 065 lost a real gate for exactly that
 * reason. The canvas renders it instead, extending the shipped skip-branch
 * vocabulary at `PhaseSpineGraph.tsx:192-206` — amber for needs-attention, a dashed
 * border for a conditional branch, `font-mono` for the slug, and a bare-English
 * sentence carrying the meaning. The wording agrees with the backend's
 * `UNSATISFIABLE_SKIP` verdict (`reachability.py:147-156`): the branch goes to the
 * declared target, and no such step exists.
 *
 * Not selectable and not focusable (the model sets both false), so it is never a
 * tab stop and never fires the selection callback.
 */
export function UnresolvedSkipNode({ data }: NodeProps<UnresolvedSkipCanvasNode>) {
  return (
    <div
      data-testid="canvas-unresolved-skip"
      data-from-slug={data.fromSlug}
      data-target-slug={data.declaredTarget}
      className={cn(
        "flex max-w-[240px] items-start gap-1.5 rounded-lg border border-dashed px-2.5 py-2",
        "border-amber-500/70 bg-amber-500/5 text-[11px] leading-snug",
        "text-amber-600 dark:text-amber-400",
      )}
    >
      <EdgeAnchors />
      <span aria-hidden="true">⤳</span>
      <span>
        on fail → goes to <span className="font-mono font-medium">{data.declaredTarget}</span> — no
        such step
      </span>
    </div>
  )
}

// ── EndCapNode — the explicit ○ terminal (sketch 136) ───────────────────────────

/**
 * Every flow ends in an explicit cap, never a dangling edge stub. Small, quiet,
 * neither selectable nor focusable — pure punctuation with an accessible name so a
 * screen-reader user hears where the flow stops.
 *
 * React Flow calls it with `NodeProps<EndCapCanvasNode>`; it reads none of them, so
 * it declares no parameter at all. The project's ESLint config ships no `^_` ignore
 * pattern, which is why an underscore-prefixed binding is not the escape hatch here.
 */
export function EndCapNode() {
  return (
    <div
      data-testid="canvas-end-cap"
      className="grid place-items-center rounded-full border border-border/60 bg-card/20 text-muted-foreground"
      style={{ width: CANVAS_LAYOUT.END_CAP_SIZE, height: CANVAS_LAYOUT.END_CAP_SIZE }}
    >
      <EdgeAnchors />
      <span aria-hidden="true" className="text-[13px] leading-none">
        ○
      </span>
      <span className="sr-only">End of the workflow</span>
    </div>
  )
}
