/**
 * Phase 200 — `RunTranscript.tsx`'s guard, pinned in the commit that created it (the
 * 196-05 / 196-07 rule: *"an unpinned file is not a lightly-guarded one, it is an UNGUARDED
 * one"*).
 *
 * WHAT WOULD BE UNGUARDED WITHOUT THIS FILE:
 *  • **the tense rule** — that a state word never sits beside a duration the other source's
 *    view of liveness contradicts. Both directions are driven, and both were the reason the
 *    rule was rewritten mid-build;
 *  • that a row's instant is its `completed_at` when it has one, so a finished step sorts by
 *    its ENDING and the running step by its beginning;
 *  • that EVERY row renders — including one with no readable instant, which keeps its gutter
 *    column and holds nothing rather than a fabricated zero or a dash;
 *  • that a declared `0` renders and an ABSENT count renders NO ELEMENT (D-07 / `SEED-159`),
 *    with a positive control proving the two are distinguishable in this render;
 *  • that the two absence headlines are picked apart correctly — no steps versus no times;
 *  • that this file spells NO user-visible string of its own (rule 3: one literal left in
 *    JSX is a second home, and a second home cannot be re-worded by a one-line diff).
 */
import { describe, it, expect } from "vitest"
import { render, screen, within, cleanup } from "@testing-library/react"
import { afterEach } from "vitest"
import RunTranscriptSource from "./RunTranscript?raw"
import { RunTranscript, type TranscriptLiveReading } from "./RunTranscript"
import { type PhaseTimingRow } from "./phaseDuration"
import {
  TRANSCRIPT_LANDMARK_LABEL,
  TRANSCRIPT_NO_STEPS,
  TRANSCRIPT_TIMES_NOT_RECORDED,
} from "./transcriptVocabulary"
import { OUTCOME_FINISHED, OUTCOME_NEVER_RAN, OUTCOME_NOT_REACHED } from "./receiptVocabulary"

afterEach(cleanup)

const T0 = Date.parse("2026-08-20T10:00:00Z")
const s = (offsetSeconds: number) => new Date(T0 + offsetSeconds * 1000).toISOString()

/** The three-step run these cases share. Step 1 finished, step 2 finished later, step 3
 *  was never reached — the ordinary mid-life shape. */
const ROWS: PhaseTimingRow[] = [
  {
    slug: "gather",
    status: "completed",
    started_at: s(0),
    completed_at: s(12),
    step_count: 312,
    step_noun: "sources",
  },
  { slug: "draft", status: "completed", started_at: s(14), completed_at: s(70) },
  { slug: "check", status: "pending" },
]

const titleOf = (slug: string) => `Step ${slug}`

function liveMap(entries: Record<string, TranscriptLiveReading>) {
  return (slug: string) => entries[slug]
}

function rowsInOrder(): string[] {
  return Array.from(document.querySelectorAll('[data-testid^="transcript-row-"]')).map(
    (el) => el.getAttribute("data-testid") ?? "",
  )
}

function clockOf(slug: string): string {
  const row = screen.getByTestId(`transcript-row-${slug}`)
  return within(row).getByTestId("transcript-clock").textContent ?? ""
}

function stateOf(slug: string): string {
  const row = screen.getByTestId(`transcript-row-${slug}`)
  return within(row).getByTestId("transcript-state").textContent ?? ""
}

// ── 1. The region and its two absences ──────────────────────────────────────────────

describe("RunTranscript — the region", () => {
  it("names itself from the vocabulary, never from a literal", () => {
    render(<RunTranscript phases={ROWS} titleOf={titleOf} now={T0} />)
    expect(screen.getByTestId("run-transcript").getAttribute("aria-label")).toBe(
      TRANSCRIPT_LANDMARK_LABEL,
    )
  })

  it("a run with NO rows says so — and says the no-STEPS sentence, not the no-TIMES one", () => {
    render(<RunTranscript phases={[]} titleOf={titleOf} now={T0} />)
    expect(screen.getByTestId("run-transcript-empty").textContent).toBe(TRANSCRIPT_NO_STEPS)
    expect(screen.queryByTestId("run-transcript-untimed")).toBeNull()
  })

  it("a run whose rows carry NO readable start says the no-TIMES sentence — and still renders every row", () => {
    // ⚠ THE ROWS ARE STILL TRUE; only their placement in time is unknown. A region that
    // vanished here would read as "the run did nothing", which is a worse claim than "we do
    // not hold a time for it".
    const historic: PhaseTimingRow[] = [
      { slug: "gather", status: "completed" },
      { slug: "draft", status: "failed" },
    ]
    render(<RunTranscript phases={historic} titleOf={titleOf} now={T0} />)
    expect(screen.getByTestId("run-transcript-untimed").textContent).toBe(
      TRANSCRIPT_TIMES_NOT_RECORDED,
    )
    expect(screen.queryByTestId("run-transcript-empty")).toBeNull()
    expect(rowsInOrder()).toEqual(["transcript-row-gather", "transcript-row-draft"])
    // The gutter column survives and holds NOTHING — never a zero, never a dash.
    expect(clockOf("gather")).toBe("")
  })

  it("does not print the no-times headline merely because ONE row is untimed", () => {
    // ⚠ IT IS A STATEMENT ABOUT THE RUN. `ROWS` has an untimed `check` step and a perfectly
    // good clock, and a headline above that list would be false.
    render(<RunTranscript phases={ROWS} titleOf={titleOf} now={T0} />)
    expect(screen.queryByTestId("run-transcript-untimed")).toBeNull()
    expect(clockOf("check")).toBe("")
  })
})

// ── 2. Placement and order ──────────────────────────────────────────────────────────

describe("RunTranscript — where a step sits on the clock", () => {
  it("stamps every step at its START, so the gutter reads as a timeline", () => {
    // ⚠ REVERSED FROM A COMPLETION STAMP on 2026-08-20 — see `transcriptEntries`' docblock. The
    // first step starts AT the anchor, so a completion stamp printed the same string as its own
    // duration (`11s · … · 11s`), which is what the browser showed.
    render(<RunTranscript phases={ROWS} titleOf={titleOf} now={T0} />)
    expect(clockOf("gather")).toBe("0s")
    expect(clockOf("draft")).toBe("14s")
  })

  it("the stamp and the duration are DIFFERENT facts on the same line", () => {
    // The non-vacuity of the reversal: on the first row they must not be the same string.
    render(<RunTranscript phases={ROWS} titleOf={titleOf} now={T0} />)
    const row = screen.getByTestId("transcript-row-gather")
    const stamp = within(row).getByTestId("transcript-clock").textContent
    const duration = within(row).getByTestId("transcript-time").textContent
    expect(stamp).toBe("0s")
    expect(duration).toBe("12s")
    expect(stamp).not.toBe(duration)
  })

  it("orders by the clock, and appends the untimed rows after every timed one", () => {
    // The server order here is deliberately the REVERSE of the time order, so a render that
    // ignored the instants would pass by accident.
    const scrambled: PhaseTimingRow[] = [
      { slug: "check", status: "pending" },
      { slug: "draft", status: "completed", started_at: s(14), completed_at: s(70) },
      { slug: "gather", status: "completed", started_at: s(0), completed_at: s(12) },
    ]
    render(<RunTranscript phases={scrambled} titleOf={titleOf} now={T0} />)
    expect(rowsInOrder()).toEqual([
      "transcript-row-gather",
      "transcript-row-draft",
      "transcript-row-check",
    ])
  })

  it("breaks a tie on the SERVER's row order, never on the slug", () => {
    // Two steps completing in the same millisecond is a real outcome on a fast run; the
    // server's own ordering is the only tiebreak this component is allowed.
    const tied: PhaseTimingRow[] = [
      { slug: "zebra", status: "completed", started_at: s(0), completed_at: s(5) },
      { slug: "alpha", status: "completed", started_at: s(1), completed_at: s(5) },
    ]
    render(<RunTranscript phases={tied} titleOf={titleOf} now={T0} />)
    expect(rowsInOrder()).toEqual(["transcript-row-zebra", "transcript-row-alpha"])
  })
})

// ── 3. The tense rule — both contradictions, driven ─────────────────────────────────

describe("RunTranscript — the state word and the duration cannot contradict each other", () => {
  it("a live step shows the page's label and NO duration", () => {
    const live: PhaseTimingRow[] = [{ slug: "draft", status: "active", started_at: s(14) }]
    // (the row and the reading agree: `active` ⇒ `running`)
    render(
      <RunTranscript
        phases={live}
        titleOf={titleOf}
        runStatus="active"
        liveOf={liveMap({ draft: { reading: "running", label: "Running" } })}
        now={T0 + 60_000}
      />,
    )
    expect(stateOf("draft")).toBe("Running")
    expect(within(screen.getByTestId("transcript-row-draft")).queryByTestId("transcript-time"))
      .toBeNull()
  })

  it("drops the page's words when they contradict the row's own status — the MEASURED crossing", () => {
    /**
     * ⚠ THIS IS THE CASE THAT WAS FOUND ON THE OPERATOR'S DATABASE, NOT INVENTED. The page
     * joins the definition's steps onto the run's rows by `phase_index` (D-188-01); on 2 of
     * 228 local runs the run's own `phase_index` values disagree with the definition's
     * ordering, and the join then reports each step's state as its NEIGHBOUR's. The first run
     * opened in a browser was one of them, and it printed *"Produce the deliverable · Not
     * started"* about a step that had FAILED.
     *
     * The row's own fields cannot be crossed that way — slug, status, timestamps and count all
     * come from one record — so a disagreement drops the page's words entirely.
     */
    render(
      <RunTranscript
        phases={ROWS}
        titleOf={titleOf}
        // The row says `completed`; the page's reading says this step never started.
        liveOf={liveMap({ gather: { reading: "not-started", label: "Not started" } })}
        now={T0}
      />,
    )
    expect(stateOf("gather")).toBe(OUTCOME_FINISHED)
    expect(stateOf("gather")).not.toBe("Not started")
    // ⚠ THE HELD READING IS STILL READABLE, and the conflict is announced. Dropping the words
    // silently would leave a crossed run looking exactly like a correct one.
    const row = screen.getByTestId("transcript-row-gather")
    expect(row.getAttribute("data-reading")).toBe("not-started")
    expect(row.getAttribute("data-source-conflict")).toBe("true")
    // NON-VACUITY: an AGREEING row in the same render keeps the page's words and is not
    // flagged, so the two attributes above are the rule firing rather than a constant.
    expect(screen.getByTestId("transcript-row-draft").getAttribute("data-source-conflict"))
      .toBeNull()
  })

  it("a stale slice still calling a finished step live is a disagreement, so the wire's word shows", () => {
    // ⚠ CONTRADICTION ONE, and the reason the rule is an agreement test rather than a
    // preference: a present-tense word beside a finished duration. The wire says this step
    // completed in 12s. The line shows what the row itself records.
    render(
      <RunTranscript
        phases={ROWS}
        titleOf={titleOf}
        liveOf={liveMap({ gather: { reading: "running", label: "Running" } })}
        now={T0}
      />,
    )
    expect(stateOf("gather")).toBe(OUTCOME_FINISHED)
    expect(
      within(screen.getByTestId("transcript-row-gather")).getByTestId("transcript-time").textContent,
    ).toBe("12s")
  })

  it("a slice ahead of the wire is a disagreement too — the mirror case", () => {
    // ⚠ CONTRADICTION TWO: a settled word beside a still-ticking duration. The slice says this
    // step is done; the row is still `active`. The row's own pairing is internally consistent
    // and is what renders.
    const inFlight: PhaseTimingRow[] = [{ slug: "draft", status: "active", started_at: s(14) }]
    render(
      <RunTranscript
        phases={inFlight}
        titleOf={titleOf}
        runStatus="active"
        liveOf={liveMap({ draft: { reading: "done", label: "Complete" } })}
        now={T0 + 600_000}
      />,
    )
    expect(stateOf("draft")).not.toBe("Complete")
    expect(screen.getByTestId("transcript-row-draft").getAttribute("data-source-conflict"))
      .toBe("true")
  })

  it("`waiting-for-you` AGREES with a `running` row — the state this surface most needs to name", () => {
    // ⚠ THE ONE COMPARISON AN `===` WOULD GET WRONG. The wire has no `waiting-for-you`
    // status: it is DERIVED on top of a running row when an ask is pending. An identity test
    // would call it a disagreement and drop the very label that says a person is being
    // waited on.
    const waiting: PhaseTimingRow[] = [{ slug: "check", status: "active", started_at: s(20) }]
    render(
      <RunTranscript
        phases={waiting}
        titleOf={titleOf}
        runStatus="active"
        liveOf={liveMap({
          check: { reading: "waiting-for-you", label: "Paused for your answer" },
        })}
        now={T0 + 60_000}
      />,
    )
    expect(stateOf("check")).toBe("Paused for your answer")
    expect(screen.getByTestId("transcript-row-check").getAttribute("data-source-conflict"))
      .toBeNull()
    expect(within(screen.getByTestId("transcript-row-check")).queryByTestId("transcript-time"))
      .toBeNull()
  })

  it("a reading this build does not know FAILS CLOSED to the wire, never to a prototype member", () => {
    // ⚠ WR-04. The reading arrives as a plain string on a read shape, and the agreement table
    // is a plain object literal — so a `constructor`-shaped reading reaches the lookup. An
    // own-property read resolves it to nothing, which is a DISAGREEMENT and therefore the
    // wire's word; a bare index would hand back a function and take the agreeing branch.
    render(
      <RunTranscript
        phases={ROWS}
        titleOf={titleOf}
        liveOf={liveMap({ gather: { reading: "constructor", label: "NOT A STATE" } })}
        now={T0}
      />,
    )
    expect(stateOf("gather")).toBe(OUTCOME_FINISHED)
    expect(screen.getByTestId("transcript-row-gather").getAttribute("data-source-conflict"))
      .toBe("true")
  })

  it("an ORDINARY COMPLETION says nothing — the bright line is the statement", () => {
    /**
     * ⚠ THE RULE THE BROWSER FORCED. The first port printed `Complete` on all five rows of a
     * five-step run: `SEED-184`'s *"information is dumped as text, not presented"* complaint,
     * arriving in the surface built to answer it. The sheet prints no status word anywhere.
     *
     * ⚠ IT IS NOT COLOUR-ALONE, and that is why the removal is safe: the state is still stated
     * in words once per step, on the SPINE beside this column, which carries a glyph and a
     * `data-reading` for every step including the finished ones.
     */
    render(
      <RunTranscript
        phases={ROWS}
        titleOf={titleOf}
        liveOf={liveMap({ gather: { reading: "done", label: "Complete" } })}
        now={T0}
      />,
    )
    const row = screen.getByTestId("transcript-row-gather")
    expect(within(row).queryByTestId("transcript-state")).toBeNull()
    // ...and the facts it DOES carry are all still there.
    expect(within(row).getByTestId("transcript-time").textContent).toBe("12s")
    expect(within(row).getByTestId("transcript-count").textContent).toBe("312 sources")
    // NON-VACUITY: a step that is NOT an ordinary completion still speaks, in the same render.
    expect(stateOf("check")).toBe(OUTCOME_NOT_REACHED)
  })

  it("every reading other than `done` still carries its word", () => {
    // The exceptional cases are exactly the ones a person needs told rather than left to infer.
    const mixed: PhaseTimingRow[] = [
      { slug: "gather", status: "failed", started_at: s(0), completed_at: s(4) },
      { slug: "draft", status: "active", started_at: s(6) },
      { slug: "check", status: "skipped" },
    ]
    render(
      <RunTranscript
        phases={mixed}
        titleOf={titleOf}
        runStatus="active"
        liveOf={liveMap({
          gather: { reading: "failed", label: "Failed — its answer did not pass the checks" },
          draft: { reading: "running", label: "Running" },
          check: { reading: "skipped", label: "Skipped" },
        })}
        now={T0 + 10_000}
      />,
    )
    expect(stateOf("gather")).toBe("Failed — its answer did not pass the checks")
    expect(stateOf("draft")).toBe("Running")
    expect(stateOf("check")).toBe("Skipped")
  })

  it("falls back to the RECEIPT's outcome for a slug the page holds no reading for", () => {
    // ⚠ THE FLOOR, and it must be a real word rather than a blank: the page can legitimately
    // hold no reading for a step (a definition it could not resolve), and a line with no
    // state at all reads as a step that did nothing.
    render(<RunTranscript phases={ROWS} titleOf={titleOf} now={T0} />)
    expect(stateOf("gather")).toBe(OUTCOME_FINISHED)
    expect(stateOf("check")).toBe(OUTCOME_NOT_REACHED)
  })

  it("never prints the same string twice on one line", () => {
    // ⚠ FOUND IN THE BROWSER, on a real run. A `pending` row resolves BOTH its outcome word
    // and its timing reading to the same constant, and the line read `not reached · not
    // reached` — which is not two facts, it is one fact and a surface that has lost track of
    // what it is saying.
    render(<RunTranscript phases={ROWS} titleOf={titleOf} now={T0} />)
    const row = screen.getByTestId("transcript-row-check")
    expect(stateOf("check")).toBe(OUTCOME_NOT_REACHED)
    expect(within(row).queryByTestId("transcript-time")).toBeNull()
    // NON-VACUITY: a row whose duration DOES add something still prints it.
    expect(
      within(screen.getByTestId("transcript-row-gather")).getByTestId("transcript-time").textContent,
    ).toBe("12s")
  })

  it("a skipped step reads NEVER RAN, which is not the same as a time we do not hold", () => {
    // The D-06 split, met at this surface: `never ran` is an affirmative fact.
    const skipped: PhaseTimingRow[] = [{ slug: "check", status: "skipped" }]
    render(<RunTranscript phases={skipped} titleOf={titleOf} now={T0} />)
    expect(stateOf("check")).toBe(OUTCOME_NEVER_RAN)
  })
})

// ── 4. The count: `0` is a fact, absence is not ─────────────────────────────────────

describe("RunTranscript — the declared count", () => {
  it("renders the wire's pair VERBATIM, substituting no word of its own", () => {
    render(<RunTranscript phases={ROWS} titleOf={titleOf} now={T0} />)
    expect(
      within(screen.getByTestId("transcript-row-gather")).getByTestId("transcript-count").textContent,
    ).toBe("312 sources")
  })

  it("a step that declared NO count renders NO element — never a `0`, never a dash", () => {
    render(<RunTranscript phases={ROWS} titleOf={titleOf} now={T0} />)
    expect(within(screen.getByTestId("transcript-row-draft")).queryByTestId("transcript-count"))
      .toBeNull()
  })

  it("a declared `0` renders, because the step searched and found nothing", () => {
    const zero: PhaseTimingRow[] = [
      {
        slug: "gather",
        status: "completed",
        started_at: s(0),
        completed_at: s(12),
        step_count: 0,
        step_noun: "sources",
      },
    ]
    render(<RunTranscript phases={zero} titleOf={titleOf} now={T0} />)
    expect(
      within(screen.getByTestId("transcript-row-gather")).getByTestId("transcript-count").textContent,
    ).toBe("0 sources")
  })
})

// ── 5. The source sweep ─────────────────────────────────────────────────────────────

describe("RunTranscript — it spells nothing", () => {
  /**
   * ⚠ RULE 3, ASSERTED RATHER THAN TRUSTED. One sentence literal left in JSX is a second
   * home for governed copy, and a second home cannot be re-worded by a one-line diff.
   *
   * The probe is a sweep for a JSX text child that is a bare quoted sentence — a run of
   * letters containing a space — inside the component body, comments stripped. Comments are
   * stripped because this file's docblock quotes the sheet's own narration on purpose, and a
   * sweep that could not tell prose from code would count that (the 187-24 trap, which has
   * fired repeatedly in this tree).
   */
  const code = RunTranscriptSource.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "")

  it("carries no multi-word string literal outside the imports", () => {
    const body = code.slice(code.lastIndexOf('from "@/components/workflows/transcriptVocabulary"'))
    const sentences = body.match(/"[A-Za-z][A-Za-z' ]*\s[A-Za-z' ]+"/g) ?? []
    expect(sentences).toEqual([])
    // POSITIVE CONTROL — the sweep really does catch one.
    expect('<span>{"Step started"}</span>'.match(/"[A-Za-z][A-Za-z' ]*\s[A-Za-z' ]+"/g)).toHaveLength(
      1,
    )
  })

  it("imports every word it renders from a vocabulary module", () => {
    expect(code).toMatch(/from "@\/components\/workflows\/transcriptVocabulary"/)
    expect(code).toMatch(/from "@\/components\/workflows\/receiptVocabulary"/)
  })
})
