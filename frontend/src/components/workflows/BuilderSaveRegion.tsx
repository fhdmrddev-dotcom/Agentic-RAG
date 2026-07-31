/**
 * Phase 186-07 (CONCUR-01 / CONCUR-02 · D-186-03 / D-186-08) — everything the Builder
 * header says about SAVING, in one place.
 *
 * ── WHY IT IS ITS OWN FILE (G-5) ──────────────────────────────────────────────────
 *
 * `WorkflowBuilderPage.tsx` is a hot file on the CLAUDE.md ledger and this plan's job was
 * to make it SMALLER while composing autosave into it. The write LOGIC left in 186-06
 * (`useDraftPersistence`); this is the other half — the four things the surface says about
 * that logic and the three controls that act on it. The page keeps the composition and one
 * mount line.
 *
 * ── FOUR SENTENCES, EACH REACHABLE FROM EXACTLY ONE STATE ────────────────────────
 *
 * Nothing here derives, classifies or re-words anything. Every sentence is either a locked
 * constant below or the one the write loop already chose, and the mapping is a switch over
 * the hook's discriminated union — so a refusal can never render as a receipt, and a
 * receipt can never render for a save that did not happen (the T-185-04-01 rule).
 *
 *   saving   → the button's own spinner + the quiet line
 *   saved    → `Saved · still a draft` (the locked 184 wording) + the quiet line, and BOTH
 *              retire the instant `dirty` is true again
 *   held     → the loop's hold sentence, on the quiet line — nothing was refused and the
 *              person is not being asked to do anything except wait
 *   error    → the loop's refusal sentence, in the alert span beside the button
 *   conflict → the banner, which is the only reading that carries controls
 *
 * ── THE CONSTANTS ARE MODULE-LOCAL, DELIBERATELY ─────────────────────────────────
 *
 * A component file may not export shared constants (`react-refresh/only-export-components`,
 * the constraint `verdictModel.ts` exists to satisfy for the gauntlet). These four strings
 * have exactly ONE consumer — the component below them — so they are named, docblocked and
 * kept unexported rather than pushed into a pure module that nothing else would read.
 * `SAVED_STILL_A_DRAFT` and the hold/refusal sentences are NOT re-declared here: they are
 * imported from their own single homes.
 */
import { SAVED_STILL_A_DRAFT } from "@/components/workflows/builderStore"
import type { PersistState } from "@/hooks/useDraftPersistence"

/**
 * D-186-08 — the conflict banner's sentence. It states what happened in the author's terms
 * (the draft moved, somewhere that is not this tab) and then offers BOTH ways out, because
 * either alone is a trap: reload-only loses the work on screen, overwrite-only loses
 * whatever the other tab wrote.
 *
 * It is a REFUSAL, not a receipt. Nothing was saved when this renders, the loop has stopped,
 * and it stays stopped until the person picks. Neither exit is ever taken automatically —
 * that rule is enforced in the hook, which never calls either one itself.
 */
const CONFLICT_BANNER_MESSAGE =
  "This draft changed somewhere else. Reload to get the newer version, or overwrite it with what's on screen."

/** The DEFAULT exit, rendered FIRST in DOM order (D-186-08). Reading order and tab order
 *  are the recommendation: the safe act is the one a person reaches first. */
const CONFLICT_RELOAD_LABEL = "Reload"

/** The SECOND click. Overwriting is the only act on this surface that can destroy writing
 *  which is not on this screen, so it is deliberately the further control — never the
 *  default, never pre-selected, never invoked by an effect. */
const CONFLICT_OVERWRITE_LABEL = "Overwrite"

/** D-186-03 — the quiet autosave voice while a write is outstanding. Two words, in the calm
 *  register: autosave is meant to be unremarkable, and it says nothing at all at rest. */
const AUTOSAVE_SAVING = "Saving…"

/** The receipt half of the same quiet voice. Reachable ONLY from the loop's `saved` state,
 *  which only a confirmed write with nothing newer queued behind it can produce. */
const AUTOSAVE_SAVED = "Saved · just now"

export interface BuilderSaveRegionProps {
  /** The write loop's state, verbatim. This component narrows it; it derives nothing. */
  state: PersistState
  /** The store's dirty flag. It OUTRANKS a `saved` reading — see `receiptVisible`. */
  dirty: boolean
  /**
   * Is the autosave loop actually running on this surface? The quiet line describes
   * autosave, so with the loop off it must not appear: D-181-01 promises a flag-off header
   * identical to the one that shipped, and `WorkflowBuilderPage.header.test.tsx` pins that
   * header as literal markup. The explicit Save button is unaffected either way.
   */
  autosaveEnabled: boolean
  onSaveNow: () => void
  onReload: () => void
  onOverwrite: () => void
}

export function BuilderSaveRegion({
  state,
  dirty,
  autosaveEnabled,
  onSaveNow,
  onReload,
  onOverwrite,
}: BuilderSaveRegionProps) {
  const saving = state.kind === "saving"
  /**
   * `!dirty` is 186-07's addition and it is load-bearing. The receipt used to retire itself
   * on a 2.5 s timer; the write loop's `saved` has no timer, so without this the surface
   * would keep claiming a save while the author typed the next edit. A receipt is retired
   * by the next change, not by a clock.
   */
  const receiptVisible = state.kind === "saved" && !dirty
  const quietLine =
    !autosaveEnabled
      ? null
      : saving
        ? AUTOSAVE_SAVING
        : receiptVisible
          ? AUTOSAVE_SAVED
          : state.kind === "held"
            ? state.sentence
            : null

  return (
    <>
      {/* Phase 103-ux: explicit Save draft + transient confirmation.
          Phase 184-11 (R6): this region is the ONLY place the surface says anything about
          the save, and what it says is `Saved · still a draft`.
          Phase 186-07 (D-186-03): the button SURVIVES as the deliberate commit-now
          affordance and keeps its own confirmation; autosave gets a quiet line beside it
          rather than taking this one over. Nothing here was deleted. */}
      <div data-testid="builder-save-state" className="flex items-center gap-2">
        <button
          type="button"
          data-testid="builder-save-draft"
          onClick={onSaveNow}
          disabled={saving}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-[13px] font-medium text-foreground transition-opacity hover:bg-accent/40 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? (
            <>
              <span
                aria-hidden="true"
                className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent"
              />
              Saving…
            </>
          ) : (
            "Save draft"
          )}
        </button>
        {receiptVisible && (
          <span data-testid="builder-save-confirm" role="status" className="text-[13px] font-medium text-success">
            {SAVED_STILL_A_DRAFT}
          </span>
        )}
        {/* The refusal line. The SENTENCE IS THE LOOP'S — nothing here classifies or
            rewrites it, which is what keeps one situation reading one way whether the hold
            gate caught it or the request's own refusal did. `conflict` is deliberately
            excluded: it has two exits, and a span cannot offer them. */}
        {state.kind === "error" && (
          <span data-testid="builder-save-error" role="alert" className="text-[13px] font-medium text-destructive">
            {state.sentence}
          </span>
        )}
        {quietLine !== null && (
          <span data-testid="builder-autosave-status" role="status" className="text-[12px] text-muted-foreground">
            {quietLine}
          </span>
        )}
      </div>

      {/* D-186-08 — the conflict banner. Rendered ONLY on a conflict, so at rest it is
          absent from the DOM entirely and the header is the one that shipped.
          RELOAD COMES FIRST IN DOM ORDER, and that is the decision rather than the styling:
          reading order and tab order both reach the safe act first.
          NOT gated on `autosaveEnabled`, unlike the quiet line: a conflict is reachable
          through the explicit Save button on any surface, and a person who has hit one must
          always be offered both ways out rather than left with a dead sentence. */}
      {state.kind === "conflict" && (
        <div
          data-testid="builder-conflict-banner"
          role="alert"
          className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/5 px-2.5 py-1.5 text-[12px] text-foreground"
        >
          <span className="max-w-[26rem]">{CONFLICT_BANNER_MESSAGE}</span>
          <button
            type="button"
            data-testid="builder-conflict-reload"
            onClick={onReload}
            className="shrink-0 rounded border border-border bg-card px-2 py-0.5 text-[12px] font-medium text-foreground hover:bg-accent/40"
          >
            {CONFLICT_RELOAD_LABEL}
          </button>
          <button
            type="button"
            data-testid="builder-conflict-overwrite"
            onClick={onOverwrite}
            className="shrink-0 rounded border border-destructive/40 px-2 py-0.5 text-[12px] font-medium text-destructive hover:bg-destructive/10"
          >
            {CONFLICT_OVERWRITE_LABEL}
          </button>
        </div>
      )}
    </>
  )
}
