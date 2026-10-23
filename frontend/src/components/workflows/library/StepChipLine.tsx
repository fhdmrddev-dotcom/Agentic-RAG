/**
 * Phase 290-02 (2026-10-21, VIS-04 / D-01 / D-03 / D-05) — the card's ONE chip line, as
 * approved in sketch 290-card-chip-line winner B: bordered pills, glyph + type sentence, joined
 * by `→`, the first three then `+N more`, which expands IN PLACE and names every step in words.
 *
 * ── WHY THIS FILE HOLDS STATE ────────────────────────────────────────────────────────────
 * `WorkflowCard.tsx` is G-5-firing and holds no `useState`; the 286-04 seam note says "290 adds
 * faces, not state". The expand switch is state, so it lives HERE (the `FieldGuidance.tsx`
 * pattern) and the card gains one value and one gated mount. It is per card, local, not
 * persisted, and resets on remount.
 *
 * ── WHAT IT RENDERS ──────────────────────────────────────────────────────────────────────
 * Collapsed: the chip track never wraps and clips (`overflow-hidden`); the `→ +N more` group is
 * `flex-none` and sits OUTSIDE the clipped list, so it can never be cut off, at 375 px either.
 * Expanded: everything wraps, every step is a chip, and the toggle reads `Show less`.
 *
 * ⚠ NO hover-only explanation anywhere (the library F1 fence; touch has no hover): the words are
 * already visible text, which is the whole point of D-03. No hover style on chips either: they
 * are not interactive. Every string comes from `libraryVocabulary.ts` or, through the resolver,
 * from `PHASE_TYPE_SENTENCES`; all of it renders as JSX text (T-290-06).
 */
import { createElement, useState } from "react"

import { phaseGlyph } from "@/lib/phaseGlyph"

import {
  STEP_LINE_JOINER,
  STEP_LINE_LABEL,
  STEP_LINE_LESS,
  stepLineMore,
  stepLineMoreLabel,
} from "./libraryVocabulary"
import type { StepChip, StepLine } from "./stepLine"

export interface StepChipLineProps {
  line: StepLine
}

function Joiner() {
  return (
    <span aria-hidden="true" className="text-[11px] text-muted-foreground">
      {STEP_LINE_JOINER}
    </span>
  )
}

function Chip({ chip, expanded }: { chip: StepChip; expanded: boolean }) {
  const Glyph = phaseGlyph(chip.type)
  return (
    <span
      className={
        expanded
          ? "inline-flex min-w-0 items-center gap-1 rounded-full border border-border bg-muted/40 py-0.5 pl-1 pr-2 text-[12px] leading-4 text-foreground"
          : "inline-flex min-w-0 max-w-[168px] items-center gap-1 rounded-full border border-border bg-muted/40 py-0.5 pl-1 pr-2 text-[12px] leading-4 text-foreground"
      }
    >
      {/* createElement, not JSX: the mark is a STABLE module-level entry of phaseGlyph's
          closed map (own-guarded; null for an unknown type, and then NO mark is drawn),
          never a component created during render. The `ArtifactBlock.tsx` precedent. */}
      {Glyph && createElement(Glyph, { className: "h-4 w-4 flex-none", "aria-hidden": true })}
      <span className={expanded ? "whitespace-normal" : "truncate"}>{chip.words}</span>
    </span>
  )
}

export function StepChipLine({ line }: StepChipLineProps) {
  const [expanded, setExpanded] = useState(false)
  const chips = expanded ? line.chips : line.shown
  return (
    <div
      data-testid="row-steps"
      className={
        expanded
          ? "mt-2 flex min-w-0 flex-wrap items-center gap-x-1 gap-y-2"
          : "mt-2 flex min-w-0 items-center gap-1"
      }
    >
      <ol
        aria-label={STEP_LINE_LABEL}
        className={
          expanded
            ? "flex flex-wrap items-center gap-x-1 gap-y-2"
            : "flex min-w-0 flex-1 flex-nowrap items-center gap-1 overflow-hidden"
        }
      >
        {chips.map((chip, i) => (
          <li key={i} data-testid="row-steps-chip" className="flex min-w-0 items-center gap-1">
            {i > 0 && <Joiner />}
            <Chip chip={chip} expanded={expanded} />
          </li>
        ))}
      </ol>
      {line.more > 0 && (
        <span className="flex flex-none items-center gap-1">
          <Joiner />
          <button
            type="button"
            data-testid="row-steps-toggle"
            aria-expanded={expanded}
            aria-label={expanded ? undefined : stepLineMoreLabel(line.more)}
            onClick={() => setExpanded((v) => !v)}
            className="rounded-full border border-dashed border-border px-2 py-0.5 text-[11px] text-primary"
          >
            {expanded ? STEP_LINE_LESS : stepLineMore(line.more)}
          </button>
        </span>
      )}
    </div>
  )
}
