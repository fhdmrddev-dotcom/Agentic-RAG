/**
 * Phase 184-03 Task 2 (D-184-06, Wave-0 G-5 extraction, sketch 137-B/137-D) —
 * PhaseNodeCard, cut down to the card itself by 188.2-06.
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
 * WHERE THE REST OF THE CARD WENT (188.2-06 · D-01 — the prose travels WITH its code, and
 * a paragraph describing both what left and what stayed was SPLIT rather than moved, since
 * half-true is the worst state a docblock can be in). `NodeCornerMarks.tsx`: the ⛨ seal,
 * the verdict mark, and the lifetime argument that decides which corner each gets.
 * `NodeRunOverlay.tsx`: the status ring, its five geometry constants, the arc, the pause
 * chip. `NodeIconWell.tsx`: the 3D mark above the top edge. `phaseNodeCardContract.ts`:
 * every slot on these props, including the max-2 badge tuple. `ownProperty.ts`: the WR-04
 * own-guard both mark modules read. STILL HERE: the node box, `{anchors}`, the 137-B card
 * div and its four-branch border, the title, the subtitle, the RUN LINE, the badge row.
 *
 * THE TREE GOT BIGGER WHILE THE FILE GOT SMALLER, and a phase headlined "the file shrank"
 * owes that out loud. Measured at the cut: this file 274 L against 797 before it, and
 * the six-file card subtree 1332 L against the same 797 — +67 %. The five new files
 * carry their own headers, imports, props types and wrappers, so the SUM rises; that is the
 * price of the split, not a regression. It is far steeper than 188.1's +8 %, for the
 * measurable reason that its two destinations came out of a 1593-line file, not a 797.
 *
 * EXTENSIBILITY SEAM #1 — 185 / 188 / 189 ADD DATA, NOT LAYOUT. `badges`, `status`,
 * `verdict`, `technicalLine` and `stepNumber` are the declared slots, and every optional
 * one renders NOTHING when absent. Three are filled (`verdict` 184-08, `grounded` 185-09,
 * `status` 188-06), each costing a change to this body and to nobody else's contract;
 * `technicalLine` is DECLINED and `stepNumber` declared-and-unread. ⚠ CORRECTED at 189-15:
 * this sentence used to end *"Badge slot 1 stays EMPTY and RESERVED FOR PHASE 189"*, and
 * 189 has now SPENT it — on the state-conditional "Not connected" word-badge (D-12 / D-18).
 * The badge budget is therefore FULL and a third is a typecheck error. **Nothing in this
 * FILE changed to make that happen**, which is the seam working exactly as designed: the
 * adapter builds the tuple and passes it through the existing `badges` prop, and this
 * component renders whatever arrives. Governance's own claim is unchanged and still holds —
 * it spends no colour and no word-badge; the badge 189 added is not a governance mark.
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
 * NEUTRAL — 248px wide, centre-aligned inside the 260px node box — with one plain-language
 * title, one supporting line and at most two word-badges centred beneath it. The 137-D
 * class names 185-01 rebuilt it from are NOT quoted here: the greps assert they are gone,
 * and a docblock spelling them would make its own guard vacuous. `pt-[42px]` and
 * `NODE_MIN_HEIGHT: 104` are D-185-17's amendments to a theme carrying 34 and 96.
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
  // THE TWO UNSPENT SLOTS, kept here because they describe slots the card STILL OWNS —
  // 188.2-06 (door b) removed the sentences narrating which phase filled the seal, the
  // ring and the mark, since those blocks and their accounts now live in the three
  // destination modules. `stepNumber` is declared and deliberately unread: D-183-07 keeps
  // the step's index off the face. `technicalLine` is DECLINED by Phase 188 (UI-SPEC §
  // Card Body Budget rule 2) — 187-09 left it notionally free and 188 chose not to spend
  // it, which dissolves the three-way competition D-188-17 warned about between the ⌥
  // subtitle, the run line and a machine identifier. Declining a slot is a decision, so it
  // is recorded rather than discovered. Both stay wired for a caller that supplies them.
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
          // ── THE HOVER LIFT (199-01 · DES-01 · sheet `c2-phase-node` §3 "HOVERED") ────
          //
          // THE ONE ROW OF SHEET c2 THE SHIPPED CARD COULD EXPRESS AND DID NOT. Measured
          // before it was written: `grep -n "hover:"` across all five files of the node
          // subtree returned ZERO. Every other section of that sheet reconciles to
          // ALREADY-SHIPPED or to a CANNOT-EXPRESS with a named reason (199-01's SUMMARY
          // carries all six rows); this is the whole of the phase's build on this atom.
          //
          // IT DELIBERATELY DOES NOT TOUCH THE BORDER, and the sheet's own hover rule does
          // (`border-color: #464651`). Taking that would put a fifth colour utility into a
          // four-branch ternary whose entire argument is that exactly ONE border-colour
          // utility is emitted per state, "so nothing depends on which order Tailwind
          // happens to emit two same-specificity colour classes in" — the paragraph
          // directly below. A hover border would make that sentence false for the one
          // state a person is looking at while they decide whether to click. The fill is
          // the calm carrier and it composes with all four branches instead of racing them.
          //
          // IT IS SUPPRESSED IN RUN MODE, from state the card ALREADY HOLDS. `reading` is
          // the run-mode boolean this whole component hangs off; no slot is added and
          // `phaseNodeCardContract.ts` is untouched. The reason is honesty rather than
          // taste: the run surface renders the canvas with no selection and no select
          // handler, so a card that lit up under the cursor there would be promising an
          // interaction that does not exist. This is the same "mutually exclusive BY
          // SURFACE" fact the border precedence below already relies on, read for a
          // second purpose.
          //
          // THE TRANSITION IS A COLOUR EASE AND NOT MOTION. Motion on this canvas keys off
          // RUN STATE and never off anything else — the run channel's motion is the ring's
          // infinite `canvas-ring-spin`, and nothing here competes with it: no transform,
          // no scale, no loop, no `animate-` utility. `duration-150` is below the threshold
          // at which a colour change reads as liveness. The suite asserts the absence of an
          // animation utility on this element rather than trusting this paragraph.
          reading === null ? "transition-colors duration-150 hover:bg-card/45" : undefined,
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
