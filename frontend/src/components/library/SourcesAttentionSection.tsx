/**
 * Phase 235 plan 11 (SURF-03 / LIB-10 · D-235-01 / D-235-17) —
 * THE HEALTH TAB'S HALF OF SURF-03: ONLY WHAT IS WRONG, AND A HOP BACK TO THE FIX.
 *
 * ── ⛔ THE DIVISION OF LABOUR IS A RULE, NOT A LAYOUT PREFERENCE (D-235-17) ────────────
 *
 *   Ingestion = every source, and everything it did.
 *   Health    = only what is wrong.
 *
 * Rendering the run history here TOO was explicitly REJECTED at scoping — two homes for one
 * truth, even with a shared component, is how two surfaces come to disagree about the same
 * source. `RunHistoryList` is deliberately NOT imported by this file, and the suite asserts
 * that absence rather than trusting this sentence.
 *
 * ── ⛔ A DOOR, NEVER A REPAIR ─────────────────────────────────────────────────────────
 *
 * Every row's one control is `Go to source`. The sketch's first variant fork was *where the
 * fix lives*, and it was REFUTED by measurement: the two variants differed by 248 characters
 * out of ~30,000 and the landing screens were pixel-identical. The question was then settled
 * BY RULE — one home for the fix, on the source card, in both variants. So every label in
 * `CONTROL_FOR_CAUSE` is absent from this file BY DESIGN, and the suite proves it by looping
 * that table's own labels rather than re-typing them.
 *
 * ⚠ PITFALL 8 — this paragraph deliberately does NOT spell those three labels. A literal
 * inside a docblock is still a literal, and the acceptance grep for them reads the whole
 * file; prose that repeats a forbidden string makes the measurement answerable by prose.
 *
 * ── ⛔ ONE READER, ONE VERDICT (D-235-05 / T-235-37) ──────────────────────────────────
 *
 * This section consumes `useSourceAttention` — the SAME hook the rail badge uses. It does not
 * fetch again and it derives nothing: the debounce threshold lives on the server precisely so
 * the badge, this list and the source card cannot disagree about which source is stopped.
 *
 * ── ⛔ THREE STATES, THREE TRUTHS (SEED-248 / T-235-39) ───────────────────────────────
 *
 *   loading                → we have not looked yet
 *   answered, none stopped → `Every source is reading.`
 *   never answered         → we could not ask
 *
 * A section that renders an empty list for all three is indistinguishable from a broken
 * section, and the third case is the dangerous one: an all-clear nobody was told.
 *
 * ── ⚠ THE `last_good_at` WINDOW IS NOT A CLAIM (plan 06) ─────────────────────────────
 *
 * `/sources/health` finds the newest success within FIVE rows. A source that has failed more
 * times than that reports `null`, which reads identically to "never succeeded". So a null
 * renders NOTHING here — `COPY.neverRead` belongs to the source card, which has fetched the
 * unbounded run list and can actually know.
 *
 * ── COLOUR ───────────────────────────────────────────────────────────────────────────
 *
 * The attention mark is the WARNING token. The alarm token is never applied to a source
 * state — the sketch's §9 posture, and the same rule the source card carries. Per the design
 * skill the state reads as glyph + label + colour, never colour alone.
 */

import { useSourceAttention } from "@/hooks/useSourceAttention"
import {
  COPY,
  SENTENCE_FOR_CAUSE,
  type SourceFailureCause,
} from "@/components/sources/sourceHealthVocabulary"
import { relativeBand } from "@/components/workflows/library/relativeChanged"
import type { StoppedSource } from "@/lib/api/sources"

/**
 * ⚠ TWO SHORT LABELS LIVE HERE RATHER THAN IN THE VOCABULARY LEAF, AND THE REASON IS
 * MEASURED, NOT LAZY. `sourceHealthVocabulary.test.ts:138` pins `Object.keys(COPY)` at
 * exactly 26, so adding a key reddens a green fence in a file this plan does not own — the
 * identical constraint plan 10 recorded for its four state labels and plan 04 for
 * `LISTING_INCOMPLETE_NOTE`. Whichever plan re-baselines that pin should hoist these two.
 *
 * ⛔ Neither is a claim about a source. They describe THIS SECTION's own knowledge, which is
 * exactly the distinction SEED-248 is about.
 */
const STILL_ASKING = "Checking which sources are reading..."
const COULD_NOT_ASK = "The source check could not be reached — this list may be incomplete."

/** ⛔ Never a guess: a cause the table does not know resolves to the honest fallback. */
function sentenceFor(source: StoppedSource): string {
  const sentence =
    SENTENCE_FOR_CAUSE[source.cause as SourceFailureCause] ?? SENTENCE_FOR_CAUSE.unknown
  return sentence(source.connection_name ?? "")
}

/**
 * The row's name. The folder is what a person watched; the connection is the honest second
 * choice. ⛔ When neither is present nothing is invented — the row still renders, and the
 * cause sentence still says what is true.
 */
function nameFor(source: StoppedSource): string | null {
  const folder = (source.source_folder_name ?? "").trim()
  if (folder) return folder
  const connection = (source.connection_name ?? "").trim()
  return connection || null
}

function AttentionRow({
  source,
  now,
  onGoToSource,
}: {
  source: StoppedSource
  now: number
  onGoToSource?: (watchId: string) => void
}) {
  const name = nameFor(source)
  const stoppedAgo = relativeBand(source.stopped_since, now)
  // ⚠ A null here is "no success inside the five-row window", NEVER "it has never read".
  const lastGood = relativeBand(source.last_good_at, now)

  return (
    <li
      data-testid="health-attention-row"
      className="flex items-start gap-3 rounded-lg border border-warning/30 bg-warning/5 px-3 py-2.5"
    >
      {/* glyph + colour; the words beside it carry the meaning */}
      <span aria-hidden="true" className="mt-0.5 text-warning text-xs leading-none">
        ○
      </span>

      <div className="min-w-0 flex-1">
        {name && (
          <div className="truncate text-sm font-medium text-foreground" data-testid="health-attention-name">
            {name}
          </div>
        )}
        <div className="text-xs text-muted-foreground" data-testid="health-attention-why">
          {sentenceFor(source)}
        </div>
        {(stoppedAgo || lastGood) && (
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-muted-foreground/80">
            {stoppedAgo && <span>{COPY.stopped(stoppedAgo)}</span>}
            {lastGood && <span data-testid="health-attention-last-good">{COPY.lastGood(lastGood)}</span>}
          </div>
        )}
      </div>

      {/* ⛔ ONE control, and it is a DOOR. The fix lives on the source card. */}
      {onGoToSource && (
        <button
          type="button"
          data-testid="health-go-to-source"
          onClick={() => onGoToSource(source.watch_id)}
          className="shrink-0 rounded-md border border-border px-2.5 py-1 text-xs font-medium hover:bg-accent"
        >
          {COPY.goToSource}
        </button>
      )}
    </li>
  )
}

export interface SourcesAttentionSectionProps {
  /** The hop back to the Ingestion card. Absent ⇒ the control is absent, never a dead click. */
  onGoToSource?: (watchId: string) => void
}

export function SourcesAttentionSection({ onGoToSource }: SourcesAttentionSectionProps) {
  const { stopped, loading, verdictKnown } = useSourceAttention()
  const now = Date.now()

  return (
    <div className="ghost-border bg-card/50 rounded-lg p-4" data-testid="health-body-health">
      <h3 className="mb-3 text-base font-headline font-bold">{COPY.attentionTitle}</h3>

      {loading ? (
        <div
          data-testid="health-attention-loading"
          className="flex items-center gap-2 text-xs text-muted-foreground"
        >
          <span className="h-3 w-3 animate-pulse rounded-full bg-muted/60" aria-hidden="true" />
          {STILL_ASKING}
        </div>
      ) : !verdictKnown ? (
        <p data-testid="health-attention-unknown" className="text-xs text-muted-foreground">
          {COULD_NOT_ASK}
        </p>
      ) : stopped.length === 0 ? (
        <p data-testid="health-attention-empty" className="text-sm text-muted-foreground">
          {COPY.attentionEmpty}
        </p>
      ) : (
        <ul data-testid="health-attention-list" className="flex flex-col gap-2">
          {stopped.map((source) => (
            <AttentionRow
              key={source.watch_id}
              source={source}
              now={now}
              onGoToSource={onGoToSource}
            />
          ))}
        </ul>
      )}
    </div>
  )
}
