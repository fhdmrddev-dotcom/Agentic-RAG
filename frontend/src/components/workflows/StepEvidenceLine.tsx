/**
 * Phase 289 (TRUST-01 / D-09 / D-10 / D-14a) — the evidence line under a knowledge-base step.
 *
 *     Answered from Procurement KB · 6 passages · ● Medium · 0.47
 *
 * A LEAF, the `WaitingOnLine` shape: no hook, no API import, no sentence logic beyond joining
 * `evidenceVocabulary.ts`'s words. The server computed the level once, at write time, with
 * chat's own function, and stamped the KB label; this renders what it was given. The live run
 * spine mounts it, and the finished-run evidence report mounts the SAME leaf off the SAME wire
 * object, which is how "on the run surface and in the receipt" is one line and not two.
 *
 * D-09, ABSENCE IS ABSENCE: no confidence (a step with no KB search) renders NOTHING — not a low
 * chip, not "n/a". An unknown level (including a prototype key) also renders nothing.
 *
 * The chip follows the 028 anatomy — [glyph aria-hidden] + [word] + [· raw score tabular-nums],
 * never colour alone, never a percentage. ⚠ Its TONES are the run surface's (`--success`,
 * `--warning`, the lightened red), NOT the metadata chip's `--panel-*` tokens: this renders on
 * `--background`, and `RunSpine.tsx` forbids `--panel-*` tokens for exactly that reason.
 *
 * The structural `EvidenceLineConfidence` interface is a READ SHAPE (the `PhaseTimingRow`
 * precedent): it keeps this leaf free of any runtime import from the API module.
 */
import { cn } from "@/lib/utils"
import { own } from "@/components/workflows/ownProperty"
import {
  ANSWERED_FROM,
  CONFIDENCE_FACE,
  NO_MATCH_EXPLANATION,
  NOTHING_MATCHED,
  SEARCHED,
  SEPARATOR,
  passages,
} from "@/components/workflows/evidenceVocabulary"

export interface EvidenceLineConfidence {
  level: "high" | "medium" | "low" | "none"
  avg_similarity: number | null
  disclaimer: string | null
  passages: number
  kb_label: string
}

const CHIP_TONE: Record<string, string> = {
  high: "bg-[hsl(var(--success)/0.12)] text-[hsl(var(--success))]",
  medium: "bg-[hsl(var(--warning)/0.12)] text-[hsl(var(--warning))]",
  low: "bg-destructive/15 text-[hsl(0_80%_80%)]",
  none: "border border-border bg-transparent text-muted-foreground",
}

const CHIP_BASE =
  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[10px] whitespace-nowrap"

export function StepEvidenceLine({ confidence }: { confidence?: EvidenceLineConfidence | null }) {
  if (!confidence) return null
  const face = own(CONFIDENCE_FACE as Record<string, { glyph: string; word: string }>, confidence.level)
  if (!face) return null

  const isNone = confidence.level === "none"
  const score =
    !isNone && typeof confidence.avg_similarity === "number"
      ? confidence.avg_similarity.toFixed(2)
      : null
  const note = isNone
    ? NO_MATCH_EXPLANATION
    : confidence.level === "low" && confidence.disclaimer
      ? confidence.disclaimer
      : null

  return (
    <span className="mt-1 block" data-testid="step-evidence-line" data-level={confidence.level}>
      <span
        data-testid="step-evidence-sentence"
        className="block text-xs leading-5 text-muted-foreground"
      >
        {isNone ? SEARCHED : ANSWERED_FROM}{" "}
        <span className="font-medium text-foreground">{confidence.kb_label}</span>
        {` ${SEPARATOR} ${isNone ? NOTHING_MATCHED : passages(confidence.passages)} ${SEPARATOR} `}
        <span className={cn(CHIP_BASE, own(CHIP_TONE, confidence.level))}>
          <span aria-hidden="true">{face.glyph}</span>
          {` ${face.word}`}
          {score !== null ? (
            <span className="tabular-nums">{` ${SEPARATOR} ${score}`}</span>
          ) : null}
        </span>
      </span>
      {note ? (
        <span data-testid="step-evidence-note" className="mt-1 block text-xs italic text-muted-foreground">
          {note}
        </span>
      ) : null}
    </span>
  )
}
