/**
 * Phase 192-07 Task 3 (LIB-01 / LIB-02 / LIB-04 — D-02 / D-03 / D-06 / D-14 / D-17) — the
 * toolbar's STRUCTURAL half.
 *
 * `192-VALIDATION.md` rows U2, U3, U6 and U7 are the LIVED-EXPERIENCE counterparts of these
 * assertions and neither half replaces the other. This file proves the structure a person
 * would then judge: that create really is first in the document, that a zero-count chip
 * really is on screen, that D-17's sentence really is DOM text with those exact characters.
 *
 * ── WHY DOM ORDER IS READ FROM THE DOM, NOT FROM THE SOURCE ─────────────────────────────
 * D-02's whole claim is STRUCTURAL — "an affordance that leads a persistent toolbar cannot
 * drift back down a grid". A test that read the JSX source order, or that trusted the order
 * the queries happen to be written in, would re-assert the author's intention rather than the
 * rendered result. `compareDocumentPosition` asks the document itself, so a wrapper, a
 * portal, a `flex-direction` inversion or a future reshuffle answers honestly. The pairwise
 * checks are backed by a stronger one: the create control is index 0 of EVERY focusable node
 * inside the toolbar, so "first" cannot be satisfied by a control that merely precedes the
 * three things this file happened to name.
 *
 * ── WHY THE ABSENCE ASSERTIONS CARRY POSITIVE CONTROLS ──────────────────────────────────
 * The Phase 187 lesson, and `GovernanceSection.test.tsx:136-142`'s fourth case: an assertion
 * that a selector finds NOTHING passes identically when the selector is broken, when the
 * component never had the thing, and when the component is not rendering at all. Every
 * absence here is therefore paired with a control that makes the SAME selector find the SAME
 * shape on a node this test plants itself. The `aria-describedby` checks are likewise ROUND
 * TRIPS resolved through `document.getElementById` — a dangling id is a silent failure that
 * an attribute-presence check reports as a pass.
 *
 * ⚠ NOT PINNED IN THE COUNT GATE YET, AND THAT IS OWED RATHER THAN WAIVED. This file lands
 * under `src/components/workflows`, which `scripts/vitest-count-gate.cjs` already RUNS via
 * its directory entry, so it is discovered and executed — it is simply not in `BASELINE`, and
 * an unpinned suite is an unguarded one (the 188-12 precedent). `192-12` owes the pin, from
 * the gate's own printed `actual` across two agreeing runs. No `TARGETS` entry is added: the
 * directory entry already reaches this path, and a `TARGETS` path that does not resolve makes
 * the gate ERROR (exit 2) rather than merely fail.
 */
import { describe, it, expect, vi } from "vitest"
import { fireEvent, render, screen, within } from "@testing-library/react"

import type { Folder } from "@/types"

import { LibraryToolbar, type LibraryToolbarProps } from "./LibraryToolbar"
import { UNBOUND } from "./libraryFilter"
import type { ChipId } from "./libraryRow"
import {
  CHIP_ORDER,
  CHIP_WORDS,
  CLEAR_FILTERS_LABEL,
  PROJECT_STARTERS_NOTE,
  SEARCH_HINT,
  SEARCH_LABEL,
} from "./libraryVocabulary"

// ── fixtures ─────────────────────────────────────────────────────────────────────────

const folder = (id: string, name: string): Folder => ({
  id,
  user_id: "u-1",
  name,
  parent_id: null,
  is_org_shared: false,
  created_at: "2026-08-10T00:00:00Z",
  updated_at: "2026-08-10T00:00:00Z",
})

const FOLDERS: Folder[] = [folder("f-risk", "Risk"), folder("f-legal", "Legal")]

/**
 * Deliberately NOT uniform, and one of them is ZERO. A fixture where every count is the same
 * number cannot tell "the chip renders its own count" from "the chip renders the first count
 * it was handed", and a fixture with no zero cannot exercise the honest-empty rule at all.
 */
const COUNTS: Record<ChipId, number> = {
  "ready-to-run": 7,
  yours: 3,
  "still-building": 2,
  starters: 4,
  "makes-a-file": 0,
  strict: 5,
}

const renderToolbar = (overrides: Partial<LibraryToolbarProps> = {}) =>
  render(
    <LibraryToolbar
      query=""
      onQueryChange={vi.fn()}
      activeChips={[]}
      onToggleChip={vi.fn()}
      counts={COUNTS}
      projectId={null}
      onProjectChange={vi.fn()}
      folders={FOLDERS}
      updating={false}
      onCreate={vi.fn()}
      onClearAll={vi.fn()}
      {...overrides}
    />,
  )

/** `a` comes before `b` in document order. Asked of the DOM, never of the source. */
const precedes = (a: Element, b: Element): boolean =>
  Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING)

const FOCUSABLE = "button, input, select, textarea, a[href], [tabindex]"

// ── 1. DOM ORDER — create leads (LIB-04 / D-02 / SC#4) ───────────────────────────────

describe("LibraryToolbar — the create affordance LEADS (D-02, the structural fix for SC#4)", () => {
  it("precedes the search field, the chips and the project select in DOCUMENT order", () => {
    renderToolbar()
    const create = screen.getByTestId("library-create")
    for (const testId of ["library-search", "library-chips", "library-project-select"]) {
      expect(precedes(create, screen.getByTestId(testId))).toBe(true)
    }
  })

  it("POSITIVE CONTROL — `precedes` reports order rather than always answering true", () => {
    // Without this, every assertion above passes on a helper that returns `true` for any
    // pair, including a create control that had drifted to the end of the toolbar.
    renderToolbar()
    const create = screen.getByTestId("library-create")
    const select = screen.getByTestId("library-project-select")
    expect(precedes(select, create)).toBe(false)
    expect(precedes(create, create)).toBe(false)
  })

  it("is index 0 of EVERY focusable node in the toolbar, not merely ahead of three of them", () => {
    renderToolbar()
    const toolbar = screen.getByTestId("library-toolbar")
    const focusable = Array.from(toolbar.querySelectorAll(FOCUSABLE))
    // Non-vacuity: the create control, the search input, six chips and the select.
    expect(focusable.length).toBeGreaterThanOrEqual(9)
    expect(focusable[0]).toBe(screen.getByTestId("library-create"))
  })

  it("opens the Builder when pressed — the shipped affordance's job is unchanged", () => {
    const onCreate = vi.fn()
    renderToolbar({ onCreate })
    fireEvent.click(screen.getByTestId("library-create"))
    expect(onCreate).toHaveBeenCalledTimes(1)
  })
})

// ── 2. ALWAYS-ON SEARCH (D-06) ───────────────────────────────────────────────────────

describe("LibraryToolbar — the search field is always on (D-06)", () => {
  it("is present at FIRST RENDER, with no interaction at all", () => {
    renderToolbar()
    expect(screen.getByTestId("library-search")).toBeInTheDocument()
    expect(screen.getByLabelText(SEARCH_LABEL)).toBeInTheDocument()
  })

  it("has no control that toggles its visibility — no disclosure state exists", () => {
    const { container } = renderToolbar()
    // A tap-to-open field announces itself; the absence of any reveal state is the
    // machine-readable form of "a control you always open should always be open".
    expect(container.querySelectorAll("[aria-expanded]")).toHaveLength(0)
    expect(container.querySelectorAll("[aria-controls]")).toHaveLength(0)
  })

  it("carries its D-08 hint as real DOM text, wired by aria-describedby (the round trip)", () => {
    renderToolbar()
    const input = screen.getByTestId("library-search")
    const describedBy = input.getAttribute("aria-describedby")
    expect(describedBy).toBeTruthy()
    const hint = document.getElementById(describedBy as string)
    expect(hint).not.toBeNull()
    // Character-identity against the imported constant: the component authors no sentence
    // it could drift, so this cannot pass on a re-worded promise.
    expect(hint?.textContent).toBe(SEARCH_HINT)
  })

  it("reports every keystroke upward and stores none of it", () => {
    const onQueryChange = vi.fn()
    renderToolbar({ onQueryChange })
    const input = screen.getByTestId("library-search")
    fireEvent.change(input, { target: { value: "clause" } })
    expect(onQueryChange).toHaveBeenCalledWith("clause")
    // Controlled by the prop, so it did NOT adopt the value on its own.
    expect((input as HTMLInputElement).value).toBe("")
  })
})

// ── 3. CHIP HONESTY (D-03) ───────────────────────────────────────────────────────────

describe("LibraryToolbar — six chips, each showing a count it did not compute (D-03)", () => {
  it("renders exactly the six chips, in the vocabulary's order", () => {
    renderToolbar()
    const chips = within(screen.getByTestId("library-chips")).getAllByRole("button")
    expect(chips).toHaveLength(6)
    expect(chips.map((c) => c.getAttribute("data-chip"))).toEqual([...CHIP_ORDER])
  })

  it.each(CHIP_ORDER)("%s renders its own number and its own word", (chip) => {
    renderToolbar()
    const button = screen.getByTestId(`library-chip-${chip}`)
    expect(within(button).getByText(CHIP_WORDS[chip].label)).toBeInTheDocument()
    expect(screen.getByTestId(`library-chip-count-${chip}`).textContent).toBe(
      String(COUNTS[chip]),
    )
  })

  it("a chip whose count is ZERO still renders — never hidden, never fabricated", () => {
    // The honest-empty-state rule (`WorkflowSoul`'s D-03 pattern). Hiding the chip would
    // answer "are there any?" by making the question unaskable.
    expect(COUNTS["makes-a-file"]).toBe(0) // the fixture really does exercise it
    renderToolbar()
    const zeroChip = screen.getByTestId("library-chip-makes-a-file")
    expect(zeroChip).toBeInTheDocument()
    expect(screen.getByTestId("library-chip-count-makes-a-file").textContent).toBe("0")
  })

  it("is a set of INDEPENDENT toggles — aria-pressed tracks each chip separately", () => {
    renderToolbar({ activeChips: ["yours", "strict"] })
    expect(screen.getByTestId("library-chip-yours")).toHaveAttribute("aria-pressed", "true")
    expect(screen.getByTestId("library-chip-strict")).toHaveAttribute("aria-pressed", "true")
    expect(screen.getByTestId("library-chip-starters")).toHaveAttribute("aria-pressed", "false")
  })

  it("reports a press upward rather than narrowing anything itself", () => {
    const onToggleChip = vi.fn()
    renderToolbar({ onToggleChip })
    fireEvent.click(screen.getByTestId("library-chip-ready-to-run"))
    expect(onToggleChip).toHaveBeenCalledWith("ready-to-run")
  })
})

// ── 4. D-17 — the project filter says what it holds out ──────────────────────────────

describe("LibraryToolbar — the project filter states that starters are held out (D-17, UAT U6)", () => {
  it("the sentence it must say is not empty (non-vacuity)", () => {
    // Every assertion below compares against this constant. If it were ever emptied, a blank
    // node would satisfy them all.
    expect(PROJECT_STARTERS_NOTE.length).toBeGreaterThan(10)
  })

  it("renders the note — with its EXACT text — when a specific project is selected", () => {
    renderToolbar({ projectId: "f-risk" })
    const note = screen.getByTestId("library-project-note")
    expect(note.textContent).toBe(PROJECT_STARTERS_NOTE)
  })

  it("renders it under the UNBOUND sentinel too, where starters also stay visible", () => {
    renderToolbar({ projectId: UNBOUND })
    expect(screen.getByTestId("library-project-note").textContent).toBe(PROJECT_STARTERS_NOTE)
  })

  it("does NOT render it under All projects — nothing is being held out there", () => {
    renderToolbar({ projectId: null })
    expect(screen.queryByTestId("library-project-note")).toBeNull()
  })

  it("wires the note to the select by aria-describedby (the round trip)", () => {
    renderToolbar({ projectId: "f-risk" })
    const select = screen.getByTestId("library-project-select")
    const describedBy = select.getAttribute("aria-describedby")
    expect(describedBy).toBeTruthy()
    const note = document.getElementById(describedBy as string)
    expect(note).not.toBeNull()
    expect(note?.textContent).toBe(PROJECT_STARTERS_NOTE)
  })

  it("POSITIVE CONTROL — under All projects the select carries NO describedby to dangle", () => {
    // Without this, the round trip above could pass on a component that always describes.
    renderToolbar({ projectId: null })
    expect(screen.getByTestId("library-project-select")).not.toHaveAttribute("aria-describedby")
  })

  it("offers All projects, one option per folder, and the shipped UNBOUND sentinel", () => {
    renderToolbar()
    const options = Array.from(
      screen.getByTestId("library-project-select").querySelectorAll("option"),
    )
    expect(options.map((o) => o.value)).toEqual(["", "f-risk", "f-legal", UNBOUND])
  })

  it("maps the empty option back to null rather than to an empty-string project", () => {
    const onProjectChange = vi.fn()
    renderToolbar({ projectId: "f-risk", onProjectChange })
    fireEvent.change(screen.getByTestId("library-project-select"), { target: { value: "" } })
    expect(onProjectChange).toHaveBeenCalledWith(null)
  })
})

// ── 5. The in-flight marker (D-17's companion rule) ──────────────────────────────────

describe("LibraryToolbar — the quiet updating marker", () => {
  it("renders with a machine-readable state while a re-query is in flight", () => {
    renderToolbar({ updating: true })
    const marker = screen.getByTestId("library-updating")
    expect(marker).toHaveAttribute("data-state", "updating")
    expect(marker.textContent?.trim().length).toBeGreaterThan(0)
  })

  it("NEGATIVE CONTROL — it is absent when settled (a permanent marker proves nothing)", () => {
    renderToolbar({ updating: false })
    expect(screen.queryByTestId("library-updating")).toBeNull()
  })

  it("does not disturb a single count while it is showing", () => {
    // D-17's companion rule in its mechanical form: previously-committed rows stay rendered
    // WITH CORRECT COUNTS during a re-query. Counts are never zeroed to signal motion.
    renderToolbar({ updating: true })
    for (const chip of CHIP_ORDER) {
      expect(screen.getByTestId(`library-chip-count-${chip}`).textContent).toBe(
        String(COUNTS[chip]),
      )
    }
  })
})

// ── 6. D-14 — no hover-only explanation, with the control that makes it mean something ──

describe("LibraryToolbar — every reason is real DOM text (D-14: touch has no hover)", () => {
  it("no element in the rendered toolbar carries a tooltip attribute", () => {
    const { container } = renderToolbar({
      // The states that render the MOST explanation are the ones most tempted by a tooltip,
      // so the sweep runs over the fullest toolbar rather than the emptiest.
      projectId: "f-risk",
      query: "clause",
      activeChips: ["strict"],
      updating: true,
    })
    expect(container.querySelectorAll("[title]")).toHaveLength(0)
  })

  it("POSITIVE CONTROL — the same selector DOES find one on a node this test plants", () => {
    // The Phase 187 lesson: an absence assertion with no positive control proves nothing —
    // it passes identically on a broken selector and on a component that never rendered.
    const { container } = render(
      <div>
        <span title="a planted hover-only explanation">planted</span>
      </div>,
    )
    expect(container.querySelectorAll("[title]")).toHaveLength(1)
  })
})

// ── 7. The way out of an over-filtered list (sketch 158) ─────────────────────────────

describe("LibraryToolbar — clear search & filters", () => {
  it.each([
    ["a query", { query: "clause" } satisfies Partial<LibraryToolbarProps>],
    ["a chip", { activeChips: ["strict"] } satisfies Partial<LibraryToolbarProps>],
    ["a project", { projectId: "f-risk" } satisfies Partial<LibraryToolbarProps>],
  ])("is offered when %s is active", (_label, overrides) => {
    renderToolbar(overrides)
    expect(screen.getByTestId("library-clear-all").textContent).toBe(CLEAR_FILTERS_LABEL)
  })

  it("is ABSENT when nothing is active — a permanent clear reports no state", () => {
    renderToolbar()
    expect(screen.queryByTestId("library-clear-all")).toBeNull()
  })

  it("hands the reset upward rather than clearing anything itself", () => {
    const onClearAll = vi.fn()
    const onQueryChange = vi.fn()
    renderToolbar({ query: "clause", onClearAll, onQueryChange })
    fireEvent.click(screen.getByTestId("library-clear-all"))
    expect(onClearAll).toHaveBeenCalledTimes(1)
    // It owns no state, so it cannot have "also" cleared the field behind the page's back.
    expect(onQueryChange).not.toHaveBeenCalled()
  })
})
