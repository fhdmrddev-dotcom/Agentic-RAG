/**
 * Phase 235 plan 04 Task 3 (SURF-02 · D-235-07 / T-235-12) — the history a person reads.
 *
 * ── NOTHING IS MOCKED, AND THAT IS THE POINT ─────────────────────────────────────────
 * `sourceHealthVocabulary` is NOT stubbed: the whole claim of this component is that the
 * REAL sentences reach the screen. A mocked vocabulary would prove the component calls
 * something, which is the assertion sketch 218 shipped 200 of and the operator rejected.
 *
 * ── ⚠ NON-VACUITY FIRST ──────────────────────────────────────────────────────────────
 * The fixture's size and its status variety are asserted before any count rests on them.
 *
 * ── THE THREE THINGS THIS SUITE REFUSES ──────────────────────────────────────────────
 *   1. A raw `last_error` reaching JSX (T-235-12) — the sentence, never the exception.
 *   2. `--color-danger` on a source state (BUILD-CONTRACT §4) — warning, never danger.
 *   3. `0 missing` on a tick whose listing was incomplete (RESEARCH P-2) — that zero is
 *      by DESIGN (`watch_service.py:415-420` suppresses the transition), not by observation.
 */
import { describe, it, expect, vi, afterEach } from "vitest"
import { render, screen, cleanup } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import type { SyncRun } from "@/lib/api/sources"

import { RunHistoryList } from "./RunHistoryList"
import {
  COPY,
  sourceFailureSentence,
  CHECKED_PREFIX,
  COUNT_ORDER,
  WORD_FOR_COUNT,
} from "./sourceHealthVocabulary"
// The component's own source, read as text for the three fences below.
import componentSource from "./RunHistoryList.tsx?raw"

const NOW = Date.parse("2026-09-05T18:00:00Z")
const CONNECTION = "Safety Drive"

/** A provider-shaped string — a dict, an exception class and a token fragment. */
const MACHINE_ERROR =
  "{'error': 'invalid_grant', 'error_description': 'Token has been expired or revoked.'} <class 'RefreshError'>"

const ZERO_COUNTS = {
  count_new: 0,
  count_modified: 0,
  count_renamed: 0,
  count_missing: 0,
  count_restored: 0,
  count_errors: 0,
} as const

function makeRun(id: string, over: Partial<SyncRun> = {}): SyncRun {
  return {
    id,
    watch_id: "watch-1",
    started_at: new Date(NOW - 60_000 * Number(id)).toISOString(),
    finished_at: new Date(NOW - 60_000 * Number(id) + 5_000).toISOString(),
    status: "success",
    failure_cause: null,
    last_error: null,
    listing_complete: true,
    ...ZERO_COUNTS,
    ...over,
  }
}

/** The sketch's own 17 ticks: 14 quiet and consecutive, bracketed by three that changed. */
const SKETCH_RUNS: SyncRun[] = [
  makeRun("1", { count_new: 3, count_modified: 1 }),
  ...Array.from({ length: 14 }, (_, i) => makeRun(String(i + 2))),
  makeRun("16", {
    status: "failed",
    failure_cause: "token_revoked",
    last_error: MACHINE_ERROR,
    count_errors: 1,
  }),
  makeRun("17", { count_new: 12, count_missing: 2 }),
]

function mount(over: Partial<Parameters<typeof RunHistoryList>[0]> = {}) {
  const onToggleExpanded = vi.fn()
  const view = render(
    <RunHistoryList
      runs={SKETCH_RUNS}
      connectionName={CONNECTION}
      expanded={false}
      onToggleExpanded={onToggleExpanded}
      now={NOW}
      {...over}
    />,
  )
  return { ...view, onToggleExpanded }
}

/** ONE run, mounted alone, so a row's whole text is the thing under assertion. */
function mountOne(over: Partial<SyncRun> = {}, id = "4") {
  return render(
    <RunHistoryList
      runs={[makeRun(id, over)]}
      connectionName={CONNECTION}
      expanded={false}
      onToggleExpanded={vi.fn()}
      now={NOW}
    />,
  )
}

/**
 * A row's rendered reading, whitespace-normalised. ⚠ Assertions below compare against this
 * WHOLE string rather than probing for a substring: a breakdown that gained a seventh bit, or
 * lost the instant, or grew a stray zero, has to redden something.
 */
function rowText(): string {
  return (screen.getByTestId("sources-run").textContent ?? "").replace(/\s+/g, " ").trim()
}

afterEach(cleanup)

// ── §1 NON-VACUITY ────────────────────────────────────────────────────────────────────

describe("§1 non-vacuity", () => {
  it("the fixture carries 17 runs and more than one status", () => {
    expect(SKETCH_RUNS).toHaveLength(17)
    expect(new Set(SKETCH_RUNS.map((r) => r.status)).size).toBeGreaterThan(1)
  })

  it("mounts and emits the history block exactly once", () => {
    mount()
    expect(screen.getAllByTestId("sources-history")).toHaveLength(1)
  })
})

// ── §2 THE BLOCKS THE CONTRACT NAMES ──────────────────────────────────────────────────

describe("§2 the contract's blocks", () => {
  it("collapsed: 3 run rows and one quiet-fold", () => {
    mount()
    expect(screen.getAllByTestId("sources-run")).toHaveLength(3)
    expect(screen.getAllByTestId("sources-quiet-fold")).toHaveLength(1)
  })

  it("expanded: all 17 run rows and no fold", () => {
    mount({ expanded: true })
    expect(screen.getAllByTestId("sources-run")).toHaveLength(17)
    expect(screen.queryAllByTestId("sources-quiet-fold")).toHaveLength(0)
  })

  it("the fold says how many quiet checks it stands for, in the vocabulary's words", () => {
    mount()
    expect(screen.getByTestId("sources-quiet-fold")).toHaveTextContent(COPY.quietFold(14))
  })

  it("a failed run carries a fail-reason inside it", () => {
    mount()
    const reason = screen.getByTestId("sources-fail-reason")
    expect(reason).toBeInTheDocument()
    expect(screen.getAllByTestId("sources-run").some((row) => row.contains(reason))).toBe(true)
  })
})

// ── §3 THE TOGGLE ─────────────────────────────────────────────────────────────────────

describe("§3 the toggle-quiet control", () => {
  it("is named for what it will do — Show every check while collapsed", () => {
    mount()
    expect(screen.getByTestId("sources-toggle-quiet")).toHaveAccessibleName(COPY.showEvery)
  })

  it("and Hide quiet checks while expanded", () => {
    mount({ expanded: true })
    expect(screen.getByTestId("sources-toggle-quiet")).toHaveAccessibleName(COPY.hideQuiet)
  })

  it("asks its owner to toggle — it holds no state of its own", async () => {
    const user = userEvent.setup()
    const { onToggleExpanded } = mount()

    await user.click(screen.getByTestId("sources-toggle-quiet"))
    expect(onToggleExpanded).toHaveBeenCalledTimes(1)
  })
})

// ── §4 HONESTY ────────────────────────────────────────────────────────────────────────

describe("§4 what a failed run says", () => {
  it("⛔ renders the SENTENCE, never the exception string (T-235-12)", () => {
    mount()
    const expected = sourceFailureSentence(MACHINE_ERROR, CONNECTION)

    expect(screen.getByTestId("sources-fail-reason")).toHaveTextContent(expected)
    expect(screen.queryByText(/RefreshError/)).toBeNull()
    expect(screen.queryByText(/invalid_grant/)).toBeNull()
    expect(document.body.textContent ?? "").not.toContain(MACHINE_ERROR)
  })

  it("names the connection the person has to go and fix", () => {
    mount()
    expect(screen.getByTestId("sources-fail-reason")).toHaveTextContent(CONNECTION)
  })
})

describe("§5 a listing that could not be read is not a listing that found nothing", () => {
  it("⛔ a tick with listing_complete false never reads as `0 missing` (RESEARCH P-2)", () => {
    const incomplete = makeRun("1", { listing_complete: false })
    render(
      <RunHistoryList
        runs={[incomplete]}
        connectionName={CONNECTION}
        expanded={false}
        onToggleExpanded={vi.fn()}
        now={NOW}
      />,
    )

    expect(screen.getByTestId("sources-listing-incomplete")).toBeInTheDocument()
    expect(screen.queryByText(/0 missing/i)).toBeNull()
    expect(screen.queryByText(/nothing was (deleted|removed)/i)).toBeNull()
  })

  it("a tick whose listing WAS complete carries no such note", () => {
    render(
      <RunHistoryList
        runs={[makeRun("1", { count_new: 2 })]}
        connectionName={CONNECTION}
        expanded={false}
        onToggleExpanded={vi.fn()}
        now={NOW}
      />,
    )

    expect(screen.queryByTestId("sources-listing-incomplete")).toBeNull()
  })

  it("⛔ and it is never folded away as quiet — an incomplete listing could not tell", () => {
    render(
      <RunHistoryList
        runs={[makeRun("1", { listing_complete: false }), makeRun("2", { listing_complete: false })]}
        connectionName={CONNECTION}
        expanded={false}
        onToggleExpanded={vi.fn()}
        now={NOW}
      />,
    )

    expect(screen.getAllByTestId("sources-run")).toHaveLength(2)
    expect(screen.queryAllByTestId("sources-quiet-fold")).toHaveLength(0)
  })
})

// ── §6 THE SOURCE FENCES ──────────────────────────────────────────────────────────────

describe("§6 the fences a later edit must not break", () => {
  it("carries the live component source (non-vacuity for the fences below)", () => {
    expect(componentSource.length).toBeGreaterThan(800)
    expect(componentSource).toContain("RunHistoryList")
  })

  it("⛔ never applies --color-danger to a source state (BUILD-CONTRACT §4)", () => {
    expect(componentSource).not.toContain("color-danger")
    expect(componentSource).not.toContain("destructive")
  })

  it("⛔ reaches last_error ONLY as an argument to sourceFailureSentence", () => {
    const code = componentSource.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")
    const mentions = code.match(/last_error/g) ?? []
    const guarded = code.match(/sourceFailureSentence\(\s*[a-zA-Z.]*\.last_error/g) ?? []

    expect(mentions.length).toBeGreaterThan(0)
    expect(mentions).toHaveLength(guarded.length)
  })

  it("⛔ writes no user-facing sentence of its own — every sentence comes from the vocabulary", () => {
    // The plan's acceptance grep, made executable: a quoted literal that opens with a
    // capitalised word followed by a space is a SENTENCE, and sentences live in the leaf.
    expect(componentSource).not.toMatch(/["'][A-Z][a-z]+ [^"'\n]*["']/)
  })
})

// ── §7 WHAT THE CHECK ACTUALLY DID ────────────────────────────────────────────────────
//
// ⭐⭐ EVERY CASE BELOW ASSERTS CONTENT, AND THAT IS THE WHOLE LESSON OF THIS GAP.
//
// The gap this section closes (G1a, SC#1) shipped THROUGH a green fence. `sourceComposition`
// asserts that the contract's blocks are PRESENT, by `data-testid` — and `sources-run` and
// `sources-fail-reason` were both present, in the right counts, the entire time. They were
// rendering one summed `N files` where the approved design renders a per-category breakdown.
// A presence assertion cannot tell those two apart, so it passed on a surface that answered
// none of the questions SC#1 names: how many were ADDED, how many were SKIPPED, how many
// FAILED. That is ROADMAP failure mode #3, and it escaped because the only thing anybody
// asserted was that an element existed.
//
// ⛔ So: a case here that only proves an element exists has not closed this gap and must not
// be written. Each one below pins the rendered TEXT — several against the row's WHOLE string,
// so a bit that appears, disappears or is reworded reddens rather than passes quietly.

describe("§7 the per-category breakdown", () => {
  it("⭐ a row reads as the full breakdown, whole-string — not one summed number", () => {
    mountOne({ count_new: 3, count_modified: 1, count_missing: 2, count_errors: 1 })

    expect(rowText()).toBe(
      `${CHECKED_PREFIX("4 min ago")} · 3 added · 1 updated · 2 missing at source · 1 could not be read`,
    )
    // ⛔ The defect, stated as an assertion: the sum of those four is 7, and no reading of
    //    this row may be the word for a file count next to that total.
    expect(rowText()).not.toContain(COPY.checkedAgo("4 min ago", 7))
  })

  it("emits one element per NON-ZERO category, in the design's reading order", () => {
    mountOne({ count_new: 3, count_modified: 1, count_missing: 2, count_errors: 1 })

    expect(screen.getByTestId("sources-run-counts")).toBeInTheDocument()
    const shown = COUNT_ORDER.filter((key) => screen.queryByTestId(`sources-run-count-${key}`))
    expect(shown).toEqual(["new", "modified", "missing", "errors"])
    expect(screen.getByTestId("sources-run-count-new")).toHaveTextContent(
      `3 ${WORD_FOR_COUNT.new}`,
    )
    expect(screen.getByTestId("sources-run-count-errors")).toHaveTextContent(
      `1 ${WORD_FOR_COUNT.errors}`,
    )
  })

  it("⛔ a zero-valued category is ABSENT — never printed as a zero next to its word", () => {
    mountOne({ count_new: 3 })

    expect(rowText()).toBe(`${CHECKED_PREFIX("4 min ago")} · 3 added`)
    for (const key of COUNT_ORDER.filter((k) => k !== "new")) {
      expect(screen.queryByText(new RegExp(WORD_FOR_COUNT[key], "i"))).toBeNull()
      expect(screen.queryByTestId(`sources-run-count-${key}`)).toBeNull()
    }
    expect(rowText()).not.toMatch(/\b0\s/)
  })

  it("the store carries six counts, so renamed and restored get their own words too", () => {
    mountOne({ count_renamed: 2, count_restored: 1 })

    expect(rowText()).toBe(`${CHECKED_PREFIX("4 min ago")} · 2 renamed · 1 restored`)
  })

  it("⛔ a non-quiet check with nothing to count prints the instant and NO dangling separator", () => {
    // Not quiet because it failed — the counts are all zero, so the bit list is empty and a
    // joined list with an empty tail is exactly where a trailing separator hides.
    mountOne({ status: "failed" })

    expect(screen.queryByTestId("sources-run-counts")).toBeNull()
    expect(rowText()).toContain(CHECKED_PREFIX("4 min ago"))
    expect(rowText()).not.toContain("·")
  })

  it("⭐ a SUCCESSFUL check that could not read some files is not drawn as a clean one", () => {
    /**
     * ⛔ MEASURED ON THE OPERATOR'S OWN GMAIL WATCH, 2026-09-09. The run row read
     * `status = 'success'`, `listing_complete = true`, `count_errors = 2` — and this history
     * drew it exactly like a run where nothing went wrong, because `failed` was
     * `run.status !== "success"` and nothing else asked about the errors.
     *
     * ⚠ THE CHECK REALLY DID SUCCEED, so `failed` stays false and no failure sentence appears.
     * What was missing is the REGISTER: two files did not arrive and the eye slid past it.
     */
    mountOne({ status: "success", count_new: 3, count_errors: 2 })

    expect(screen.getByTestId("sources-run-partial")).toBeInTheDocument()
    expect(screen.getByTestId("sources-run-count-errors")).toHaveTextContent("2")
    // ⛔ NO INVENTED REASON. `last_error` is null on such a row, so a sentence here would be
    //    the unknown-failure prose attached to a run that did not fail.
    expect(screen.queryByTestId("sources-fail-reason")).toBeNull()
  })

  it("⚠ a clean check gets no partial mark — the marker must not be always-on", () => {
    mountOne({ status: "success", count_new: 3, count_errors: 0 })

    expect(screen.queryByTestId("sources-run-partial")).toBeNull()
  })

  it("a QUIET check is untouched — it still reads no changes, and prints no bits", () => {
    mountOne()

    expect(rowText()).toBe(COPY.checkedNoChange("4 min ago"))
    expect(screen.queryByTestId("sources-run-counts")).toBeNull()
  })

  it("⚠ an unparseable instant prints no time, and the bits still say what happened", () => {
    mountOne({ started_at: "not-an-instant", count_new: 5 })

    expect(rowText()).toBe("5 added")
    expect(rowText()).not.toMatch(/^·/)
  })

  it("⛔ an incomplete listing keeps its note, and the breakdown sits BESIDE it", () => {
    mountOne({ listing_complete: false, count_new: 2 })

    expect(rowText()).toContain(`${CHECKED_PREFIX("4 min ago")} · 2 added`)
    expect(screen.getByTestId("sources-listing-incomplete")).toBeInTheDocument()
    // ⛔ RESEARCH P-2 — `count_missing = 0` here was written by the H-5 structural guard, not
    //    observed at the source. It must never reach the screen as a reassuring zero.
    expect(screen.queryByText(/0 missing/i)).toBeNull()
    expect(screen.queryByTestId("sources-run-count-missing")).toBeNull()
  })

  it("the mounted sketch history reads its own ticks back, in words", () => {
    mount()

    const rows = screen.getAllByTestId("sources-run").map((r) => r.textContent ?? "")
    expect(rows.some((t) => t.includes("12 added") && t.includes("2 missing at source"))).toBe(true)
    expect(rows.some((t) => t.includes("3 added") && t.includes("1 updated"))).toBe(true)
    expect(rows.some((t) => t.includes("1 could not be read"))).toBe(true)
  })

  it("⛔ the summed reading is gone from the component, and the words come from the leaf", () => {
    // The plan's acceptance greps, made executable. The one-number helper is deleted here;
    // the source CARD keeps its own copy on purpose, and that difference is deliberate.
    expect(componentSource).not.toContain("filesTouched")
    expect(componentSource).toContain("COUNT_ORDER")
    expect(componentSource).toContain("WORD_FOR_COUNT")
    // ⛔ No breakdown word is spelled in the component — it composes, it does not author.
    expect(componentSource).not.toMatch(/["'](added|updated|missing at source|could not be read)["']/)
  })
})
