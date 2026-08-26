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
 * `NodeIconWell.tsx`: the 3D mark above the top edge.
 *
 * ⚠ THAT FOURTH DESTINATION WAS DELETED AND IS NOW RESTORED, and both moves are recorded
 * because the second one is a REVERSAL and not a discovery. The Phase 200 canvas port cut
 * `NodeIconWell.tsx` on the ground that sketch 200 draws the step's mark INSIDE the card in
 * a 24px left gutter, so a module whose whole subject was a 62px disc floating above the
 * card's top edge had no consumer left. **The operator has since seen both faces rendered
 * and chosen the earlier one** — naming the ring around the mark and the card silhouette
 * specifically — so the module is restored from `cd6f7b1d` VERBATIM and the card renders
 * `<NodeIconWell>` again at its original JSX position. The port's own destination-count pin
 * moves 4 → 5, back where it was, deliberately rather than by drift.
 *
 * ⚠ THIS IS NOT A CLAIM THAT THE PORT WAS WRONG TO PORT. Sketch 200 really does draw the
 * compact row, and a port that reproduced it was doing its job. What changed is the
 * JUDGEMENT: two faces were built, both were looked at in a browser, and the older one won.
 * The sheet governs presentation only while the operator agrees with the sheet.
 *
 * STILL HERE: the node box, `{anchors}`, the 137-B card div and its four-branch border, the
 * title, the subtitle, the effect banner, the branch condition, the RUN LINE, the elapsed,
 * the badge row.
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
 * title, one supporting line and at most two word-badges centred beneath it, and the 62px
 * 3D mark floating above its top edge. `pt-[42px]` and `NODE_MIN_HEIGHT: 104` are
 * D-185-17's amendments to a theme carrying 34 and 96.
 *
 * ⚠ THE PARAGRAPH ABOVE WAS REPLACED BY THE PHASE 200 CANVAS PORT AND IS RESTORED, and the
 * port's own wording is kept here rather than deleted, because a reversal that erased what
 * it reversed would leave the next editor to rediscover both faces from scratch. The port
 * read: "WHAT IS TRUE NOW: the face is `screens/builder-canvas.html`'s, ported from its
 * markup rather than derived from a change-log. A COMPACT HORIZONTAL ROW — 240px wide, a
 * small radius, a solid card fill, 16px of padding — carrying a 24px icon well on the LEFT
 * and then a left-aligned column: a 13px title, an 11px supporting line, and (only where
 * the step reaches beyond this workspace) a 9px wide-tracked effect banner. The floor is
 * the sheet's own 72px and the card still grows downward from it."
 *
 * ⚠ WHAT THE REVERSAL KEEPS, said plainly so it is not mistaken for an incomplete revert.
 * The port added three CONTENT slots the 137-B card never had — the effect banner, the
 * branch condition and the elapsed — and those are CAPABILITIES, not silhouette. They stay,
 * re-composed centre-aligned. Only the geometry goes back: the box, the radius, the fill,
 * the alignment, the padding, the hover, and the mark's return to the top edge.
 *
 * The 137-D class names 185-01 rebuilt this card from are NOT quoted here: the greps assert
 * they are gone, and a docblock spelling them would make its own guard vacuous.
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
// Phase 200 (canvas port) / Phase 209 (Item 2) — the effect banner.
import { EFFECT_BANNER_READ_ONLY, effectBannerFor } from "@/components/workflows/nodeEffectBanner"
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
 * ⚠ 120 → 84 AT THE PHASE 200 CANVAS PORT AND BACK TO 120 HERE. The port's arithmetic was
 * sound and is kept: "The same arithmetic now starts from the sheet's 72px floor rather
 * than 137-B's 104, and lands on 84." Its INPUT was the sheet's 72px card, and that card is
 * reverted, so the input is 104 again and the output is 120 again. ⚠ THE THREE CONSTANTS
 * MOVE TOGETHER OR THE CONNECTORS DETACH: `CANVAS_LAYOUT.NODE_MIN_HEIGHT` goes 72 → 104 in
 * the same commit and `CANVAS_LAYOUT.EDGE_ANCHOR_Y` 36 → 28 with it, because the anchor is
 * measured from the node TOP and the mark now overhangs that top edge again.
 *
 * `CANVAS_LAYOUT.EDGE_ANCHOR_Y` is measured from the node TOP, so edges are unaffected by
 * this floor itself either way — precisely what D-183-12 exists for.
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
    subtitleIsIdentifier,
    condition,
    technicalLine,
    tint,
    badges,
    status,
    emitFailure,
    elapsed,
    verdict,
    grounded,
    selected,
    anchors,
    effectBanner: explicitEffectBanner,
  } = props

  // RUN MODE is exactly "a reading was supplied". Everything 188 adds hangs off this one
  // boolean, so the Builder — which supplies no reading — renders the 185 card unchanged.
  const reading = status ?? null
  const runBorder = reading === null ? undefined : runReadingBorder(reading)
  // Phase 200 (canvas port) / Phase 209 — resolved by a total function over the phase type,
  // or explicit prop from caller with tool/read config.
  const effectBanner = explicitEffectBanner !== undefined ? explicitEffectBanner : effectBannerFor(phaseType)
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

          ⚠ THIS GEOMETRY WAS REPLACED BY THE PHASE 200 CANVAS PORT AND IS RESTORED HERE.
          The port made the card `screens/builder-canvas.html`'s: 240px wide, a small
          radius, a solid fill, 16px of padding, a horizontal row with the mark inside a
          24px LEFT gutter and the text left-aligned. It was a faithful port and it was
          judged in a browser against this one; **the operator chose this one**, naming the
          ring around the mark and the card silhouette. The port's face survives in this
          file's git history at `901b25ff`.

          THE HEIGHT IS A FLOOR, NOT A FIXED SIZE. The card grows DOWNWARD from it, so a run
          reading, a branch condition or an effect banner adds a line rather than being
          hidden — which is what lets the three content slots the port added keep their
          homes on a card that is no longer the port's shape.

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
          // ⚠ THE PHASE 200 PORT OVERRULED THAT REFUSAL AND THIS COMMIT RESTORES IT, and
          // the port's argument is kept rather than deleted because part of it was
          // MEASURED and stays true: a hover-variant border utility and a BASE border
          // utility are different variants, so they never contend for the same
          // tailwind-merge slot. That is why the port's border hover was safe. It is
          // reverted anyway, with the rest of the port's face, because its whole warrant
          // was "the sketch is the absolute reference" — and that premise is the one the
          // operator has now withdrawn for this card. The port also shipped a
          // `-translate-y-1` lift; motion on this canvas keys off RUN STATE, and the fill
          // is what 199-01 chose for exactly that reason.
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

        {/* THE SUPPORTING LINE. It WRAPS — no truncation — and that is the 137-B form
            restored. The Phase 200 port truncated it to fit the sheet's 72px row, keeping a
            `break-words` escape for the one case that could not survive truncation: 187-09
            moved the ⌥ Technical-names reveal into this slot precisely because the TITLE
            slot truncates and clipped the slug (`AI agent step · find-renewal-t…`). On a
            card that grows downward there is nothing to escape from, so both arms wrap and
            the shipped 187-09 fix is safe by shape rather than by branch.

            `data-identifier` survives the revert: it is the only thing that marks this line
            as carrying a machine identifier rather than a sentence, and `break-words` is
            still the right treatment for an unbroken slug in a 208px column. */}
        {subtitle ? (
          <p
            data-identifier={subtitleIsIdentifier ? "true" : undefined}
            className={cn(
              "mt-1 text-[11px] leading-snug text-muted-foreground",
              subtitleIsIdentifier ? "break-words" : undefined,
            )}
          >
            {subtitle}
          </p>
        ) : null}

        {/* THE EFFECT BANNER — a Phase 200 slot that SURVIVES the revert of the Phase 200
            face, because it is a capability and not a silhouette: it states that a step
            reaches beyond this workspace, which nothing else on the card says.

            ⚠ THE SHEET DRAWS TWO BANNERS AND ONLY ONE IS ON THE WIRE. `ONLY READS` is
            DECLINED, not approximated — every external capability this client recognises
            is a WRITE, so nothing could resolve a step to it without the model choosing
            which steps "only read". The whole argument, and its dated re-open trigger,
            lives in `nodeEffectBanner.ts`; the word itself has exactly one home there. */}
        {effectBanner ? (
          <p
            // `canvas-effect-banner`, NOT `canvas-node-effect-banner`. Several suites
            // enumerate the plane's node ROOTS with a `canvas-node-` test-id prefix
            // selector, and that works only because every other element wearing that prefix
            // is CONDITIONAL and absent from a resting Builder card. This line renders on a
            // RESTING card (any `external_action` step), so a prefixed name would be counted
            // as a node. Measured: `WorkflowCanvas.test.tsx`'s seven-type roster read 8.
            data-testid="canvas-effect-banner"
            className={cn(
              "mt-1 text-[9px] font-bold leading-snug tracking-wider",
              effectBanner === EFFECT_BANNER_READ_ONLY ? "text-muted-foreground" : "text-warning",
            )}
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

        {/* THE ELAPSED (Phase 200 · `screens/node-identity.html:265`).
            A Phase 200 slot that SURVIVES the revert of the Phase 200 face, for the same
            reason as the effect banner: it is a capability — the only place a step's own
            clock reaches the plane — and not a silhouette. It is a sibling of the run line
            rather than an absolutely-positioned element, so it can never overlap the status
            ring `NodeRunOverlay` paints above the card.

            ⚠ ITS ONE ALIGNMENT UTILITY WAS DROPPED WITH THE REVERT. The sheet put it
            bottom-RIGHT of a left-aligned row; this card is `text-center`, so a `text-right`
            override would have been the single element on the face pulling against the
            card's own alignment. It inherits instead.

            ⚠ TWO CONDITIONS, AND BOTH ARE LOAD-BEARING. `reading !== null` is what makes this
            unreachable on an authoring canvas — a draft supplies no run state, so it supplies
            no elapsed and this whole subtree is structurally out of reach (the `199-02`
            refusal, held by shape). The non-empty string test is the second: a step the page
            holds no timing for renders NO element, never `00:00` and never a dash.

            ⚠ IT DOES NOT RAISE THE RUN-MODE FLOOR. `RUN_MODE_NODE_MIN_HEIGHT` already clears
            the run line, and this sits on the same baseline row rather than under it, so a
            step that acquires a timing mid-run does not reflow the plane a person is watching
            — the constant-height argument the floor exists for. */}
        {reading !== null && typeof elapsed === "string" && elapsed.length > 0 ? (
          <p
            data-testid="canvas-node-elapsed"
            className="mt-1 font-mono text-[10px] leading-none text-primary"
          >
            {elapsed}
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
