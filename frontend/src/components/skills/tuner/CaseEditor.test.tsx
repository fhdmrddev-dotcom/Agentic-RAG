/**
 * Phase 123.1 Plan 04 Task 1 (D-05/D-06) — CaseEditor: hydrated seeded cases.
 *
 * The page hydrates the editor from the backend's seeded cases (getSeededCases) BEFORE
 * a run (fixes WR-05 / BUG-260624-01 — the editor used to init `cases=[]` and show
 * "0 cases" while the run used hidden seeded cases). This suite locks the COMPONENT
 * contract the page depends on:
 *
 *  - hydrated seeded/sibling cases render with their REAL provenance tags (no longer
 *    "you"-only) in the correct should-fire / should-NOT column.
 *  - the hydrated cases are fully editable: a case can be REMOVED, and a new case ADDED
 *    (provenance "you") before the run.
 *  - the `held` tag is RESOLVED (dropped from the provenance union) — the 60/40 split
 *    bar owns the train/held-out display, so the provenance union is now exactly
 *    seeded | sibling | you (no dead "held" string).
 */
import { describe, it, expect, vi } from "vitest"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { Skill } from "@/types"
import { CaseEditor, type EditorCase } from "./CaseEditor"

const SKILL: Skill = {
  id: "skill-1",
  user_id: "user-1",
  name: "SQL Writer",
  description: "Fires on SQL.",
  instructions: "Write SQL.",
  is_enabled: true,
  is_global: false,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
}

// A mixed hydrated set: seeded should-fire, a sibling false-fire rail case, and an
// author-owned "you" case — the real provenance the backend + author produce.
const HYDRATED: EditorCase[] = [
  { id: "h1", prompt: "Write a SQL query for me", should_fire: true, provenance: "seeded" },
  { id: "h2", prompt: "Fix this JOIN", should_fire: true, provenance: "you" },
  { id: "h3", prompt: "Summarize this PDF", should_fire: false, provenance: "sibling" },
  { id: "h4", prompt: "What's the weather?", should_fire: false, provenance: "seeded" },
]

describe("CaseEditor — hydrated seeded cases with real provenance (D-05/D-06)", () => {
  it("renders hydrated seeded/sibling cases with their real provenance tags (not 'you'-only)", () => {
    render(<CaseEditor cases={HYDRATED} onChange={vi.fn()} skill={SKILL} />)
    const editor = screen.getByTestId("case-editor")
    // real provenance tags — seeded (own paraphrase) + sibling (the false-fire rail).
    expect(editor.textContent?.toLowerCase()).toContain("seeded")
    expect(editor.textContent?.toLowerCase()).toContain("sibling")
    expect(editor.textContent?.toLowerCase()).toContain("you")
  })

  it("places hydrated cases in the correct should-fire / should-NOT column", () => {
    render(<CaseEditor cases={HYDRATED} onChange={vi.fn()} skill={SKILL} />)
    const fireCol = screen.getByTestId("case-col-should-fire")
    const noCol = screen.getByTestId("case-col-should-not")
    expect(within(fireCol).getByText(/Write a SQL query for me/)).toBeTruthy()
    expect(within(noCol).getByText(/Summarize this PDF/)).toBeTruthy()
    // the sibling false-fire case is on the should-NOT rail, not the recall column.
    expect(within(fireCol).queryByText(/Summarize this PDF/)).toBeNull()
  })

  it("a hydrated case is removable (removeCase drops it via onChange)", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<CaseEditor cases={HYDRATED} onChange={onChange} skill={SKILL} />)
    const fireCol = screen.getByTestId("case-col-should-fire")
    // remove the first should-fire case.
    const removeBtns = within(fireCol).getAllByLabelText("Remove case")
    await user.click(removeBtns[0])
    expect(onChange).toHaveBeenCalledTimes(1)
    const next = onChange.mock.calls[0][0] as EditorCase[]
    expect(next.find((c) => c.id === "h1")).toBeUndefined()
    expect(next).toHaveLength(HYDRATED.length - 1)
  })

  it("a new case is addable and tagged provenance 'you'", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<CaseEditor cases={HYDRATED} onChange={onChange} skill={SKILL} />)
    await user.type(screen.getByPlaceholderText(/a user prompt to benchmark/i), "Generate an INSERT statement")
    await user.click(screen.getByRole("button", { name: /^add$/i }))
    expect(onChange).toHaveBeenCalledTimes(1)
    const next = onChange.mock.calls[0][0] as EditorCase[]
    const added = next.find((c) => c.prompt === "Generate an INSERT statement")
    expect(added).toBeTruthy()
    expect(added!.provenance).toBe("you")
  })
})

describe("CaseEditor — the held tag is resolved (dropped from the provenance union)", () => {
  it("the split bar owns the train/held-out display (no dead 'held' provenance tag)", () => {
    render(<CaseEditor cases={HYDRATED} onChange={vi.fn()} skill={SKILL} />)
    // the 60/40 split bar carries the held-out display, not a per-case provenance tag.
    const split = screen.getByTestId("split-bar")
    expect(split.textContent?.toLowerCase()).toMatch(/held-out|held out|40/)
    // every rendered case carries a provenance tag, and NONE is a literal "held".
    const tags = screen.getAllByTestId("provenance-tag")
    expect(tags.length).toBe(HYDRATED.length)
    for (const tag of tags) {
      expect(tag.textContent?.toLowerCase()).not.toBe("held")
    }
  })
})
