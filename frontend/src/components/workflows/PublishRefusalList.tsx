/**
 * Phase 214-10 Task 1 (STEP-03 · D-214-09 / D-214-12, sketch 215) — THE PUBLISH REFUSAL,
 * RENDERED AS A CAUSE RATHER THAN AS A STATUS.
 *
 * ── WHY THIS IS A COMPONENT AND NOT FIVE LINES INSIDE THE GAUNTLET ────────────────────
 *
 * `PublishGauntlet.tsx` has rendered every new refusal shape INLINE for nineteen commits,
 * which is the growth pattern its hot-file row tracks. The whole of STEP-03's refusal —
 * the five sentences, the count line, the two next actions and the not-retroactive note —
 * lives here and in `publishRefusalVocabulary.ts`, so the gauntlet gains one import and one
 * mounted child. ⚠ The seam a future extraction should take is the BLOCK REGION AS A WHOLE
 * (verdict + cause + spine); this component is the first thing out through it.
 *
 * ── ⚠ FIVE REFUSALS, NOT ONE (D-214-09, sketch 215 §4) ────────────────────────────────
 *
 * Each source arm is proved on its own terms, so each failure is a DIFFERENT FACT ABOUT
 * THE WORLD and gets its own sentence. A single *"this step is invalid"* headline would
 * collapse all five — which is `BUG-260815-06`'s stage-naming failure wearing a new
 * costume, and that report's trigger fired at this phase and was declined a second time
 * (D-214-13) precisely because THIS refusal is written correctly from birth.
 *
 * The pairing is NOT re-implemented here. `REFUSAL_FOR_KIND` and `REFUSAL_NEXT_FOR_KIND`
 * are `Record`s keyed by `ArgumentGapKind`, so a sixth kind is a COMPILE ERROR in the
 * vocabulary module rather than a silent fall-through to a generic sentence here. This
 * file contains no `switch`, no `default:` and no second spelling of the five literals —
 * even the detection set below is read back off `REFUSAL_FOR_KIND`'s own keys.
 *
 * ── ⛔ WHAT THIS SURFACE MUST NEVER RENDER ────────────────────────────────────────────
 *
 *  · THE PHASE SLUG. Sketch 215 #1 asserts both halves: the AUTHORED name is there and the
 *    slug is not. The slug's job is to highlight the node on the canvas, not to be read.
 *  · THE BACKEND DIAGNOSTIC. The wire entry carries a server-composed sentence for the log
 *    and the `harness_audit` receipt. Putting a backend diagnostic on an author's screen is
 *    the whole of what `BUG-260815-06` is about. The English on this surface is composed
 *    CLIENT-SIDE from the vocabulary; the backend supplies kind + step name + argument name
 *    and never a sentence.
 *  · A GAUNTLET STAGE NAME (#4), AN EXCLAMATION OR A SEVERITY WORD (#5). The stage words
 *    live on the spine, BELOW this block.
 *  · DESTRUCTIVE COLOUR (#9). A refusal that is honest does not need to shout; the shipped
 *    `doorVocabulary` refusal register is the precedent.
 *
 * ── KEY DETECTION PER ENTRY, NEVER A SWITCH ON THE STAGE ──────────────────────────────
 *
 * `named_failures` is POLYMORPHIC across the gauntlet's stages (lint / judge / summary /
 * interactive / bare string), and `PublishGauntlet.tsx`'s docblock rule 4 requires the shape
 * to be detected PER ENTRY. `isArgumentRefusal` is that detection for these five codes;
 * everything it declines falls through to the shipped generic renderer, unchanged.
 *
 * ⚠ IT LIVES IN `publishRefusalEntry.ts` RATHER THAN HERE, and the reason was MEASURED, not
 * preferred: `react-refresh/only-export-components` is an ACTIVE ERROR in this repo, so a
 * component file may not export a shared function. Read that module's header for the rest —
 * including why an entry this surface cannot phrase HONESTLY is declined rather than
 * approximated.
 */
import { isArgumentRefusal, type ArgumentRefusal } from "@/components/workflows/publishRefusalEntry"
import {
  ALREADY_PUBLISHED_NOTE,
  REFUSAL_FOR_KIND,
  REFUSAL_NEXT_FOR_KIND,
  REFUSE_COUNT_MANY,
  REFUSE_COUNT_ONE,
  REFUSE_REST_OK,
  REFUSE_TITLE,
} from "@/components/workflows/publishRefusalVocabulary"

export interface PublishRefusalListProps {
  /** The verdict's `named_failures`, VERBATIM and unfiltered. This component picks its own
   *  entries out; the caller does not pre-sort them into shapes. */
  entries: readonly unknown[]
  /**
   * How many steps the workflow has, when the caller knows. Feeds `REFUSE_REST_OK` — *"The
   * other N are ready"* — which is the half of the answer a refusal that only names failures
   * leaves the reader guessing at. ⚠ ABSENT ⇒ THE LINE IS NOT RENDERED. Guessing a total
   * would put a number on screen that nothing counted.
   */
  totalSteps?: number | null
  /** Take the reader to the step. Absent ⇒ the control renders, states where the fix lives
   *  in its `title`, and is disabled — the shipped `RunLink` precedent: no dead affordance. */
  onGoToStep?: (refusal: ArgumentRefusal) => void
}

/** One refusal: the sentence, and the one thing to do about it. */
function RefusalItem({
  refusal,
  onGoToStep,
}: {
  refusal: ArgumentRefusal
  onGoToStep?: (refusal: ArgumentRefusal) => void
}) {
  // The sentence is looked up, never selected by a conditional. `shape_unknown`'s restraint
  // (it takes no `arg`) survives the indirection because the map holds the composed function
  // ITSELF — we hand it every fact we have and it provably drops the one it must not print.
  const sentence = REFUSAL_FOR_KIND[refusal.code]({
    step: refusal.step_name,
    arg: refusal.argument ?? "",
    upstream: refusal.upstream ?? "",
  })
  // And so is the next action. Four kinds send the reader to the step; `shape_unknown` sends
  // them to re-discovery, because the step is not where its fix lives. Deriving that with an
  // `if` here is exactly what the second `Record` exists to prevent.
  const nextAction = REFUSAL_NEXT_FOR_KIND[refusal.code]
  return (
    <li
      data-testid="refusal-item"
      data-refusal-kind={refusal.code}
      className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-3 py-2.5 last:border-b-0"
    >
      <span
        data-testid="refusal-headline"
        className="min-w-0 flex-1 text-[13px] font-semibold leading-relaxed text-foreground"
      >
        {sentence}
      </span>
      <button
        type="button"
        data-testid="refusal-next"
        disabled={onGoToStep == null}
        onClick={onGoToStep ? () => onGoToStep(refusal) : undefined}
        title={onGoToStep == null ? `${nextAction} — open this workflow in the builder` : undefined}
        className="shrink-0 rounded border border-primary/40 bg-primary/10 px-3 py-1 text-[12px] font-semibold text-primary disabled:opacity-70"
      >
        {nextAction}
      </button>
    </li>
  )
}

/**
 * The cause block. Renders NOTHING when no entry is one of the five — so the gauntlet's
 * other nine stages are byte-for-byte untouched by mounting it.
 */
export function PublishRefusalList({ entries, onGoToStep, totalSteps }: PublishRefusalListProps) {
  const refusals = entries.filter(isArgumentRefusal)
  if (refusals.length === 0) return null

  // ⚠ SKETCH 215 #6 — THE COUNT AGREES WITH THE LIST. Both the headline number and the
  // rendered items come from `refusals`, the SAME array, so the one lie this surface could
  // tell while every sentence in it is true is unreachable rather than merely avoided.
  const count = refusals.length
  const countLine = count === 1 ? REFUSE_COUNT_ONE : REFUSE_COUNT_MANY({ count })
  // `REFUSE_REST_OK` is rendered only when the caller actually knows the total. A guessed
  // "other N" would be the same class of invention the whole surface refuses.
  const rest = typeof totalSteps === "number" && totalSteps > count ? totalSteps - count : null

  return (
    <section data-testid="publish-refusals" className="mt-2 rounded-lg border border-border bg-card">
      <div className="border-b border-border px-3 py-2.5">
        <div data-testid="refusal-title" className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {REFUSE_TITLE}
        </div>
        <div data-testid="refusal-count" className="mt-1 text-[15px] font-bold leading-snug text-foreground">
          {countLine}
        </div>
        {rest != null && (
          <div data-testid="refusal-rest-ok" className="mt-0.5 text-[12px] leading-relaxed text-muted-foreground">
            {REFUSE_REST_OK({ count: rest })}
          </div>
        )}
      </div>
      <ul className="list-none">
        {refusals.map((refusal, i) => (
          <RefusalItem key={i} refusal={refusal} onGoToStep={onGoToStep} />
        ))}
      </ul>
      {/* ⚠ D-214-12 / SKETCH 215 #12 — THE GATE IS NOT RETROACTIVE, SAID OUT LOUD. It lives
          INSIDE this component rather than beside it in the caller, so "renders with every
          refusal" is structural instead of remembered: there is no render of this surface
          that omits it. Without the sentence an author reasonably fears their running
          workflows just stopped, and acts on that. */}
      <p
        data-testid="already-published-note"
        className="border-t border-border px-3 py-2 text-[12px] leading-relaxed text-muted-foreground"
      >
        {ALREADY_PUBLISHED_NOTE}
      </p>
    </section>
  )
}
