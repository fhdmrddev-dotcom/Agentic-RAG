/**
 * Phase 200-05 Task 1 (DES-02 / D-06 / D-07) — `phaseDuration.ts`'s arms, RED-first.
 *
 * WHAT WOULD BE UNGUARDED WITHOUT THIS FILE:
 *  • the NINE discriminated arms, and specifically that `never ran` and `time not recorded`
 *    are DIFFERENT RENDERS — the case a boolean cannot express and the one this repo has
 *    now got wrong twice (`runFacts.ts` CR-01, `DecisionsList` D-20);
 *  • that a declared `0` renders as the fact it is while an ABSENT count renders nothing —
 *    the `SEED-159` / D-07 split, which `step_count ?? 0` silently destroys;
 *  • that a `constructor`-slugged phase resolves NO FUNCTION, with a positive control
 *    proving the unguarded form really is broken on that key (WR-04, sink nine);
 *  • that `now` is injectable, so no arm needs a clock mock to be falsified.
 */
import { describe, it, expect } from "vitest"
import {
  branchReading,
  clockTime,
  declaredCount,
  phaseRunFacts,
  phaseTiming,
  readInstant,
  runAnchorMs,
  runFactsBySlug,
  runSpan,
  transcriptEntries,
  type PhaseTimingRow,
} from "./phaseDuration"
import {
  BRANCH_NOT_TAKEN,
  BRANCH_TAKEN,
  OUTCOME_FAILED,
  OUTCOME_FINISHED,
  OUTCOME_INTERRUPTED,
  OUTCOME_NEVER_RAN,
  OUTCOME_NOT_REACHED,
  OUTCOME_STILL_RUNNING,
  OUTCOME_UNKNOWN,
  OUTCOME_DID_NOT_FINISH,
  TIME_NOT_RECORDED,
  OUTCOME_PAUSED,
} from "./receiptVocabulary"

/** A fixed instant, injected rather than mocked — the whole reason `now` is a parameter. */
const NOW = Date.parse("2026-08-19T14:22:00.000Z")

function row(over: Partial<PhaseTimingRow> = {}): PhaseTimingRow {
  return { slug: "gather", status: "completed", ...over }
}

describe("phaseTiming — D-06's arms, each a DISTINCT reading", () => {
  it("ARM 1 — `pending` reads `not reached`: the run never got this far", () => {
    const t = phaseTiming(row({ status: "pending" }), "running", NOW)
    expect(t.kind).toBe("not-started")
    expect(t.reading).toBe(OUTCOME_NOT_REACHED)
  })

  it("ARM 2 — `skipped` reads NEVER RAN, which is a fact rather than an absence", () => {
    const t = phaseTiming(row({ status: "skipped" }), "completed", NOW)
    expect(t.kind).toBe("never-ran")
    // D-09's worked example puts exactly this sentence where a duration would go.
    expect(t.reading).toBe(OUTCOME_NEVER_RAN)
    expect(phaseRunFacts(row({ status: "skipped" }), "completed", NOW).outcome).toBe(
      OUTCOME_NEVER_RAN,
    )
  })

  it("ARM 3 — an unrecognised status is `unknown` and NEVER a success (the T-15 rule)", () => {
    const t = phaseTiming(row({ status: "teleported" }), "running", NOW)
    expect(t.kind).toBe("unknown")
    expect(t.reading).toBe(OUTCOME_UNKNOWN)
    expect(phaseRunFacts(row({ status: "teleported" }), "running", NOW).outcome).toBe(
      OUTCOME_UNKNOWN,
    )
  })

  it("ARM 4 — `active` under a LIVE run ticks from `started_at` against the injected now", () => {
    const t = phaseTiming(
      row({ status: "active", started_at: new Date(NOW - 12_000).toISOString() }),
      "running",
      NOW,
    )
    expect(t.kind).toBe("running")
    expect(t.reading).toBe("12s so far")
  })

  it("ARM 5 — `active` under a TERMINAL run reads `did not finish`, never a live clock", () => {
    // RESEARCH §B4: the engine only terminalizes the interrupted phase on a cancellation, so
    // a crash really does leave this row. Without the arm the reading below would be a
    // forever-ticking duration — `BUG-260610-01`'s symptom on the surface built to fix it.
    const r = row({ status: "active", started_at: new Date(NOW - 900_000).toISOString() })
    for (const runStatus of ["failed", "completed", "cancelled", "timed_out"]) {
      const t = phaseTiming(r, runStatus, NOW)
      expect(t.kind).toBe("unfinished")
      expect(t.reading).toBe(OUTCOME_DID_NOT_FINISH)
    }
  })

  it("ARM 6 — `active` under a PAUSED run is its OWN arm (the state wave 3 created)", () => {
    const t = phaseTiming(
      row({ status: "active", started_at: new Date(NOW - 60_000).toISOString() }),
      "paused",
      NOW,
    )
    expect(t.kind).toBe("paused")
    expect(t.reading).toBe(OUTCOME_PAUSED)
    // ⚠ 200-03's binding constraint: it may not be spelled as any of these three.
    expect(t.reading.toLowerCase()).not.toContain("stopped")
    expect(t.reading.toLowerCase()).not.toContain("failed")
    expect(t.reading.toLowerCase()).not.toContain("waiting to start")
    // And it is NOT the same reading as a crashed step or an unstarted one.
    expect(t.reading).not.toBe(OUTCOME_DID_NOT_FINISH)
    expect(t.kind).not.toBe("not-started")
  })

  it("ARM 7 — `completed` with both timestamps is a plain duration", () => {
    const t = phaseTiming(
      row({
        status: "completed",
        started_at: "2026-08-19T14:00:00.000Z",
        completed_at: "2026-08-19T14:02:04.000Z",
      }),
      "completed",
      NOW,
    )
    expect(t.kind).toBe("ran")
    expect(t.reading).toBe("2m 04s")
  })

  it("ARM 8 — `cancelled` with both timestamps reads `ran Ns, interrupted`", () => {
    const t = phaseTiming(
      row({
        status: "cancelled",
        started_at: "2026-08-19T14:00:00.000Z",
        completed_at: "2026-08-19T14:00:08.000Z",
      }),
      "cancelled",
      NOW,
    )
    expect(t.kind).toBe("interrupted")
    expect(t.reading).toBe("ran 8s, interrupted")
  })

  it("ARM 9 — a HISTORIC row (`completed`, both timestamps NULL) reads `time not recorded`", () => {
    const t = phaseTiming(
      row({ status: "completed", started_at: null, completed_at: null }),
      "completed",
      NOW,
    )
    expect(t.kind).toBe("not-recorded")
    expect(t.reading).toBe(TIME_NOT_RECORDED)
  })

  it("⚠ THE D-06 HEADLINE — `never ran` and `time not recorded` are DIFFERENT RENDERS", () => {
    const skipped = phaseRunFacts(row({ status: "skipped" }), "completed", NOW)
    const historic = phaseRunFacts(
      row({ status: "completed", started_at: null, completed_at: null }),
      "completed",
      NOW,
    )
    // Different arms.
    expect(skipped.timing.kind).not.toBe(historic.timing.kind)
    // Different rendered sentences — and neither is the other's.
    expect(skipped.timing.reading).toBe(OUTCOME_NEVER_RAN)
    expect(historic.timing.reading).toBe(TIME_NOT_RECORDED)
    expect(skipped.timing.reading).not.toBe(historic.timing.reading)
    expect(skipped.outcome).not.toBe(historic.outcome)
    // ⚠ AND A BOOLEAN CANNOT EXPRESS EITHER PAIR. `never ran` / `not reached` / `time not
    // recorded` are THREE different facts, and every one of them has "no duration to show".
    // A `hasDuration` bit collapses all three into ONE answer — precisely the fold
    // `runFacts.ts` shipped once (CR-01) and `DecisionsList` shipped once (D-20).
    const pending = phaseRunFacts(row({ status: "pending" }), "completed", NOW)
    const asBoolean = [skipped, historic, pending].map((f) => /\d/.test(f.timing.reading))
    expect(new Set(asBoolean).size).toBe(1)
    const asReadings = new Set([skipped, historic, pending].map((f) => f.timing.reading))
    expect(asReadings.size).toBe(3)
  })

  it("ARM 7b — a `failed` step that DID run states the outcome first, then the figure", () => {
    const t = phaseTiming(
      row({
        status: "failed",
        started_at: "2026-08-19T14:00:00.000Z",
        completed_at: "2026-08-19T14:00:04.000Z",
      }),
      "failed",
      NOW,
    )
    expect(t.kind).toBe("ran")
    expect(t.reading).toBe("stopped after 4s")
    // ⚠ It must not read as a plain duration — that is how a failure gets skimmed as a pass.
    expect(t.reading).not.toBe("4s")
  })

  it("no two of the nine arms produce the same reading for the same duration", () => {
    const started = new Date(NOW - 4000).toISOString()
    const readings = [
      phaseTiming(row({ status: "pending" }), "running", NOW),
      phaseTiming(row({ status: "skipped" }), "completed", NOW),
      phaseTiming(row({ status: "teleported" }), "running", NOW),
      phaseTiming(row({ status: "active", started_at: started }), "running", NOW),
      phaseTiming(row({ status: "active", started_at: started }), "failed", NOW),
      phaseTiming(row({ status: "active", started_at: started }), "paused", NOW),
      phaseTiming(
        row({ status: "completed", started_at: "2026-08-19T14:00:00.000Z", completed_at: "2026-08-19T14:00:04.000Z" }),
        "completed",
        NOW,
      ),
      phaseTiming(
        row({ status: "cancelled", started_at: "2026-08-19T14:00:00.000Z", completed_at: "2026-08-19T14:00:04.000Z" }),
        "cancelled",
        NOW,
      ),
      phaseTiming(row({ status: "completed", started_at: null, completed_at: null }), "completed", NOW),
    ]
    expect(new Set(readings.map((r) => r.kind)).size).toBe(9)
    expect(new Set(readings.map((r) => r.reading)).size).toBe(9)
  })

  it("an ABSENT key and a NULL value are tested separately, never by truthiness", () => {
    // `undefined` (the key never arrived) and `null` (it arrived empty) must land on the
    // same honest arm — but they are compared explicitly, so a later `if (row.started_at)`
    // cannot pass this file while folding a third state in with them.
    const absent = phaseTiming(row({ status: "completed" }), "completed", NOW)
    const empty = phaseTiming(
      row({ status: "completed", started_at: null, completed_at: null }),
      "completed",
      NOW,
    )
    expect(absent.kind).toBe("not-recorded")
    expect(empty.kind).toBe("not-recorded")
  })

  it("an UNPARSEABLE timestamp is an absence, never a duration measured from the epoch", () => {
    const t = phaseTiming(
      row({ status: "completed", started_at: "not-a-date", completed_at: "also-not" }),
      "completed",
      NOW,
    )
    expect(t.kind).toBe("not-recorded")
  })

  it("`active` with no readable start does not invent a tick", () => {
    const t = phaseTiming(row({ status: "active", started_at: null }), "running", NOW)
    expect(t.kind).toBe("not-recorded")
  })

  it("every outcome word is a distinct string — no two statuses read the same by accident", () => {
    const seen = new Map<string, string>()
    for (const [status, expected] of [
      ["pending", OUTCOME_NOT_REACHED],
      ["active", OUTCOME_STILL_RUNNING],
      ["completed", OUTCOME_FINISHED],
      ["failed", OUTCOME_FAILED],
      ["skipped", OUTCOME_NEVER_RAN],
      ["cancelled", OUTCOME_INTERRUPTED],
    ] as const) {
      // ⚠ `"running"` here, deliberately: the `active` row's outcome DEPENDS on the run, and
      // under a terminal one it correctly reads `did not finish` instead. That dependency is
      // the point of `outcomeFor`, and this loop measures the live-run column of it.
      const word = phaseRunFacts(row({ status }), "running", NOW).outcome
      expect(word).toBe(expected)
      seen.set(status, word)
    }
    expect(new Set(seen.values()).size).toBe(seen.size)
  })

  it("⚠ the outcome LABEL follows the timing arm, so one row never carries two claims", () => {
    const started = new Date(NOW - 4000).toISOString()
    const r = row({ status: "active", started_at: started })
    // Live: still running, and it ticks.
    expect(phaseRunFacts(r, "running", NOW).outcome).toBe(OUTCOME_STILL_RUNNING)
    // Terminal run underneath it: the label changes WITH the reading, never against it.
    expect(phaseRunFacts(r, "failed", NOW).outcome).toBe(OUTCOME_DID_NOT_FINISH)
    expect(phaseRunFacts(r, "failed", NOW).timing.reading).toBe(OUTCOME_DID_NOT_FINISH)
    // Paused run underneath it: likewise.
    expect(phaseRunFacts(r, "paused", NOW).outcome).toBe(OUTCOME_PAUSED)
    expect(phaseRunFacts(r, "paused", NOW).timing.reading).toBe(OUTCOME_PAUSED)
  })
})

describe("declaredCount — D-07 / IDIOM-3: `0` is a FACT, absence is not", () => {
  it("a declared `0` RENDERS — the step searched and found nothing", () => {
    expect(declaredCount(row({ step_count: 0, step_noun: "sources" }))).toEqual({
      count: 0,
      noun: "sources",
    })
  })

  it("an ABSENT count renders NOTHING — never `0`, never a dash", () => {
    expect(declaredCount(row())).toBeNull()
    expect(declaredCount(row({ step_count: null, step_noun: null }))).toBeNull()
  })

  it("POSITIVE CONTROL — the shipped-coalesce shape really does destroy the distinction", () => {
    // The two forms this module is forbidden to use, reproduced here so the negatives above
    // are a measurement rather than a regex that never matches anything.
    const declaredZero: PhaseTimingRow = row({ step_count: 0, step_noun: "sources" })
    const declaredNothing: PhaseTimingRow = row({ step_count: null, step_noun: null })
    expect(declaredZero.step_count ?? 0).toBe(declaredNothing.step_count ?? 0)
    expect(Boolean(declaredZero.step_count)).toBe(Boolean(declaredNothing.step_count))
    // While the real arm keeps them apart.
    expect(declaredCount(declaredZero)).not.toBeNull()
    expect(declaredCount(declaredNothing)).toBeNull()
  })

  it("the wire's noun is passed through VERBATIM, including one this client never heard of", () => {
    expect(declaredCount(row({ step_count: 7, step_noun: "widgets" }))).toEqual({
      count: 7,
      noun: "widgets",
    })
  })

  it("a count with NO noun renders nothing — a lone figure has no subject", () => {
    expect(declaredCount(row({ step_count: 12, step_noun: null }))).toBeNull()
    expect(declaredCount(row({ step_count: 12, step_noun: "   " }))).toBeNull()
  })
})

describe("runFactsBySlug — the own-property guard (WR-04)", () => {
  const rows: PhaseTimingRow[] = [
    row({ slug: "gather", status: "completed", started_at: "2026-08-19T14:00:00.000Z", completed_at: "2026-08-19T14:00:02.000Z" }),
    row({ slug: "constructor", status: "completed", started_at: "2026-08-19T14:00:00.000Z", completed_at: "2026-08-19T14:00:03.000Z" }),
  ]

  it("a `constructor`-slugged phase resolves its OWN facts, never a function", () => {
    const lookup = runFactsBySlug(rows, "completed", NOW)
    const facts = lookup("constructor")
    expect(typeof facts).not.toBe("function")
    expect(facts?.timing.kind).toBe("ran")
    expect(facts?.timing.reading).toBe("3s")
  })

  it("an inherited key that is NOT a phase resolves to undefined, not to Object.prototype", () => {
    const lookup = runFactsBySlug(rows, "completed", NOW)
    for (const key of ["toString", "__proto__", "hasOwnProperty", "valueOf"]) {
      expect(lookup(key)).toBeUndefined()
    }
  })

  it("POSITIVE CONTROL — the UNGUARDED bracket read really does hand back a function", () => {
    const bare: Record<string, unknown> = {}
    expect(typeof bare["constructor"]).toBe("function")
    expect(typeof bare["toString"]).toBe("function")
    // …which is why the two cases above are a mitigation and not ceremony.
  })

  it("a slug the run never mentioned resolves to undefined (the spine's absent-node arm)", () => {
    const lookup = runFactsBySlug(rows, "completed", NOW)
    expect(lookup("nowhere")).toBeUndefined()
  })
})

describe("runSpan + clockTime — the header's measured figures", () => {
  it("spans min(started_at) → max(completed_at) ACROSS the rows, not one row's pair", () => {
    const span = runSpan([
      row({ slug: "a", started_at: "2026-08-19T14:00:00.000Z", completed_at: "2026-08-19T14:00:30.000Z" }),
      row({ slug: "b", started_at: "2026-08-19T14:00:30.000Z", completed_at: "2026-08-19T14:04:12.000Z" }),
      row({ slug: "c", status: "skipped", started_at: null, completed_at: null }),
    ])
    expect(span).not.toBeNull()
    expect(span!.ms).toBe(252_000)
    expect(span!.startedAtMs).toBe(Date.parse("2026-08-19T14:00:00.000Z"))
    expect(span!.finishedAtMs).toBe(Date.parse("2026-08-19T14:04:12.000Z"))
  })

  it("is NULL when no row carries a readable pair — the header then says so in words", () => {
    expect(runSpan([row({ status: "skipped", started_at: null, completed_at: null })])).toBeNull()
    expect(runSpan([])).toBeNull()
  })

  it("is derived from the PHASE timestamps, not from a client clock", () => {
    // The same rows measured at two wildly different `now`s produce the same span — which is
    // what "a measured fact rather than a claim" means operationally.
    const rows = [row({ started_at: "2026-08-19T14:00:00.000Z", completed_at: "2026-08-19T14:00:09.000Z" })]
    expect(runSpan(rows)).toEqual(runSpan(rows))
    expect(runSpan(rows)!.ms).toBe(9_000)
  })

  it("clockTime reads a 24-hour local wall clock", () => {
    // Built from LOCAL components, so the expectation holds in any timezone the suite runs in.
    const local = new Date(2026, 7, 19, 14, 22, 0)
    expect(clockTime(local.getTime())).toBe("14:22")
    const morning = new Date(2026, 7, 19, 9, 5, 0)
    expect(clockTime(morning.getTime())).toBe("09:05")
  })
})

describe("branchReading — BS-MR-03's two words", () => {
  it("words the caller's answer and decides nothing itself", () => {
    expect(branchReading(true)).toBe(BRANCH_TAKEN)
    expect(branchReading(false)).toBe(BRANCH_NOT_TAKEN)
    expect(BRANCH_TAKEN).not.toBe(BRANCH_NOT_TAKEN)
  })
})

// ── Phase 200 · the run log's zero and its entry order ──────────────────────────────────

/**
 * WHAT WOULD BE UNGUARDED WITHOUT THIS BLOCK:
 *  • that `runAnchorMs` answers where `runSpan` deliberately does not — mid-run, when
 *    nothing has completed. That difference is the entire reason it was extracted, and a
 *    log built on `runSpan` would have had no clock during the only period it matters;
 *  • that `readInstant` is exported as the ONE string→instant door and still refuses an
 *    unparseable value as an ABSENCE rather than an epoch zero;
 *  • that a row is placed at its COMPLETION when it has one, so a finished step sorts by
 *    its ending;
 *  • that untimed rows are APPENDED rather than dropped or floated to the top.
 */
describe("runAnchorMs — the run's zero, which is not the run's span", () => {
  const started = (at: string, slug = "a"): PhaseTimingRow => ({
    slug,
    status: "active",
    started_at: at,
  })

  it("answers mid-run, where runSpan cannot", () => {
    // ⚠ THE WHOLE POINT OF THE EXTRACTION, driven as a contrast rather than asserted alone:
    // one step has started and nothing has finished, which is every run that is still going.
    const rows = [started("2026-08-19T14:00:00.000Z")]
    expect(runSpan(rows)).toBeNull()
    expect(runAnchorMs(rows)).toBe(Date.parse("2026-08-19T14:00:00.000Z"))
  })

  it("takes the EARLIEST start, not the first row's", () => {
    const rows = [
      started("2026-08-19T14:00:30.000Z", "late"),
      started("2026-08-19T14:00:00.000Z", "early"),
    ]
    expect(runAnchorMs(rows)).toBe(Date.parse("2026-08-19T14:00:00.000Z"))
  })

  it("is null when no row carries a readable start — never a client clock, never zero", () => {
    expect(runAnchorMs([])).toBeNull()
    expect(runAnchorMs([{ slug: "a", status: "pending" }])).toBeNull()
    // ⚠ AN UNPARSEABLE STRING IS AN ABSENCE. Letting it through would anchor the whole log
    // on the epoch and print figures nothing measured.
    expect(runAnchorMs([{ slug: "a", status: "active", started_at: "not a date" }])).toBeNull()
  })

  it("agrees with runSpan's own startedAtMs whenever runSpan has an answer", () => {
    // One derivation, read two ways — which is what "one home" has to mean operationally.
    const rows: PhaseTimingRow[] = [
      {
        slug: "a",
        status: "completed",
        started_at: "2026-08-19T14:00:00.000Z",
        completed_at: "2026-08-19T14:00:12.000Z",
      },
    ]
    expect(runAnchorMs(rows)).toBe(runSpan(rows)!.startedAtMs)
  })
})

describe("readInstant — the one string→instant door", () => {
  it("reads an ISO instant and refuses everything that is not one", () => {
    expect(readInstant("2026-08-19T14:00:00.000Z")).toBe(Date.parse("2026-08-19T14:00:00.000Z"))
    expect(readInstant(null)).toBeNull()
    expect(readInstant(undefined)).toBeNull()
    // ⚠ THE ARM THAT MATTERS: `Date.parse("")` is NaN, and a NaN reaching a subtraction
    // produces a duration against nothing at all.
    expect(readInstant("")).toBeNull()
    expect(readInstant("tuesday")).toBeNull()
  })
})

describe("transcriptEntries — where each step sits in the log", () => {
  const T0 = Date.parse("2026-08-19T14:00:00.000Z")
  const at = (seconds: number) => new Date(T0 + seconds * 1000).toISOString()

  /**
   * ⚠ THIS PAIR ASSERTED THE OPPOSITE UNTIL 2026-08-20, AND THE REVERSAL IS THE POINT.
   * `transcriptEntries` stamped a finished step at its `completed_at`, on the reasoning that a
   * log entry marks when a thing became KNOWN. That held for a line carrying no duration. The
   * line now carries one, and on the very first step — which starts at the anchor — the stamp
   * and the duration became THE SAME STRING: `11s · Pull usage and adoption data · 11s`, seen
   * in a browser. Start-stamp plus duration state the whole interval instead of overlapping,
   * and the column reads as a timeline whose gaps between steps are visible.
   */
  it("places a step at its START, so the stamp and the duration are complementary", () => {
    const rows: PhaseTimingRow[] = [
      { slug: "a", status: "completed", started_at: at(0), completed_at: at(12) },
    ]
    expect(transcriptEntries(rows)).toEqual([{ slug: "a", offsetMs: 0, order: 0 }])
  })

  it("reads as a timeline — each stamp is when that step began", () => {
    const rows: PhaseTimingRow[] = [
      { slug: "a", status: "completed", started_at: at(0), completed_at: at(12) },
      { slug: "b", status: "active", started_at: at(14) },
    ]
    expect(transcriptEntries(rows).map((e) => e.offsetMs)).toEqual([0, 14_000])
  })

  it("falls back to `completed_at` for a row that has no readable start", () => {
    // ⚠ THE FALLBACK IS NOT DEAD CODE: a row can carry a completion and no start (a historic
    // row half-written before migration 121). Placing it at its completion is the only instant
    // it has, and dropping it would remove a step that really ran.
    const rows: PhaseTimingRow[] = [
      { slug: "a", status: "completed", started_at: at(0), completed_at: at(12) },
      { slug: "b", status: "completed", completed_at: at(30) },
    ]
    expect(transcriptEntries(rows).map((e) => e.offsetMs)).toEqual([0, 30_000])
  })

  it("sorts by the clock and appends untimed rows in the SERVER's order", () => {
    const rows: PhaseTimingRow[] = [
      { slug: "never", status: "skipped" },
      { slug: "second", status: "completed", started_at: at(14), completed_at: at(70) },
      { slug: "first", status: "completed", started_at: at(0), completed_at: at(12) },
      { slug: "unreached", status: "pending" },
    ]
    expect(transcriptEntries(rows).map((e) => e.slug)).toEqual([
      "first",
      "second",
      "never",
      "unreached",
    ])
  })

  it("keeps EVERY row — a dropped one reads as a step that does not exist", () => {
    const rows: PhaseTimingRow[] = [
      { slug: "a", status: "completed", started_at: at(0), completed_at: at(12) },
      { slug: "b", status: "pending" },
      { slug: "c", status: "skipped" },
    ]
    expect(transcriptEntries(rows)).toHaveLength(3)
    expect(transcriptEntries(rows).filter((e) => e.offsetMs === null).map((e) => e.slug)).toEqual([
      "b",
      "c",
    ])
  })

  it("gives every row a null offset when the run has no zero at all", () => {
    // ⚠ `offsetMs: 0` WOULD BE A READING. A run whose rows carry no readable start has no
    // clock, and the caller says so in words rather than stamping everything at the start.
    const rows: PhaseTimingRow[] = [
      { slug: "a", status: "completed" },
      { slug: "b", status: "failed" },
    ]
    expect(transcriptEntries(rows).every((e) => e.offsetMs === null)).toBe(true)
  })

  it("breaks a tie on the server's row order, never on the slug", () => {
    // ⚠ TIED ON THE STAMPED INSTANT, which is the START — the fixture was tied on
    // `completed_at` while the stamp was the completion, and had to move with the reversal or
    // it would have stopped exercising a tie at all while still passing.
    const rows: PhaseTimingRow[] = [
      { slug: "zebra", status: "completed", started_at: at(0), completed_at: at(5) },
      { slug: "alpha", status: "completed", started_at: at(0), completed_at: at(9) },
    ]
    expect(transcriptEntries(rows).map((e) => e.slug)).toEqual(["zebra", "alpha"])
  })

  it("never returns a negative offset, even for a row stamped before the anchor", () => {
    // Clock skew between writers is not this module's to fix, but a negative elapsed time is
    // a figure that cannot be true, so it is floored rather than printed.
    // Row `b` carries only a completion, and it lands BEFORE the anchor row `a` started.
    const rows: PhaseTimingRow[] = [
      { slug: "a", status: "active", started_at: at(10) },
      { slug: "b", status: "completed", completed_at: at(5) },
    ]
    expect(transcriptEntries(rows).every((e) => (e.offsetMs ?? 0) >= 0)).toBe(true)
  })
})
