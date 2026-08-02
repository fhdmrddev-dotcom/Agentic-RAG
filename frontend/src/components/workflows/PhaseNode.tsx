/**
 * Phase 183-06 Task 1 (CANVAS-01, D-183-07 / D-183-10 / D-183-12 / D-183-14,
 * sketch 137-D) — the three canvas node faces.
 *
 * THE VIEW HALF of the projection. `canvasModel.toCanvas` resolves every value a
 * card needs; these three components only PAINT it. They are the values of the
 * module-scope `nodeTypes` map in `WorkflowCanvas.tsx` — `phase`,
 * `unresolvedSkip` and `endCap`, the exact vocabulary `CANVAS_NODE_TYPES` exports.
 *
 * WHAT THIS FILE IS AFTER THE 184-03 SPLIT (D-184-06). `PhaseNode` is no longer the
 * phase card — it is a thin `NodeProps` → slots ADAPTER over `PhaseNodeCard`, which
 * lives in its own file and imports nothing from `@xyflow/react`. This file keeps the
 * three things that genuinely belong to the graph library boundary: the `nodeTypes`
 * entry points, the hidden `EdgeAnchors`, and the two small faces that have no reuse
 * story outside the plane (`UnresolvedSkipNode`, `EndCapNode`). The presentation
 * const-tables moved to `nodePresentation.ts` in the same plan.
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
import { memo } from "react"

import { Handle, Position, type NodeProps } from "@xyflow/react"

import {
  CANVAS_LAYOUT,
  type PhaseCanvasNode,
  type UnresolvedSkipCanvasNode,
} from "@/components/workflows/canvasModel"
import {
  DEFAULT_TINT,
  ICON_TINT,
  renderPhaseMark,
  type VerdictMarkKind,
} from "@/components/workflows/nodePresentation"
import {
  PhaseNodeCard,
  type BadgeSlot,
  type BadgeSlots,
} from "@/components/workflows/PhaseNodeCard"
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

// ── PhaseNode — the NodeProps → slots adapter (D-184-06) ────────────────────────

/**
 * One phase, one card. `llm_batch_agents` gets ONE node: the ×N fan-out is runtime
 * behaviour, not topology (sketch 136), and drawing N lanes would disagree with the
 * server's adjacency.
 *
 * THIS IS AN ADAPTER, NOT A CARD (D-184-06, plan 184-03 Task 2). The face itself is
 * `PhaseNodeCard`, which imports nothing from the graph library so it renders in a
 * plain provider-less test and Phase 188 can reuse it outside a `ReactFlowProvider`.
 * Everything below is the mapping `NodeProps` → slots, plus the one thing that cannot
 * cross that boundary: `<EdgeAnchors />`, injected through the card's `anchors` slot
 * so the rendered DOM is byte-identical to the pre-split node. A custom node that
 * renders no `Handle` paints ZERO edges, silently (see HANDLES ARE MANDATORY above),
 * which is why the adapter — not the card — owns them.
 */
function PhaseNodeImpl({ data, selected }: NodeProps<PhaseCanvasNode>) {
  // The ⌥ reveal rides on `data` (set by the shell), so this leaf has no context
  // dependency of its own and there can never be a second technical-names state.
  const technical = data.technical === true

  // The 3D mark is resolved by `nodePresentation.renderPhaseMark`, a module-scope
  // helper in another file since the 184-03 split — see its docblock for why the
  // lookup does not live in this body.
  const tint = ICON_TINT[data.phaseType] ?? DEFAULT_TINT

  // VALID-03 (184-10): the server's verdict mark, threaded down on `data` by the shell
  // exactly as the ⌥ reveal is. The value was already reduced to one of three states by
  // `verdictModel.markFor`, which reads `verdict.severity` and derives NONE of it — so
  // this adapter neither classifies nor asks, and a provider-less node still renders.
  // The cast is the price of `PhaseNodeData`'s `[k: string]: unknown` index signature,
  // which @xyflow/react requires on every node-data shape; the value's own type is
  // guaranteed at the shell's `marks` prop, which is typed to this exact union.
  const verdict = data.verdict as VerdictMarkKind | undefined

  // BADGE SLOT 1 IS DELIBERATELY EMPTY, AND IT IS SPOKEN FOR (Phase 185, SPEC Req 6).
  //
  // Until 185-08 slot 1 carried the three-face grounding word-badge. That badge is
  // DELETED, not moved: governance renders as SHAPE — the corner seal 185-09 places at
  // the card's top-right, passed below as `grounded` — and SPEC Req 6 states that
  // governance spends no colour and no word-badge slot. Its inputs still reach this
  // component, as `data.grounded` and `data.armed`; what is gone is the chip that spoke
  // them, and what replaced it costs neither a slot nor a colour.
  //
  // DO NOT FILL THE FREED SLOT with a governance mark. The freed slot belongs to
  // Phase 188 (run state) and Phase 189 (external actions), and `BadgeSlots` is a max-2
  // tuple union, so a third badge is a typecheck error rather than a review comment —
  // which is exactly the budget `PhaseNodeCard`'s own docblock says it enforces.
  //
  // Slot 2 is unchanged: `Waits for you`, on `llm_human_input` only (D-183-07).
  const waitsForYou: BadgeSlot = {
    testId: "canvas-waits-for-you",
    tone: "primary",
    label: "Waits for you",
    dataAttr: { "data-waits-for-you": "true" },
  }
  const badges: BadgeSlots = data.waitsForYou ? [waitsForYou] : []

  // `status`, `technicalLine` and `stepNumber` are still deliberately NOT passed: Wave 0
  // landed the seam and Phase 188 lands those. `verdict` WAS in that list until 184-10
  // and `grounded` until 185-09 — the line is corrected each time rather than left,
  // because a comment that still names a slot the component now fills is the same defect
  // as a false docblock.
  //
  // 187-09 IS THE FIRST CHANGE TO THIS LINE THAT DOES NOT REMOVE A NAME FROM IT, and the
  // distinction is the whole point. Req 4 / D-187-16 moves the ⌥ reveal out of the TITLE
  // slot and into the SUBTITLE slot below — a slot the card ALREADY renders and this
  // adapter ALREADY fills. Nothing was added to the card and no reserved slot was spent:
  // `technicalLine` is still Phase 188's, and choosing it instead (sketch 149-B) would
  // have been a Phase 188 scope decision this phase declines to make.
  //
  // WHY THE SLOT MOVED. The shipped reveal was a title SWAP, which was cheap while the
  // plain title was the generic "Work out how to do it"; 187-04's config-derived tier
  // makes it SPECIFIC, so the same swap destroys real meaning. It also truncated the one
  // token the reveal exists to show — the title slot is `truncate` at 14px in a 248px
  // card, so `technicalTitle` rendered as `AI agent step · find-renewal-t…` and the SLUG
  // clipped. The subtitle slot wraps, so the whole slug reaches the DOM there.
  //
  // D-187-06: the type subtitle ALWAYS stays in the reveal-OFF state. Suppressing it
  // when the derived tier resolved would make card height depend on which tier won and
  // make the reveal ADD a line rather than swap one. The measured redundancy is confined
  // to `llm_human_input` and `llm_emit`; it is an accepted cost, recorded, not designed
  // away.
  //
  // `data.armed` IS DELIBERATELY UNCONSUMED HERE, and it is not an oversight: the armed
  // action-risk mark is an EDGE, not a node change (plan 185-10 — the detour arc, sketch
  // 147). Do not look for it on the card, and do not add it: a second mark on the face
  // would spend the corner the seal claims or a badge slot 188/189 owns.
  return (
    <PhaseNodeCard
      slug={data.slug}
      phaseType={data.phaseType}
      icon={renderPhaseMark(data.phaseType)}
      title={data.title}
      subtitle={technical ? data.technicalTitle : data.subtitle}
      tint={tint}
      badges={badges}
      verdict={verdict}
      grounded={data.grounded}
      selected={selected}
      anchors={<EdgeAnchors />}
    />
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

/**
 * MEMOIZED, and the reason is a measured drag defect rather than a habit.
 *
 * A drag moves the card by rewriting the WRAPPER's transform every pointer frame. The
 * adapter's own props do not change while that happens — `position` lives on the node
 * object, not in `data` — but without a memo React re-rendered this subtree ~60x/s
 * anyway, re-running `renderPhaseMark()` and rebuilding the 3D mark's SVG on every
 * frame. The browser re-rasterised it each time, which is the flicker the operator
 * reported as "blinking while I drag".
 *
 * This only holds because `WorkflowCanvas`'s node memo is split (settledNodes + a thin
 * drag overlay): `data` keeps its identity for the WHOLE drag, including for the card
 * being dragged, so the default shallow compare genuinely short-circuits. If a future
 * change rebuilds `data` per frame this memo goes quiet without failing — the pairing
 * is the load-bearing part, not this line on its own.
 */
export const PhaseNode = memo(PhaseNodeImpl)
PhaseNode.displayName = "PhaseNode"
