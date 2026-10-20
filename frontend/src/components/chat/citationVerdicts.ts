/**
 * Phase 294-05 (DEC-03, D-14, D-16, D-17, D-20a) — THE ONE citation-verdict vocabulary.
 *
 * Every word, glyph, class and sentence the chat shows for a citation check comes from this
 * table: the marker decoration (`CitedMarkdown`), the peek's verdict section (`CitationPeek`), and
 * the References-header action (`CitationCheckAction`). Sketch 294 A is the acceptance bar:
 * ✓ supported (green) · ◐ partly (amber) · ○ not supported (muted) · ✕ contradicted (red + ring)
 * · ? couldn't check (dashed, dim).
 *
 * ⚠ THERE IS NO MODEL-WRITTEN REASON. Decision engines return a label and a confidence, no text
 * (294-RESEARCH §5), so each verdict's one-line `reason` is FIXED copy written here. Nothing a
 * passage, an answer or an engine says is ever rendered as a verdict or a reason (T-294-25).
 *
 * ⚠ ABSENCE IS ABSENCE (D-17). An unknown verdict string, or a prototype key, resolves to the
 * `couldnt_check` row through the own-property guard — never to `supported` (the
 * `phaseStatusMeta.statusMeta` precedent).
 *
 * Colour is never the only carrier (028): every rendering pairs the aria-hidden glyph with the
 * WORD. Pill tokens are the ConfidenceChip AA set (`--panel-status-done` green,
 * `--panel-status-active` amber, `hsl(0 80% 80%)` red text, panel-muted for the quiet two).
 * `__tests__/citationVerdicts.parity.test.ts` reads the backend `Verdict` Literal via `?raw`.
 */
import type { CitationCheckAvailability, Verdict } from "@/lib/api/citationChecks"
import { engineFor } from "@/components/settings/rerankEngines"

export interface VerdictMeta {
  glyph: string
  word: string
  /** The marker class (`index.css`, beside `.citation-marker`). */
  markerClass: string
  /** Tailwind classes for the count pill and the peek's verdict glyph. */
  pillClass: string
  /** The fixed one-line reason shown in the peek. */
  reason: string
}

export const VERDICT_META: Record<Verdict, VerdictMeta> = {
  supported: {
    glyph: "✓",
    word: "Supported",
    markerClass: "citation-marker--v-supported",
    pillClass: "bg-[hsl(var(--panel-status-done)/0.15)] text-[hsl(var(--panel-status-done))]",
    reason: "The source passage says this.",
  },
  partly_supported: {
    glyph: "◐",
    word: "Partly supported",
    markerClass: "citation-marker--v-partly_supported",
    pillClass: "bg-[hsl(var(--panel-status-active)/0.15)] text-[hsl(var(--panel-status-active))]",
    reason: "The source backs part of this sentence, not all of it.",
  },
  not_supported: {
    glyph: "○",
    word: "Not supported",
    markerClass: "citation-marker--v-not_supported",
    pillClass: "bg-muted text-panel-muted-foreground",
    reason: "The source passage does not say this.",
  },
  contradicted: {
    glyph: "✕",
    word: "Contradicted",
    markerClass: "citation-marker--v-contradicted",
    pillClass: "bg-destructive/15 text-[hsl(0_80%_80%)] ring-1 ring-destructive/50",
    reason: "The source passage says something different.",
  },
  couldnt_check: {
    glyph: "?",
    word: "Couldn't check",
    markerClass: "citation-marker--v-couldnt_check",
    pillClass: "border border-dashed border-border text-panel-muted-foreground",
    reason: "The engine gave no verdict for this sentence and source, so none is shown.",
  },
}

/** Order the count pills render in (D-20a). */
export const VERDICT_ORDER: readonly Verdict[] = [
  "supported",
  "partly_supported",
  "not_supported",
  "contradicted",
  "couldnt_check",
]

/** The row for a verdict string from the wire. Unknown / prototype keys → couldn't check (D-17). */
export function verdictMeta(v: string): VerdictMeta {
  if (!Object.prototype.hasOwnProperty.call(VERDICT_META, v)) return VERDICT_META.couldnt_check
  return VERDICT_META[v as Verdict]
}

/**
 * The confidence to SHOW for a claim, or null. Only a known, decided verdict carries one: a
 * `couldnt_check` (or an unknown string, which reads as couldn't check) shows no number, because a
 * number beside "couldn't check" would read as a measurement nobody made (D-17). Raw, never
 * rounded here; callers format with `toFixed(2)` for display only.
 */
export function claimConfidence(verdict: string, confidence: number | null | undefined): number | null {
  if (!Object.prototype.hasOwnProperty.call(VERDICT_META, verdict) || verdict === "couldnt_check") return null
  return typeof confidence === "number" && Number.isFinite(confidence) ? confidence : null
}

/** "Contradicted, confidence 0.87" / "Couldn't check" — the marker's aria-label suffix. */
export function verdictSpoken(verdict: string, confidence: number | null | undefined): string {
  const word = verdictMeta(verdict).word
  const c = claimConfidence(verdict, confidence)
  return c === null ? word : `${word}, confidence ${c.toFixed(2)}`
}

const OFF_LINE = "Citation check is off while reranking is off."
const REORDERS_ONLY_LINE = "Citation check needs Jev or OpenAI Decisions (Settings → Reranking)."

function keyMissingLine(engine: string | null | undefined): string {
  const keyName = engine ? engineFor(engine).keyName : null
  return `Citation check can't run: no saved ${keyName ?? "engine key"} (Settings → Reranking).`
}

/** The ⓘ sentence shown in place of the button (D-16), or null when a check can run. */
export function availabilityReason(a: CitationCheckAvailability): string | null {
  if (a.available) return null
  if (a.reason === "engine_reorders_only") return REORDERS_ONLY_LINE
  if (a.reason === "key_missing") return keyMissingLine(a.engine)
  return OFF_LINE
}

/** One fixed line for a failed check, from the store's error code (never server text). */
export function checkErrorLine(code: string, a: CitationCheckAvailability | null): string {
  switch (code) {
    case "in_flight":
      return "A check is already running for this answer."
    case "off":
      return OFF_LINE
    case "engine_reorders_only":
      return REORDERS_ONLY_LINE
    case "key_missing":
      return keyMissingLine(a?.engine)
    case "not_found":
      return "This answer isn't available to check."
    case "rejected":
      return "This answer has no cited passages to check."
    case "engine_failed":
      // 294-REVIEW CR-01: the server's 503 — no engine call answered, so NOTHING was stored and
      // any saved verdicts are unchanged (the store keeps them; this line sits under them).
      return "The engine didn't answer, so nothing was saved. Try again in a moment."
    default:
      return "The check didn't finish. Try again."
  }
}
