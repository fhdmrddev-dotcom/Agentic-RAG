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
import { PhaseNodeCard } from "@/components/workflows/PhaseNodeCard"
// 188.2-06: the slot contract now lives in its own leaf, and the card leaves NO re-export
// shim (D-06) — so this adapter names the two homes separately. It lands as its OWN
// statement rather than by widening the line above (the `FlowEdge.test.tsx:80-85`
// convention 188.1 set for exactly this situation), so the whole change reads as added
// lines under `git diff` and no shipped line had to be edited to accommodate it.
import type { BadgeSlot, BadgeSlots } from "@/components/workflows/phaseNodeCardContract"
// Phase 200 (canvas port) — the plane's own words. A true leaf; see its docblock for why
// the end cap's sentence does not live in `phaseVocabulary.ts`.
import { END_CAP_MEANING } from "@/components/workflows/planeVocabulary"
import type { NodeRunState } from "@/components/workflows/runVocabulary"
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
  //
  // ⚠ THE OWN-PROPERTY GUARD IS NOT CEREMONY (WR-04 site 1, 188.1-04), and it was
  // measured RED before it was written. `ICON_TINT` is a plain object literal, so it
  // INHERITS `constructor`, `toString`, `__proto__` and friends. A bare
  // index-and-coalesce therefore returns a FUNCTION for those keys — never nullish, so
  // `?? DEFAULT_TINT` never fires — and THIS value has a sink: `PhaseNodeCard`
  // interpolates it into a CSS string, `radial-gradient(circle, ${tint}, …)`. It is the
  // only one of the five WR-04 sites that reaches a style context. `data.phaseType` is
  // author-supplied workflow-definition JSONB, and totality is a property of the lookup
  // rather than of its current callers (`lib/phaseState.ts:65-75`, the house argument).
  //
  // The TERNARY shape is load-bearing and must not be refactored into a helper call:
  // `PhaseNodeCard.test.tsx:373` is a POSITIVE CONTROL requiring the literal `ICON_TINT[`
  // form to survive in this file, which is what keeps the sibling negative fence — the
  // card looks up no tint — non-vacuous. `own(ICON_TINT, …)` would turn a shipped guard
  // red. `PhaseNode.test.tsx`'s 188.1-04 falsification keeps this line honest.
  const tint = Object.prototype.hasOwnProperty.call(ICON_TINT, data.phaseType)
    ? ICON_TINT[data.phaseType]
    : DEFAULT_TINT

  // VALID-03 (184-10): the server's verdict mark, threaded down on `data` by the shell
  // exactly as the ⌥ reveal is. The value was already reduced to one of three states by
  // `verdictModel.markFor`, which reads `verdict.severity` and derives NONE of it — so
  // this adapter neither classifies nor asks, and a provider-less node still renders.
  // The cast is the price of `PhaseNodeData`'s `[k: string]: unknown` index signature,
  // which @xyflow/react requires on every node-data shape; the value's own type is
  // guaranteed at the shell's `marks` prop, which is typed to this exact union.
  const verdict = data.verdict as VerdictMarkKind | undefined

  // RUNVIZ-01 (188-07): the step's live run state, threaded down on `data` by the shell
  // exactly as the ⌥ reveal and the verdict mark are (D-183-08 / D-184-06). The PAGE owns
  // every part of it — it joins the run's rows to the definition's slugs, it calls
  // `phaseState.canvasReading` once to pick the reading, and it calls
  // `runVocabulary.runReadingLabel` once to word it — so this adapter derives nothing,
  // collapses nothing and maps no status. That is what stops `PhaseNode` growing a second
  // source of truth for a value only the run stream owns, and it is why a provider-less
  // node still renders in a unit test.
  //
  // The cast is the same price `verdict` pays one line above: `PhaseNodeData` carries an
  // `[k: string]: unknown` index signature because @xyflow/react requires one on every
  // node-data shape. The value's own type is guaranteed at the shell's `runState` prop,
  // which is typed to this exact interface.
  const run = data.run as NodeRunState | undefined

  // BADGE SLOT 1 IS NOW SPENT, AND THE BUDGET IS FULL (Phase 189-15 · D-12 / D-18).
  //
  // Until 185-08 slot 1 carried the three-face grounding word-badge. That badge is
  // DELETED, not moved: governance renders as SHAPE — the corner seal 185-09 places at
  // the card's top-right, passed below as `grounded` — and SPEC Req 6 states that
  // governance spends no colour and no word-badge slot. Its inputs still reach this
  // component, as `data.grounded` and `data.armed`; what is gone is the chip that spoke
  // them, and what replaced it costs neither a slot nor a colour. THAT ARGUMENT IS
  // UNCHANGED by 189: the badge below is not a governance mark, and governance still
  // spends neither colour nor a slot.
  //
  // ⚠ CORRECTED at Phase 189-15, IN THE COMMIT THAT FALSIFIED IT. This paragraph used to
  // end *"Slot 1 is therefore still empty and now belongs to Phase 189 alone."* Both
  // claimants have now answered. Phase 188 paints run state on this card (see `run`
  // above) and spends ZERO badge slots — its channel is the ring's geometry plus a
  // sentence in the body, which is exactly why sketch 153-A won — and Phase 189 SPENDS
  // the slot, here, on the muted "Not connected" word-badge below.
  //
  // THERE IS NO THIRD SLOT TO ADD ONE TO. `BadgeSlots` is a max-2 tuple union, so a third
  // badge is a typecheck error rather than a review comment — the budget
  // `PhaseNodeCard`'s own docblock says it enforces. It is control-tested, not asserted:
  // `PhaseNodeCard.test.tsx`'s `@ts-expect-error` case reads 34 type errors with the
  // union widened and 33 with it narrow, and that swing was RE-OBSERVED at 189-15 after
  // the slot was spent, because a guard nobody re-ran after changing its subject is a
  // guard on trust.
  //
  // Slot 2 is unchanged: `Waits for you`, on `llm_human_input` only (D-183-07).
  const waitsForYou: BadgeSlot = {
    testId: "canvas-waits-for-you",
    tone: "primary",
    label: "Waits for you",
    dataAttr: { "data-waits-for-you": "true" },
  }

  // SLOT 1 (D-12 / D-18, CONN-01) — this step reaches outside and is wired to nothing yet.
  //
  // CONDITIONAL ON THE STATE, NOT ON THE TYPE. `data.notConnected` is resolved ONCE at
  // projection time by `phaseVocabulary.notConnectedOf` (189-13), whose type test and
  // state test sit on separate lines on purpose. When Phase 190 binds a real destination
  // that predicate returns false, the tuple below falls to its existing branch, the badge
  // stops rendering — and THIS FILE IS NOT TOUCHED. The badge RETIRES BY DATA, NOT BY
  // EDIT, which is the whole reason D-12 chose a state-conditional badge over a
  // type-conditional one: the invariant fact (this type is always armed for approval) is
  // really part of the type, and 185 set the precedent by spending no badge at all on it.
  //
  // MUTED, AND NO GLYPH. `primary` is the live/waiting indigo and is spoken for by slot 2;
  // `success` would read as good news; the strong tokens are banked for 188's run status.
  // "Not connected" is a calm design-time fact, not an alarm, and `muted` is `StatusChip`'s
  // own calm-terminal tone. The WORD carries the meaning either way (WCAG 1.4.1) — tone is
  // decoration — and `icon-convention.md` §4 is explicit that a word-badge carries NO glyph.
  const notConnected: BadgeSlot = {
    testId: "canvas-not-connected",
    tone: "muted",
    label: "Not connected",
    dataAttr: { "data-not-connected": "true" },
  }

  // EXPLICIT BRANCHES, NEVER A SPREAD. `[...a, ...b]` widens `BadgeSlots` to
  // `BadgeSlot[]` and SILENTLY RETIRES the max-2 typecheck guard — the one budget on this
  // face that no review reliably catches, which is why the guard exists at all.
  //
  // ORDER IS A TUPLE POSITION, NOT A PREFERENCE. Position 0 IS slot 1, so the new badge
  // comes FIRST in every branch that carries it; the shipped one is documented as slot 2
  // in three separate places.
  //
  // ⚠ THE TWO-BADGE BRANCH IS UNREACHABLE FROM REAL DATA IN 189 — `external_action` and
  // `llm_human_input` are different phase types, so no projected node sets both booleans —
  // and it must STILL be written: `BadgeSlots` demands the two-badge case be
  // representable, and the positive control for the max-2 guard renders exactly it.
  const badges: BadgeSlots = data.notConnected
    ? data.waitsForYou
      ? [notConnected, waitsForYou]
      : [notConnected]
    : data.waitsForYou
      ? [waitsForYou]
      : []

  // `technicalLine` and `stepNumber` are still deliberately NOT passed. `status` WAS in
  // that list until 188-07 — this plan fills it, below, together with `emitFailure` —
  // just as `verdict` was until 184-10 and `grounded` until 185-09. The line is corrected
  // each time rather than left, because a comment that still names a slot the component
  // now fills is the same defect as a false docblock.
  //
  // `technicalLine` is not merely unspent by 188, it is DECLINED by it (UI-SPEC § Card
  // Body Budget rule 2): the card body is ONE budget, the run line is the thing 188
  // spends it on, and declining the 10px mono line is what dissolved the three-way
  // competition D-188-17 warned about. Declining a slot is a decision, recorded here
  // rather than discovered later. Both it and `stepNumber` stay free for Phase 189 —
  // `stepNumber` additionally guarded by D-183-07, which keeps the step ordinal off the
  // face regardless of who wants it.
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
  // would spend the corner the seal claims — and, since 189-15, THERE IS NO BADGE SLOT
  // LEFT TO SPEND. Both are taken (slot 1 "Not connected", slot 2 "Waits for you") and a
  // third is a typecheck error against `BadgeSlots`. A face that wants to say more than
  // this now has to argue for a slot, not merely find one.
  return (
    <PhaseNodeCard
      slug={data.slug}
      phaseType={data.phaseType}
      icon={renderPhaseMark(data.phaseType)}
      title={data.title}
      subtitle={technical ? data.technicalTitle : data.subtitle}
      // Phase 200 (canvas port) — the reveal's form is `${label} · ${slug}`, a MACHINE
      // IDENTIFIER, so the card must not truncate it. This adapter is the one place that
      // knows the reveal is on (D-183-08 — exactly ONE technical-names state in the app),
      // which is why the answer is resolved here and passed as data rather than re-derived
      // inside a card that has to render provider-less. See `subtitleIsIdentifier`.
      subtitleIsIdentifier={technical}
      // 200-06 (BC-MR-03) — the branch condition, resolved to the target step's NAME at
      // projection time by `canvasModel.buildPhaseData` via `phaseVocabulary
      // .branchConditionOf`. This adapter derives nothing and resolves nothing: the value
      // is `undefined` for every step that declares no branch, and the card then renders
      // no condition element at all.
      //
      // ⚠ IT IS NOT SWAPPED BY THE ⌥ REVEAL, and that is the point. The reveal swaps a
      // TITLE for its technical form; the condition is a sentence about the workflow's
      // shape and reads the same to both audiences. Its identifier — the target slug —
      // never reaches this face in either mode.
      //
      // The cast is the same price `verdict` and `run` pay above: `PhaseNodeData` carries
      // an `[k: string]: unknown` index signature because @xyflow/react requires one on
      // every node-data shape.
      condition={data.condition as string | undefined}
      tint={tint}
      badges={badges}
      status={run?.reading}
      emitFailure={run?.emitFailure}
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
      // ⚠ THE HOVER SENTENCE (Phase 200 — operator finding, in their words: *"at the very
      // end of the workflow there is a circle, I don't know what this is."*). The cap was
      // already telling screen-reader users what it means, through the `sr-only` span
      // below, and telling sighted users nothing at all. `title` closes that gap with the
      // SAME string from the SAME home, so the two audiences cannot be told two things.
      //
      // IT DOES NOT MAKE THIS FOCUSABLE, deliberately: the model sets `selectable: false`
      // and `focusable: false` on this node, and a `title` needs no tab stop to work under
      // the pointer. The canvas-level "one tab stop per node" invariant is untouched, and
      // so is the cap's inertness.
      title={END_CAP_MEANING}
      className="grid place-items-center rounded-full border border-border/60 bg-card/20 text-muted-foreground"
      style={{ width: CANVAS_LAYOUT.END_CAP_SIZE, height: CANVAS_LAYOUT.END_CAP_SIZE }}
    >
      <EdgeAnchors />
      <span aria-hidden="true" className="text-[13px] leading-none">
        ○
      </span>
      {/* The accessible name. Unchanged in ROLE, but no longer spelled inline — it now comes
          from the plane's one string home, which is what makes the `title` above provably
          the same sentence rather than a second one that merely agrees today. */}
      <span className="sr-only">{END_CAP_MEANING}</span>
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
