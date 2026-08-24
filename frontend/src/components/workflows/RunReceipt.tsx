/**
 * Phase 200-05 Task 3 (DES-02 / D-09) — THE RUN RECEIPT: the same spine, re-read in the
 * PAST TENSE.
 *
 * ⚠ NOT A THIRD SURFACE, and D-09 says so outright. Every row here is the same step the
 * builder's spine shows, with one difference that is the whole point: on the spine each row
 * is a CLAIM about what will happen, and here each row is a MEASURED FACT about what did.
 * That difference is exactly what `200-02`'s wire slice bought — `started_at`,
 * `completed_at`, `step_count` and `step_noun` are on the wire for the first time — and it
 * closes `COVERAGE.md`'s recorded *"c3's receipt column is missing"* gap.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * ⚠ THIS COMPONENT IS CREATED HERE AND MOUNTED IN `200-07`. THAT IS DELIBERATE.
 * ─────────────────────────────────────────────────────────────────────────────────────────
 *
 * It is exported and mounted NOWHERE at this commit, which is a decision rather than an
 * oversight, and it is load-bearing twice:
 *
 *   1. `WorkflowRunPage.tsx` is `200-07`'s primary file. Mounting the receipt from here would
 *      put two plans in one file in one wave — the overlap the phase's plan split exists to
 *      avoid.
 *   2. ⚠ It keeps `199-02`'s refusal intact BY CONSTRUCTION. The builder's spine reads a
 *      DRAFT definition and has no run; a receipt that never reaches the builder cannot
 *      fabricate a claim there, and no amount of care is needed to keep it that way.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * IT COMPOSES; IT DOES NOT DECIDE, AND IT DOES NOT SPELL
 * ─────────────────────────────────────────────────────────────────────────────────────────
 *
 *  • The DECISIONS come from `phaseDuration.ts` — which of D-06's nine arms a row is on, and
 *    whether a count was declared at all.
 *  • The WORDS come from `receiptVocabulary.ts`. ⚠ **This file spells no user-visible string
 *    of its own**, and its suite sweeps this source to prove it: one literal left in JSX is a
 *    second home, and a second home cannot be re-worded by a one-line diff.
 *  • The FORMATTER is `@/lib/fmtElapsed`, the one this tree hoisted after carrying three.
 *  • The TITLE is the caller's. `nodeTitle`'s four-tier ladder needs a page-owned name
 *    context, so re-deriving a face here would produce a DIFFERENT face from the spine's for
 *    the same step — the two-views-two-languages defect, one surface further along.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * THE TWO ABSENCES THAT ARE NOT BLANKS
 * ─────────────────────────────────────────────────────────────────────────────────────────
 *
 *  • ⚠ A STEP THAT DECLARED NO COUNT RENDERS NO COUNT SLOT AT ALL — never `0`, never a dash,
 *    and never prose (D-07 / `SEED-159`). N-8 records that the sketch's own run surface puts
 *    the SENTENCE `Summarized meeting notes` in the same slot as the COUNT `Found 12
 *    contracts`; drawing prose there re-introduces precisely the fabricated-figure failure
 *    D-07 exists to prevent — the thing `199-05` called *"the highest-consequence lie this
 *    phase could ship."* A declared `0` is the opposite case and DOES render: the step
 *    searched and found nothing, which is a measurement.
 *  • ⚠ THE NOUN IS THE STEP'S OWN AND ARRIVES ON THE WIRE. `312 docs matched` /
 *    `48 fields extracted` are DOMAIN sentences (`SEED-168`); this surface renders the pair
 *    verbatim and substitutes no word of its own.
 *  • THE DELIVERABLE IS THE CALLER'S TOO, and it is optional. Nothing on `workflow_phases`
 *    says which file a step produced, so inventing one here would be a fabricated claim. The
 *    page holds the run's file list and supplies it; absent ⇒ nothing renders.
 *
 * ⚠ ROW ORDER IS THE SERVER'S. The rows are rendered in the order given and are NOT re-sorted
 * — the same D-17/D-18 fence the library feeds carry. A client-side re-sort is a second
 * ordering authority, and two authorities disagree eventually.
 */
import { fmtElapsed } from "@/lib/fmtElapsed"
// The ONE run-terminal predicate in the tree (`lib/phaseState.ts`), imported rather than
// re-derived — `phaseDuration.ts` reads the same Set for the same reason, and a second
// definition of "the run is over" is how a header comes to contradict the page it heads.
import { TERMINAL_RUN_STATUSES } from "@/lib/phaseState"
import {
  clockTime,
  declaredCount,
  phaseRunFacts,
  runSpan,
  type PhaseTimingRow,
} from "@/components/workflows/phaseDuration"
import {
  countDeclared,
  HEADER_NOT_FINISHED,
  HEADER_SEPARATOR,
  HEADER_SPAN_NOT_RECORDED,
  HEADER_STILL_RUNNING,
  headerFinished,
  headerSpan,
  headerSpanSoFar,
  headerSteps,
  RECEIPT_LANDMARK_LABEL,
} from "@/components/workflows/receiptVocabulary"

export interface RunReceiptProps {
  /** The run's durable phase rows, IN THE ORDER THE SERVER GAVE THEM. */
  phases: readonly PhaseTimingRow[]
  /**
   * The step's human name. ⚠ THE CALLER'S, never re-derived here — `nodeTitle`'s ladder needs
   * a page-owned name context, and a second derivation would give the same step a different
   * face on this surface than on the spine.
   */
  titleOf: (slug: string) => string
  /**
   * The WORKFLOW RUN's status. ⚠ It is what separates a live tick from `did not finish` from
   * `paused, waiting on a person`, and none of the three is derivable from a phase row alone.
   */
  runStatus?: string | null
  /**
   * The file this step produced, if the caller holds one. ⚠ Nothing on `workflow_phases` says
   * which file a step produced, so an absent answer renders NOTHING — never a placeholder.
   */
  deliverableOf?: (slug: string) => string | null | undefined
  /** The instant to tick a still-running row against — hoist ONE per render (P-1). */
  now?: number
  /**
   * ⚠ `"summary"` RENDERS THE HEADER STRIP AND NO ROWS, AND IT EXISTS BECAUSE THE FULL RECEIPT
   * BECAME A DUPLICATE THE DAY THE RUN LOG SHIPPED.
   *
   * Seen in a browser: the log listed five steps with their durations, and this region listed
   * the same five steps with the same durations seven hundred pixels below it. That is the
   * defect this surface has already shipped once — its run band is `sr-only` today because an
   * operator reported the status appearing twice — arriving again in a new place.
   *
   * The HEADER is not a duplicate of anything: `Ran 57s · 5 steps · finished 19:55` is the only
   * statement on the page about the run AS A WHOLE that is derived from the steps that really
   * ran. So the strip survives and the rows go.
   *
   * ⚠ THE ROW RENDERER IS KEPT, NOT DELETED. `"full"` is still the default and still the tested
   * shape: nothing about D-06's nine arms or D-07's count rule is weakened, and a surface that
   * wants the whole receipt (a printable record, an audit view) can still ask for it. What
   * changed is which variant the run page mounts.
   */
  variant?: "full" | "summary"
}

export function RunReceipt({
  phases,
  titleOf,
  runStatus,
  deliverableOf,
  now = Date.now(),
  variant = "full",
}: RunReceiptProps) {
  // ⚠ THE SPAN IS DERIVED FROM THE PHASE TIMESTAMPS, NOT FROM A CLIENT CLOCK and not from
  // `workflow_runs.claimed_at` — `200-02` measured that column null on 0 of 149 completed
  // runs, so it anchors a live run and nothing else. `min(started_at) → max(completed_at)` is
  // what makes the header a measurement.
  const span = runSpan(phases)
  // ⚠ THE STRIP MUST NOT CLAIM A RUN HAS STOPPED WHILE IT IS RUNNING, AND IT DID.
  //
  // Found by driving a real run with a human-input step on 2026-08-20: with the run PAUSED on
  // its approval gate, this strip read *"Ran 42s · 3 steps · finished 22:15"* — beside a spine
  // whose second row was visibly waiting for an answer, and a page header that said `Running`.
  // Both figures were honest measurements of the STEPS (`runSpan` is min(started) →
  // max(completed) across the phase rows, and the first step really did complete at 22:15);
  // what was wrong is what the SENTENCES asserted about them. The header contradicted the
  // surface it heads.
  //
  // ⚠ IT READS THE RUN'S OWN STATUS, NOT THE PHASE ROWS. A "have all the steps finished?" test
  // over `phases` would be a second, weaker definition of terminal — it answers `true` for a
  // run that is between steps, which is exactly the state this defect appeared in. The run
  // says whether it is over; the phases say how long its steps took.
  const runIsOver = runStatus != null && TERMINAL_RUN_STATUSES.has(runStatus)
  const header = [
    span === null
      ? HEADER_SPAN_NOT_RECORDED
      : runIsOver
        ? headerSpan(fmtElapsed(span.ms))
        : headerSpanSoFar(fmtElapsed(span.ms)),
    headerSteps(phases.length),
    // ⚠ THE ORDER OF THESE TESTS IS THE CONTRACT. "Still running" outranks "no instant
    // recorded": a live run has no finish time because it has not finished, which is a
    // stronger and more useful statement than saying we do not hold one.
    !runIsOver
      ? HEADER_STILL_RUNNING
      : span === null
        ? HEADER_NOT_FINISHED
        : headerFinished(clockTime(span.finishedAtMs)),
  ]

  return (
    <section
      data-testid="run-receipt"
      aria-label={RECEIPT_LANDMARK_LABEL}
      className="flex min-w-0 flex-col gap-2"
    >
      <p
        data-testid="receipt-header"
        className="text-[12px] font-medium leading-relaxed text-foreground"
      >
        {header.map((atom, i) => (
          <span key={atom + String(i)}>
            {i > 0 && <span aria-hidden="true">{HEADER_SEPARATOR}</span>}
            <span data-testid={`receipt-header-atom-${i}`}>{atom}</span>
          </span>
        ))}
      </p>

      {variant === "summary" ? null : (
      <ol className="flex flex-col gap-1">
        {phases.map((row) => {
          const facts = phaseRunFacts(row, runStatus, now)
          // ⚠ READ FROM THE RESOLVER, NOT RE-TESTED HERE. `declaredCount` is the ONE arm that
          // knows `0` from absence, and a second `typeof` check at this call site would be a
          // second place to get it wrong.
          const count = declaredCount(row)
          const deliverable = deliverableOf?.(row.slug)
          const hasDeliverable = typeof deliverable === "string" && deliverable.trim().length > 0

          return (
            <li
              key={row.slug}
              data-testid={`receipt-row-${row.slug}`}
              data-outcome={facts.outcome}
              className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5 text-[12px] leading-relaxed"
            >
              <span
                data-testid="receipt-row-title"
                className="min-w-0 flex-1 truncate text-foreground"
              >
                {titleOf(row.slug)}
              </span>
              <span data-testid="receipt-row-outcome" className="text-muted-foreground">
                {facts.outcome}
              </span>
              <span data-testid="receipt-row-time" className="tabular-nums text-muted-foreground">
                {facts.timing.reading}
              </span>
              {count && (
                <span data-testid="receipt-row-count" className="text-muted-foreground">
                  {countDeclared(count.count, count.noun)}
                </span>
              )}
              {hasDeliverable && (
                <span data-testid="receipt-row-deliverable" className="truncate text-muted-foreground">
                  {deliverable}
                </span>
              )}
            </li>
          )
        })}
      </ol>
      )}
    </section>
  )
}

export default RunReceipt
