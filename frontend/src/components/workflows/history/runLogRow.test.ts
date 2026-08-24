/**
 * SEED-190 — `runLogRowFacts`' contract.
 *
 * ⚠ THE HEADLINE CASES ARE §2 AND §4. Everything else here is ordinary coverage; the two
 * blocks that would catch the defects this module exists to prevent are:
 *
 *   §2 — a run whose timings were never recorded must NOT report a duration, and above all
 *        must not report `0s`. Migration 121 is not backfilled, so most rows in the real
 *        database take that arm today: measured 2026-08-20, 10 of 580 phase rows carry the
 *        pair. A resolver that coalesced a missing instant to zero would look perfect on a
 *        fixture and print "0s" at a person about 220 of their 230 runs.
 *
 *   §4 — the outcome word must be the word the LIBRARY CARD prints for the same run. It is
 *        asserted by calling `runFacts` independently and comparing, never by re-typing the
 *        strings — a copy of the word here would pass while the two surfaces drifted.
 *
 * ⚠ `now` IS INJECTED IN EVERY CASE THAT READS A BAND (P-1). A suite that let the default
 * `Date.now()` run is a suite that passes at one instant and flakes at another.
 *
 * No DOM: this is a pure leaf, so rendering here would prove the panel as well as the
 * resolver — the reasoning `cardFace.test.ts` and `runFacts.test.ts` both record.
 */
import { describe, it, expect } from "vitest"

import { runLogRowFacts } from "./runLogRow"
import { WORKFLOW_DELETED } from "./runLogVocabulary"
import { runFacts } from "@/components/workflows/library/runFacts"
import { TIME_NOT_RECORDED } from "@/components/workflows/receiptVocabulary"
import type { WorkflowRunListItem } from "@/lib/api"

/** A fixed instant, so every band in this file is deterministic. */
const NOW = Date.parse("2026-08-20T18:00:00.000Z")
const ago = (ms: number) => new Date(NOW - ms).toISOString()
const MIN = 60_000

function rowOf(over: Partial<WorkflowRunListItem> = {}): WorkflowRunListItem {
  return {
    id: "run-1",
    thread_id: "thread-1",
    definition_id: "def-1",
    workflow_name: "Quarterly Business Review",
    workflow_slug: "qbr",
    workflow_version: 2,
    status: "completed",
    created_at: ago(90 * MIN),
    step_total: 5,
    started_at: null,
    completed_at: null,
    ...over,
  }
}

describe("runLogRowFacts §1 — the identity of a row", () => {
  it("carries the run id, the workflow's name and its version", () => {
    const facts = runLogRowFacts(rowOf(), NOW)
    expect(facts.runId).toBe("run-1")
    expect(facts.title).toBe("Quarterly Business Review")
    expect(facts.orphaned).toBe(false)
    expect(facts.detail).toContain("v2")
    expect(facts.detail).toContain("5 steps")
  })

  it("a run whose workflow was DELETED still resolves, and says so", () => {
    // ⚠ THE ROW MUST SURVIVE ITS WORKFLOW. Deleting a workflow does not delete its runs —
    // `WorkflowDeleteSheet` tells the operator the threads become normal chats — so an
    // orphaned run is a real row. It must be openable, and it must not render a blank cell
    // or the machine slug.
    const facts = runLogRowFacts(rowOf({ workflow_name: "" }), NOW)
    expect(facts.orphaned).toBe(true)
    expect(facts.title).toBe(WORKFLOW_DELETED)
    expect(facts.title).not.toBe("")
    expect(facts.title).not.toContain("qbr")
    // …and it is still a row that can be opened.
    expect(facts.runId).toBe("run-1")
  })

  it("a name of pure whitespace is treated as ABSENT, not as a name", () => {
    expect(runLogRowFacts(rowOf({ workflow_name: "   " }), NOW).orphaned).toBe(true)
  })

  it("ONE step reads `1 step`, not `1 steps`", () => {
    expect(runLogRowFacts(rowOf({ step_total: 1 }), NOW).detail).toContain("1 step")
  })

  it("ZERO steps is a real reading and is NOT suppressed", () => {
    // `0` is a fact — this run created no phase rows — and it is not the same as absence.
    expect(runLogRowFacts(rowOf({ step_total: 0 }), NOW).detail).toContain("0 steps")
  })
})

describe("runLogRowFacts §2 — an unmeasured run reports NO duration (the headline)", () => {
  it("both instants absent → the not-recorded WORD, never a zero", () => {
    const facts = runLogRowFacts(rowOf({ started_at: null, completed_at: null }), NOW)
    expect(facts.durationMeasured).toBe(false)
    expect(facts.duration).toBe(TIME_NOT_RECORDED)
    // The three spellings a coalescing bug would produce, each ruled out by name.
    expect(facts.duration).not.toBe("0s")
    expect(facts.duration).not.toBe("00:00")
    expect(facts.duration).not.toBe("")
  })

  it("a start with NO finish is not a duration either — a run still going has no span", () => {
    const facts = runLogRowFacts(
      rowOf({ status: "active", started_at: ago(2 * MIN), completed_at: null }),
      NOW,
    )
    expect(facts.durationMeasured).toBe(false)
    expect(facts.duration).toBe(TIME_NOT_RECORDED)
  })

  it("a finish with NO start is not a duration either", () => {
    const facts = runLogRowFacts(rowOf({ started_at: null, completed_at: ago(MIN) }), NOW)
    expect(facts.durationMeasured).toBe(false)
  })

  it("an UNPARSEABLE instant is absence, never a fabricated zero", () => {
    const facts = runLogRowFacts(
      rowOf({ started_at: "not-a-timestamp", completed_at: ago(MIN) }),
      NOW,
    )
    expect(facts.durationMeasured).toBe(false)
    expect(facts.duration).toBe(TIME_NOT_RECORDED)
  })

  it("the unmeasured word NEVER joins the detail line — it is a sentence, not a figure", () => {
    const facts = runLogRowFacts(rowOf(), NOW)
    expect(facts.detail).not.toContain(TIME_NOT_RECORDED)
  })
})

describe("runLogRowFacts §3 — a measured run reports its real span", () => {
  it("both instants present → the elapsed between them, on the detail line", () => {
    const facts = runLogRowFacts(
      rowOf({
        started_at: "2026-08-20T16:28:07.474637Z",
        completed_at: "2026-08-20T16:31:05.143715Z",
      }),
      NOW,
    )
    expect(facts.durationMeasured).toBe(true)
    // 2m 57.669s — the REAL span of a real run on the dev database, not a round fixture.
    expect(facts.duration).toBe("2m 57s")
    expect(facts.detail).toContain("2m 57s")
  })

  it("a sub-minute run reports seconds, and the figure is the measurement", () => {
    const started = ago(10 * MIN)
    const facts = runLogRowFacts(
      rowOf({ started_at: started, completed_at: new Date(Date.parse(started) + 57_000).toISOString() }),
      NOW,
    )
    expect(facts.duration).toBe("57s")
  })

  it("the span is measured from the INSTANTS, never from `created_at`", () => {
    // ⚠ THE FALSIFICATION FOR THE ONE SHORTCUT NOBODY SHOULD TAKE. `created_at` is when the
    // ROW was inserted; the span is when the WORK ran. This row's `created_at` is 90 minutes
    // old and its phases span 57 seconds — a resolver reaching for `created_at` reads ~90m.
    const started = ago(80 * MIN)
    const facts = runLogRowFacts(
      rowOf({
        created_at: ago(90 * MIN),
        started_at: started,
        completed_at: new Date(Date.parse(started) + 57_000).toISOString(),
      }),
      NOW,
    )
    expect(facts.duration).toBe("57s")
    expect(facts.duration).not.toContain("m")
  })
})

describe("runLogRowFacts §4 — the outcome is the CARD's word (the second headline)", () => {
  // ⚠ COMPARED AGAINST `runFacts`, NEVER AGAINST A COPY OF THE STRING. A literal here would
  // keep passing while the log and the library card drifted apart, which is the exact defect
  // this module was written to make impossible.
  for (const status of ["completed", "failed", "cancelled"] as const) {
    it(`\`${status}\` reads exactly what the workflow card reads`, () => {
      const at = ago(3 * MIN)
      const facts = runLogRowFacts(rowOf({ status, created_at: at }), NOW)
      const card = runFacts({ lastRunAt: at, lastRunStatus: status, hasAnyRun: true }, NOW)
      expect(facts.fact).toEqual(card)
      expect(facts.fact.word.length).toBeGreaterThan(0)
    })
  }

  it("an in-flight status is `unknown` — NEVER success by default (T-15)", () => {
    const facts = runLogRowFacts(rowOf({ status: "active" }), NOW)
    expect(facts.fact.kind).toBe("unknown")
    expect(facts.tone).toBe("unknown")
  })

  it("a status this build has never seen is `unknown`, not a crash and not a claim", () => {
    const facts = runLogRowFacts(rowOf({ status: "teleported" }), NOW)
    expect(facts.fact.kind).toBe("unknown")
  })

  it("the tone key tracks the arm — `ran` contributes its outcome, others their kind", () => {
    expect(runLogRowFacts(rowOf({ status: "completed" }), NOW).tone).toBe("worked")
    expect(runLogRowFacts(rowOf({ status: "failed" }), NOW).tone).toBe("failed")
    expect(runLogRowFacts(rowOf({ status: "cancelled" }), NOW).tone).toBe("stopped")
  })

  it("a run with no readable `created_at` reports the outcome ALONE, with no invented time", () => {
    const facts = runLogRowFacts(rowOf({ created_at: null }), NOW)
    expect(facts.fact.kind).toBe("ran")
    if (facts.fact.kind === "ran") expect(facts.fact.when).toBeNull()
    expect(facts.fact.word).not.toContain("ago")
    expect(facts.fact.word).not.toContain("just now")
  })
})

describe("runLogRowFacts §5 — `now` is injected, so two rows in one render agree", () => {
  it("the SAME row read at two instants reads two different bands", () => {
    const at = ago(0)
    const near = runLogRowFacts(rowOf({ created_at: at }), NOW)
    const far = runLogRowFacts(rowOf({ created_at: at }), NOW + 3 * 24 * 60 * 60 * 1000)
    expect(near.fact.word).not.toBe(far.fact.word)
  })
})
