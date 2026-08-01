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
 *   held     → the loop's hold sentence, on the quiet line — nothing was refused, and what
 *              the person is asked to do next depends on whether the loop will flush for
 *              them (it says "wait" when it will, and "press Save again" when it will not).
 *              RENDERED ON EVERY SURFACE, unlike the two readings above it: `held` describes
 *              the outcome of an explicit Save press as much as autosave's, so it is not
 *              part of what the canvas flag hides (186-13, WR-04).
 *   error    → the loop's refusal sentence, in the alert span beside the button
 *   conflict → the banner, which is the only reading that carries controls. It may also
 *              carry an OPTIONAL second line — `state.note`, authored by the loop, today
 *              produced only by a reload that could not reach the server (186-14). It is
 *              rendered BESIDE the locked banner sentence and never instead of it: the
 *              sentence that offers the two exits is the one thing on this surface that may
 *              not be replaced, least of all at the moment an exit has just failed.
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
   * Is the autosave loop actually running on this surface? `Saving…` and `Saved · just now`
   * describe AUTOSAVE NARRATING ITSELF, so with the loop off they must not appear: D-181-01
   * promises a flag-off header identical to the one that shipped, and
   * `WorkflowBuilderPage.header.test.tsx` pins that header as literal markup.
   *
   * IT DOES NOT GATE `held` (186-13, WR-04). A hold is the outcome of an explicit Save press
   * as much as of an autosave beat, and the press is available on every surface — so gating
   * the sentence made the flag-off button look like a control that did nothing at all.
   * Nothing about the resting header changes: `held` is unreachable at rest.
   *
   * The explicit Save button itself is unaffected either way.
   */
  autosaveEnabled: boolean
  /**
   * 186-12 — an exit the person chose is in progress. It comes from the write loop, which
   * is the only thing that knows; this component neither derives it nor infers it from
   * `state`, because a `saving` reading is produced by ordinary autosave too.
   */
  resolving: boolean
  onSaveNow: () => void
  onReload: () => void
  onOverwrite: () => void
}

export function BuilderSaveRegion({
  state,
  dirty,
  autosaveEnabled,
  resolving,
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
  /**
   * `held` IS EVALUATED BEFORE THE FLAG GATE, and the order is the fix (186-13, WR-04).
   *
   * It used to sit behind `!autosaveEnabled ? null`, which made a Save-draft press during a
   * publish a completely silent no-op on the flag-off surface: the loop reached
   * `{kind:"held"}`, chose a sentence, and nothing rendered it. A control that states no
   * outcome is worse than the pre-186 button it replaced.
   *
   * The other two readings stay behind the flag because of what they DESCRIBE. `Saving…` and
   * `Saved · just now` are the autosave loop narrating itself, and with the flag off that
   * loop genuinely is not running. `held` is not about autosave: it is the outcome of
   * something the person just did, and it is reachable on any surface because the Save
   * button and the Publish door are both mounted on any surface.
   *
   * Nothing is added to the RESTING markup by this: `held` is only reachable while a publish
   * is in flight or a shape check came back unreadable, so the flag-off header at rest is
   * still the one `WorkflowBuilderPage.header.test.tsx:305` pins byte for byte.
   */
  const quietLine =
    state.kind === "held"
      ? state.sentence
      : !autosaveEnabled
        ? null
        : saving
          ? AUTOSAVE_SAVING
          : receiptVisible
            ? AUTOSAVE_SAVED
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
          always be offered both ways out rather than left with a dead sentence.

          186-12 — `|| resolving` IS LOAD-BEARING, AND IT IS WHY THE DISABLE IS HONEST.
          `overwrite` sets `{kind:"saving"}` synchronously, so a banner gated on `conflict`
          alone unmounts on the very first click and the disabled state is never on screen —
          which is exactly how a double-click stayed an ordinary thing to do. A control that
          is doing something has to still be there, saying so. Disabling a control that has
          already vanished protects nothing.

          186-14 (GAP-4 / CR-02) — THE NOTE IS ADDITIVE, AND THAT IS THE WHOLE POINT.
          `CONFLICT_BANNER_MESSAGE` is the one sentence on this surface that may never be
          replaced, because it is the sentence that OFFERS THE TWO EXITS — and a failed exit
          is exactly the moment a person needs both of them most. So an explanation of the
          failure is a SECOND LINE on the same banner, under the same `role="alert"`, with
          both controls still mounted and still enabled. It is deliberately not put in the
          `builder-save-error` span above: that span is for a refused WRITE, and this is a
          failed READ during a resolution the person chose. Two situations in one element is
          how a sentence stops meaning one thing. */}
      {(state.kind === "conflict" || resolving) && (
        <div
          data-testid="builder-conflict-banner"
          role="alert"
          className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/5 px-2.5 py-1.5 text-[12px] text-foreground"
        >
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="max-w-[26rem]">{CONFLICT_BANNER_MESSAGE}</span>
            {state.kind === "conflict" && typeof state.note === "string" && state.note !== "" && (
              <span
                data-testid="builder-conflict-note"
                className="max-w-[26rem] text-[11px] text-muted-foreground"
              >
                {state.note}
              </span>
            )}
          </div>
          <button
            type="button"
            data-testid="builder-conflict-reload"
            onClick={onReload}
            disabled={resolving}
            className="shrink-0 rounded border border-border bg-card px-2 py-0.5 text-[12px] font-medium text-foreground hover:bg-accent/40 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {CONFLICT_RELOAD_LABEL}
          </button>
          <button
            type="button"
            data-testid="builder-conflict-overwrite"
            onClick={onOverwrite}
            disabled={resolving}
            className="shrink-0 rounded border border-destructive/40 px-2 py-0.5 text-[12px] font-medium text-destructive hover:bg-destructive/10 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {CONFLICT_OVERWRITE_LABEL}
          </button>
        </div>
      )}
    </>
  )
}
