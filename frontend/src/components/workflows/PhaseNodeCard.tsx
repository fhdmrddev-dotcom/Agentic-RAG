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
 * (D-184-08) while still adding the seam.
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
 * in 184-08 and was moved by 185-01; see the mark's own docblock) — while `status` and
 * `stepNumber` are still declared and still render nothing. The seam worked exactly as
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
import type { ReactNode } from "react"

import { StatusChip, type ChipTone } from "@/components/org/StatusChip"
import { CANVAS_LAYOUT } from "@/components/workflows/canvasModel"
// 185-09: the seal's accessible label. IMPORTED, never re-typed — SPEC Req 7's
// vocabulary is a lock, and `definitionOps`' copy block is where the governance words
// already live (the dial's two labels, the refusal, the gate row). A local literal here
// would be a second copy of a locked word, free to drift from the panel's.
import { GOVERNANCE_SEAL_LABEL } from "@/components/workflows/definitionOps"
// 184-08: the verdict-mark table and its key type. This is the ONLY thing this card
// takes from the presentation module — the TINT is still resolved by the adapter and
// handed over as a plain string, and the fence in `PhaseNodeCard.test.tsx` still says
// so, anchored on the tint identifiers rather than on the module path.
import { VERDICT_MARK, type VerdictMarkKind } from "@/components/workflows/nodePresentation"
// 188-06: the canvas's OWN run vocabulary — the words, the clause layer, the border
// tokens and the ring's geometry inputs. The DERIVATION that produces a reading lives
// one directory up in `lib/phaseState` and is imported by the ADAPTER, never here: this
// card is handed a reading and paints it (D-188-02 — one derivation, two vocabularies).
import {
  ringDash,
  ringSpecFor,
  runReadingBorder,
  runReadingLabel,
} from "@/components/workflows/runVocabulary"
import type { CanvasReading } from "@/lib/phaseState"
import { cn } from "@/lib/utils"
import type { EmitFailure } from "@/types"

// ── The slot contract ───────────────────────────────────────────────────────────

/**
 * One word-badge. The WORD carries the meaning — `tone` is decoration and `glyph`,
 * when present, is rendered `aria-hidden` beside it (WCAG 1.4.1, never colour alone).
 *
 * `dataAttr` is spread onto the badge's WRAPPER, not onto the chip: the shipped
 * canvas suite selects on wrappers such as `[data-waits-for-you]` while `StatusChip`
 * owns its own `data-testid` / `data-tone`.
 */
export interface BadgeSlot {
  /** The chip's stable test hook — e.g. `"canvas-waits-for-you"`. */
  testId: string
  /** The shared three-tone org vocabulary. Domain→tone mapping stays at the CALLER,
   *  per `StatusChip`'s own scope rule — this file ships no such table. (Phase 185
   *  deleted `nodePresentation.GROUNDING_TONE` along with the badge it coloured;
   *  governance spends no colour and no badge slot.) */
  tone: ChipTone
  /** The visible label. A plain string, rendered as a React text child. */
  label: string
  /** An optional decorative mark rendered `aria-hidden` before the label. */
  glyph?: string
  /** Data attributes for the wrapper `<span>` — the canvas suite's selectors. */
  dataAttr?: Record<string, string>
}

/**
 * **THE 137-B TWO-BADGE BUDGET, ENFORCED BY THE TYPE SYSTEM.**
 *
 * A max-2 tuple union. Zero, one or two badges are representable; a third is a
 * TYPECHECK ERROR, not a review comment. That is deliberate and it is the mechanism
 * D-184-06 asks for: Phase 185 physically cannot spend this surface's badge budget on
 * a graded-governance chip, and Phase 188's run state cannot quietly become badge
 * three. No tool chips, no gate identifiers, no `phase_index` on the face (D-183-07).
 */
export type BadgeSlot2Tuple = readonly [BadgeSlot, BadgeSlot]
export type BadgeSlots = readonly [] | readonly [BadgeSlot] | BadgeSlot2Tuple

/**
 * The per-node validation mark (VALID-03). **Declared in 184-03, rendered by 184-08.**
 *
 * The slot exists here so the marks land as DATA on an existing card rather than as a
 * layout change to it — and that is exactly how it played out: 184-08 filled it by
 * changing this component's body and nobody else's contract. The adapter still does
 * not pass it in 184; 184-13 is where a canvas node first carries one.
 *
 * Every value is a SERVER verdict (D-182-06 / VALID-03 — the client never guesses a
 * severity). The colour budget stays with Phase 188: 184's marks are a red ✕ for
 * `error` and a dashed grey ○ for `incomplete`, so a 3-`incomplete` / 0-`error` draft
 * renders with zero destructive-token elements.
 *
 * The literal union itself lives in `nodePresentation` beside the table that renders
 * it, because a component module may not export shared constants (`react-refresh/
 * only-export-components` says so, and it is right — a const re-created on every hot
 * reload is a stale-identity bug waiting to happen). This alias keeps the name every
 * caller already knows.
 */
export type NodeVerdictMark = VerdictMarkKind

/**
 * The live run-state slot. **Declared in 184-03, FILLED by Phase 188 (plan 188-06).**
 *
 * IT IS NO LONGER OPAQUE. 184 had no run state at all, so declaring the literals then
 * would have been inventing them, and the alias was left as a bare string on purpose so
 * that 188 could narrow it later. That is exactly what happened here, and the seam paid
 * off precisely as D-184-06 predicted: narrowing it broke NO caller, because 184 shipped
 * none — the adapter never passed the slot and the card rendered nothing for it.
 *
 * The union itself is `CanvasReading`, imported from `lib/phaseState` rather than
 * re-typed here. That is load-bearing: `canvasReading()` is the ONE function that turns
 * a run row into a reading (and the one named place `retrying` collapses into running),
 * so re-spelling the seven members in this file would create a second, drift-prone copy
 * of the very union SPEC Req 4's subset property is stated over.
 */
export type NodeRunStatus = CanvasReading

export interface PhaseNodeCardProps {
  /** The phase slug — node identity, and the `canvas-node-<slug>` test hook. */
  slug: string
  /** The raw `phase_type` discriminator, surfaced as a data attribute only. */
  phaseType: string
  /** The resolved 3D mark. A `ReactNode` because the resolution is a module-scope
   *  lookup (`nodePresentation.renderPhaseMark`), never a component bound in a body. */
  icon: ReactNode
  /** The one title line. The adapter decides plain-language vs the ⌥ technical form,
   *  so there is exactly ONE technical-names state in the app. */
  title: string
  /** The one supporting line. An empty string renders nothing. */
  subtitle?: string
  /** An extra ⌥-reveal line. **Not passed by the 184 adapter** — the reveal is a
   *  title swap today; this slot exists so a later phase adds a line without
   *  re-cutting the card. Absent ⇒ renders nothing. */
  technicalLine?: string
  /** The icon-well tint, already resolved (with `DEFAULT_TINT` as the fallback) by
   *  the caller. The card performs no lookup and so cannot crash on an unknown type. */
  tint: string
  /** At most TWO word-badges — see `BadgeSlots`. Absent or empty ⇒ no badge row. */
  badges?: BadgeSlots
  /** The step's live run reading (Phase 188). **Supplying it puts the card in RUN
   *  MODE**, which is a mode and not a decoration: the status ring paints above the
   *  card, the run line appears in the body for EVERY reading (including *Not started*,
   *  so nothing reflows as the run progresses), and the card's minimum height rises to
   *  the run-mode floor. Absent ⇒ the Builder's card, byte-identical to 185's.
   *
   *  The reading is DERIVED BY THE CALLER, once, through `phaseState.canvasReading` —
   *  this card maps no status and collapses no state. */
  status?: NodeRunStatus
  /** The step's terminal emit failure, when the run row carries one. Selects which of
   *  three fixed clauses follows the word *Failed*; ignored for every other reading.
   *
   *  ⚠ THE HARNESS'S FREE-FORM FAILURE TEXT IS NEVER RENDERED ON THIS SURFACE. That
   *  string can carry slugs, model ids and gate identifiers, which is precisely what
   *  SPEC Req 2 forbids on the canvas. Only this TYPED enum reaches the card, and it
   *  only ever selects between three fixed sentences. The detailed reason stays in the
   *  developer timeline, one click away through "Open the chat thread". */
  emitFailure?: EmitFailure | null
  /** The server's verdict mark (VALID-03), rendered by 184-08 and relocated to the
   *  card's LEFT edge by 185-01 (D-185-17 — top-right is CLAIMED for the governance
   *  seal). **Every value here is SERVER-DERIVED** — the caller reads it off
   *  `verdictModel.markFor(slug)`, which reads `verdict.severity` and derives nothing.
   *  Absent ⇒ the card renders no verdict element at all, which is the state a draft
   *  is in before its first check has answered (D-184-15). */
  verdict?: NodeVerdictMark
  /** GOVERN-02 (sketch 143-A) — this step must prove it. Renders the corner seal.
   *
   *  THE SEAL IS NEVER CONDITIONAL ON RUN STATE: run status overwrites the border, so
   *  the seal is the only carrier that survives mid-run, and hiding, dimming or moving
   *  it would delete the reading at exactly the moment it matters most. Top-right of
   *  the card is CLAIMED for governance — 188/189 may not take it.
   *
   *  Resolved by the CALLER, once, at projection time (`canvasModel.buildPhaseData`
   *  via `phaseVocabulary.groundingCauseOf` — the ONE client home of the rule the
   *  panel's dial also reads). This card neither derives it nor asks why. */
  grounded?: boolean
  /** The 137-B step number. Declared, rendered as nothing in 184-03 — D-183-07 keeps
   *  `phase_index` off the face today, and putting it on is a sketch decision with its
   *  own acceptance bar, not a side effect of an extraction. */
  stepNumber?: number
  /** Whether the canvas has this node selected. Border treatment only; **motion never
   *  keys off selection.** */
  selected?: boolean
  /** The graph library's hidden edge anchors, injected by the `PhaseNode` adapter.
   *  Rendered as the FIRST child so the DOM is byte-identical to the pre-split node.
   *  It is a plain `ReactNode` precisely so this file imports no graph library: a
   *  provider-less render (unit tests, Phase 188's reuse) simply omits it. */
  anchors?: ReactNode
}

// ── The status ring's constants (188-06 · sketch 153-A) ─────────────────────────

/** The arc's radius on the ring's own 72×72 viewBox. `d = 68px` inside a 72px box
 *  leaves the stroke 3px clear of the shipped 62px icon well on every side, so the ring
 *  never touches the 3D mark or its tint gradient. */
const RING_RADIUS = 34

/** Computed, never pasted. Every dasharray and dashoffset the ring emits is derived
 *  from this one number by `ringDash`, so moving the radius moves the whole pattern
 *  rather than leaving hand-written decimals describing a circle that no longer exists. */
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS

/** The ring's own box, concentric with the 62px well: `(72 − 62) / 2 = 5`, and the well
 *  floats at `−26`, so the ring floats at `−31`. Not a spacing choice and not roundable. */
const RING_BOX_CLASSES =
  "pointer-events-none absolute left-1/2 top-[-31px] z-[5] h-[72px] w-[72px] -translate-x-1/2"

/**
 * The arc's stroke per reading. **Colour REINFORCES; it never carries.**
 *
 * This table lives HERE, next to the one element it paints, rather than in
 * `runVocabulary` beside the word and geometry tables — and the split is deliberate.
 * The vocabulary module holds what a reading MEANS (its word, its clause, its arc
 * shape), all of which survive colour being switched off, which is sketch 153-A's whole
 * acceptance test and a build criterion rather than a preference. A stroke is a paint
 * detail of this SVG. The border table is the one colour value that does live in the
 * vocabulary module, because what needs a documented home there is not the three tokens
 * but the FOUR ABSENCES beside them — *Complete* declining to recolour the border is an
 * editorial decision, not a paint one.
 *
 * `unknown` is on the muted token ON PURPOSE. Spending an alarm colour on "we can't
 * tell" would make it look like a warning the run has not actually raised — the same
 * reasoning that keeps the degraded verdict mark off the destructive token.
 */
const RING_STROKE: Record<CanvasReading, string> = {
  "not-started": "",
  running: "hsl(var(--primary))",
  done: "hsl(var(--success))",
  failed: "hsl(var(--destructive))",
  skipped: "hsl(var(--muted-foreground))",
  "waiting-for-you": "hsl(var(--warning))",
  unknown: "hsl(var(--muted-foreground))",
}

/** The track every reading shares — the path the arc has or has not travelled. */
const RING_TRACK_STROKE = "hsl(var(--muted-foreground) / 0.35)"

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

  // Total by construction: the slot is typed, but a forward-compat value arriving from
  // a caller falls back to the degraded mark rather than to nothing. Falling back to
  // NOTHING would render a node nobody could check as a checked-and-clean one.
  //
  // (The word this sentence used to spell for "nobody could check" is on SPEC Req 7's
  // banned list, and 185-09's acceptance grep is file-wide rather than scoped to
  // rendered strings. The meaning is unchanged — `VERDICT_MARK.unknown` is exactly the
  // "we could not check" state — so the rewording costs nothing and lets the grep
  // return 0 honestly instead of carrying a documented exception forever.)
  const mark = verdict ? (VERDICT_MARK[verdict] ?? VERDICT_MARK.unknown) : null

  // RUN MODE is exactly "a reading was supplied". Everything 188 adds hangs off this one
  // boolean, so the Builder — which supplies no reading — renders the 185 card unchanged.
  const reading = status ?? null
  const runBorder = reading === null ? undefined : runReadingBorder(reading)
  // `null` from `ringDash` means "paint NO arc", which is *Not started*'s whole reading:
  // the track exists and nothing has travelled it. It is a different thing from the
  // unbroken circle *Complete* paints, and the two must never collapse into each other.
  const arc = reading === null ? null : ringDash(ringSpecFor(reading), RING_CIRCUMFERENCE)
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

      {/* The server's verdict mark, on the card's LEFT edge (D-185-17 / SPEC Req 6).
          THE REASON IS LIFETIME, NOT TASTE. The card has exactly two free corners and
          two claimants with different lifespans. The governance seal is a PERMANENT
          property of the step — it is true of the step whether or not anything has run,
          and it was verified at all four run states in sketch 143-A — so it keeps the
          top-right corner, which SPEC Req 6 CLAIMS for it. A verdict only exists once
          the server has returned a problem, so the TRANSIENT mark is the one that
          moves. The permanent mark keeps its corner; the transient one relocates.

          RESIDUAL, recorded rather than discovered later: the moved verdict grazes the
          `stepNumber` slot by 2×16px (verdict x −8…14 / y 6…28 against 137-B's
          `.stepn` at x 12…34 / y 12…34). That is not a collision today because the slot
          RENDERS NOTHING — D-183-07 keeps `phase_index` off the face. If `phase_index`
          is ever brought to the face, move the step number to `left:16` and the graze
          clears. `PhaseNodeCard.test.tsx`'s occupancy block pins both halves.

          It is `pointer-events-none` and carries no control of any kind: one tab stop
          per node is a canvas-level invariant, and a pressable mark would make it
          two. */}
      {mark ? (
        <span
          data-testid="canvas-node-verdict"
          data-verdict={verdict}
          className={cn(
            "pointer-events-none absolute -left-2 top-1.5 z-[8] grid h-[22px] w-[22px]",
            "place-items-center rounded-full text-[11px] font-bold leading-none",
            mark.className,
          )}
        >
          <span aria-hidden="true">{mark.glyph}</span>
          <span className="sr-only">{mark.label}</span>
        </span>
      ) : null}

      {/* ── THE GOVERNANCE SEAL (GOVERN-02 · SPEC Req 6 · sketch 143-A) ───────────
          THE CORNER IS CLAIMED. Top-right of the card belongs to governance and to
          nothing else. 185-01 moved the verdict mark to the card's LEFT precisely to
          free it, and Phases 188 (run state) and 189 (external actions) may not take
          it back. See the verdict mark's block above for why the PERMANENT mark keeps
          a corner and the TRANSIENT one moves.

          THE SEAL IS LOAD-BEARING; THE EDGE IS REINFORCEMENT. Governance may spend
          neither colour (137-B banks all of it for Phase 188's run status) nor a
          word-badge (both slots are committed to 188/189), so the mark is made of
          SHAPE. It carries its OWN background and its OWN border, which is the whole
          reason it works: when a step goes running / needs-you / failed the status
          colour overwrites the card border, and the seal stays legible anyway. The
          reading degrades from two carriers to one; it never disappears.

          THEREFORE IT IS NEVER CONDITIONAL ON RUN STATE. This block reads `grounded`
          and nothing else — no `status`, no selection, no run phase. Hiding, dimming
          or moving it mid-run would delete the reading at exactly the moment a person
          most needs it. `PhaseNodeCard.test.tsx` pins that mechanically, twice: a
          `?raw` props fence proving this block never names the run-state prop, and a
          four-value render asserting the seal's class list and text are IDENTICAL
          across every run state.

          THE 17px. Sketch 143-A places the seal `top: 11px; right: 11px` inside the
          248px CARD. This element is a sibling of the verdict mark, so its containing
          block is the 260px NODE BOX, whose right edge sits 6px outside the card's
          border ((260 − 248) / 2). 11 + 6 = 17 keeps the sketch's 11px clearance from
          the border the reader actually sees — `right-[11px]` here would leave 5px and
          crowd the card's 22px corner radius. `top-[11px]` needs no such correction:
          the card's top edge IS the node box's top edge. The test asserts the 11px
          clearance from the card's right border rather than the 17, so this composite
          cannot drift away from the number the sketch locked.

          THE DOCUMENTED FALLBACK is sketch 143-B — a stitched rail outside the card's
          border, which survives run status intact rather than degrading to one
          carrier. If the seal alone reads too quiet in live use, that is a SWAP, not a
          redesign: this block is replaced, and nothing else here moves.

          It is `pointer-events-none` and carries no control of any kind — no role, no
          tab index, no handler. One tab stop per node is a canvas-level invariant, and
          a pressable seal would make it two. Arming and escalating happen in the
          panel; the canvas is where you SEE, never where you SET (sketch 147). */}
      {grounded ? (
        <span
          data-testid="canvas-node-seal"
          data-grounded="true"
          className={cn(
            "pointer-events-none absolute right-[17px] top-[11px] z-[6] grid h-[21px] w-[21px]",
            "place-items-center rounded-full text-[11px] leading-none",
            "border border-[hsl(220_30%_100%/0.34)] bg-[hsl(220_30%_100%/0.1)] text-foreground",
          )}
        >
          <span aria-hidden="true">⛨</span>
          <span className="sr-only">{GOVERNANCE_SEAL_LABEL}</span>
        </span>
      ) : null}

      {/* ── THE STATUS RING (RUNVIZ-01 · sketch 153-A · D-188-07) ──────────────────
          THE 62px ICON WELL BECOMES THE STATUS DIAL. **The arc SHAPE is the state;
          colour only ever reinforces it.** That is why this sketch won: it spends no
          badge slot, no step number, no technical line and no glyph — and it survives
          colour being switched off, which is its whole acceptance test and a BUILD
          criterion rather than a preference. All seven readings differ in a shape
          property a machine can assert: no arc / one short arc / a closed circle / one
          wide gap at 12 o'clock / two arcs / coarse dashes / fine dots.

          IT IS A SIBLING OF THE 3D MARK, RENDERED IMMEDIATELY BEFORE IT, so the mark
          always paints above the arc. Concentric with the well by construction: the
          well is 62px at `top-[-26px]`, this is 72px, and `(72 − 62) / 2 = 5` gives
          `−31`. Those two numbers are a geometric derivation, not spacing — rounding
          either to the 4px grid breaks the concentricity.

          `z-[5]` sits below the ⛨ seal (`z-[6]`) and the verdict mark (`z-[8]`). None
          of the three overlap geometrically, so the z-order is hygiene rather than
          arbitration.

          ⚠ **A GAP IS PLACED WITH `stroke-dashoffset`, NEVER BY ROTATING THE CIRCLE.**
          Giving an SVG circle a rotation attribute *and* the CSS `transform-box` /
          `transform-origin` pair composes the two and pivots the arc about a DOUBLED
          offset — that bug shipped in the sketch's own first two drafts and put the
          waiting gap in the wrong quadrant. Every offset here comes out of `ringDash`,
          and the only transform anywhere in this subtree is the spin utility class.

          ⚠ **THE CLIPPING BAN EXTENDS TO THIS ELEMENT** — the rule stated on the 3D
          mark well below (which spells the forbidden utility once, and is the only
          place in this file that may) now covers one more element and one more
          overhang: the mark clears the node box upward by 26px and this ring by 31px.
          Neither this wrapper, nor the `<svg>`, nor the card, nor the node box, nor the
          node wrapper around it may clip. `overflow-visible` on the `<svg>` is
          belt-and-braces on top of that.

          (The utility is deliberately NOT named a second time here. The suite fences
          it, and a comment that spelled it would make the fence match its own
          prohibition — the 187-24 lesson, which this phase has now met four times.
          The fence is therefore anchored on the CLASS-ATTRIBUTE form and the one
          surviving prose mention is asserted to be exactly one.)

          It is `aria-hidden` and carries no role, no tab index and no handler. The
          visible run line already states the reading as real text and the node's own
          accessible name repeats it for focus; a third announcement would make one step
          speak three times. */}
      {reading !== null ? (
        <span
          aria-hidden="true"
          data-testid="canvas-node-ring"
          data-reading={reading}
          className={RING_BOX_CLASSES}
        >
          <svg viewBox="0 0 72 72" className="block h-full w-full overflow-visible">
            <circle
              cx="36"
              cy="36"
              r={RING_RADIUS}
              fill="none"
              strokeWidth="2.5"
              stroke={RING_TRACK_STROKE}
            />
            {arc ? (
              <circle
                data-testid="canvas-node-ring-arc"
                cx="36"
                cy="36"
                r={RING_RADIUS}
                fill="none"
                strokeWidth="3.5"
                strokeLinecap="round"
                stroke={RING_STROKE[reading]}
                {...(arc.dasharray === null ? {} : { strokeDasharray: arc.dasharray })}
                strokeDashoffset={arc.dashoffset}
                className={arc.spinning ? "canvas-ring-spin" : undefined}
              />
            ) : null}
          </svg>
        </span>
      ) : null}

      {/* THE PAUSE CHIP, in the ring's 12-o'clock gap, for the waiting reading only.
          It is TWO `<span>` RECTANGLES of 3×9px — never the double-bar character. That
          is exactly how D-188-06's zero-net-new-glyph rule survives while the one
          reading that needs a person to act still gets a mark of its own. The phase
          ships no new mark anywhere, canvas or chrome.

          A SIBLING of the ring rather than a child of it: these coordinates are measured
          against the node box, and nesting them inside the ring's own absolute wrapper
          would re-anchor them to it. */}
      {reading === "waiting-for-you" ? (
        <span
          aria-hidden="true"
          data-testid="canvas-node-pause-chip"
          className={cn(
            "pointer-events-none absolute left-1/2 top-[-37px] z-[9] flex -translate-x-1/2",
            "gap-[3px] rounded border border-[hsl(var(--warning))] bg-background px-[5px] py-[3px]",
          )}
        >
          <span className="block h-[9px] w-[3px] bg-[hsl(var(--warning))]" />
          <span className="block h-[9px] w-[3px] bg-[hsl(var(--warning))]" />
        </span>
      ) : null}

      {/* The 3D mark FLOATING ABOVE THE CARD'S TOP EDGE, horizontally centred on it
          (`themes/canvas-184.css` `body.card-b .node .icowrap`: `left:50%; top:-26px;
          62×62`): a soft light disc behind it (the D-183-14 canvas-local icon-well
          lightening, applied uniformly), the per-type tint inside that disc, and its
          own contact shadow beneath.

          It overflows the node box upward by 26px. That is the SAME overflow the
          verdict mark already relies on, and it is why nothing in this subtree — or in
          the node wrapper around it — may ever take `overflow-hidden`. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-[-26px] grid h-[62px] w-[62px] -translate-x-1/2 place-items-center"
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
          {icon}
        </span>
      </span>
    </div>
  )
}
