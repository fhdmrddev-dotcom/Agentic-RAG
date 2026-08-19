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
 * chip. `phaseNodeCardContract.ts`: every slot on these props, including the max-2 badge
 * tuple. `ownProperty.ts`: the WR-04 own-guard both mark modules read.
 *
 * ⚠ THE FOURTH DESTINATION IS GONE. This list named `NodeIconWell.tsx`: the 3D mark above
 * the top edge. The Phase 200 canvas port DELETED that module — sketch 200 draws the step's
 * mark INSIDE the card, in a 24px left gutter, so a module whose whole subject was a 62px
 * disc floating above the card's top edge had no consumer left. Its responsibility, and the
 * no-clipping rule its docblock carried, came back here into the card's inline icon-well
 * comment. Nothing else in the tree imported it (measured: `grep -rn "NodeIconWell"
 * frontend/src` returns prose only), and the suite's own destination-count pin was moved
 * 5 → 4 deliberately rather than allowed to drift.
 *
 * STILL HERE: the node box, `{anchors}`, the card div and its four-branch border, the inline
 * icon well, the title, the subtitle, the effect banner, the RUN LINE, the badge row.
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
 * ⚠ THE LOOK IS SKETCH 200, AND THIS PARAGRAPH REPLACED ITS PREDECESSOR RATHER THAN
 * BEING EDITED AROUND IT. It read, for five phases: "THE LOOK IS SKETCH 137-B, the locked
 * acceptance bar: a frosted-glass card that stays NEUTRAL — 248px wide, centre-aligned
 * inside the 260px node box — with one plain-language title, one supporting line and at
 * most two word-badges centred beneath it. … `pt-[42px]` and `NODE_MIN_HEIGHT: 104` are
 * D-185-17's amendments to a theme carrying 34 and 96."
 *
 * WHAT IS TRUE NOW: the face is `screens/builder-canvas.html`'s, ported from its markup
 * rather than derived from a change-log. A COMPACT HORIZONTAL ROW — 240px wide, a small
 * radius, a solid card fill, 16px of padding — carrying a 24px icon well on the LEFT and
 * then a left-aligned column: a 13px title, an 11px supporting line, and (only where the
 * step reaches beyond this workspace) a 9px wide-tracked effect banner. The floor is the
 * sheet's own 72px and the card still grows downward from it, which is how the run line,
 * the branch condition and the badges keep their homes on a card half the height.
 *
 * The 137-D class names 185-01 rebuilt the old card from are still NOT quoted here: the
 * greps assert they are gone, and a docblock spelling them would make its own guard
 * vacuous.
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
import { NodeRunOverlay } from "@/components/workflows/NodeRunOverlay"
// Phase 200 (canvas port) — the sheet's third body line and its ONE string home. The
// module is a true leaf (it imports nothing), and its docblock carries the reason the
// sheet's SECOND banner, `ONLY READS`, is declined rather than approximated.
import { effectBannerFor } from "@/components/workflows/nodeEffectBanner"
// 188.2-06: the slot contract, imported back from its own leaf. THERE IS NO RE-EXPORT
// SHIM here and there may never be one (D-06): a re-export that exists so nobody has to
// change two lines is a second name for the same type, free to be the one a later phase
// imports by accident. Both callers re-point instead.
import type { PhaseNodeCardProps } from "@/components/workflows/phaseNodeCardContract"
import { runReadingBorder, runReadingLabel } from "@/components/workflows/runVocabulary"
import { cn } from "@/lib/utils"

/**
 * The card's minimum height IN RUN MODE.
 *
 * ⚠ 120 → 84 AT THE PHASE 200 CANVAS PORT, and the original reasoning is kept because it
 * is UNCHANGED — only its inputs moved. It read: "One 11px `leading-snug` line (≈15px)
 * plus its 4px top margin is 19px, and 120 is the next 4px step that clears it." The same
 * arithmetic now starts from the sheet's 72px floor rather than 137-B's 104, and lands on
 * 84 — which is, independently, the exact height `screens/builder-canvas.html` gives its
 * OWN three-line nodes. Two routes to one number is why it is written down.
 *
 * The floor is still raised for the WHOLE run view rather than per-reading, for the
 * original reason: the run line renders at every reading, so a card that grew only when
 * its step finished would reflow the plane live, on the exact surface a non-technical
 * person is watching it.
 *
 * `CANVAS_LAYOUT.EDGE_ANCHOR_Y` is still measured from the node TOP, so edges are
 * unaffected by this floor either way — precisely what D-183-12 exists for.
 */
const RUN_MODE_NODE_MIN_HEIGHT = 84

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
    condition,
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
  // Phase 200 (canvas port) — resolved by a total function over the phase type, so an
  // unrecognised forward-compat discriminator yields `null` and the card renders no
  // banner element at all. No lookup and no default string: see `nodeEffectBanner.ts`.
  const effectBanner = effectBannerFor(phaseType)
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

      {/* ── THE CARD, PORTED DIRECTLY FROM `screens/builder-canvas.html` ──────────────
          Phase 200 (canvas port). The sheet's own node markup, structure for structure:

            w-[240px] h-[72px] bg-card border border-border-color rounded
            flex items-center p-md  (+ a hover border change) transition-colors

          ⚠ The sheet's hover token is described above rather than QUOTED, deliberately: a
          fence in this card's suite pins the exact SET of hover utilities spelled anywhere
          in this subtree's source, and a docblock quoting one verbatim would add a phantom
          member and turn a shipped guard red against prose.

          — a COMPACT HORIZONTAL ROW: a 24px icon well on the LEFT, then a left-aligned
          content column of a 13px title over an 11px supporting line. Ten of the sheet's
          ten canvas nodes are that shape and no other.

          ⚠ WHAT THIS REPLACED, SAID PLAINLY RATHER THAN QUIETLY SWAPPED. Until this commit
          the card was 137-B's: a 248px frosted block, `rounded-[22px]`, CENTRE aligned,
          padded `42px 20px 20px` to clear a 62px 3D mark floating above its top edge. That
          shape was a locked acceptance bar for five phases and it is not being called a
          mistake — it is REPLACED because the operator has named sketch 200 the absolute
          reference and 200 draws a different card. The 137-B geometry survives in this
          file's git history and in the three `CARD_HTML_BASELINE` captures, which are
          re-baselined in this same commit with the reason written INSIDE the pin.

          THE HEIGHT IS A FLOOR, NOT A FIXED SIZE, and the sheet agrees: its two-line nodes
          are 72px and its three-line nodes (the ones carrying an effect banner) are 84px.
          The card still grows DOWNWARD from the floor, so a run reading or a branch
          condition adds a line rather than being hidden.

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
          // THE SHEET'S BOX: 240 wide, small radius, solid card fill, 16px pad, a
          // horizontal row aligned to its top so a grown card keeps the icon beside the
          // TITLE rather than drifting to the vertical centre of five lines.
          "mx-auto flex w-[240px] items-start gap-2 rounded border bg-card p-4 text-left",
          "shadow-[0_1px_0_hsl(var(--foreground)/0.06)_inset,0_18px_36px_-22px_rgba(0,0,0,0.95)]",
          // ── THE HOVER LIFT (199-01 · DES-01 · sheet `c2-phase-node` §3 "HOVERED") ────
          //
          // THE ONE ROW OF SHEET c2 THE SHIPPED CARD COULD EXPRESS AND DID NOT. Measured
          // before it was written: `grep -n "hover:"` across all five files of the node
          // subtree returned ZERO. Every other section of that sheet reconciles to
          // ALREADY-SHIPPED or to a CANNOT-EXPRESS with a named reason (199-01's SUMMARY
          // carries all six rows); this is the whole of the phase's build on this atom.
          //
          // ⚠ CORRECTED BY THE PHASE 200 PORT, AND THE ORIGINAL REFUSAL IS PRESERVED
          // DIRECTLY BELOW RATHER THAN DELETED. 199-01 shipped a FILL change only and
          // recorded, verbatim: "IT DELIBERATELY DOES NOT TOUCH THE BORDER, and the
          // sheet's own hover rule does (`border-color: #464651`). Taking that would put a
          // fifth colour utility into a four-branch ternary whose entire argument is that
          // exactly ONE border-colour utility is emitted per state … A hover border would
          // make that sentence false for the one state a person is looking at while they
          // decide whether to click. The fill is the calm carrier and it composes with all
          // four branches instead of racing them."
          //
          // That refusal was correct ON ITS OWN TERMS and it is OVERRULED on the
          // operator's: the sketch is the absolute reference, and `node-identity.html`
          // §"Interaction States" draws HOVERED as two simultaneous changes — a lifted
          // border AND `-translate-y-1`. 199-01 shipped neither.
          //
          // THE TAILWIND-MERGE CONCERN IT RAISED DOES NOT ACTUALLY BIND HERE, which is the
          // measurable part of the correction rather than a matter of taste. A hover-variant
          // border utility and a BASE border utility are DIFFERENT VARIANTS, so they never
          // contend for the same tailwind-merge slot; the "exactly one border-colour utility
          // per state" invariant is about the RESTING class list and is untouched.
          // The re-baselined captures below are the evidence: every one still carries
          // exactly one unprefixed border-colour token.
          //
          // THE LIFT IS MOTION, and this canvas's standing rule is that motion keys off RUN
          // STATE. The rule is honoured by the suppression below, not broken by the lift:
          // it renders ONLY in Builder mode, where there is no run for it to compete with.
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
          reading === null
            ? "transition-[transform,border-color] duration-150 hover:-translate-y-1 hover:border-muted-foreground"
            : undefined,
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
                : "border-border",
        )}
        style={{ minHeight }}
      >
        {/* THE ICON WELL, INLINE AND ON THE LEFT — the sheet's
            `w-6 h-6 mr-sm flex-shrink-0 … flex items-center justify-center` gutter, with
            its glyph at the sheet's own `text-[18px]`.

            ⚠ IT USED TO FLOAT ABOVE THE CARD, and the rule that fact carried has MOVED HERE
            rather than died with it. `NodeIconWell` rendered this mark at `top-[-26px]`,
            62px across, horizontally centred and overhanging the node box; the sheet puts it
            INSIDE the card, so THIS element no longer overhangs and that module is deleted.

            THE NO-CLIPPING RULE STILL BINDS, because the verdict mark still overhangs — it
            straddles the card's left border at `left-[-1px]`, one pixel outside the node box.
            So: nothing in this subtree — this wrapper, the card, the node box, or the node
            wrapper the graph library puts around it — may ever take `overflow-hidden`. It is
            a property of the whole ancestor chain and not of the one element that overhangs.

            ⚠ THIS IS THE TREE'S ONLY MENTION OF THAT UTILITY AND THE COUNT IS PINNED AT
            EXACTLY ONE (`PhaseNodeCard.test.tsx`, the 188-06 no-clipping block), so the rule
            cannot be deleted as easily as the utility cannot be added. Do not add a second
            mention anywhere in this subtree. It used to live in `NodeIconWell.tsx` and the
            port had to re-home it deliberately — a naive deletion took the count to ZERO and
            turned the pin red, which is exactly the alarm it was built to raise.

            THE PER-TYPE TINT SURVIVES THE MOVE, and it remains the only per-step-type
            colour on the whole face — the colour budget 137-D banked and 188 spends on run
            state. It is a soft disc BEHIND the mark, inset negatively so it reads as a
            glow around a 24px glyph rather than as a filled chip. `tint` arrives already
            resolved by the adapter (own-property guarded there, WR-04 site 1) and reaches
            an inline style object, never markup — so this element renders no authored
            string into an HTML sink.

            `aria-hidden`, no control, no tab index: one tab stop per node is a
            canvas-level invariant and the node's own accessible name states the type. */}
        <span
          aria-hidden="true"
          data-testid="canvas-node-icon"
          className="relative grid h-6 w-6 shrink-0 place-items-center"
        >
          <span
            className="absolute inset-[-5px] rounded-full"
            style={{ background: `radial-gradient(circle, ${tint}, transparent 68%)` }}
          />
          <span className="relative grid place-items-center text-[18px] leading-none text-muted-foreground">
            {icon}
          </span>
        </span>

        {/* THE CONTENT COLUMN — the sheet's `flex-grow min-w-0`. Left aligned, which is the
            change that makes ten cards on a plane read as one column of steps rather than
            as ten independent posters. */}
        <div className="min-w-0 flex-1">
          {/* No `data-testid` on the title or the supporting line, deliberately — they had
              none before the port and adding one would widen every `CARD_SHAPE` capture in
              this card's suite for no assertion that wants it. The icon well and the effect
              banner DO carry one, because a fence and a behaviour test respectively ask for
              them by name. */}
          <p className="truncate text-[13px] font-medium leading-tight text-foreground">
            {title}
          </p>

          {subtitle ? (
            <p className="mt-1 truncate text-[11px] leading-snug text-muted-foreground">
              {subtitle}
            </p>
          ) : null}

          {/* THE EFFECT BANNER — the sheet's third line, on the four of its ten nodes that
              reach beyond this workspace:
              `text-status-warning text-[9px] font-bold mt-1 tracking-wider`.

              ⚠ THE SHEET DRAWS TWO BANNERS AND ONLY ONE IS ON THE WIRE. `ONLY READS` is
              DECLINED, not approximated — every external capability this client recognises
              is a WRITE, so nothing could resolve a step to it without the model choosing
              which steps "only read". The whole argument, and its dated re-open trigger,
              lives in `nodeEffectBanner.ts`; the word itself has exactly one home there. */}
          {effectBanner ? (
            <p
              data-testid="canvas-node-effect-banner"
              className="mt-1 text-[9px] font-bold leading-snug tracking-wider text-warning"
            >
              {effectBanner}
            </p>
          ) : null}

        {/* THE BRANCH CONDITION (200-06 · BC-MR-03 · ledger row `BC-3`).
            The step's own condition, in business words, resolved to the target step's
            NAME by the projection — never a slug, and never on a step that declares no
            branch. It is a BODY line rather than a badge because both badge slots are
            spent and a third is a typecheck error, and because it is a sentence.

            It sits BELOW the type sentence and ABOVE the run line on purpose: the two
            lines above it say what this step IS, and the run line says what it is DOING
            right now. A condition is a fact about the SHAPE of the workflow, so it reads
            with the design-time half rather than interleaved with the live half.

            A `<p>`: no tooltip trigger, no control, no tab index. One tab stop per node is
            a canvas-level invariant and this is not an exception to it. */}
        {condition ? (
          <p
            data-testid="canvas-node-condition"
            className="mt-1 line-clamp-2 text-[11px] leading-snug text-[hsl(38_92%_60%/0.95)]"
          >
            {condition}
          </p>
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
      </div>

      <NodeCornerMarks verdict={verdict} grounded={grounded} />

      <NodeRunOverlay reading={reading} />
    </div>
  )
}
