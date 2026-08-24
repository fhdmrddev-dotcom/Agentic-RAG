/**
 * Phase 200-05 Task 1 (DES-02 / D-06 / D-07 / D-09) — THE ONE PLACE A WIRE TRUTH BECOMES A
 * RENDERED DURATION FACT.
 *
 * `200-02` put four new fields on the wire — `started_at`, `completed_at`, `step_count`,
 * `step_noun` — and every one of them can be ABSENT for a reason that is itself a fact.
 * This module is where those absences are turned into distinct readings, and it is a
 * separate leaf for a measured reason: `panel/phaseStatusMeta.ts` (the other candidate
 * home) is UNPINNED — no dedicated suite, exercised only transitively through
 * `PhaseTimeline` / `PhaseCard` — and D-06's arms are the highest-consequence logic in this
 * phase. A new leaf is pinned in the commit that creates it (the 196-05 / 196-07 rule:
 * *"an unpinned file is not a lightly-guarded one, it is an UNGUARDED one"*).
 *
 * ── ⚠ IDIOM-2: ABSENCE GETS ITS OWN ARM, AND A BOOLEAN CANNOT EXPRESS IT ───────────────
 *
 * This repo has now learned the same lesson three times. `library/runFacts.ts` needed a
 * FOURTH arm after CR-01, because folding an absence together with a negative printed
 * *"Never run"* about workflows that really had run. `DecisionsList.tsx` needed a THIRD
 * under D-20, because an absent readiness was rendering as a pass. Here the twin cases are:
 *
 *   • a `skipped` step  → it NEVER RAN. An affirmative fact; correct silence.
 *   • a historic row    → its TIME WAS NOT RECORDED. We hold no fact at all.
 *
 * Those are DIFFERENT RENDERS of what a careless reader would call "no duration", and the
 * reason there is no backfill is the same shape of honesty: a value derived from
 * `updated_at` would be right for some rows and silently wrong for others, with nothing on
 * the row to say which (D-05).
 *
 * ⚠ THE COMPARISONS ARE EXPLICIT, NEVER TRUTHINESS. `=== undefined` (the key was absent
 * from the payload) is tested separately from `=== null` (the key arrived empty), because
 * a truthiness test folds `false`, `null`, `undefined` — and, for a count, `0` — into ONE
 * answer, and these arms turn on them being several.
 *
 * ── ⚠ IDIOM-3: A COUNT OF `0` IS A FACT, NOT AN ABSENCE ────────────────────────────────
 *
 * `step_count === 0` is a REAL measurement — the step searched and found nothing — and it
 * renders as the fact it is. `step_count == null` means the phase type declares no count at
 * all (four of the seven do), and it renders NOTHING: no `0`, no dash, no prose (D-07 /
 * `SEED-159` / N-8). The arm below is therefore `typeof === "number"`.
 *
 * ⚠ THE TWO FORBIDDEN SHAPES ARE NOT SPELLED HERE, and that is the 187-24 rule rather than
 * coyness: this plan's acceptance greps this file for a zero-coalesce and for a truthiness
 * test on the count, and a docblock quoting either needle makes its own guard read `1`
 * instead of `0`. It did, on the first draft. Both are reproduced ONCE, in
 * `phaseDuration.test.ts`'s POSITIVE CONTROL, which is the one place they cannot be
 * mistaken for live code — and where they are shown to really destroy the distinction.
 *
 * ── WHAT THIS MODULE DELIBERATELY DOES NOT DO ─────────────────────────────────────────
 *
 *  • It spells NO user-visible string. Every word comes from `receiptVocabulary.ts` — the
 *    same split `cardFace.ts` made for the state axis, one field over: the DECISION lives
 *    here, the WORDS live there.
 *  • It formats NO duration of its own. `@/lib/fmtElapsed` is THE formatter (this tree
 *    carried three before 194.1-06 hoisted it); a fourth is the thing not to write.
 *  • It grows NO second DB-status → client-status mapping. `@/lib/phaseState`'s
 *    `phaseStatusFromDb` is the one, and `api.ts:4172`'s docblock says so outright. Its
 *    own-property guard and its `unknown` fail-CLOSED are inherited here for free.
 *  • It holds NO run-terminal predicate of its own. `TERMINAL_RUN_STATUSES` is a `Set` in
 *    `@/lib/phaseState`, pinned at size 4 by that module's suite.
 *  • `now` is a PARAMETER with a `Date.now()` default (`runFacts.ts`'s exact signature, for
 *    `relativeChanged.ts`'s exact reason): the page hoists ONE instant per render so two
 *    rows cannot straddle a boundary, and a suite injects a fixed instant with no clock
 *    mock.
 */
import { fmtElapsed } from "@/lib/fmtElapsed"
import { phaseStatusFromDb, TERMINAL_RUN_STATUSES } from "@/lib/phaseState"
import { own } from "./ownProperty"
import {
  BRANCH_NOT_TAKEN,
  BRANCH_TAKEN,
  OUTCOME_DID_NOT_FINISH,
  OUTCOME_FAILED,
  OUTCOME_FINISHED,
  OUTCOME_INTERRUPTED,
  OUTCOME_NEVER_RAN,
  OUTCOME_NOT_REACHED,
  OUTCOME_PAUSED,
  OUTCOME_STILL_RUNNING,
  OUTCOME_UNKNOWN,
  TIME_NOT_RECORDED,
  timeFailed,
  timeInterrupted,
  timeRan,
  timeRunning,
} from "./receiptVocabulary"

// ── The read shape ──────────────────────────────────────────────────────────────────────

/**
 * The subset of `api.ts`'s `WorkflowRunPhase` this module reads.
 *
 * ⚠ IT IS A READ SHAPE, NOT A SECOND HOME FOR THE WIRE TYPE — the `PhaseSpecJSON`
 * precedent, one file over. Declaring it structurally means this leaf takes **zero runtime
 * imports from `@/lib/api`**, so `196-08`'s failure mode (nine suites throwing at mount
 * because a `vi.mock("@/lib/api")` factory did not declare a newly-added export) is
 * unreachable from here by construction rather than by care. `WorkflowRunPhase` satisfies
 * it structurally; the compiler checks that at every call site.
 */
export interface PhaseTimingRow {
  slug: string
  status: string
  started_at?: string | null
  completed_at?: string | null
  step_count?: number | null
  step_noun?: string | null
}

/**
 * The nine readings, as a DISCRIMINATED UNION rather than a status string plus an `if`.
 *
 * ⚠ THE TYPE IS DOING THE WORK, exactly as `RunFact`'s does. The three silent arms carry
 * `word: null` and NOTHING ELSE, so a consumer cannot reach a duration through them even by
 * mistake — an absence is structurally unreadable as a time.
 */
export type PhaseTiming =
  /** `pending` — the run never got this far. */
  | { kind: "not-started"; reading: string }
  /** `skipped` — routed around. It NEVER RAN, which is a fact, not a missing value. */
  | { kind: "never-ran"; reading: string }
  /** A status this build does not recognise. ⚠ NEVER success by default (the T-15 rule). */
  | { kind: "unknown"; reading: string }
  /** `active` under a live run, with a readable `started_at` — a tick against `now`. */
  | { kind: "running"; reading: string }
  /**
   * `active` under a TERMINAL run. ⚠ ADDED BY MEASUREMENT (RESEARCH §B4 / A3): the engine
   * only terminalizes the interrupted phase on a cancellation, so a crash leaves this row
   * behind. Without this arm it renders a live-ticking clock forever — `BUG-260610-01`'s
   * symptom re-created by the surface built to fix it.
   */
  | { kind: "unfinished"; reading: string }
  /**
   * `active` under a PAUSED run. ⚠ ADDED BY WAVE 3, which made `pause_run` the first writer
   * of `workflow_runs.status = 'paused'` in this project's history. Nothing failed, nothing
   * ended, and the step HAS started — so this arm is neither `unfinished` nor `not-started`.
   */
  | { kind: "paused"; reading: string }
  /** A terminal step with BOTH timestamps readable — the duration itself. */
  | { kind: "ran"; reading: string }
  /** `cancelled` with both timestamps — how long it got, and that it was cut short. */
  | { kind: "interrupted"; reading: string }
  /**
   * Terminal, but the timestamps are absent or unreadable — a HISTORIC row, written before
   * migration 121 existed. ⚠ A DIFFERENT RENDER FROM `never-ran`: that one says it did not
   * run, this one says we do not hold the time. Folding them is the D-06 defect.
   */
  | { kind: "not-recorded"; reading: string }

/**
 * Everything the run tense knows about ONE step. The caller owns the join.
 *
 * ⚠ `timing.reading` IS THE ROW'S ONE READING and `outcome` is its short label — D-09's own
 * shape, where `1.8s` and `never ran (skipped)` occupy THE SAME SLOT. Nothing here is a
 * "duration or nothing" field a caller could render beside a contradicting word.
 */
export interface PhaseRunFacts {
  timing: PhaseTiming
  /** The step's own past-tense outcome word — never a status slug interpolated into copy. */
  outcome: string
  /** `null` when this phase type declared no count. ⚠ `{count: 0}` is NOT null. */
  count: { count: number; noun: string } | null
  /**
   * Whether the run took THIS step's on-fail branch. ⚠ OPTIONAL, AND ITS ABSENCE IS A THIRD
   * STATE: `undefined` means the caller does not hold the fact, which is not the same as
   * `false`. `runFactsBySlug` below never sets it — the join between a definition's
   * `skip_to_phase` and what a run actually did belongs to the PAGE, exactly as
   * `WorkflowCanvas.runState`'s docblock requires.
   */
  branchTaken?: boolean
}

/**
 * The whole run tense, in ONE optional prop.
 *
 * ⚠ ONE MEMBER, NOT TWO, AND THAT IS THE POINT. The spine's absent-prop render must be
 * BYTE-IDENTICAL to its authoring render, and a component with two independent optional run
 * props has four states to prove instead of two. Bundling the per-step lookup with the
 * already-worded total also keeps the house rule intact: *"the PAGE owns the join, the
 * reading and the words"* — this component derives nothing from a run it was never given.
 */
export interface SpineRunTense {
  /** Per-step facts. `undefined` for a slug the run never mentioned. */
  factsOf: (slug: string) => PhaseRunFacts | undefined
  /**
   * The run's total runtime, ALREADY WORDED by `receiptVocabulary.ts`. `null` when no phase
   * row carried a readable pair — the caller then says so; this component never prints `0s`.
   */
  total: string | null
}

// ── Timestamp reading ───────────────────────────────────────────────────────────────────

/**
 * An ISO instant, or `null` for every shape that is not one.
 *
 * ⚠ EXPORTED SINCE PHASE 200's TRANSCRIPT, and exported rather than copied for the reason
 * the paragraph below states: the "unparseable ⇒ absence, never zero" rule is the whole
 * value of this function, and a second private copy beside a second consumer is a second
 * place for it to be got wrong quietly. It stays the ONLY string→instant door in this tree.
 *
 * ⚠ AN UNPARSEABLE STRING IS AN ABSENCE, NOT A ZERO. `Date.parse("")` is `NaN` and
 * `new Date(NaN).getTime()` is `NaN`; letting either through would compute a duration
 * against the epoch and print a number nothing measured. `relativeChanged.ts` reaches the
 * same conclusion for the same reason.
 */
export function readInstant(raw: string | null | undefined): number | null {
  if (raw === undefined || raw === null) return null
  const ms = Date.parse(raw)
  return Number.isFinite(ms) ? ms : null
}

// ── The status-keyed word tables ────────────────────────────────────────────────────────

/**
 * The past-tense OUTCOME word per CLIENT status (the union `phaseStatusFromDb` produces).
 *
 * ⚠ READ THROUGH `own()`, NOT `TABLE[key] ?? fallback`. This is a plain object literal, so
 * it INHERITS `constructor`, `toString`, `__proto__` and friends — an inherited member is
 * never nullish, so a coalesce does not fire and hands back a FUNCTION typed as a string.
 * `workflow_phases.slug` is unconstrained `text` (migration 121 declined `SEED-143`'s CHECK
 * with a recorded trigger), so a `constructor`-slugged phase really can reach this layer.
 * The guard is the WR-04 mitigation, and it was measured RED at five earlier sites in this
 * tree before it was written at any of them.
 */
const OUTCOME_BY_STATUS: Record<string, string> = {
  pending: OUTCOME_NOT_REACHED,
  running: OUTCOME_STILL_RUNNING,
  done: OUTCOME_FINISHED,
  failed: OUTCOME_FAILED,
  skipped: OUTCOME_NEVER_RAN,
  cancelled: OUTCOME_INTERRUPTED,
  "recorded-not-sent": OUTCOME_FINISHED,
  unknown: OUTCOME_UNKNOWN,
}

// ── The resolver ────────────────────────────────────────────────────────────────────────

/**
 * D-06's arms, resolved for ONE phase row.
 *
 * @param row       the wire row. Only its five timing/count fields are read.
 * @param runStatus the WORKFLOW RUN's status, or `null`/`undefined` when the caller does
 *                  not hold one. ⚠ It is what separates `running` from `unfinished` from
 *                  `paused`, and none of the three is derivable from the phase row alone.
 * @param now       the instant to tick against — hoist ONE per render (P-1).
 */
export function phaseTiming(
  row: PhaseTimingRow,
  runStatus?: string | null,
  now: number = Date.now(),
): PhaseTiming {
  const status = phaseStatusFromDb(row.status)
  const startedAt = readInstant(row.started_at)
  const completedAt = readInstant(row.completed_at)

  // (1) It has not run, and it did not run. Two arms, two reasons, two different sentences
  // — kept apart because folding an absence together with a negative is THE defect.
  if (status === "pending") return { kind: "not-started", reading: OUTCOME_NOT_REACHED }
  if (status === "skipped") return { kind: "never-ran", reading: OUTCOME_NEVER_RAN }

  // (2) A status this build has never heard of. NEVER a time, never a success.
  if (status === "unknown") return { kind: "unknown", reading: OUTCOME_UNKNOWN }

  // (3) Still marked active. WHICH reading that earns is a RUN-level question, and the run
  // status is the only thing that answers it — read HERE and nowhere earlier, so the two
  // arms above are provably untouched by it.
  if (status === "running") {
    if (runStatus != null && TERMINAL_RUN_STATUSES.has(runStatus)) {
      return { kind: "unfinished", reading: OUTCOME_DID_NOT_FINISH }
    }
    if (runStatus === "paused") return { kind: "paused", reading: OUTCOME_PAUSED }
    if (startedAt === null) return { kind: "not-recorded", reading: TIME_NOT_RECORDED }
    return { kind: "running", reading: timeRunning(fmtElapsed(Math.max(0, now - startedAt))) }
  }

  // (4) Terminal. The duration exists only when BOTH anchors are readable; a historic row
  // (both null, pre-migration-121) says so in its own words rather than showing nothing.
  if (startedAt === null || completedAt === null) {
    return { kind: "not-recorded", reading: TIME_NOT_RECORDED }
  }
  const elapsed = fmtElapsed(Math.max(0, completedAt - startedAt))
  if (status === "cancelled") return { kind: "interrupted", reading: timeInterrupted(elapsed) }
  if (status === "failed") return { kind: "ran", reading: timeFailed(elapsed) }
  return { kind: "ran", reading: timeRan(elapsed) }
}

/**
 * D-07's arm. `null` means THIS PHASE TYPE DECLARED NO COUNT — render nothing at all.
 *
 * ⚠ `0` IS A DECLARED FACT AND MUST SURVIVE THIS FUNCTION. The test is `typeof === "number"`
 * precisely so that a step which searched and found nothing still says so.
 *
 * ⚠ A count with no noun renders NOTHING rather than a bare number. The wire contract is
 * that `step_noun` is non-null iff `step_count` is, so this arm is defensive — but a lone
 * `312` on a receipt is a figure with no subject, which is a worse claim than silence.
 */
export function declaredCount(row: PhaseTimingRow): { count: number; noun: string } | null {
  if (typeof row.step_count !== "number") return null
  const noun = row.step_noun
  if (typeof noun !== "string" || noun.trim().length === 0) return null
  return { count: row.step_count, noun }
}

/**
 * The step's short outcome LABEL.
 *
 * ⚠ IT IS DERIVED FROM THE TIMING ARM FIRST, NOT FROM THE STATUS ALONE, and that ordering
 * is the whole point. A phase row still reading `active` under a run that ended has the
 * status of a running step and the OUTCOME of one that never landed; labelling it *still
 * running* beside a reading of *did not finish* would put two contradicting claims on one
 * row — which is how a receipt stops being a receipt.
 */
function outcomeFor(timing: PhaseTiming, status: string): string {
  if (timing.kind === "unfinished") return OUTCOME_DID_NOT_FINISH
  if (timing.kind === "paused") return OUTCOME_PAUSED
  return own(OUTCOME_BY_STATUS, phaseStatusFromDb(status)) ?? OUTCOME_UNKNOWN
}

/** Everything the run tense knows about one step, in one call. */
export function phaseRunFacts(
  row: PhaseTimingRow,
  runStatus?: string | null,
  now: number = Date.now(),
): PhaseRunFacts {
  const timing = phaseTiming(row, runStatus, now)
  return {
    timing,
    outcome: outcomeFor(timing, row.status),
    count: declaredCount(row),
  }
}

/**
 * A slug → facts lookup, in the shape the spine's optional run prop takes.
 *
 * ⚠ THE MAP IS READ THROUGH `own()` FOR THE SAME REASON THE WORD TABLE IS, and here the
 * hazard is live rather than theoretical: the KEYS are `workflow_phases.slug` values, which
 * the column does not constrain. A phase slugged `constructor` fed to a bare index returns
 * `Object`'s constructor — a FUNCTION typed as `PhaseRunFacts` — and React then refuses the
 * function-valued child and renders NOTHING AT ALL, which is how the eighth sink of this
 * class was found in `200-04` (worse than the predicted `[Function Object]`, because
 * nothing appears on screen to say anything went wrong).
 */
export function runFactsBySlug(
  rows: readonly PhaseTimingRow[],
  runStatus?: string | null,
  now: number = Date.now(),
): (slug: string) => PhaseRunFacts | undefined {
  // ⚠ A PLAIN OBJECT LITERAL ON PURPOSE, so `own()` below is LOAD-BEARING rather than
  // decorative. A null-prototype map would remove the hazard silently and leave the guard
  // unfalsifiable — and this suite's positive control proves the bare index really does
  // hand back a function for `constructor`, which is what makes the mitigation a
  // measurement instead of ceremony.
  const map: Record<string, PhaseRunFacts> = {}
  for (const row of rows) map[row.slug] = phaseRunFacts(row, runStatus, now)
  return (slug: string) => own(map, slug)
}

// ── The transcript's entry order (Phase 200 · the run log) ─────────────────────────────

/** One step, placed (or not) on the run's clock. */
export interface TranscriptEntry {
  slug: string
  /**
   * Milliseconds since the run's zero, or `null` for a row carrying no readable instant.
   * ⚠ `0` IS A REAL POSITION — the first step starts at the anchor — so the absence arm is
   * `null` and is tested as `null`, never as a falsy value.
   */
  offsetMs: number | null
  /** The row's index in the SERVER's order. Ties break on it and on nothing else. */
  order: number
}

// ── The derivation ──────────────────────────────────────────────────────────────────────

/**
 * The run's rows, ordered as a log: timed rows by their instant, untimed rows appended in
 * the server's own order.
 *
 * ⚠ A ROW'S INSTANT IS ITS `started_at`, AND THIS REVERSES AN EARLIER DECISION IN THIS SAME
 * FILE. The first version stamped a finished step at its `completed_at`, reasoning that *"a
 * log entry is stamped when the thing became known"*. That was sound **for a line carrying no
 * duration**, and the line now carries one: with a duration on the right, a completion stamp
 * on the left makes the two numbers describe overlapping facts, and on the very first step —
 * which starts at the anchor — they are the SAME STRING. Seen in a browser as
 * `11s · Pull usage and adoption data · Complete · 11s`.
 *
 * Start-stamp plus duration are COMPLEMENTARY: together they state the whole interval, the
 * column reads as a timeline (`0s, 11s, 19s, 26s, 33s`), and the gaps BETWEEN steps become
 * visible — which a completion stamp hides. The reversal is recorded rather than quietly
 * applied, because the original reasoning is still correct about the thing it was reasoning
 * about.
 *
 * ⚠ NOTHING IS SYNTHESISED TO MAKE THE LIST REGULAR. A `done` row with no `completed_at` is
 * a historic row (pre-migration-121) and keeps whatever instant it does have; a row with
 * neither is untimed. Inventing either would be the backfill D-05 refuses.
 */
export function transcriptEntries(rows: readonly PhaseTimingRow[]): TranscriptEntry[] {
  const anchor = runAnchorMs(rows)
  const timed: TranscriptEntry[] = []
  const untimed: TranscriptEntry[] = []

  rows.forEach((row, order) => {
    const at = readInstant(row.started_at) ?? readInstant(row.completed_at)
    if (at === null || anchor === null) {
      untimed.push({ slug: row.slug, offsetMs: null, order })
      return
    }
    timed.push({ slug: row.slug, offsetMs: Math.max(0, at - anchor), order })
  })

  timed.sort((a, b) => {
    // Both offsets are numbers in this branch; the guards above are what guarantee it.
    const delta = (a.offsetMs ?? 0) - (b.offsetMs ?? 0)
    return delta !== 0 ? delta : a.order - b.order
  })
  return [...timed, ...untimed]
}

// ── The run span (D-09's header) ────────────────────────────────────────────────────────

/**
 * The run's true span: `min(started_at) → max(completed_at)` ACROSS THE PHASE ROWS.
 *
 * ⚠ THIS IS DERIVED FROM THE PHASES, NOT FROM A CLIENT CLOCK AND NOT FROM
 * `workflow_runs.claimed_at`. `200-02` measured `claimed_at` null on **0 of 149 completed
 * runs**, so it is a usable anchor for a live run and a useless one for a finished one; the
 * phase rows now carry both instants, which is strictly better and is what makes every
 * figure on the receipt a MEASURED FACT rather than a claim.
 *
 * `null` when no row carries a readable pair — a run whose steps were all routed around, or
 * one that predates migration 121. The header then says so in words; it never prints `0s`.
 */
export function runSpan(
  rows: readonly PhaseTimingRow[],
): { ms: number; startedAtMs: number; finishedAtMs: number } | null {
  const first = runAnchorMs(rows)
  let last: number | null = null
  for (const row of rows) {
    const c = readInstant(row.completed_at)
    if (c !== null && (last === null || c > last)) last = c
  }
  if (first === null || last === null) return null
  return { ms: Math.max(0, last - first), startedAtMs: first, finishedAtMs: last }
}

/**
 * The run's ZERO — `min(started_at)` across the phase rows, and nothing else.
 *
 * ⚠ IT IS EXTRACTED FROM `runSpan` RATHER THAN COPIED BESIDE IT, and the distinction is the
 * reason this function exists at all. `runSpan` answers *"how long did the whole thing
 * take"* and therefore returns `null` the moment no row has COMPLETED — which is true of
 * every run that is still going. A transcript needs the opposite property: it is at its most
 * useful mid-run, and its clock starts at the first step that STARTED whether or not
 * anything has finished. Re-deriving `min(started_at)` at that call site would have been a
 * second home for the run's own zero, and two homes for a zero disagree exactly when a row
 * arrives out of order — which is the one case a reader would never suspect.
 *
 * `null` when NO row carries a readable `started_at`: a run whose steps were all routed
 * around, one that has not been claimed, or any row written before migration 121. The caller
 * then says so in words — it never substitutes a client clock, and it never prints `00:00`
 * for an instant nothing measured (the D-05 no-backfill rule, one field over).
 */
export function runAnchorMs(rows: readonly PhaseTimingRow[]): number | null {
  let first: number | null = null
  for (const row of rows) {
    const s = readInstant(row.started_at)
    if (s !== null && (first === null || s < first)) first = s
  }
  return first
}

/**
 * The 24-hour clock reading for the header's `finished` atom.
 *
 * ⚠ `Intl.DateTimeFormat` RATHER THAN A HAND-ROLLED PAD, deliberately: this module formats
 * no duration of its own (rule 5 in `receiptVocabulary.ts`) and a private two-digit padder
 * here would be the first step back toward the fourth formatter 194.1-06 removed. The
 * locale is pinned so the reading cannot drift with the browser's, and `hour12` is off
 * because the receipt's other figures are all elapsed times.
 */
const CLOCK = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
})

/**
 * The RUN CLOCK — a position in a run, as `mm:ss` (or `h:mm:ss` past an hour).
 *
 * ⚠ IT IS NOT A FOURTH `fmtElapsed`, AND THE DISTINCTION IS THE CONTRACT RATHER THAN THE OUTPUT.
 * `lib/fmtElapsed.ts` renders a HUMAN DURATION PHRASE — `12s`, `4m 12s`, `1h 06m` — and its own
 * docblock names a fourth one as *"the thing NOT to write"*. This renders a FIXED-WIDTH CLOCK
 * POSITION for a gutter, where every row must occupy the same columns and read as a stopwatch:
 * `00:00`, `00:42`, `01:15`. A duration phrase cannot do that (`0s` and `1m 10s` are different
 * widths and different shapes), and a clock cannot do what a duration phrase does (`00:12` beside
 * a step reads as a time of day, not as "it took twelve seconds").
 *
 * Two formatters for two contracts. The rule `fmtElapsed` states is against a second way of
 * saying the SAME thing, and this says a different thing — so every DURATION on this surface
 * still goes through `fmtElapsed`, and only the gutter goes through here.
 */
export function runClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const seconds = String(total % 60).padStart(2, "0")
  const minutes = Math.floor(total / 60)
  if (minutes < 60) return `${String(minutes).padStart(2, "0")}:${seconds}`
  return `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, "0")}:${seconds}`
}

export function clockTime(ms: number): string {
  return CLOCK.format(new Date(ms))
}

// ── The branch reading (BS-MR-03, run tense ONLY) ───────────────────────────────────────

/**
 * The word for one on-fail branch, given whether the run took it.
 *
 * ⚠ THE CALLER DECIDES WHETHER IT WAS TAKEN; THIS FUNCTION ONLY WORDS THE ANSWER. That is
 * the `WorkflowCanvas.runState` rule verbatim — *"the PAGE owns the join, the reading and
 * the words"* — and it is why the spine derives nothing from a run it was never given.
 */
export function branchReading(taken: boolean): string {
  return taken ? BRANCH_TAKEN : BRANCH_NOT_TAKEN
}
