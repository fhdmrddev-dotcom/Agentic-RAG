/**
 * `RunSpine.tsx`'s guard — the run surface's right-hand spine.
 *
 * ⚠ THIS FILE WAS OWED AND IS NOW PAID. The component shipped exercised only TRANSITIVELY,
 * through `WorkflowRunPage.test.tsx` — precisely the state `panel/phaseStatusMeta.ts` was
 * criticised for, and the state the 196-05 rule calls UNGUARDED rather than lightly guarded.
 *
 * WHAT WOULD BE UNGUARDED WITHOUT IT:
 *  • that the spine spells NO SLUG. It exists because a wiring pass mounted the DEVELOPER
 *    `PhaseTimeline` here and the run surface showed raw `workflow_phases.slug` values, a
 *    `Phase 5 / 5` counter and an agent count to a business author — Phase 187's whole subject;
 *  • D-07's count rule at the surface that now carries it: a declared `0` RENDERS, an ABSENT
 *    count renders NO ELEMENT — never `0`, never a dash, never prose;
 *  • that a historic row still says `time not recorded`. An earlier draft computed the duration
 *    locally, which produced a figure for rows holding both instants and NOTHING for the rows
 *    that do not, so D-06's absence arm lost its only home on the page;
 *  • that a STATE fact (`never ran (skipped)`, `not reached`) does NOT appear in the time
 *    column — the log's word carries it, and repeating it here is the duplication this surface
 *    keeps removing;
 *  • that liveness is decided by BOTH sources, so a stale slice cannot pulse a finished step.
 */
import { describe, it, expect, afterEach } from "vitest"
import { render, screen, within, cleanup } from "@testing-library/react"
import { RunSpine } from "./RunSpine"
import { type PhaseTimingRow } from "./phaseDuration"

afterEach(cleanup)

const T0 = Date.parse("2026-08-20T10:00:00Z")
const s = (sec: number) => new Date(T0 + sec * 1000).toISOString()

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

const titleOf = (slug: string) => ({ gather: "Pull the contracts", draft: "Draft it", check: "Check it over" })[slug] ?? slug
const live = (m: Record<string, { reading: string; label: string }>) => (slug: string) => m[slug]

function row(slug: string) {
  return screen.getByTestId(`spine-step-${slug}`)
}

describe("RunSpine — it speaks the author's language, never the schema's", () => {
  it("names every step with the caller's title and spells no slug anywhere", () => {
    render(<RunSpine phases={ROWS} titleOf={titleOf} now={T0} />)
    // ⚠ RE-ANCHORED ON THE COMPONENT'S OWN ROOT, NOT ON THE HEADING. It read
    // `screen.getByText(SPINE_HEADING).closest("div")?.parentElement` — which reached this
    // component's root only because the heading happened to live inside it. The heading has
    // moved to the PAGE's header band (so the panel's heading and the page's share one row;
    // see `RunSpine.tsx`'s own note), and an anchor that depended on where a heading lived was
    // never asserting anything about the spine. `run-spine` names the subject directly.
    const text = screen.getByTestId("run-spine").textContent ?? ""
    expect(text).toContain("Pull the contracts")
    // ⚠ THE WHOLE REASON THIS COMPONENT EXISTS. The component it replaced rendered these.
    for (const slug of ["gather", "draft", "check"]) expect(text).not.toContain(slug)
  })

  it("carries the sheet's connecting rail — what makes it a spine and not a list", () => {
    render(<RunSpine phases={ROWS} titleOf={titleOf} now={T0} />)
    expect(screen.getByTestId("spine-rail")).toBeInTheDocument()
  })
})

describe("RunSpine — Phase 200.2 (D-05 / A-02) count sub-line removed", () => {
  it("renders NO count sub-line even when step_count is declared (yield moved to centre column)", () => {
    render(<RunSpine phases={ROWS} titleOf={titleOf} now={T0} />)
    expect(within(row("gather")).queryByTestId("spine-count")).toBeNull()
  })

  it("renders NO count sub-line for 0-count row", () => {
    const zero: PhaseTimingRow[] = [
      { slug: "gather", status: "completed", started_at: s(0), completed_at: s(12), step_count: 0, step_noun: "sources" },
    ]
    render(<RunSpine phases={zero} titleOf={titleOf} now={T0} />)
    expect(within(row("gather")).queryByTestId("spine-count")).toBeNull()
  })

  it("renders NO count sub-line when step_count is absent", () => {
    render(<RunSpine phases={ROWS} titleOf={titleOf} now={T0} />)
    expect(within(row("draft")).queryByTestId("spine-count")).toBeNull()
  })
})

describe("RunSpine — the time column carries TIME facts and only time facts", () => {
  it("a finished step shows its duration", () => {
    render(<RunSpine phases={ROWS} titleOf={titleOf} now={T0} />)
    expect(within(row("gather")).getByTestId("spine-duration").textContent).toBe("12s")
  })

  it("a HISTORIC row says its time was not recorded — the arm a local subtraction loses", () => {
    const historic: PhaseTimingRow[] = [{ slug: "gather", status: "completed" }]
    render(<RunSpine phases={historic} titleOf={titleOf} now={T0} />)
    expect(within(row("gather")).getByTestId("spine-duration").textContent).toBe("time not recorded")
  })

  it("a STATE fact does not appear in the time column — the log's word carries it", () => {
    const mixed: PhaseTimingRow[] = [
      { slug: "check", status: "skipped" },
      { slug: "draft", status: "pending" },
    ]
    render(<RunSpine phases={mixed} titleOf={titleOf} now={T0} />)
    expect(within(row("check")).queryByTestId("spine-duration")).toBeNull()
    expect(within(row("draft")).queryByTestId("spine-duration")).toBeNull()
  })

  it("a running step ticks, and the tick DISCLOSES that it is unfinished", () => {
    const running: PhaseTimingRow[] = [{ slug: "draft", status: "active", started_at: s(0) }]
    render(
      <RunSpine
        phases={running}
        titleOf={titleOf}
        runStatus="active"
        liveOf={live({ draft: { reading: "running", label: "Running" } })}
        now={T0 + 14_000}
      />,
    )
    // ⚠ NOT A BARE FIGURE. A bare duration beside a step reads as a FINAL one; the shipped
    // phrase states the incompleteness in words.
    expect(within(row("draft")).getByTestId("spine-elapsed").textContent).toBe("14s so far")
  })

  it("a STALE slice cannot pulse a finished step — liveness needs both sources", () => {
    render(
      <RunSpine
        phases={ROWS}
        titleOf={titleOf}
        liveOf={live({ gather: { reading: "running", label: "Running" } })}
        now={T0}
      />,
    )
    // The wire says this finished in 12s. The slice has not caught up. The settled duration
    // shows and no live tick replaces it.
    expect(within(row("gather")).queryByTestId("spine-elapsed")).toBeNull()
    expect(within(row("gather")).getByTestId("spine-duration").textContent).toBe("12s")
  })
})

describe("RunSpine — the answer control sits at its own step", () => {
  it("renders the caller's ask inside the row it is given for, and nowhere else", () => {
    render(
      <RunSpine
        phases={ROWS}
        titleOf={titleOf}
        renderAsk={(slug) => (slug === "draft" ? <b data-testid="the-ask">answer me</b> : null)}
        now={T0}
      />,
    )
    expect(within(row("draft")).getByTestId("the-ask")).toBeInTheDocument()
    expect(within(row("gather")).queryByTestId("the-ask")).toBeNull()
  })
})
