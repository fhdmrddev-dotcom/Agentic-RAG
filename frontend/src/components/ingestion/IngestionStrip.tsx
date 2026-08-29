/**
 * Phase 217 (LIB-03 / SC#3) — the six-segment ingestion stage strip.
 *
 * ── WHAT THIS IS NOT ──────────────────────────────────────────────────────────────────
 * ⛔ NOT a progress bar. There is no percentage, no finish-time guess and no "n of 6" here, and
 * none may be added (D-217-19). Two of the six stages are decided WHILE THE FILE RUNS, so the
 * pipeline's length is unknown when the strip first renders — a determinate bar would have no
 * honest denominator. The strip shows STAGES REACHED.
 *
 * ⚠ The negative fence over this file's SOURCE is deliberately blunt (it greps for the literal
 * tokens a progress bar would need), so this docblock avoids spelling them even to deny them.
 *
 * ⛔ NOT a second status vocabulary. Every label comes from `TERM_MAP`'s six `ingest.*` entries
 * through `usePlainLabel`, so the ⌥ Technical-names reveal works here for free and no word is
 * invented. ⛔ NOT a second status palette either: this component renders no document-status
 * badge at all — `DocumentList` already mounts `DocumentStatusBadge`, and the failure REASON is
 * `error_message`, which `DocumentList` also already renders. One reason, one place.
 *
 * ── THE FIVE SEGMENT STATES, AND WHY THE LAST TWO ARE DIFFERENT THINGS ─────────────────
 *   done        the pipeline reached and finished this stage
 *   active      the stage happening RIGHT NOW — only ever on a `processing` document
 *   pending     not yet reached, and nothing says it will be skipped
 *   skipped     STRUCK THROUGH — the pipeline would never run this stage for this file
 *               (D-217-19: an absent thing that looks pending is the failure this avoids)
 *   not-reached DIMMED — the run stopped before this stage, and it will never happen
 *               (D-217-23's third non-done state; only ever on a `failed` document)
 *
 * `skipped` and `not-reached` are DELIBERATELY DISTINCT and are asserted distinct by the suite.
 * "we were never going to do this" and "we were going to, and then the run died" are different
 * facts, and collapsing them would make a broken file look like a simple one.
 *
 * ── PER STATUS ────────────────────────────────────────────────────────────────────────
 *   pending      nothing done, nothing active. Inapplicable conditionals still strike through —
 *                the must_have forbids a never-run stage looking pending, and applicability is
 *                mime-derived, so it is already known before the first byte is read.
 *   processing   up to `ingestion_step` done · that one active · later pending.
 *   completed    ⛔ `ingestion_step` IS NOT READ AT ALL. It is `"metadata"` by RESIDUE, never by
 *                observation (D-217-23 / Pitfall 3), so this arm derives everything from
 *                `status` alone: applicable stages done, inapplicable conditionals struck.
 *   failed       up to `ingestion_step` done; the step itself is the FAILURE POINT and every
 *                segment from it onward is not-reached. The failure point carries
 *                `data-failure-point`, so it stays identifiable without inventing a sixth state.
 *
 * ⚠ `ingestion_step` is never nulled here, and the backend must never be asked to null it:
 * `text_sanitize.py:9` diagnoses BUG-260825-01 by reading the pair `status=failed /
 * ingestion_step=embedding`. Clearing the column would delete a diagnostic.
 *
 * ⚠ An UNKNOWN `ingestion_step` (null, or a value not in `INGESTION_STAGES`) yields index `-1`,
 * which renders every segment pending rather than throwing or guessing — the same
 * fall-back-to-plain discipline `DocumentStatusBadge.tsx:27-32` already applies to the label.
 * The raw value is NEVER rendered: it is only ever a KEY into `TERM_MAP` (T-217-27).
 */
import { cn } from "@/lib/utils"
import { TERM_MAP, usePlainLabel, type TermKey } from "@/lib/termMap"
import {
  INGESTION_STAGES,
  isStageSkipped,
  stageIndex,
  stageTermKey,
  type IngestionStage,
} from "./ingestionStages"
import type { Document } from "@/types"

export type SegmentState = "done" | "active" | "pending" | "skipped" | "not-reached"

const SEGMENT_CLASS: Record<SegmentState, string> = {
  done: "bg-primary/25 text-primary border-transparent",
  active: "bg-primary text-primary-foreground border-transparent font-semibold animate-pulse",
  pending: "border-dashed border-border text-muted-foreground",
  // struck through — "the pipeline would never run this"
  skipped: "border-dashed border-border text-muted-foreground opacity-50 line-through",
  // dimmed, NOT struck — "the run stopped before this"
  "not-reached": "border-border/40 text-muted-foreground/50 bg-muted/20",
}

type StripDocument = Pick<
  Document,
  | "status"
  | "ingestion_step"
  | "tables_stage_applies"
  | "images_stage_applies"
  | "table_count"
  | "image_count"
>

/**
 * The state of one segment. Pure, exported for the suite so a rendering claim can be checked
 * against the derivation rather than only against a class string.
 */
export function segmentState(
  stage: IngestionStage,
  index: number,
  doc: StripDocument,
): SegmentState {
  // A stage the pipeline would never run reads the same on every status. It is the strongest
  // claim we can make about a segment, so it wins over position.
  if (isStageSkipped(stage, doc)) return "skipped"

  switch (doc.status) {
    case "pending":
      return "pending"

    case "completed":
      // ⛔ `ingestion_step` is residue here — not consulted, deliberately.
      return "done"

    case "processing": {
      const current = stageIndex(doc.ingestion_step)
      if (current < 0) return "pending"
      if (index < current) return "done"
      if (index === current) return "active"
      return "pending"
    }

    case "failed": {
      const current = stageIndex(doc.ingestion_step)
      // An unknown failure point means we cannot claim ANY stage completed.
      if (current < 0) return "not-reached"
      return index < current ? "done" : "not-reached"
    }
  }
}

function StageSegment({
  stage,
  state,
  isFailurePoint,
}: {
  stage: IngestionStage
  state: SegmentState
  isFailurePoint: boolean
}) {
  // One hook per segment, called unconditionally — `INGESTION_STAGES` is a fixed-length
  // constant, so the hook count is stable across every render and every document.
  const label = usePlainLabel(stageTermKey(stage) as TermKey)
  // The MICRO-LABEL, read from the same map as the sentence. Indexed with the narrow
  // `ingest.<key>` type rather than the widened `TermKey`, so TypeScript proves all six
  // entries carry a `short` and a missing one is a build error, not a blank box.
  const short = TERM_MAP[stageTermKey(stage)].short

  return (
    <li
      data-stage={stage.key}
      data-state={state}
      data-failure-point={isFailurePoint ? "true" : undefined}
      // ⚠ THE FULL SENTENCE LIVES HERE, and it is still reveal-aware (`usePlainLabel`). The
      // visible text below is the short form; hover and assistive tech get the whole thing.
      title={label}
      aria-label={label}
      className={cn(
        "flex h-5 min-w-[38px] flex-1 items-center justify-center gap-0 rounded-[3px] border px-1",
        "text-[9px] font-mono uppercase tracking-wide",
        SEGMENT_CLASS[state],
        isFailurePoint && "ring-1 ring-destructive/60",
      )}
    >
      {/*
        ⭐ VISIBLE TEXT, NOT `sr-only` (D-217.1-19). This span was `className="sr-only"` and the
        strip rendered six BLANK BOXES — a stage strip that named no stage. The word is inside
        the `<li>` that carries the state class, so `line-through` on a skipped stage strikes
        THE WORD; a strike over an empty box communicated nothing.

        ⚠ `aria-hidden` — the accessible name is the `aria-label` sentence above, so exposing
        this abbreviation as well would make a screen reader read the stage twice, once badly.
      */}
      <span aria-hidden="true" className="truncate">
        {short}
      </span>
    </li>
  )
}

export function IngestionStrip({
  document: doc,
  className,
}: {
  document: StripDocument
  className?: string
}) {
  // The failure point is read ONLY on the `failed` arm — never on `completed`, where the column
  // is residue.
  const failureIndex = doc.status === "failed" ? stageIndex(doc.ingestion_step) : -1

  return (
    <ul
      role="list"
      aria-label="Ingestion stages"
      data-testid="ingestion-strip"
      data-status={doc.status}
      className={cn("flex w-full items-center gap-1", className)}
    >
      {INGESTION_STAGES.map((stage, i) => (
        <StageSegment
          key={stage.key}
          stage={stage}
          state={segmentState(stage, i, doc)}
          isFailurePoint={i === failureIndex}
        />
      ))}
    </ul>
  )
}
