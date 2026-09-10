/**
 * Phase 235 plan 04 Task 3 (SURF-02 · D-235-07) — the quiet-run fold, proved as a PURE
 * function over stored rows.
 *
 * ── NO DOM, NO DOUBLES, NO MOUNT ──────────────────────────────────────────────────────
 * `runHistoryFold.ts` is a strict leaf, so its suite is one too: it calls the fold and reads
 * the result. Nothing is drawn, nothing is stubbed, nothing is awaited. A failure here is a
 * defect in the fold, never in a fixture or a query selector.
 *
 * ── ⚠ NON-VACUITY FIRST ──────────────────────────────────────────────────────────────
 * Every count below rests on ONE fixture — the sketch's own 17 runs. A fixture that silently
 * shrank to two rows would make "17 → 3 collapsed" pass over nothing, so its size and its
 * status variety are asserted BEFORE any property rests on them.
 *
 * ── ⭐ THE NUMBERS ARE THE SKETCH'S OWN, READ FROM THE GENERATED CONTRACT ─────────────
 * `sourceComposition.json` emits `runCollapsed: 3` and `runExpanded: 17` from the running
 * sketch. They are imported here rather than typed, so a re-emitted contract moves this suite
 * with it instead of leaving a stale constant behind.
 */
import { describe, it, expect } from "vitest"

import CONTRACT from "./__generated__/sourceComposition.json"
import { foldRuns, isQuiet, type RunRow, type SyncRunLike } from "./runHistoryFold"

// ── FIXTURES ──────────────────────────────────────────────────────────────────────────

interface Fixture extends SyncRunLike {
  id: string
}

const ZERO_COUNTS = {
  count_new: 0,
  count_modified: 0,
  count_renamed: 0,
  count_missing: 0,
  count_restored: 0,
  count_errors: 0,
} as const

function run(id: string, over: Partial<Fixture> = {}): Fixture {
  return {
    id,
    started_at: `2026-09-05T${id.padStart(2, "0")}:00:00Z`,
    status: "success",
    listing_complete: true,
    ...ZERO_COUNTS,
    ...over,
  }
}

function quiet(id: string): Fixture {
  return run(id)
}

/**
 * ⭐ THE SKETCH'S OWN HISTORY, `index.html:432-448` — 17 stored ticks of which 14 are quiet
 * AND CONSECUTIVE, bracketed by three that changed something. Newest first, as the wire
 * delivers them.
 */
const SKETCH_RUNS: Fixture[] = [
  run("01", { count_new: 3, count_modified: 1 }),
  ...Array.from({ length: 14 }, (_, i) => quiet(String(i + 2).padStart(2, "0"))),
  run("16", { count_new: 1, count_errors: 1, status: "failed", listing_complete: true }),
  run("17", { count_new: 12, count_missing: 2 }),
]

const kinds = (rows: RunRow<Fixture>[]) => rows.map((r) => r.kind)
const runRows = (rows: RunRow<Fixture>[]) => rows.filter((r) => r.kind === "run")

// ── §1 NON-VACUITY ────────────────────────────────────────────────────────────────────

describe("§1 non-vacuity — the fixture is the sketch's, and it is real", () => {
  it("carries at least 15 runs and more than one distinct status", () => {
    expect(SKETCH_RUNS.length).toBeGreaterThanOrEqual(15)
    expect(new Set(SKETCH_RUNS.map((r) => r.status)).size).toBeGreaterThan(1)
  })

  it("carries exactly 14 quiet runs, and they are consecutive", () => {
    const quietFlags = SKETCH_RUNS.map(isQuiet)
    expect(quietFlags.filter(Boolean)).toHaveLength(14)

    const first = quietFlags.indexOf(true)
    const last = quietFlags.lastIndexOf(true)
    expect(last - first).toBe(13) // no loud run interleaved
  })

  it("the generated contract still names the numbers this suite pins", () => {
    expect(CONTRACT.counts.runCollapsed).toBe(3)
    expect(CONTRACT.counts.runExpanded).toBe(17)
    expect(SKETCH_RUNS).toHaveLength(CONTRACT.counts.runExpanded)
  })
})

// ── §2 WHAT COUNTS AS QUIET ───────────────────────────────────────────────────────────

describe("§2 isQuiet", () => {
  it("a successful, complete tick that changed nothing is quiet", () => {
    expect(isQuiet(run("01"))).toBe(true)
  })

  it("⛔ a SUCCESSFUL tick whose listing was INCOMPLETE is NOT quiet — it could not tell", () => {
    expect(isQuiet(run("01", { listing_complete: false }))).toBe(false)
  })

  it("any non-zero count makes a tick loud — all six of them", () => {
    const counts: (keyof typeof ZERO_COUNTS)[] = [
      "count_new",
      "count_modified",
      "count_renamed",
      "count_missing",
      "count_restored",
      "count_errors",
    ]
    expect(counts).toHaveLength(6)
    for (const key of counts) {
      expect(isQuiet(run("01", { [key]: 1 }))).toBe(false)
    }
  })

  it("a non-success status is never quiet", () => {
    for (const status of ["failed", "paused", "running"] as const) {
      expect(isQuiet(run("01", { status }))).toBe(false)
    }
  })
})

// ── §3 THE FOLD ───────────────────────────────────────────────────────────────────────

describe("§3 foldRuns — density is RENDERING, never storage", () => {
  it("⭐ collapsed: the sketch's 17 stored ticks render as 3 run rows and ONE fold of 14", () => {
    const rows = foldRuns(SKETCH_RUNS)

    expect(runRows(rows)).toHaveLength(CONTRACT.counts.runCollapsed)
    const folds = rows.filter((r) => r.kind === "quiet-fold")
    expect(folds).toHaveLength(1)
    expect(folds[0]).toMatchObject({ kind: "quiet-fold", count: 14 })
    // 3 run rows + 1 fold. The contract counts `run` BLOCKS, which is why the row total is 4.
    expect(rows).toHaveLength(4)
  })

  it("⭐ expanded: the same input renders all 17, every one of them a run row", () => {
    const rows = foldRuns(SKETCH_RUNS, { expanded: true })

    expect(rows).toHaveLength(CONTRACT.counts.runExpanded)
    expect(kinds(rows).every((k) => k === "run")).toBe(true)
  })

  it("folds only CONSECUTIVE quiet runs — [quiet, loud, quiet] stays three rows", () => {
    const rows = foldRuns([quiet("01"), run("02", { count_new: 1 }), quiet("03")])

    expect(rows).toHaveLength(3)
    expect(kinds(rows)).toEqual(["run", "run", "run"])
  })

  it("a run of exactly ONE quiet tick is not a fold — folding one thing is longer than it", () => {
    const rows = foldRuns([run("01", { count_new: 1 }), quiet("02"), run("03", { count_new: 1 })])

    expect(kinds(rows)).toEqual(["run", "run", "run"])
  })

  it("two consecutive quiet ticks DO fold", () => {
    const rows = foldRuns([quiet("01"), quiet("02"), run("03", { count_new: 1 })])

    expect(kinds(rows)).toEqual(["quiet-fold", "run"])
  })

  it("preserves the order it was given, newest first", () => {
    const rows = foldRuns(SKETCH_RUNS)
    const ids = runRows(rows).map((r) => (r.kind === "run" ? r.run.id : ""))

    expect(ids).toEqual(["01", "16", "17"])
  })

  it("the fold carries the group's own bounds, in the order given", () => {
    const rows = foldRuns(SKETCH_RUNS)
    const fold = rows.find((r) => r.kind === "quiet-fold")

    expect(fold).toBeDefined()
    if (fold?.kind !== "quiet-fold") throw new Error("unreachable — asserted above")
    expect(fold.firstAt).toBe(SKETCH_RUNS[1].started_at)
    expect(fold.lastAt).toBe(SKETCH_RUNS[14].started_at)
  })

  it("an empty history returns an empty list without throwing", () => {
    expect(foldRuns([])).toEqual([])
    expect(foldRuns([], { expanded: true })).toEqual([])
  })

  it("a history of nothing but quiet ticks is ONE fold", () => {
    const rows = foldRuns([quiet("01"), quiet("02"), quiet("03")])

    expect(kinds(rows)).toEqual(["quiet-fold"])
    expect(rows[0]).toMatchObject({ count: 3 })
  })

  it("never mutates its input", () => {
    const before = JSON.stringify(SKETCH_RUNS)
    foldRuns(SKETCH_RUNS)
    foldRuns(SKETCH_RUNS, { expanded: true })
    expect(JSON.stringify(SKETCH_RUNS)).toBe(before)
  })
})
