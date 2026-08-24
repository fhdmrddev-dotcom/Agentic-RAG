/**
 * Phase 200-05 Task 3 (DES-02 / D-09 / D-07) — `RunReceipt`.
 *
 * WHAT WOULD BE UNGUARDED WITHOUT THIS FILE:
 *  • that a step which declared NO count renders NO count slot at all — never `0`, never a
 *    dash, never prose. N-8 records that the sketch's own run surface puts the SENTENCE
 *    `Summarized meeting notes` where the COUNT `Found 12 contracts` goes, which is the
 *    fabricated-figure failure D-07 exists to prevent;
 *  • that a DECLARED `0` renders, because it is a measurement and not an absence;
 *  • that `never ran (skipped)` and `time not recorded` reach the DOM as DIFFERENT readings;
 *  • that the total runtime is derived from the PHASE TIMESTAMPS and not from a client clock;
 *  • that this component spells NO user-visible string of its own — every displayed word
 *    traces to a `receiptVocabulary.ts` import;
 *  • ⚠ that it is mounted on EXACTLY ONE surface — the run page — which is what keeps
 *    `199-02`'s refusal intact by construction rather than by care.
 *
 * ⚠ THAT LAST LINE READ *"MOUNTED NOWHERE at this commit"* UNTIL PHASE 200-07, and the
 * original is corrected here rather than quietly overwritten: `200-05` created this
 * component and deliberately mounted it nowhere, saying so in its own docblock and
 * predicting this edit; `200-07` mounted it on `WorkflowRunPage.tsx`, and the sweep below
 * went RED on that commit. It is INVERTED, not deleted — it now pins the importer list at
 * exactly one named file, so a SECOND mount (most of all on the builder, which has no run
 * and where a past-tense claim would be fabricated) reddens it again.
 */
import { describe, it, expect, vi } from "vitest"
import { render, screen, within } from "@testing-library/react"
import runReceiptSource from "./RunReceipt?raw"
import { RunReceipt } from "./RunReceipt"
import { type PhaseTimingRow } from "./phaseDuration"
import {
  countDeclared,
  HEADER_NOT_FINISHED,
  HEADER_SPAN_NOT_RECORDED,
  OUTCOME_FINISHED,
  OUTCOME_NEVER_RAN,
  RECEIPT_LANDMARK_LABEL,
  TIME_NOT_RECORDED,
  HEADER_STILL_RUNNING,
} from "./receiptVocabulary"

const NOW = Date.parse("2026-08-19T14:22:00.000Z")

/** D-09's own worked example, as wire rows. */
const rows: PhaseTimingRow[] = [
  {
    slug: "find",
    status: "completed",
    started_at: "2026-08-19T14:00:00.000Z",
    completed_at: "2026-08-19T14:00:01.800Z",
    step_count: 312,
    step_noun: "sources",
  },
  {
    slug: "pull",
    status: "completed",
    started_at: "2026-08-19T14:00:02.000Z",
    completed_at: "2026-08-19T14:02:06.000Z",
    step_count: 48,
    step_noun: "agents",
  },
  // A step whose phase type declares NO count at all — four of the seven do.
  {
    slug: "check",
    status: "completed",
    started_at: "2026-08-19T14:02:06.000Z",
    completed_at: "2026-08-19T14:03:57.000Z",
  },
  // Routed around: it NEVER RAN.
  { slug: "escalate", status: "skipped", started_at: null, completed_at: null },
  // A HISTORIC row: it really ran, before migration 121 existed.
  { slug: "write", status: "completed", started_at: null, completed_at: null },
]

const TITLES: Record<string, string> = {
  find: "Find the contracts",
  pull: "Pull the key terms",
  check: "Check them",
  escalate: "Escalate exceptions",
  write: "Write the summary",
}

function renderReceipt(over: Partial<React.ComponentProps<typeof RunReceipt>> = {}) {
  return render(
    <RunReceipt
      phases={rows}
      titleOf={(slug) => TITLES[slug] ?? slug}
      runStatus="completed"
      now={NOW}
      {...over}
    />,
  )
}

function cell(slug: string, testId: string): HTMLElement | null {
  return within(screen.getByTestId(`receipt-row-${slug}`)).queryByTestId(testId)
}

describe("RunReceipt — D-09's worked example, as measured facts", () => {
  it("renders one row per step, in the ORDER THE SERVER GAVE (never re-sorted)", () => {
    const { container } = renderReceipt()
    const items = Array.from(container.querySelectorAll("li"))
    expect(items.map((li) => li.getAttribute("data-testid"))).toEqual([
      "receipt-row-find",
      "receipt-row-pull",
      "receipt-row-check",
      "receipt-row-escalate",
      "receipt-row-write",
    ])
  })

  it("the header carries the total runtime, the step count and the finish time", () => {
    renderReceipt()
    const header = screen.getByTestId("receipt-header").textContent ?? ""
    // 14:00:00.000 → 14:03:57.000 across the rows = 3m 57s.
    expect(header).toContain("Ran 3m 57s")
    expect(header).toContain("5 steps")
    expect(header).toContain("finished ")
  })

  it("⚠ the total runtime is derived from the PHASE TIMESTAMPS, not from a client clock", () => {
    // The same rows measured at two wildly different `now`s produce the same total — which is
    // operationally what "a measured fact rather than a claim" means. A `claimed_at`- or
    // `Date.now()`-anchored figure would move between these two renders.
    const a = renderReceipt({ now: NOW })
    const first = screen.getByTestId("receipt-header").textContent
    a.unmount()
    renderReceipt({ now: NOW + 9_000_000 })
    expect(screen.getByTestId("receipt-header").textContent).toBe(first)
  })

  it("a run with NO readable timestamps says so in words — never `0s`", () => {
    renderReceipt({
      phases: [{ slug: "only", status: "completed", started_at: null, completed_at: null }],
    })
    const header = screen.getByTestId("receipt-header").textContent ?? ""
    expect(header).toContain(HEADER_SPAN_NOT_RECORDED)
    expect(header).toContain(HEADER_NOT_FINISHED)
    expect(header).not.toContain("0s")
    // ⚠ THE TWO ABSENCE ARMS SAY DIFFERENT THINGS: one is "we do not know how long", the
    // other "there is no finish instant to name".
    expect(HEADER_SPAN_NOT_RECORDED).not.toBe(HEADER_NOT_FINISHED)
  })
})

describe("RunReceipt — D-07: a count renders only where one was DECLARED", () => {
  it("a declared count renders as the wire's pair, verbatim", () => {
    renderReceipt()
    expect(cell("find", "receipt-row-count")?.textContent).toBe("312 sources")
    expect(cell("pull", "receipt-row-count")?.textContent).toBe("48 agents")
  })

  it("⚠ a step that declared NO count renders NO count slot AT ALL", () => {
    renderReceipt()
    expect(cell("check", "receipt-row-count")).not.toBeInTheDocument()
    // …and nothing stands in for it: no `0`, no dash, no prose (D-07 / SEED-159 / N-8).
    const face = screen.getByTestId("receipt-row-check").textContent ?? ""
    expect(face).not.toContain("—")
    expect(face).not.toMatch(/\b0\b/)
    // NON-VACUITY: the row is real and does carry its other facts.
    expect(face).toContain("Check them")
    expect(cell("check", "receipt-row-time")?.textContent).toBe("1m 51s")
  })

  it("⚠ a DECLARED `0` renders as the fact it is — the step searched and found nothing", () => {
    renderReceipt({
      phases: [
        { slug: "find", status: "completed", started_at: "2026-08-19T14:00:00.000Z", completed_at: "2026-08-19T14:00:02.000Z", step_count: 0, step_noun: "sources" },
      ],
    })
    expect(cell("find", "receipt-row-count")?.textContent).toBe("0 sources")
    // The point of the pair of cases: `0` and "declared nothing" are DIFFERENT renders, and a
    // coalesce or a truthiness test collapses them into one.
    expect(countDeclared(0, "sources")).not.toBe("")
  })

  it("the noun is the WIRE's, even one this client has never heard of (SEED-168)", () => {
    renderReceipt({
      phases: [{ slug: "find", status: "completed", started_at: null, completed_at: null, step_count: 7, step_noun: "widgets" }],
    })
    expect(cell("find", "receipt-row-count")?.textContent).toBe("7 widgets")
  })
})

describe("RunReceipt — D-06 reaches the DOM as two DIFFERENT readings", () => {
  it("⚠ a `skipped` step reads NEVER RAN while a historic row reads TIME NOT RECORDED", () => {
    renderReceipt()
    const routedAround = cell("escalate", "receipt-row-time")?.textContent
    const historic = cell("write", "receipt-row-time")?.textContent
    expect(routedAround).toBe(OUTCOME_NEVER_RAN)
    expect(historic).toBe(TIME_NOT_RECORDED)
    expect(routedAround).not.toBe(historic)
    // And their OUTCOME labels differ too, so neither row can be mistaken for the other on a
    // glance at either column.
    expect(cell("escalate", "receipt-row-outcome")?.textContent).toBe(OUTCOME_NEVER_RAN)
    expect(cell("write", "receipt-row-outcome")?.textContent).toBe(OUTCOME_FINISHED)
  })

  it("a still-active step under a PAUSED run reads its own words, not a live clock", () => {
    renderReceipt({
      phases: [{ slug: "ask", status: "active", started_at: "2026-08-19T14:00:00.000Z", completed_at: null }],
      runStatus: "paused",
    })
    const reading = cell("ask", "receipt-row-time")?.textContent ?? ""
    expect(reading).toContain("paused")
    expect(reading).not.toMatch(/\d+s/)
  })
})

describe("RunReceipt — the deliverable is the CALLER's, and optional", () => {
  it("renders it where the caller supplies one", () => {
    renderReceipt({ deliverableOf: (slug) => (slug === "write" ? "report.docx" : null) })
    expect(cell("write", "receipt-row-deliverable")?.textContent).toBe("report.docx")
  })

  it("⚠ renders NOTHING where the caller supplies none — nothing on the row says what a step produced", () => {
    renderReceipt()
    for (const slug of Object.keys(TITLES)) {
      expect(cell(slug, "receipt-row-deliverable")).not.toBeInTheDocument()
    }
  })

  it("a BLANK answer is an absence too — never an empty chip", () => {
    renderReceipt({ deliverableOf: () => "   " })
    expect(cell("find", "receipt-row-deliverable")).not.toBeInTheDocument()
    // NON-VACUITY: the same render DOES show a deliverable when one is really supplied.
    expect(screen.getByTestId("receipt-row-find")).toBeInTheDocument()
  })
})

describe("RunReceipt — the one-string-home rule, and the deliberate non-mount", () => {
  it("⚠ spells NO user-visible sentence of its own — every word traces to the vocabulary", () => {
    // Sweep the JSX for a bare string literal in a text position. The component's own strings
    // are all `data-testid`s, class lists and imported identifiers.
    const jsxText = runReceiptSource.match(/>\s*[A-Z][a-z][^<>{}]{3,}</g) ?? []
    expect(jsxText).toEqual([])
    // The accessible name is imported too — ⚠ an `aria-label` IS user-visible text, it is just
    // not legible to a sighted reviewer, which makes it the harder drift to notice.
    expect(runReceiptSource).toContain("aria-label={RECEIPT_LANDMARK_LABEL}")
    expect(screen.queryByLabelText(RECEIPT_LANDMARK_LABEL)).not.toBeInTheDocument()
    renderReceipt()
    expect(screen.getByLabelText(RECEIPT_LANDMARK_LABEL)).toBeInTheDocument()
  })

  it("POSITIVE CONTROL — the literal sweep really can find a sentence in a text position", () => {
    const planted = "<span>Summarized meeting notes</span>"
    expect(planted.match(/>\s*[A-Z][a-z][^<>{}]{3,}</g)).not.toEqual([])
  })

  it("⚠ is mounted on the RUN PAGE and NOWHERE ELSE — 199-02's refusal, by construction", () => {
    // ─────────────────────────────────────────────────────────────────────────────────────
    // ⚠ THIS CASE WAS `is MOUNTED NOWHERE` UNTIL PHASE 200-07, AND IT WENT RED THE MOMENT
    // THAT PLAN MOUNTED THE COMPONENT — which is the fence doing its job at exactly the
    // moment its invariant was deliberately superseded, not a fence that rotted.
    //
    // It is INVERTED here rather than deleted (the `192.2-05` method, and `200-05`'s own
    // `BS-MNR-01` precedent one file over): a removed assertion proves nothing afterwards,
    // whereas a live one that now names the ONE permitted importer reddens again if a
    // SECOND mount ever appears. `200-05`'s own docblock predicted this edit in as many
    // words — *"created here and mounted in `200-07`. That is deliberate."*
    //
    // WHAT STILL MATTERS, and is the whole reason the assertion survives in any form: the
    // builder's spine reads a DRAFT definition and has NO RUN, so a past-tense receipt there
    // would be a fabricated claim — precisely what `199-02` refused. Keeping that a property
    // of the IMPORT GRAPH rather than of anyone's care is what the sweep buys.
    // ─────────────────────────────────────────────────────────────────────────────────────
    const modules = import.meta.glob("/src/**/*.{ts,tsx}", { query: "?raw", import: "default", eager: true }) as Record<string, string>
    // NON-VACUITY: the sweep really read the tree, and it really can see this component's own
    // two files (its source and this suite).
    expect(Object.keys(modules).length).toBeGreaterThan(200)
    const importers = Object.entries(modules)
      .filter(([path]) => !path.endsWith("RunReceipt.tsx") && !path.endsWith("RunReceipt.test.tsx"))
      .filter(([, src]) => /from\s+["'][^"']*RunReceipt["']/.test(src) || /<RunReceipt[\s/>]/.test(src))
      .map(([path]) => path)
    // EXACTLY ONE importer, and it is named. A `toContain` would pass with a second mount
    // sitting silently beside it; the equality is what makes this a budget rather than a hope.
    expect(importers.map((p) => p.split("/").pop())).toStrictEqual(["WorkflowRunPage.tsx"])
    // …and the surface with no run is named explicitly too, so the refusal is stated rather
    // than inferred from the list above.
    expect(importers.some((p) => p.endsWith("WorkflowBuilderPage.tsx"))).toBe(false)
    expect(importers.some((p) => p.endsWith("PhaseSpineGraph.tsx"))).toBe(false)
  })

  it("POSITIVE CONTROL — the importer sweep really can find a mount", () => {
    const planted = 'import { RunReceipt } from "@/components/workflows/RunReceipt"\n<RunReceipt phases={[]} />'
    expect(/from\s+["'][^"']*RunReceipt["']/.test(planted)).toBe(true)
    expect(/<RunReceipt[\s/>]/.test(planted)).toBe(true)
  })

  it("takes no run-tense decision of its own — the resolver is the only source", () => {
    // A second `typeof step_count === "number"` here would be a second place to get D-07
    // wrong. The component reads `declaredCount`'s answer and nothing else.
    expect(runReceiptSource).toContain("declaredCount(row)")
    expect(runReceiptSource.split("typeof row.step_count").length - 1).toBe(0)
    expect(runReceiptSource).toContain("phaseRunFacts(row, runStatus, now)")
    // …and it formats no duration of its own beyond the ONE hoisted formatter.
    expect(runReceiptSource.split("padStart(2").length - 1).toBe(0)
    expect(runReceiptSource).toContain('from "@/lib/fmtElapsed"')
  })

  it("does not throw on an empty run, and says so honestly", () => {
    expect(() => renderReceipt({ phases: [] })).not.toThrow()
    const header = screen.getByTestId("receipt-header").textContent ?? ""
    expect(header).toContain("0 steps")
    expect(header).toContain(HEADER_SPAN_NOT_RECORDED)
  })

  it("a `constructor`-slugged step renders its own facts, never a function (WR-04)", () => {
    renderReceipt({
      phases: [{ slug: "constructor", status: "completed", started_at: "2026-08-19T14:00:00.000Z", completed_at: "2026-08-19T14:00:05.000Z" }],
      titleOf: vi.fn(() => "A hostile slug"),
    })
    expect(cell("constructor", "receipt-row-time")?.textContent).toBe("5s")
  })
})

// ── THE HEADER MUST NOT CLAIM A RUN HAS STOPPED WHILE IT IS RUNNING ──────────────────────
//
// ⚠ FOUND BY DRIVING A REAL RUN, NOT BY A TEST — and that is why the block exists. On
// 2026-08-20 a live run of a workflow with a human-input step sat PAUSED on its approval
// gate, and this strip read *"Ran 42s · 3 steps · finished 22:15"* beside a spine whose
// second row was visibly waiting for an answer and a page header that said `Running`.
//
// Both FIGURES were honest — `runSpan` is `min(started_at) → max(completed_at)` across the
// phase rows, and the first step really did complete at 22:15. What was wrong is what the
// SENTENCES asserted about them. Every case in this file passed throughout, because every one
// of them rendered a terminal run: the defect lived entirely in a state the suite never built.
describe("RunReceipt — a run in flight is never described in the past tense", () => {
  /** The same rows, cut off mid-run: two steps done, the third started and not finished. */
  const liveRows: PhaseTimingRow[] = [
    rows[0],
    rows[1],
    { slug: "check", status: "active", started_at: "2026-08-19T14:02:06.000Z", completed_at: null },
  ]

  for (const status of ["active", "paused", "cap_paused"] as const) {
    it(`\`${status}\` reports the runtime SO FAR and refuses to name a finish`, () => {
      renderReceipt({ phases: liveRows, runStatus: status })
      const header = screen.getByTestId("receipt-header").textContent ?? ""

      // ⚠ THE EXACT SHAPE OF THE OLD LIE, RULED OUT BY NAME: `Ran …` is a claim that it
      // stopped, and `finished HH:MM` names an instant it has not reached.
      expect(header).not.toMatch(/\bRan\b/)
      expect(header).not.toMatch(/\bfinished \d/)
      // …and it still reports the measurement, because the figure was never the problem.
      expect(header).toContain(HEADER_STILL_RUNNING)
      expect(header).toMatch(/\d+[smh]/)
      expect(header).toContain("3 steps")
    })
  }

  it("a TERMINAL run is unchanged — the past tense is correct there and still used", () => {
    // The control. Without it the block above is satisfied by a strip that never says `Ran`.
    renderReceipt({ phases: liveRows, runStatus: "completed" })
    const header = screen.getByTestId("receipt-header").textContent ?? ""
    expect(header).toMatch(/\bRan\b/)
    expect(header).not.toContain(HEADER_STILL_RUNNING)
  })

  it("`still running` OUTRANKS `no finish time recorded`, and the two are different words", () => {
    // ⚠ THE PRECEDENCE IS THE CONTRACT. A live run whose rows carry NO instants has no finish
    // time for TWO reasons at once, and the useful one is that it has not finished — that
    // tells a person to keep waiting, where "we do not hold the instant" does not.
    renderReceipt({
      phases: [{ slug: "write", status: "active", started_at: null, completed_at: null }],
      runStatus: "active",
    })
    const header = screen.getByTestId("receipt-header").textContent ?? ""
    expect(header).toContain(HEADER_STILL_RUNNING)
    expect(header).not.toContain(HEADER_NOT_FINISHED)
    // …and the untimed arm still speaks, because the runtime really is not recorded.
    expect(header).toContain(HEADER_SPAN_NOT_RECORDED)
    // The two sentences are not the same sentence — the fold this asserts against.
    expect(HEADER_STILL_RUNNING).not.toBe(HEADER_NOT_FINISHED)
  })

  it("an ABSENT run status asserts NO finish — never success by default", () => {
    // ⚠ THIS CASE WAS WRITTEN THE OTHER WAY ROUND FIRST, AND THE IMPLEMENTATION WAS RIGHT.
    // The first draft asserted the PAST tense here, arguing that `runStatus` is optional, that
    // the receipt's only production mount always passes one, and that a missing status is
    // therefore a caller bug rather than a run state. It went red, and the argument does not
    // survive being checked: when the status is absent we do not know whether the run
    // finished, and the two arms are NOT symmetric. The past-tense arm ASSERTS a completion
    // and names an instant; the live arm asserts only that no finish is known. This
    // repository's standing rule — never success by default (T-15) — picks the second.
    //
    // Recorded rather than quietly re-pointed: a test rewritten to match the code is worthless
    // unless the reason it changed is written down.
    renderReceipt({ phases: liveRows, runStatus: undefined })
    const header = screen.getByTestId("receipt-header").textContent ?? ""
    expect(header).not.toMatch(/finished \d/)
    expect(header).toContain(HEADER_STILL_RUNNING)
  })
})
