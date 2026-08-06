/**
 * Phase 184-03 Task 2 (D-184-06, Wave-0 G-5 extraction, sketch 137-B/137-D) —
 * PhaseNodeCard.
 *
 * THE PHASE CARD, PURELY PRESENTATIONAL. Every value it paints arrives as a prop;
 * it reads no context, fetches nothing, owns no state, and — the whole point of
 * D-184-06 — **imports NOTHING from the canvas graph library**. It therefore renders
 * under a plain `render()` with no provider (proved in `PhaseNodeCard.test.tsx`), and
 * Phase 188 can reuse the same card outside a `ReactFlowProvider`.
 *
 * The graph-library boundary lives one file away, in `PhaseNode.tsx`: that adapter
 * maps `NodeProps` onto this slot contract and injects the hidden edge anchors
 * through the `anchors` slot. This file's zero-graph-library property is machine
 * checked by a `?raw` source guard (the `canvasModel.purity.test.ts:14-17` house
 * idiom) carrying a positive control, so the guard is falsifiable rather than
 * vacuous.
 *
 * EXTENSIBILITY SEAM #1 — 185 / 188 / 189 ADD DATA, NOT LAYOUT. `badges`, `status`,
 * `verdict`, `technicalLine` and `stepNumber` are the declared slots those phases
 * fill. In 184 the adapter passes only `badges`; every other optional slot renders
 * NOTHING when absent, which is what keeps this extraction behaviour-preserving
 * (D-184-08) while still adding the seam. Three of the five are now filled — `verdict`
 * by 184-08, `grounded` by 185-09, `status` by 188-06 — and every one of them cost a
 * change to this component's body and to nobody else's contract, which is the seam
 * doing exactly the job it was cut for.
 *
 * WHAT 185 FILLED, stated literally so this paragraph does not drift either: plan
 * 185-09 added ONE slot, `grounded`, and renders it as the corner seal at top-right
 * plus a border reinforcement — no new layout constant, no new badge. Badge slot 1
 * stayed EMPTY on purpose: SPEC Req 6 says governance spends no colour and no
 * word-badge slot, so the freed slot belongs to 188 / 189 and the governance reading is
 * made of SHAPE instead.
 *
 * WHAT 188 FILLED, in the same voice, because a docblock that still names a slot the
 * component now fills is the same defect as a false one: plan 188-06 filled `status`
 * (with a new `emitFailure` companion) and it is the first slot that puts the card into
 * a MODE — supplying a reading adds the status ring above the card, the run line inside
 * it and a run-state branch on the border, and raises the card's minimum height. It
 * spends **ZERO badge slots**: slot 1 is still empty and still reserved for Phase 189.
 * `technicalLine` is DECLINED by 188 and `stepNumber` is STILL declared and STILL
 * renders nothing — those two are the only unspent slots left on this contract.
 *
 * WHAT 184-08 CHANGED, stated literally so this docblock does not drift: the `verdict`
 * slot is now RENDERED — a corner mark on the card's left edge (it landed on the right
 * in 184-08 and was moved by 185-01; see the mark's own docblock). (This sentence used
 * to end "…while `status` and `stepNumber` are still declared and still render nothing",
 * which 188-06 made false for the first of the two; `stepNumber` alone still holds.)
 * The seam worked exactly as
 * D-184-06 intended: filling it was a change to this component's body and to nobody
 * else's contract. The card is still the wrong place to ask what a verdict MEANS: the
 * value arrives already reduced to one of three states by `verdictModel.markFor`, which
 * reads the server's `severity` and derives none of it (VALID-03 / D-182-06).
 *
 * THE TWO-BADGE BUDGET IS ENFORCED BY THE TYPE SYSTEM (137-B / D-183-07). `BadgeSlots`
 * is a max-2 TUPLE union, so a third badge is a typecheck error rather than a review
 * comment. Phase 185's graded-governance dial therefore physically cannot spend a
 * budget it was not given — it adds data to an existing row.
 *
 * ONE TAB STOP PER NODE (Pattern 3 Option A) — carried here verbatim with the code it
 * constrains. The canvas keeps `nodesFocusable` at its `true` default and the node
 * OBJECT already carries a button role plus an accessible label, so the graph
 * library's own node wrapper is the focus target. This component therefore contains
 * NO focusable control of any kind — no inner pressable element, no anchor, no
 * tab-index attribute, no click handler. An inner control would produce two tab stops
 * per node, ten tab presses to traverse the five-phase maximum, and a screen reader
 * announcing every step twice. Selection is handled once, by the canvas's
 * `onNodeClick`. This is asserted at BOTH levels: `WorkflowCanvas.test.tsx:231-238`
 * walks every rendered `.react-flow__node`, and this card's own suite walks the card
 * in isolation. It is also what forces the ✕-delete and ＋-insert affordances onto
 * the lane rather than into the card (184-12).
 *
 * THE LOOK IS SKETCH 137-B, the locked acceptance bar: a frosted-glass card that stays
 * NEUTRAL — 248px wide, centre-aligned, centred inside the 260px node box — with the 3D
 * mark FLOATING ABOVE ITS TOP EDGE over its own contact shadow, then one plain-language
 * title, one supporting line, and at most two word-badges, all centred beneath it.
 *
 * (185-01 rebuilt this from 137-D, where the mark sat at the LEFT edge of a full-width
 * card pushed 24px right by a left margin, its body padded to clear the icon. The card
 * class names of that shape are deliberately NOT quoted anywhere in this file: the
 * plan's acceptance greps assert they are gone, and a docblock that spelled them would
 * make its own guard vacuous. The move is not decoration: SPEC Req 6 CLAIMS top-right
 * for the governance seal and relocates the verdict mark to the left, and on 137-D a
 * left verdict overlapped the left-edge icon well by 14×8px — no left placement was
 * reachable at all. D-185-17 sequences the rebuild ahead of every governance mark, as
 * its own separately-committed plan. The clearance numbers `pt-[42px]` and
 * `NODE_MIN_HEIGHT: 104` are D-185-17's amendments to the sketch theme, which carries
 * 34 and 96; every other constant here is the theme's, verbatim.)
 *
 * Per-step-type colour is a TINT BEHIND THE ICON ONLY — the colour budget was banked
 * for exactly this, and 188-06 is what spends it: the status ring's arc, and the run
 * border on the three loud readings. Motion keys off RUN STATE, never off selection
 * (the defect found in the sketch 137 review), and 188-06 is where that sentence stops
 * being hypothetical: the ONE animation on this card is the running arc's spin, guarded
 * behind `prefers-reduced-motion`. A card with no reading is still completely still,
 * and any ambient drift still belongs to the canvas backdrop.
 *
 * TOTALITY: an unrecognised `phaseType` is a data attribute here, never a lookup —
 * the adapter resolves the tint (falling back to `nodePresentation.DEFAULT_TINT`) and
 * the mark before either reaches this component, so the card cannot crash on a
 * forward-compat discriminator. That mirrors `panel/PhaseCard.tsx`'s
 * `UNKNOWN_PHASE_META` discipline.
 *
 * XSS (T-124-01 / T-184-03-01): every authored string (phase names, subtitles, badge
 * labels) is rendered as a plain React text child — never `dangerouslySetInnerHTML`.
 *
 * (The house grep guard for that clause is anchored on the JSX PROP FORM — the
 * identifier followed by an assignment — never on the bare identifier, because the
 * clause itself must be quoted verbatim in this docblock, exactly as it is in
 * `PhaseNode.tsx`, `PhaseSpine.tsx`, `WorkflowSoul.tsx` and `WorkflowDoorSwitch.tsx`.)
 */
import { StatusChip } from "@/components/org/StatusChip"
import { CANVAS_LAYOUT } from "@/components/workflows/canvasModel"
// 188.2-06: the three modules the card's four mark blocks were cut into. Each is
// rendered at the byte-identical JSX position its block occupied inline — these elements
// are absolutely positioned and their paint order IS their document order.
import { NodeCornerMarks } from "@/components/workflows/NodeCornerMarks"
import { NodeIconWell } from "@/components/workflows/NodeIconWell"
import { NodeRunOverlay } from "@/components/workflows/NodeRunOverlay"
// 188.2-06: the slot contract, imported back from its own leaf. THERE IS NO RE-EXPORT
// SHIM here and there may never be one (D-06): a re-export that exists so nobody has to
// change two lines is a second name for the same type, free to be the one a later phase
// imports by accident. Both callers re-point instead.
import type { PhaseNodeCardProps } from "@/components/workflows/phaseNodeCardContract"
import { runReadingBorder, runReadingLabel } from "@/components/workflows/runVocabulary"
import { cn } from "@/lib/utils"

/**
 * The card's minimum height IN RUN MODE, 104 → 120.
 *
 * One 11px `leading-snug` line (≈15px) plus its 4px top margin is 19px, and 120 is the
 * next 4px step that clears it. The floor is raised for the WHOLE run view rather than
 * per-reading, because the run line renders at every reading: a card that grew only when
 * its step finished would reflow the spine live, on the exact surface a non-technical
 * person is watching it.
 *
 * `CANVAS_LAYOUT` itself is untouched. Edges are unaffected either way — `EDGE_ANCHOR_Y`
 * is measured from the node TOP, which is precisely what D-183-12 exists for.
 */
const RUN_MODE_NODE_MIN_HEIGHT = 120

// ── The card ────────────────────────────────────────────────────────────────────

/**
 * One phase, one card. `llm_batch_agents` gets ONE card: the ×N fan-out is runtime
 * behaviour, not topology (sketch 136), and drawing N lanes would disagree with the
 * server's adjacency.
 */
export function PhaseNodeCard(props: PhaseNodeCardProps) {
  // `stepNumber` is the LAST slot still declared and deliberately unread — D-183-07
  // keeps the step's index off the face, and putting it on is a sketch decision with
  // its own acceptance bar. `verdict` joined the rendered set in 184-08 and is the ONE
  // slot whose value comes from the server rather than from a local derivation.
  // `grounded` joined it in 185-09 and is the ONE slot resolved by a shared client rule
  // rather than by the server. `status` joined it in 188-06 (with `emitFailure`) and is
  // the ONE slot that puts the whole card into a different MODE.
  //
  // `technicalLine` is DECLINED by Phase 188 (UI-SPEC § Card Body Budget rule 2): 187-09
  // left it notionally free for this phase and this phase chooses not to spend it, which
  // is what dissolves the three-way competition D-188-17 warned about between the ⌥
  // subtitle, the run line and a machine identifier. Declining a slot is a decision, and
  // it is recorded here rather than discovered later. It stays wired for a caller that
  // supplies it; the 188 adapter does not.
  const {
    slug,
    phaseType,
    icon,
    title,
    subtitle,
    technicalLine,
    tint,
    badges,
    status,
    emitFailure,
    verdict,
    grounded,
    selected,
    anchors,
  } = props

  // RUN MODE is exactly "a reading was supplied". Everything 188 adds hangs off this one
  // boolean, so the Builder — which supplies no reading — renders the 185 card unchanged.
  const reading = status ?? null
  const runBorder = reading === null ? undefined : runReadingBorder(reading)
  const minHeight = reading === null ? CANVAS_LAYOUT.NODE_MIN_HEIGHT : RUN_MODE_NODE_MIN_HEIGHT

  return (
    <div
      data-testid={`canvas-node-${slug}`}
      data-slug={slug}
      data-phase-type={phaseType}
      data-selected={selected ? "true" : "false"}
      className="relative"
      style={{ width: CANVAS_LAYOUT.NODE_WIDTH, minHeight }}
    >
      {anchors}

      {/* The frosted card. Neutral by construction — no per-type wash anywhere.
          137-B geometry (`themes/canvas-184.css` `body.card-b .node`): a 248px
          centre-aligned BLOCK card, horizontally centred inside the 260px node box,
          `border-radius: 22px`, padding `42px 20px 20px`. The top padding is the one
          number that does NOT come from the sketch theme — D-185-17 raises it 34 → 42
          so the mark floating above the top edge clears the title by 11px.

          THE SEALED EDGE (185-09, sketch 143-A) is the third branch of the border
          ternary: a grounded step's border is lifted to `hsl(220 30% 100% / .34)`. It
          is REINFORCEMENT, never the carrier. It is EXPECTED to be overwritten — by
          the `selected` treatment today and by Phase 188's run status tomorrow — and
          that is ACCEPTED, because the corner seal below carries its own background
          and its own border and therefore survives both. 143-A verified exactly this
          degradation live at all four run states: the reading drops from two carriers
          to one, and never to zero. The three branches are mutually exclusive on
          purpose — one border-colour utility per state, so nothing depends on which
          order Tailwind happens to emit two same-specificity colour classes in. */}
      <div
        className={cn(
          "mx-auto block w-[248px] rounded-[22px] border pb-5 pt-[42px] px-5 text-center",
          "bg-card/30 backdrop-blur-sm",
          "shadow-[0_1px_0_hsl(var(--foreground)/0.06)_inset,0_18px_36px_-22px_rgba(0,0,0,0.95)]",
          // 188-06 prepends ONE branch, so precedence reads:
          //   run state (when supplied) > selected > grounded > default.
          // It can never actually contend with the branch below it, and that is by
          // design rather than by luck: the run surface renders the canvas with no
          // selection and no select handler, so no node is ever selected there, and the
          // Builder never supplies a reading, so no node ever has one there. The two
          // states are mutually exclusive BY SURFACE.
          //
          // Only three readings claim the border at all — the two loud ones and the
          // running one. `done`, `not-started`, `skipped` and `unknown` fall straight
          // through to the sealed edge or the default, unchanged.
          runBorder
            ? runBorder
            : selected
              ? "border-primary shadow-[0_0_0_1px_hsl(var(--primary)/0.4)]"
              : grounded
                ? "border-[hsl(220_30%_100%/0.34)]"
                : "border-border/50",
        )}
        style={{ minHeight }}
      >
        <p className="truncate font-headline text-[14px] font-semibold leading-tight text-foreground">
          {title}
        </p>

        {subtitle ? (
          <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{subtitle}</p>
        ) : null}

        {/* THE RUN LINE (188-06 · sketch 154-A · UI-SPEC § Card Body Budget slot 3).
            Every step states its own truth inside its own card, which is what lets the
            run band above the canvas shrink to a single line.

            IT RENDERS AT EVERY READING, *Not started* included. Showing it only for
            terminal readings would make every card change height as the run progressed
            — reflow on a live canvas, on the exact surface a non-technical person is
            watching. Constant height is also why the run-mode floor is raised for the
            whole view rather than per-node.

            The words come from ONE function, which is also the function that builds the
            node's accessible-name suffix, so what is read and what is announced cannot
            drift apart. The clause set is bounded to short fixed strings, so the
            two-line clamp is a guard rather than a routine event — and when a long
            clause meets a long ⌥ subtitle it is THIS line that clamps and never the
            subtitle, because the subtitle under ⌥ carries the whole identifier and
            re-truncating it would undo the shipped 187-09 fix.

            It is a `<p>`: no tooltip trigger, no button, no tab index, no handler. One
            tab stop per node is a canvas-level invariant. */}
        {reading !== null ? (
          <p
            data-testid="canvas-node-run-line"
            data-reading={reading}
            className="mt-1 line-clamp-2 text-[11px] leading-snug text-foreground/90"
          >
            {runReadingLabel(reading, emitFailure)}
          </p>
        ) : null}

        {technicalLine ? (
          <p
            data-testid="canvas-node-technical-line"
            className="mt-1 truncate font-mono text-[10px] leading-snug text-muted-foreground"
          >
            {technicalLine}
          </p>
        ) : null}

        {/* At most TWO word-badges (D-183-07), and the type says so. No tool chips,
            no gate identifiers, no phase_index on the face. */}
        {badges && badges.length > 0 ? (
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {badges.map((badge) => (
              <span key={badge.testId} {...badge.dataAttr}>
                <StatusChip tone={badge.tone} testId={badge.testId}>
                  {badge.glyph ? (
                    <span aria-hidden="true" className="mr-1">
                      {badge.glyph}
                    </span>
                  ) : null}
                  {badge.label}
                </StatusChip>
              </span>
            ))}
          </div>
        ) : null}
      </div>

      <NodeCornerMarks verdict={verdict} grounded={grounded} />

      <NodeRunOverlay reading={reading} />

      <NodeIconWell icon={icon} tint={tint} />
    </div>
  )
}
