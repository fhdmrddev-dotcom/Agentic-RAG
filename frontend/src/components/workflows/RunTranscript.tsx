/**
 * Phase 200 — THE RUN LOG: what happened, and when.
 *
 * Ported from sketch `run-surface.html`'s centre region, which draws a chronological
 * transcript in the slot the shipped page gave to the canvas. It closes `WIRE-run-surface.md`
 * rows 1 and 2, which that pass left **BLOCKED** pending an operator decision on what belongs
 * in the centre of the run page. The decision was taken and it is recorded here rather than
 * only in a planning file, because a future reader meets this file first.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * ⚠ WHY THE CANVAS CAME OFF THIS SURFACE — FOUR MEASURED REASONS, NOT A PREFERENCE
 * ─────────────────────────────────────────────────────────────────────────────────────────
 *
 *  1. **There is no graph to draw.** `WorkflowDefinition.phases` is `list[PhaseSpec]`
 *     (`backend/app/models/harness.py`) — a flat ordered list — and the harness models
 *     contain no branch construct at all. Every run is a straight chain, so a graph of it
 *     is the spine drawn expensively. (When branching becomes representable, that is a new
 *     decision with new evidence; this one is scoped to what the data is today.)
 *  2. **The page was stating one fact three times.** The canvas, the right-hand live spine
 *     and the receipt below are all renderings of {step → status}. This surface has already
 *     shipped that defect once: its run band is `sr-only` today precisely because an
 *     operator reported the status appearing twice, one line under the other.
 *  3. **The sheet is the newer approved bar.** The canvas-on-the-run-page came from sketch
 *     152-B by way of Phase 188. Sketch 200 carries `acceptance_bar: true` and draws no
 *     canvas on this surface at all.
 *  4. ⚠ **THE BLOCKER THAT HELD ROWS 1-2 WAS SCOPED TO THE WRONG SOURCE, AND THIS IS THE
 *     CORRECTION.** `AUDIT-run-arrival-connections.md` marked the sheet's per-line clock
 *     `BE-NEEDED` because `ToolCall.startedAt` is a client `Date.now()`, *"undefined for
 *     tool calls loaded from DB"*. That is true of TOOL CALLS and it is not what this log
 *     is built from. `200-02` + migration 121 put `started_at` / `completed_at` on
 *     `workflow_phases`; `api/workflow_runs.py` serialises them beside `step_count` /
 *     `step_noun`, and `api.ts` declares them. So a STEP-grained log has real instants and
 *     real counts today, with no backend work. The original verdict is preserved in that
 *     audit file; this is the measurement that supersedes it.
 *
 * ⚠ THE CANVAS ITSELF LOST NOTHING. `PORT-canvas.md`'s four commits edited
 * `WorkflowCanvas.tsx` / `PhaseNodeCard.tsx` — the SHARED component the builder renders,
 * which is the surface `builder-canvas.html` actually draws. Removing this page's mount
 * removed a mount, not the port.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * ONE LINE PER STEP, PLACED AT THE INSTANT IT LAST BECAME TRUE
 * ─────────────────────────────────────────────────────────────────────────────────────────
 *
 * A row's instant is its `completed_at` when it has one, and its `started_at` otherwise. That
 * is what a log timestamp means — *when this became known* — and it is why a finished step
 * sorts by its ending while the step still running sorts by its beginning.
 *
 * ⚠ AN EARLIER DRAFT EMITTED TWO LINES PER STEP (one opening, one closing), which is what
 * the sheet draws, and it was WITHDRAWN ON MEASUREMENT rather than on taste. The sheet's two
 * lines carry two different sentences — *"Connecting to Northwind CRM instance…"* then
 * *"Extracted vendor list"* — and that narration is **authored copy this product does not
 * have and must not invent** (D-07 / `SEED-159`; `199-05` called a fabricated business figure
 * *"the highest-consequence lie this phase could ship"*, and a fabricated business SENTENCE is
 * the same lie in prose). With only the step's NAME to put on both lines, two lines say the
 * same thing twice. The clock, the ordering and the live reading are the parts of the sheet's
 * idea that survive contact with the data; the narration is not, and it is REPORTED as
 * missing rather than approximated.
 *
 * ⚠ EVERY ROW RENDERS, INCLUDING THE ONES WITH NO INSTANT. A `pending` step and a `skipped`
 * one have no moment to be placed at, so they append after the timed rows, in the SERVER's
 * order, with an EMPTY gutter — never a fabricated zero, never a dash inside the clock, and
 * never silently dropped. A dropped row reads as *"that step does not exist"*, which is a
 * worse claim than *"we do not hold a time for it"*.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * TWO TENSES, AND THE RULE THAT KEEPS THEM FROM CONTRADICTING EACH OTHER
 * ─────────────────────────────────────────────────────────────────────────────────────────
 *
 * ⚠ THE TWO HALVES OF A LINE COME FROM TWO DIFFERENT SOURCES, AND THIS PAGE ALREADY HAS A
 * TEST PROVING THEY CAN DISAGREE (*"a STALE live-slice row does not override the durable rows
 * the receipt reads"*). The live reading is derived from the phase STREAM; the timing, the
 * outcome and the count are read from the durable FETCH, which is authoritative (D-v2.5-03).
 * Rendering both on one line is how a surface ends up saying *"still running · 12s"*.
 *
 * The rule is **the page's richer label ONLY while it agrees with the wire row's own
 * status; the wire's word otherwise**:
 *
 *   • they AGREE and the step is live  → the page's label alone, with no duration.
 *   • they AGREE and the step is over  → the page's label, the wire's duration, the count.
 *   • they DISAGREE                    → the WIRE's outcome, duration and count, and the
 *     page's words are not used at all.
 *
 * The page's label is preferred where it can be, because it carries strictly more for the
 * state where that matters most: `runReadingLabel` says WHICH of three things went wrong on a
 * failure, where the receipt has one word for all three.
 *
 * ⚠ THE DISAGREEMENT ARM EXISTS BECAUSE OF A DEFECT MEASURED ON THE OPERATOR'S OWN DATABASE,
 * NOT BECAUSE OF A HYPOTHETICAL. The page derives its reading by joining the definition's
 * steps onto the run's rows BY `phase_index` (D-188-01, and that decision is sound — the live
 * reconcile skeleton emits placeholder SLUGS, so a slug join is the one that cannot be
 * trusted). On **2 of 228 local runs** the run's `workflow_phases.phase_index` does not agree
 * with the definition's own ordering, and the join then reports each step's state as its
 * NEIGHBOUR's. Opening one of those two runs in the browser produced, on screen:
 *
 *     Produce the deliverable   Not started   time not recorded     ← this step FAILED
 *     Work out how to do it     Failed …      not reached           ← never started
 *
 * ⚠ THE ROW'S OWN WIRE FIELDS CANNOT BE CROSSED THAT WAY, which is what makes them the safe
 * fallback: `phases[entry.order]` IS the row, so its slug, its status, its timestamps and its
 * count all come from one record and are consistent with each other by construction. Only the
 * page's reading travels through the index join.
 *
 * ⚠ AN EARLIER DRAFT PREFERRED THE PAGE'S LABEL UNCONDITIONALLY and was corrected by that
 * measurement. The cost of this arm is real and is stated rather than hidden: while a step is
 * transitioning, the stream knows before the run poll does, so a line can briefly show the
 * wire's older word where the spine on the right already shows the newer one. **A word that is
 * a few seconds late is worth paying to never show a word that is permanently wrong** — and
 * the lag is bounded by the poll this page already runs, where the crossing is not bounded by
 * anything.
 *
 * ⚠ THIS COMPONENT DOES NOT FIX THE CROSSING AND MUST NOT TRY. Re-keying the join on slug
 * would overturn D-188-01 on the strength of two rows, at a surface that is not where the
 * join lives. The defect is reported; this is only the surface refusing to repeat it.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * IT COMPOSES; IT DOES NOT DECIDE, AND IT SPELLS NOTHING
 * ─────────────────────────────────────────────────────────────────────────────────────────
 *
 *  • The DECISION about which of D-06's nine arms a step is on, and whether a count was
 *    declared at all, comes from `phaseDuration.ts` — the same resolver the receipt and the
 *    chat panel use, so three surfaces provably cannot word one duration three ways.
 *  • The RUN'S ZERO comes from `phaseDuration.runAnchorMs`. ⚠ It is NOT `runSpan`: that one
 *    returns `null` until something has COMPLETED, which is true of every run still going —
 *    and this region is at its most useful mid-run.
 *  • The PAST-TENSE words come from `receiptVocabulary.ts`; this region's own come from
 *    `transcriptVocabulary.ts`. ⚠ **This file spells no user-visible string of its own**, and
 *    its suite sweeps this source to prove it.
 *  • The LIVE reading is the PAGE's, handed down already worded. Someone watching a step
 *    happen right now is the canvas vocabulary's audience, and minting a third phrasing here
 *    would be the two-views-two-languages defect told in copy.
 *  • The FORMATTER is `@/lib/fmtElapsed`, the one this tree hoisted after carrying three.
 *
 * ⚠ THE GUTTER READS `4m 12s`, NOT THE SHEET'S `00:42`, AND THAT IS DELIBERATE.
 * `lib/fmtElapsed.ts`'s own docblock names a fourth elapsed formatter as *"the thing NOT to
 * write"*, and an `mm:ss` gutter is exactly that. The sheet governs presentation; it does
 * not overrule a rule the product already keeps — the same call this phase made three times
 * over when a sheet drew nine publish stages against the server's ten.
 *
 * ⚠ AND IT SPENDS ZERO NET-NEW GLYPHS. The sheet marks the attention line and the active
 * line with two icons. This surface renders neither: `WorkflowRunPage.tsx` ships no spinner
 * and no violet mark today, and the panel's own a11y rule is that a status carries REAL TEXT
 * and is never signalled by colour alone. The live state is therefore carried by the page's
 * already-worded label, with tone reinforcing it rather than replacing it.
 *
 * ⚠ `--panel-*` TOKENS ARE FORBIDDEN HERE. This region renders on `--background`, not inside
 * the panel shell; `phaseStatusMeta.ts` states that boundary in as many words.
 *
 * ⚠ ROW ORDER IS DERIVED FROM THE SERVER'S INSTANTS, AND TIES BREAK ON THE SERVER'S OWN ROW
 * ORDER. There is no client-side re-sort by anything else — the D-17/D-18 fence the library
 * feeds carry, met one surface along.
 */
import { fmtElapsed } from "@/lib/fmtElapsed"
import { phaseStatusFromDb } from "@/lib/phaseState"
import { cn } from "@/lib/utils"
import {
  declaredCount,
  phaseRunFacts,
  runAnchorMs,
  transcriptEntries,
  type PhaseTimingRow,
} from "@/components/workflows/phaseDuration"
import { own } from "@/components/workflows/ownProperty"
import { countDeclared } from "@/components/workflows/receiptVocabulary"
import {
  TRANSCRIPT_LANDMARK_LABEL,
  TRANSCRIPT_NO_STEPS,
  TRANSCRIPT_TIMES_NOT_RECORDED,
} from "@/components/workflows/transcriptVocabulary"

// ── The read shapes ─────────────────────────────────────────────────────────────────────

/**
 * The page's live reading for one step, as this region reads it.
 *
 * ⚠ A READ SHAPE, NOT A SECOND HOME FOR `NodeRunState` — the `PhaseTimingRow` precedent one
 * file over. Declaring it structurally means this component takes ZERO runtime imports from
 * the canvas vocabulary or from `@/lib/api`, so `196-08`'s failure mode (suites throwing at
 * mount because a `vi.mock` factory did not declare a newly-added export) is unreachable
 * from here by construction rather than by care. `NodeRunState` satisfies it structurally;
 * the compiler checks that at the call site.
 */
export interface TranscriptLiveReading {
  /** The canvas reading member. Compared, never rendered. */
  reading: string
  /** That reading, ALREADY WORDED by the page. The only live text this region prints. */
  label: string
}

/* ⚠ THE ENTRY DERIVATION DOES NOT LIVE HERE, AND THE REASON IS THE TOOLING'S OWN.
 * `transcriptEntries` and its `TranscriptEntry` type moved to `phaseDuration.ts` —
 * eslint's `react-refresh/only-export-components` says it in as many words: *"Fast refresh
 * only works when a file only exports components. Use a new file to share constants or
 * functions between components."* It was MEASURED as a real error on this file before the
 * move, which is the same instruction that produced `phaseStatusMeta.ts` and
 * `stepCardSectionContext.ts`.
 *
 * ⚠ AND `phaseDuration.ts` IS THE RIGHT HOME RATHER THAN A CONVENIENT ONE. That module is
 * already *"the ONE place a wire truth becomes a rendered duration fact"*; placing a step on
 * the run's clock is that job exactly, it needs only `readInstant` / `runAnchorMs` from
 * there, and siting it there costs no new leaf. */

/**
 * The readings that mean *"this step is happening now"* — the only ones whose line drops the
 * past tense and carries the page's live label instead.
 *
 * ⚠ A `Set`, READ BY MEMBERSHIP, never a bracket lookup into an object literal. The values
 * are `CanvasReading` members today, but they arrive here as a plain `string` on a read
 * shape, and a bare index into an object hands back an inherited member for a prototype key
 * — the WR-04 sink this tree has now measured at eight sites.
 */
const LIVE_READINGS: ReadonlySet<string> = new Set(["running", "waiting-for-you"])

/**
 * Which wire statuses each page reading is consistent with.
 *
 * ⚠ IT IS NOT AN IDENTITY COMPARISON, and the three places it differs are the whole reason
 * the table is written out rather than replaced by `===`:
 *   • the page says `not-started` where the wire says `pending`;
 *   • the page collapses `retrying` into `running` before a reading ever reaches here, so
 *     the RUNNING row below covers a reattempt without naming it. ⚠ `retrying` is deliberately
 *     ABSENT from the values: it is representable LIVE and is not a member of the database's
 *     own CHECK constraint, so `phaseStatusFromDb` never produces it for a wire row. Listing
 *     it would suggest a state this side can be in;
 *   • `waiting-for-you` is DERIVED on top of a `running` row — the wire has no such status —
 *     so a comparison that demanded a matching status would call the one state this surface
 *     most needs to name a disagreement, and drop its label.
 *
 * ⚠ READ THROUGH `own()`, NOT `TABLE[key]`. A reading arrives here as a plain `string` on a
 * read shape, and a bare index into an object literal returns an INHERITED member for a
 * prototype key — the WR-04 sink this tree has measured at eight sites. A key that is not
 * present resolves to `undefined` and therefore to DISAGREEMENT, which fails toward the wire:
 * the safe direction, because the wire row is the internally consistent one.
 */
const WIRE_STATUS_FOR_READING: Record<string, readonly string[]> = {
  "not-started": ["pending"],
  running: ["running"],
  "waiting-for-you": ["running"],
  done: ["done"],
  failed: ["failed"],
  skipped: ["skipped"],
  cancelled: ["cancelled"],
  "recorded-not-sent": ["recorded-not-sent"],
  unknown: ["unknown"],
}

/** Whether the page's reading for this step is consistent with the row's own status. */
function pageAgreesWithWire(row: PhaseTimingRow, live: TranscriptLiveReading): boolean {
  const allowed = own(WIRE_STATUS_FOR_READING, live.reading)
  return allowed != null && allowed.includes(phaseStatusFromDb(row.status))
}

/**
 * The reading that earns the attention tone. Kept apart from `LIVE_READINGS` because
 * "is happening" and "is stuck on a person" are two facts, and only one of them is an ask.
 */
const ATTENTION_READING = "waiting-for-you"

export interface RunTranscriptProps {
  /** The run's durable phase rows, IN THE ORDER THE SERVER GAVE THEM. */
  phases: readonly PhaseTimingRow[]
  /**
   * The step's human name. ⚠ THE CALLER'S, never re-derived here — `nodeTitle`'s ladder
   * needs a page-owned name context, and a second derivation would give the same step a
   * different face in the log than on the spine beside it.
   */
  titleOf: (slug: string) => string
  /**
   * The page's already-worded live reading per step. ⚠ Absent, or absent FOR A SLUG, means
   * the caller holds no live fact — which is not the same as the step being idle. The line
   * then carries its recorded past tense, which is true either way.
   */
  liveOf?: (slug: string) => TranscriptLiveReading | undefined
  /**
   * The WORKFLOW RUN's status. ⚠ It is what separates a live tick from `did not finish`
   * from `paused, waiting on a person`, and none of the three is derivable from a phase row.
   */
  runStatus?: string | null
  /** The instant to tick a still-running row against — hoist ONE per render (P-1). */
  now?: number
}

export function RunTranscript({
  phases,
  titleOf,
  liveOf,
  runStatus,
  now = Date.now(),
}: RunTranscriptProps) {
  const anchor = runAnchorMs(phases)
  const entries = transcriptEntries(phases)

  return (
    <section
      data-testid="run-transcript"
      aria-label={TRANSCRIPT_LANDMARK_LABEL}
      className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto"
    >
      {phases.length === 0 ? (
        <p data-testid="run-transcript-empty" className="text-sm text-muted-foreground">
          {TRANSCRIPT_NO_STEPS}
        </p>
      ) : (
        <>
          {/* ⚠ THE HEADLINE APPEARS ONLY WHEN THE RUN HAS NO ZERO AT ALL — not when a single
              row happens to be untimed. It is a statement about the RUN, and printing it
              above a list that does carry a clock would be false. */}
          {anchor === null && (
            <p data-testid="run-transcript-untimed" className="mb-3 text-xs text-muted-foreground">
              {TRANSCRIPT_TIMES_NOT_RECORDED}
            </p>
          )}
          <ol className="flex flex-col gap-1.5">
            {entries.map((entry) => {
              const row = phases[entry.order]
              const facts = phaseRunFacts(row, runStatus, now)
              const held = liveOf?.(entry.slug)
              // ⚠ THE PAGE'S WORDS ARE USED ONLY WHILE THEY AGREE WITH THE ROW'S OWN STATUS —
              // see the tense rule in the docblock, and the crossing it was measured against.
              // A disagreement drops them ENTIRELY rather than contributing half a line.
              const live = held != null && pageAgreesWithWire(row, held) ? held : null
              const isLive = live != null && LIVE_READINGS.has(live.reading)
              const attention = live != null && live.reading === ATTENTION_READING
              // The duration belongs to a step that has stopped. When the page's label is in
              // use and says the step is live, there is no duration to show yet; otherwise the
              // wire's own reading is internally consistent and renders as it is.
              const showPast = !isLive
              // ⚠ READ FROM THE RESOLVER, NOT RE-TESTED HERE. `declaredCount` is the ONE arm
              // that knows a declared `0` from an absence, and a second `typeof` check at
              // this call site would be a second place to get it wrong.
              const count = showPast ? declaredCount(row) : null
              // The word this line ends up carrying, resolved ONCE so the duplicate check
              // below and the rendered span can never disagree about what it is.
              const word = live != null ? live.label : facts.outcome
              // ⚠ A TIMING READING THAT IS THE SAME STRING AS THE STATE WORD IS NOT A SECOND
              // FACT. `pending` resolves both to the same constant, and printing it twice
              // ("not reached · not reached") reads as a surface that has lost track of what
              // it is saying. Compared by VALUE rather than by arm, so it holds for any future
              // pair that happens to collide.
              const timeAddsSomething = facts.timing.reading !== word

              return (
                <li
                  key={row.slug}
                  data-testid={`transcript-row-${row.slug}`}
                  data-outcome={facts.outcome}
                  data-live={isLive ? "true" : undefined}
                  // The page's reading, machine-readable — the `data-outcome` idiom the
                  // receipt row already uses, one source over. ⚠ IT IS THE HELD READING, NOT
                  // THE USED ONE: it stays readable even when the row disagreed with it and
                  // its words were dropped, because that disagreement is exactly the thing a
                  // reader diagnosing a crossed run needs to be able to see.
                  data-reading={held?.reading}
                  // ⚠ PRESENT ONLY WHEN THE TWO SOURCES DISAGREED. It is what turns the
                  // measured crossing from something a person has to notice into something a
                  // test — or a console — can ask about directly.
                  data-source-conflict={held != null && live == null ? "true" : undefined}
                  className="flex min-w-0 items-baseline gap-3 text-[13px] leading-relaxed"
                >
                  {/* ⚠ THE GUTTER IS ALWAYS PRESENT AND SOMETIMES EMPTY. An untimed row keeps
                      its column so the timed rows above it stay aligned, and it holds nothing
                      rather than a placeholder — a dash in a clock column is a reading. */}
                  <span
                    data-testid="transcript-clock"
                    className="w-16 shrink-0 text-right font-mono text-[11px] tabular-nums text-muted-foreground"
                  >
                    {entry.offsetMs === null ? "" : fmtElapsed(entry.offsetMs)}
                  </span>
                  {/* ⚠ THE TITLE IS FULL-STRENGTH ON EVERY LINE, INCLUDING THE LIVE ONE.
                      An earlier draft dimmed the running step, borrowed from the sheet, where
                      the dim lines are IN-FLIGHT NARRATION beside separate bright RESULT
                      lines. With one line per step that mapping inverts: it would mute the
                      single most important row on a page somebody is watching. The tone that
                      distinguishes the states rides on the STATE WORD instead. */}
                  <span
                    data-testid="transcript-title"
                    className={cn(
                      "min-w-0 flex-1 truncate text-foreground",
                      attention && "text-accent-violet-text",
                    )}
                  >
                    {titleOf(row.slug)}
                  </span>
                  {/* ⚠ THE STATE WORD IS THE PAGE'S WHENEVER IT HOLDS ONE. It carries
                      strictly more for the one state where it matters most: `runReadingLabel`
                      words a failure with WHICH of three things went wrong, where the receipt
                      has a single word for all three. The receipt's outcome is the FLOOR, for
                      a slug the page holds no reading for at all. */}
                  <span
                    data-testid="transcript-state"
                    className={cn(
                      "shrink-0",
                      attention ? "text-accent-violet-text" : "text-muted-foreground",
                    )}
                  >
                    {word}
                  </span>
                  {showPast && (
                    <>
                      {timeAddsSomething && (
                        <span
                          data-testid="transcript-time"
                          className="shrink-0 tabular-nums text-muted-foreground"
                        >
                          {facts.timing.reading}
                        </span>
                      )}
                      {count && (
                        <span
                          data-testid="transcript-count"
                          className="shrink-0 text-muted-foreground"
                        >
                          {countDeclared(count.count, count.noun)}
                        </span>
                      )}
                    </>
                  )}
                </li>
              )
            })}
          </ol>
        </>
      )}
    </section>
  )
}

export default RunTranscript
