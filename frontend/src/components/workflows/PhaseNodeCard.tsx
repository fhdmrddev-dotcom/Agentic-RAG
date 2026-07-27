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
 * THE TWO-BADGE BUDGET IS ENFORCED BY THE TYPE SYSTEM (137-D / D-183-07). `BadgeSlots`
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
 * THE LOOK IS SKETCH 137-D, the locked acceptance bar: a frosted-glass card that
 * stays NEUTRAL, with the 3D mark floating at the LEFT edge over its own contact
 * shadow, one plain-language title, one supporting line, and at most two word-badges.
 * Per-step-type colour is a TINT BEHIND THE ICON ONLY — the colour budget is
 * load-bearing, because Phase 188 paints run state onto these same nodes and needs
 * the strong colours free. Motion keys off RUN STATE, never off selection (the defect
 * found in the sketch 137 review); 184 still has no run state, so the card is
 * completely still and any ambient drift belongs to the canvas backdrop.
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
import { cn } from "@/lib/utils"

// ── The slot contract ───────────────────────────────────────────────────────────

/**
 * One word-badge. The WORD carries the meaning — `tone` is decoration and `glyph`,
 * when present, is rendered `aria-hidden` beside it (WCAG 1.4.1, never colour alone).
 *
 * `dataAttr` is spread onto the badge's WRAPPER, not onto the chip: the shipped
 * canvas suite selects on `[data-grounding]` / `[data-waits-for-you]` wrappers while
 * `StatusChip` owns its own `data-testid` / `data-tone`.
 */
export interface BadgeSlot {
  /** The chip's stable test hook — e.g. `"canvas-grounding"`. */
  testId: string
  /** The shared three-tone org vocabulary. Domain→tone mapping stays at the caller
   *  (`nodePresentation.GROUNDING_TONE`), per `StatusChip`'s own scope rule. */
  tone: ChipTone
  /** The visible label. A plain string, rendered as a React text child. */
  label: string
  /** An optional decorative mark rendered `aria-hidden` before the label. */
  glyph?: string
  /** Data attributes for the wrapper `<span>` — the canvas suite's selectors. */
  dataAttr?: Record<string, string>
}

/**
 * **THE 137-D TWO-BADGE BUDGET, ENFORCED BY THE TYPE SYSTEM.**
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
 * layout change to it. In this plan the card renders NOTHING for it and the adapter
 * never passes it — that absence is asserted, and it is what makes this extraction
 * behaviour-preserving.
 *
 * Every value is a SERVER verdict (D-182-06 / VALID-03 — the client never guesses a
 * severity). The colour budget stays with Phase 188: 184's marks are a red ✕ for
 * `error` and a dashed grey ○ for `incomplete`, so a 3-`incomplete` / 0-`error` draft
 * renders with zero destructive-token elements.
 */
export type NodeVerdictMark = "error" | "incomplete" | "unknown"

/**
 * The live run-state slot. **Declared in 184-03, owned by Phase 188.**
 *
 * 184 has no run state at all, so declaring the literals here would be inventing
 * them. The alias is deliberately opaque today; Phase 188 replaces it with its own
 * union, which cannot break a 184 caller because 184 has none — the adapter never
 * passes it and the card renders nothing for it.
 */
export type NodeRunStatus = string

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
  /** Phase 188's run state. Declared, rendered as nothing in 184. */
  status?: NodeRunStatus
  /** 184-08's server verdict mark. Declared, rendered as nothing in 184-03. */
  verdict?: NodeVerdictMark
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

// ── The card ────────────────────────────────────────────────────────────────────

/**
 * One phase, one card. `llm_batch_agents` gets ONE card: the ×N fan-out is runtime
 * behaviour, not topology (sketch 136), and drawing N lanes would disagree with the
 * server's adjacency.
 */
export function PhaseNodeCard(props: PhaseNodeCardProps) {
  // Only the slots this plan RENDERS are destructured. `status`, `verdict` and
  // `stepNumber` are declared on the interface above and deliberately unread here —
  // Wave 0 adds the seam, 184-08 / Phase 188 add the behaviour.
  const { slug, phaseType, icon, title, subtitle, technicalLine, tint, badges, selected, anchors } =
    props

  return (
    <div
      data-testid={`canvas-node-${slug}`}
      data-slug={slug}
      data-phase-type={phaseType}
      data-selected={selected ? "true" : "false"}
      className="relative"
      style={{ width: CANVAS_LAYOUT.NODE_WIDTH, minHeight: CANVAS_LAYOUT.NODE_MIN_HEIGHT }}
    >
      {anchors}

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

        {subtitle ? (
          <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{subtitle}</p>
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
          {icon}
        </span>
      </span>
    </div>
  )
}
