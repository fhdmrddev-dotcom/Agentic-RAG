/**
 * Phase 267 plan 04 (PACK-23 / PACK-24 · D-267-11 / D-267-16 / UI-SPEC §5.6-5.7) — the transcript
 * event card renders the BACKEND BUILDER'S REAL OUTPUT, and every word is visible at rest.
 *
 * ⛔ CONTENT, NOT PRESENCE. Each case asserts the rendered strings; a `data-testid` is only an
 * anchor. ⛔ AT REST: `toBeVisible()` plus no hiding class on any ancestor — a `title` never counts.
 *
 * ⛔ THE OPEN CONTROL IS A REAL BUTTON ONLY WHEN IT CAN DO SOMETHING. Inside a navigation context
 * that resolves the target → a button that opens it. A target the loaded list does not hold → the
 * title as plain text and no control (267-REVIEW WR-09: never "· deleted" — absence from an in-memory
 * list is not evidence of a deletion). No context at all → the title as text and no control.
 */
import { describe, expect, it, vi } from "vitest"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
// @ts-ignore — Vite `?raw` import, typed by vite/client at build time only.
import expertChangedRaw from "../../../../../backend/tests/fixtures/phase267/expert_changed.json?raw"
// @ts-ignore — Vite `?raw` import.
import expertHandoffRaw from "../../../../../backend/tests/fixtures/phase267/expert_handoff.json?raw"
// @ts-ignore — Vite `?raw` import (268-03: the scope_changed builder's real output).
import scopeChangedRaw from "../../../../../backend/tests/fixtures/phase268/scope_changed.json?raw"
// @ts-ignore — Vite `?raw` import.
import scopeHeldRaw from "../../../../../backend/tests/fixtures/phase268/scope_changed_held.json?raw"
// @ts-ignore — Vite `?raw` import.
import scopeDuringRunRaw from "../../../../../backend/tests/fixtures/phase268/scope_changed_during_run.json?raw"
import type { ExpertChangedEvent, ExpertHandoffEvent, ScopeChangedEvent } from "@/lib/api/threads"
import type { Thread } from "@/types"
import { ExpertEventCard } from "../ExpertEventCard"
import { ThreadNavigationProvider } from "../threadNavigation"

const changed = JSON.parse(expertChangedRaw as string) as ExpertChangedEvent
const handoff = JSON.parse(expertHandoffRaw as string) as ExpertHandoffEvent
const scopeChanged = JSON.parse(scopeChangedRaw as string) as ScopeChangedEvent
const scopeHeld = JSON.parse(scopeHeldRaw as string) as ScopeChangedEvent
const scopeDuringRun = JSON.parse(scopeDuringRunRaw as string) as ScopeChangedEvent

const HIDING = ["sr-only", "hidden", "invisible", "opacity-0"]

/** Visible now, with nothing between it and the root that hides it until a hover. */
function expectVisibleAtRest(el: HTMLElement) {
  expect(el).toBeVisible()
  for (let n: HTMLElement | null = el; n; n = n.parentElement) {
    for (const cls of HIDING) {
      expect(n.classList.contains(cls), `ancestor <${n.tagName}> carries "${cls}"`).toBe(false)
    }
  }
}

const target: Thread = {
  id: handoff.target_thread_id,
  user_id: "u-1",
  title: handoff.target_title,
  created_at: "2026-09-25T14:45:00Z",
  updated_at: "2026-09-25T14:45:00Z",
} as Thread

describe("ExpertEventCard — expert_changed (the fixture swap)", () => {
  it("(1) is a note with a time element and a header naming both Experts", () => {
    render(<ExpertEventCard event={changed} />)
    const card = screen.getByTestId("expert-event-card")
    expect(card).toHaveAttribute("role", "note")
    expect(card.getAttribute("aria-label")).toMatch(/^Expert change at \S/)
    const time = card.querySelector("time")
    expect(time).not.toBeNull()
    expect(time!.getAttribute("dateTime")).toBe(changed.at)
    expectVisibleAtRest(within(card).getByText("Financial Analyzer → HR Advisor"))
  })

  it("(2) Now and Dropped — keys and values visible at rest, from the payload", () => {
    render(<ExpertEventCard event={changed} />)
    const now = screen.getByTestId("expert-event-now")
    const dropped = screen.getByTestId("expert-event-dropped")
    expectVisibleAtRest(within(now).getByText("Now"))
    expectVisibleAtRest(within(now).getByText("HR Policies"))
    expectVisibleAtRest(within(dropped).getByText("Dropped"))
    expectVisibleAtRest(within(dropped).getByText("Financial Reports & Filings"))
    expectVisibleAtRest(within(dropped).getByText("/Client ACME (4)"))
    expectVisibleAtRest(within(dropped).getByText("Slack"))
  })

  it("(3) the restricted exclusion sub-line names the files and ends with the attachments promise", () => {
    render(<ExpertEventCard event={changed} />)
    const dropped = screen.getByTestId("expert-event-dropped")
    const sub = within(dropped).getByText(/Chat attachments stay readable\.$/)
    expectVisibleAtRest(sub)
    expect(sub.textContent).toContain("ACME_MSA_2026.pdf")
    expect(sub.textContent).toContain("Board_deck_Q3.pptx")
  })

  it("(4) never renders the row's content sentence — only the payload", () => {
    render(<ExpertEventCard event={changed} />)
    expect(screen.queryByText(/Now: HR Policies\./)).toBeNull()
  })

  it("(5) an empty Dropped says 'Nothing'", () => {
    const empty = { folders: [], thread_folder: null, all_documents: false, connections: [] }
    render(<ExpertEventCard event={{ ...changed, dropped: empty, excluded: null }} />)
    expectVisibleAtRest(within(screen.getByTestId("expert-event-dropped")).getByText("Nothing"))
  })

  it("(6) a removal says '{Expert} left' on a neutral card; a join says '{Expert} joined'", () => {
    const { unmount } = render(<ExpertEventCard event={{ ...changed, after: null, excluded: null }} />)
    expectVisibleAtRest(screen.getByText("Financial Analyzer left"))
    expect(screen.getByTestId("expert-event-card").className).not.toContain("violet")
    unmount()
    render(<ExpertEventCard event={{ ...changed, before: null }} />)
    expectVisibleAtRest(screen.getByText("HR Advisor joined"))
    expect(screen.getByTestId("expert-event-card").className).toContain("border-violet-500/35")
  })
})

describe("ExpertEventCard — expert_handoff (the source thread's pointer)", () => {
  it("(7) Here and the inherited folder are stated at rest", () => {
    render(<ExpertEventCard event={handoff} />)
    const card = screen.getByTestId("expert-event-card")
    expectVisibleAtRest(within(card).getByText("Contract Reviewer · new chat"))
    expectVisibleAtRest(within(card).getByText("Here"))
    expectVisibleAtRest(within(card).getByText("Financial Analyzer stays"))
    expectVisibleAtRest(within(card).getByText("Open"))
    expectVisibleAtRest(within(card).getByText("Same folder: /Client ACME"))
  })

  it("(8) inside a provider that resolves the thread, Open is a button that opens it once", async () => {
    const openThread = vi.fn()
    const findThread = vi.fn((id: string) => (id === target.id ? target : null))
    render(
      <ThreadNavigationProvider value={{ findThread, openThread, refreshThreads: async () => {} }}>
        <ExpertEventCard event={handoff} />
      </ThreadNavigationProvider>,
    )
    const open = screen.getByTestId("handoff-event-open")
    expect(open.tagName).toBe("BUTTON")
    expectVisibleAtRest(open)
    expect(open.textContent).toBe("Contract Reviewer · Q3 board prep →")
    await userEvent.setup().click(open)
    expect(openThread).toHaveBeenCalledTimes(1)
    expect(openThread).toHaveBeenCalledWith(target)
  })

  // 267-REVIEW WR-09 — this case used to read "(9) a thread no longer in the list reads '· deleted'":
  // it pinned the defect. `findThread` reads only the in-memory list, which also misses a thread while
  // the list is still loading, after a handoff made in another tab, or when the first load failed —
  // each of which the card reported as a deletion that never happened.
  it("(9) a thread the loaded list does not hold reads its plain title — never '· deleted' — and has no control", () => {
    render(
      <ThreadNavigationProvider
        value={{ findThread: () => null, openThread: vi.fn(), refreshThreads: async () => {} }}
      >
        <ExpertEventCard event={handoff} />
      </ThreadNavigationProvider>,
    )
    expectVisibleAtRest(screen.getByText("Contract Reviewer · Q3 board prep"))
    expect(screen.queryByText(/deleted/)).toBeNull()
    expect(screen.queryByRole("button")).toBeNull()
  })

  it("(10) outside any provider the title is text and nothing is clickable", () => {
    render(<ExpertEventCard event={handoff} />)
    expectVisibleAtRest(screen.getByText("Contract Reviewer · Q3 board prep"))
    expect(screen.queryByRole("button")).toBeNull()
  })
})

describe("ExpertEventCard — scope_changed (268-03, the same Shell, a third kind)", () => {
  it("(11) normal: a note named 'Scope change at …', the header, Now / Dropped and the idle footer", () => {
    render(<ExpertEventCard event={scopeChanged} />)
    const card = screen.getByTestId("scope-event-card")
    expect(screen.queryByTestId("expert-event-card")).toBeNull()
    expect(card).toHaveAttribute("role", "note")
    expect(card.getAttribute("aria-label")).toMatch(/^Scope change at \S/)
    expect(card.className).toContain("border-indigo-600/40")
    expectVisibleAtRest(within(card).getByText("Scope /Client ACME → /Client ACME/Contracts"))
    const now = screen.getByTestId("scope-event-now")
    expectVisibleAtRest(within(now).getByText("Now"))
    expectVisibleAtRest(within(now).getByText("/Client ACME/Contracts (2)"))
    const dropped = screen.getByTestId("scope-event-dropped")
    expectVisibleAtRest(within(dropped).getByText("Dropped"))
    expectVisibleAtRest(within(dropped).getByText("/Client ACME (4)"))
    const when = screen.getByTestId("scope-event-when")
    expectVisibleAtRest(when)
    expect(when.textContent).toBe("From your next message.")
    // the row's content sentence is never rendered
    expect(screen.queryByText(/Now: /)).toBeNull()
  })

  it("(12) written while an answer streamed: the footer names what the answer keeps", () => {
    render(<ExpertEventCard event={scopeDuringRun} />)
    expect(screen.getByTestId("scope-event-when").textContent).toBe(
      "From your next message. The answer in progress keeps /Client ACME.",
    )
    expectVisibleAtRest(within(screen.getByTestId("scope-event-now")).getByText("Financial Reports & Filings"))
    expectVisibleAtRest(within(screen.getByTestId("scope-event-now")).getByText("Slack"))
  })

  it("(13) held (Restricted): an amber card with Saved / Searching and the leave footer — no Now / Dropped", () => {
    render(<ExpertEventCard event={scopeHeld} />)
    const card = screen.getByTestId("scope-event-card")
    expect(card.className).toContain("border-amber-600/40")
    const saved = screen.getByTestId("scope-event-saved")
    expectVisibleAtRest(within(saved).getByText("Saved"))
    expectVisibleAtRest(within(saved).getByText("/Client ACME/Contracts"))
    const searching = screen.getByTestId("scope-event-searching")
    expectVisibleAtRest(within(searching).getByText("Searching"))
    expectVisibleAtRest(within(searching).getByText("HR Policies only · HR Advisor is Restricted"))
    expect(screen.getByTestId("scope-event-when").textContent).toBe("Takes effect when HR Advisor leaves.")
    expect(screen.queryByTestId("scope-event-now")).toBeNull()
    expect(screen.queryByTestId("scope-event-dropped")).toBeNull()
  })

  it("(14) an empty Dropped (widening) says 'Nothing' muted", () => {
    const empty = { folders: [], thread_folder: null, all_documents: false, connections: [] }
    render(<ExpertEventCard event={{ ...scopeChanged, dropped: empty }} />)
    const nothing = within(screen.getByTestId("scope-event-dropped")).getByText("Nothing")
    expectVisibleAtRest(nothing)
    expect(nothing.className).toContain("text-muted-foreground")
  })
})
