/**
 * Phase 112 Plan 03 Task 1 — ConfidenceChip (the META-02 display contract).
 *
 * Net-new metadata primitive. Anatomy CLONED from StatusPill (chat/StatusPill.tsx) —
 * NOT from ConfidenceBadge (chat/ConfidenceBadge.tsx), which uses raw colour tokens
 * (text-green-500/text-red-500), is colour-only (no glyph+word+score), and has no
 * honest Edited/Extracted states. Sketch source: sources/028-confidence-and-edit/
 * GROUNDING.md (variant 028-A, the chosen build spec).
 *
 * Render contract — THREE inseparable atoms, never colour-alone:
 *   [glyph aria-hidden] + [tier/state WORD] + [· raw score tabular-nums]
 *
 * a11y / contrast: panel-scoped AA tokens ONLY (verified in index.css against the
 * dark --panel-surface #0c121d). NEVER the global --muted-foreground (3.59:1 — fails
 * the ≥4.5:1 floor). The WORD always carries the meaning so the chip survives
 * greyscale; glyphs are decorative (aria-hidden).
 */
import { CheckCircle2, AlertTriangle, PencilLine, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"

export interface ConfidenceChipProps {
  /** Raw stored confidence 0.0–1.0 from `documents.metadata._confidence[field]`.
   *  `undefined` = a stored value with no `_confidence` entry (renders neutral
   *  "Extracted" — NEVER a fabricated "High"). */
  score?: number
  /** Per-field provenance from `documents.metadata._source[field]`. `"user"` =
   *  manually overridden → neutral "Edited" chip (no score, no green). */
  source?: "user" | "extracted"
}

// Phase 112 D-05 — metadata display tiers. HARDCODED, NOT a settings knob.
// These are NOT the retrieval confidence_bucket_high/medium (0.54/0.38) in
// agent_loop.py — that is a different system (cosine similarity over retrieved
// chunks). Do not conflate or import them here.
// Tunable constants; re-verify against the live confidence distribution at UAT.
const TIER = { HIGH: 0.75, MED: 0.5 } as const

function tierFor(score: number): "high" | "med" | "low" {
  if (score >= TIER.HIGH) return "high"
  if (score >= TIER.MED) return "med"
  return "low"
}

// Panel-scoped AA tokens (see frontend/src/index.css):
//   --panel-status-done   142 71% 55% → 10.63:1 on #0c121d
//   --panel-status-active  38 92% 62% → 10.48:1 on #0c121d
//   --panel-muted-foreground 220 16% 65% → 7.21:1 on #0c121d
//   hsl(0 80% 80%) lightened red → ≥4.5:1 (NEVER raw --destructive for text)
const SCORED_VARIANTS = {
  high: "bg-[hsl(var(--panel-status-done)/0.15)] text-[hsl(var(--panel-status-done))]",
  med: "bg-[hsl(var(--panel-status-active)/0.15)] text-[hsl(var(--panel-status-active))]",
  low: "bg-destructive/15 text-[hsl(0_80%_80%)]",
} as const

const NEUTRAL_VARIANT =
  "bg-transparent border border-border text-panel-muted-foreground"

const BASE_CLASSES =
  "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full font-mono text-[10px] uppercase tracking-wider flex-shrink-0"

export function ConfidenceChip({ score, source }: ConfidenceChipProps) {
  // State resolution order is load-bearing — provenance first, then unscored,
  // then the scored tier. (1) and (2) are NEUTRAL by design.

  // (1) Manual override → NEUTRAL "Edited" chip.
  // Phase 112 honesty contract: a manual override renders NO score and NO green.
  // Once a human sets the value the model is no longer the authority — a
  // green/scored chip would lie. DO NOT "fix" this to green (reviewers will be
  // tempted). The neutral provenance chip is the correct, honest signal.
  if (source === "user") {
    return (
      <span data-testid="confidence-chip" data-state="edited" className={cn(BASE_CLASSES, NEUTRAL_VARIANT)}>
        <PencilLine aria-hidden="true" className="w-3 h-3" />
        <span className="tabular-nums">Edited</span>
      </span>
    )
  }

  // (2) Stored value but no _confidence entry → NEUTRAL "Extracted" chip.
  // NEVER render "High" for an unscored field — fabricating model confidence
  // for a field the extractor never scored would lie about authority.
  if (score === undefined) {
    return (
      <span data-testid="confidence-chip" data-state="extracted" className={cn(BASE_CLASSES, NEUTRAL_VARIANT)}>
        <Sparkles aria-hidden="true" className="w-3 h-3" />
        <span className="tabular-nums">Extracted</span>
      </span>
    )
  }

  // (3) Scored chip by hardcoded tier. Score shown RAW to 2 decimals — NEVER a %.
  const tier = tierFor(score)
  const raw = score.toFixed(2)

  if (tier === "high") {
    return (
      <span data-testid="confidence-chip" data-state="high" className={cn(BASE_CLASSES, SCORED_VARIANTS.high)}>
        <CheckCircle2 aria-hidden="true" className="w-3 h-3" />
        <span className="tabular-nums">High · {raw}</span>
      </span>
    )
  }

  if (tier === "med") {
    return (
      <span data-testid="confidence-chip" data-state="med" className={cn(BASE_CLASSES, SCORED_VARIANTS.med)}>
        {/* filled dot (●) — decorative, the WORD carries the meaning */}
        <span aria-hidden="true" className="inline-block w-1.5 h-1.5 rounded-full bg-current" />
        <span className="tabular-nums">Med · {raw}</span>
      </span>
    )
  }

  // low
  return (
    <span data-testid="confidence-chip" data-state="low" className={cn(BASE_CLASSES, SCORED_VARIANTS.low)}>
      <AlertTriangle aria-hidden="true" className="w-3 h-3" />
      <span className="tabular-nums">Low · {raw}</span>
    </span>
  )
}
