/**
 * Phase 292-02 Task 3 (D-06 · D-18 · I-3 · sketch 4A · UI-D-292-15..18) — the vertical rail.
 *
 * Today is injected (a fixed 24 Oct 2026) so the assertions are about what a person reads on that
 * day: events in date order, exactly one Today row, filled past dots and hollow upcoming ones, an
 * amber deadline ring with a worded day count, gap rows, and sources only where they exist.
 */
import { afterEach, describe, expect, it } from "vitest"
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import { TimelineArtifact } from "../TimelineArtifact"
import { parseArtifactRecord, type ArtifactRecord } from "../artifactSpec"
import { mutable, timelineAtlas } from "./fixtures"

afterEach(() => cleanup())

const TODAY = { y: 2026, m: 10, d: 24 }

function rec(raw: unknown): ArtifactRecord {
  const r = parseArtifactRecord(raw)
  if (!r.ok) throw new Error(`fixture failed to parse: ${r.reason}`)
  return r.record
}

function rows() {
  return within(screen.getByRole("list")).getAllByRole("listitem")
}

function events() {
  return screen.getAllByTestId("timeline-event")
}

describe("TimelineArtifact — the rail", () => {
  it("an ordered list named for the timeline, 9 events + 3 gaps + 1 Today = 13 rows", () => {
    render(<TimelineArtifact record={rec(timelineAtlas)} today={TODAY} />)
    const list = screen.getByRole("list")
    expect(list.tagName).toBe("OL")
    expect(list).toHaveAttribute("aria-label", "Timeline: Atlas Logistics contract — history and what’s next. 9 events.")
    expect(rows()).toHaveLength(13)
    expect(rows().map((r) => r.getAttribute("data-row"))).toEqual([
      "event", "event", "gap", "event", "gap", "event", "event", "event", "gap", "event", "today", "event", "event",
    ])
  })

  it("events read in date order whatever order the record holds, with fixed-table dates", () => {
    const shuffled = mutable(timelineAtlas)
    shuffled.spec.timeline.events.reverse()
    render(<TimelineArtifact record={rec(shuffled)} today={TODAY} />)
    expect(events().map((e) => within(e).getByTestId("event-date").textContent)).toEqual([
      "14 Mar 2023",
      "1 Apr 2023",
      "9 Feb 2024",
      "20 Nov 2024",
      "15 Jan 2025",
      "1 Apr 2025",
      "1 Apr 2026",
      "31 Dec 2026",
      "31 Mar 2027",
    ])
  })

  it("exactly one Today row, between past and upcoming, in today's date", () => {
    render(<TimelineArtifact record={rec(timelineAtlas)} today={TODAY} />)
    const today = screen.getAllByTestId("timeline-today")
    expect(today).toHaveLength(1)
    expect(today[0].textContent).toContain("Today")
    expect(today[0].textContent).toContain("24 Oct 2026 — everything below hasn't happened yet")
    expect(within(today[0]).getByTestId("today-sr").textContent).toBe("Today, 24 Oct 2026.")
  })

  it("past dots are filled, upcoming hollow, the deadline ring amber with `in 68 days`", () => {
    render(<TimelineArtifact record={rec(timelineAtlas)} today={TODAY} />)
    const dots = events().map((e) => within(e).getByTestId("event-dot"))
    expect(dots.slice(0, 7).map((d) => d.getAttribute("data-fill"))).toEqual(Array(7).fill("filled"))
    expect(dots.slice(7).map((d) => d.getAttribute("data-fill"))).toEqual(["hollow", "hollow"])
    expect(dots[7].className).toContain("border-amber-600")
    expect(dots[8].className).toContain("border-muted-foreground")
    const pill = within(events()[7]).getByTestId("deadline-pill")
    expect(pill.textContent).toBe("in 68 days")
    expect(pill.className).toContain("text-amber-700")
  })

  it("each event starts with its sr-only state word", () => {
    render(<TimelineArtifact record={rec(timelineAtlas)} today={TODAY} />)
    const words = events().map((e) => within(e).getByTestId("event-state").textContent)
    expect(words).toEqual([...Array(7).fill("Happened."), "Deadline.", "Upcoming."])
    for (const e of events()) expect(e.firstElementChild?.nextElementSibling?.nextElementSibling?.firstElementChild).toHaveTextContent(/^(Happened|Upcoming|Deadline)\.$/)
  })

  it("gap rows read `{N} months` with an sr-only ` later`", () => {
    render(<TimelineArtifact record={rec(timelineAtlas)} today={TODAY} />)
    const gaps = screen.getAllByTestId("timeline-gap")
    expect(gaps.map((g) => g.textContent)).toEqual(["10 months later", "9 months later", "12 months later"])
    expect(within(gaps[0]).getByText(" later", { normalizer: (s) => s })).toHaveClass("sr-only")
  })

  it("titles, details and categories render as text; a category chip is never coloured", () => {
    const m = mutable(timelineAtlas)
    m.spec.timeline.events[1].title = "<img src=x onerror=alert(1)>"
    const { container } = render(<TimelineArtifact record={rec(m)} today={TODAY} />)
    expect(container.querySelector("img")).toBeNull()
    expect(container.textContent).toContain("<img src=x onerror=alert(1)>")
    const chip = within(events()[0]).getByTestId("event-category")
    expect(chip.textContent).toBe("Contract")
    expect(chip.className).toContain("text-muted-foreground")
  })

  it("all upcoming → Today first; all past → Today last", () => {
    const a = render(<TimelineArtifact record={rec(timelineAtlas)} today={{ y: 2020, m: 1, d: 1 }} />)
    expect(rows()[0].getAttribute("data-row")).toBe("today")
    expect(screen.getByTestId("timeline-today").textContent).toContain("1 Jan 2020 — none of these has happened yet")
    a.unmount()
    render(<TimelineArtifact record={rec(timelineAtlas)} today={{ y: 2030, m: 6, d: 1 }} />)
    const all = rows()
    expect(all[all.length - 1].getAttribute("data-row")).toBe("today")
    expect(screen.getByTestId("timeline-today").textContent).toContain("1 Jun 2030 — everything above has happened")
    // A missed deadline still reads as one, in words, on a muted pill with a filled amber dot.
    const pill = within(events()[7]).getByTestId("deadline-pill")
    expect(pill.textContent).toBe("passed 1,248 days ago")
    expect(pill.className).toContain("bg-muted")
    expect(within(events()[7]).getByTestId("event-dot").getAttribute("data-fill")).toBe("filled")
  })
})

describe("TimelineArtifact — sources", () => {
  it("only sourced events have a source line; it is focusable and shows the tooltip", () => {
    render(<TimelineArtifact record={rec(timelineAtlas)} today={TODAY} />)
    const lines = screen.getAllByTestId("event-source")
    expect(lines).toHaveLength(2)
    expect(lines.map((l) => l.textContent)).toEqual(["Atlas_MSA_2023.pdf · p.1", "Atlas_MSA_2023.pdf"])
    expect(lines[0].tabIndex).toBe(0)
    act(() => lines[0].focus())
    const tip = screen.getByRole("tooltip")
    expect(tip.id).toBe("a_tl9e4v2n6b-tip")
    expect(lines[0]).toHaveAttribute("aria-describedby", "a_tl9e4v2n6b-tip")
    expect(tip.textContent).toContain("“This Master Services Agreement is entered into on 14 March 2023.”")
    act(() => lines[0].blur())
    expect(screen.queryByRole("tooltip")).toBeNull()
    fireEvent.pointerEnter(lines[1])
    expect(screen.getByRole("tooltip").textContent).toContain("ninety (90) days")
    fireEvent.keyDown(lines[1], { key: "Escape" })
    expect(screen.queryByRole("tooltip")).toBeNull()
  })

  it("an event with no source has no source line and nothing focusable", () => {
    render(<TimelineArtifact record={rec(timelineAtlas)} today={TODAY} />)
    expect(within(events()[1]).queryByTestId("event-source")).toBeNull()
    expect(events()[1].querySelector("[tabindex]")).toBeNull()
  })
})

describe("TimelineArtifact — the clock", () => {
  it("without an injected today it reads the viewer's clock once and still draws exactly one Today row", () => {
    render(<TimelineArtifact record={rec(timelineAtlas)} />)
    expect(screen.getAllByTestId("timeline-today")).toHaveLength(1)
  })
})
