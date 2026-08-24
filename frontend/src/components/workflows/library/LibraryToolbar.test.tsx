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

// ── 8. 199-10 Task 1 — THE PRE-CHANGE RESTING INVENTORY (sheet `c6-library-dialogs`) ──

/**
 * Phase 199-10 Task 1 (DES-01) — WHAT THE TOOLBAR RENDERS AT REST, AS LITERALS, BEFORE
 * ANYTHING MOVES.
 *
 * Phase 199 re-presents shipped surfaces in the adopted design language, and its premise is
 * REMOVAL. A removal is only provable against a record of what was there, so this block is
 * taken FIRST, in a commit that changes no source byte, and every literal below is READ OUT
 * OF THIS ASSERTION'S OWN FAILING DIFF rather than predicted from the JSX.
 *
 * ⚠ THE REMOVALS THAT FOLLOW ARE PROVED BY INVERTING THESE ASSERTIONS FROM PRESENT TO
 * ABSENT, NEVER BY DELETING THEM. A deleted assertion and a passing one are indistinguishable
 * in a green run; an inverted one still fails if the atom comes back. Zero assertion
 * deletions is the target for the whole plan.
 *
 * ⚠ `textContent` CONCATENATES, which is what killed a `\b` word boundary in `199-07`. These
 * are EXACT equalities against whole strings, not substring or boundary matches, so the
 * concatenation is the thing being pinned rather than a hazard to the matcher — and each is
 * preceded by a non-vacuity assertion, because `toBe("")` against a surface that stopped
 * rendering passes forever.
 */
describe("LibraryToolbar 199-10 — the resting inventory, pinned before the re-presentation", () => {
  it("renders something at all (non-vacuity, before anything is asserted about its contents)", () => {
    renderToolbar()
    const toolbar = screen.getByTestId("library-toolbar")
    expect(toolbar.querySelectorAll("*").length).toBeGreaterThan(15)
    expect((toolbar.textContent ?? "").length).toBeGreaterThan(40)
  })

  /**
   * ⚠ INVERTED BY 199-10 TASK 2, NOT DELETED. Each assertion below is the SAME assertion the
   * previous commit made, with the removed sub-line taken out of the expected string. The
   * pre-change value is quoted in the comment beside each one, so the delta is readable here
   * rather than only in a diff, and a re-introduction of the sentence reds these rather than
   * passing silently on a line somebody deleted.
   */
  it("the whole toolbar's resting text is EXACTLY this string", () => {
    // WAS (199-10 Task 1, one commit earlier):
    //   "＋Build a workflowDescribe it in plain English → AI drafts itMatches the letters…"
    // The delta is exactly the create control's sub-line. Nothing else on the row moved.
    renderToolbar()
    expect(screen.getByTestId("library-toolbar").textContent).toBe(
      "＋Build a workflowMatches the letters you type, in the name or the purpose.Ready to run7Yours3Still building2Starters4Makes a file0🔒Strict5ProjectAll projectsRiskLegalUnbound (no project)",
    )
  })

  it("the create control's own resting text is EXACTLY this string", () => {
    // WAS: "＋Build a workflowDescribe it in plain English → AI drafts it"
    renderToolbar()
    expect(screen.getByTestId("library-create").textContent).toBe("＋Build a workflow")
  })

  it("the create control renders ONE line — the sub-line is gone, not merely hidden", () => {
    // WAS 3 spans (the wrapping line span, the glyph span, the sub-line span); now 1.
    // The structural half of the same record: text alone cannot tell a removed node from a
    // node rendered empty, and an empty node still costs a row of layout.
    renderToolbar()
    const create = screen.getByTestId("library-create")
    expect(create.querySelectorAll("span").length).toBe(1)
  })

  it("nothing anywhere in the toolbar names the mechanism the sub-line named", () => {
    // Scoped to the WHOLE toolbar rather than to the create control, because "removed" and
    // "moved somewhere else on the same row" are the two outcomes this plan must tell apart.
    const { container } = renderToolbar({
      projectId: "f-risk",
      query: "clause",
      activeChips: ["strict"],
      updating: true,
    })
    const text = container.textContent ?? ""
    expect(text.length).toBeGreaterThan(40) // non-vacuity, before any absence is claimed
    expect(text).not.toContain("plain English")
    expect(text).not.toContain("AI drafts")
  })

  it("POSITIVE CONTROL — the same two checks DO fire on a node this test plants", () => {
    // Without this, the absences above pass identically on a broken matcher.
    const { container } = render(
      <div>
        <span>Describe it in plain English → AI drafts it</span>
      </div>,
    )
    const text = container.textContent ?? ""
    expect(text).toContain("plain English")
    expect(text).toContain("AI drafts")
  })
})

// ── 9. 199-10 Task 2 — CREATE LEADS VISUALLY AS WELL AS IN THE DOCUMENT ──────────────

/**
 * D-02's claim has two halves and only one of them was ever asserted.
 *
 * DOM order is asserted above by `compareDocumentPosition` and by the focusable-index-0 check,
 * and that is the KEYBOARD half. The other half is that the control a person SEES first is the
 * same one. A re-skin that reversed the row visually — `flex-row-reverse`, or an `order-*`
 * utility on any child — would leave every DOM-order assertion above green while demoting the
 * affordance on screen, and 199-10's own sheet (c6) draws create LAST behind an `ml-auto`,
 * so this is a live temptation rather than a hypothetical one.
 *
 * ⚠ JSDOM RUNS NO LAYOUT. `getBoundingClientRect()` returns zeroes for every node here, so a
 * geometric check would read `0 <= 0` and pass on a reversed row — the failure mode 199-07
 * recorded on this phase. What is asserted instead is a STATED CLASS-LEVEL SURROGATE: the
 * toolbar declares no reversing direction and no explicit ordering utility, so DOM order IS
 * paint order by construction. That is a weaker claim than "the pixels are where we think",
 * and the difference is OWED as a G-4 lived-experience UAT row rather than papered over.
 */
describe("LibraryToolbar 199-10 — create leads on screen too, not only in the document", () => {
  it("the toolbar declares no reversing flex direction and no explicit order utility", () => {
    const { container } = renderToolbar({ query: "clause", activeChips: ["strict"], updating: true })
    const toolbar = screen.getByTestId("library-toolbar")
    const classes = Array.from(container.querySelectorAll<HTMLElement>("*"))
      .map((el) => el.getAttribute("class") ?? "")
      .join(" ")
    expect(classes.length).toBeGreaterThan(100) // non-vacuity: the sweep sees real classes
    expect(toolbar.className).not.toMatch(/flex-(row|col)-reverse/)
    expect(classes).not.toMatch(/(^|\s)order-(first|last|none|\d+)(\s|$)/)
    expect(classes).not.toMatch(/(^|\s)-order-\d+(\s|$)/)
  })

  it("POSITIVE CONTROL — the same two matchers DO fire on planted markup", () => {
    expect("flex flex-row-reverse gap-2").toMatch(/flex-(row|col)-reverse/)
    expect("px-2 order-last text-sm").toMatch(/(^|\s)order-(first|last|none|\d+)(\s|$)/)
    expect("px-2 -order-1 text-sm").toMatch(/(^|\s)-order-\d+(\s|$)/)
    // …and they do NOT fire on the shipped strings, so the assertions above are not vacuous
    // for want of anything resembling the forbidden shapes.
    expect("flex flex-wrap items-start gap-x-4").not.toMatch(/flex-(row|col)-reverse/)
    expect("flex h-9 items-center gap-1.5 rounded-md bg-primary").not.toMatch(
      /(^|\s)order-(first|last|none|\d+)(\s|$)/,
    )
  })

  it("the create control is still index 0 AFTER the re-skin, over the fullest toolbar", () => {
    // The Task-1 block asserts this on the empty toolbar; this re-asserts it on the state
    // with the most competing controls, which is the one a re-skin is likeliest to disturb.
    renderToolbar({ query: "clause", activeChips: ["strict"], projectId: "f-risk", updating: true })
    const focusable = Array.from(screen.getByTestId("library-toolbar").querySelectorAll(FOCUSABLE))
    expect(focusable.length).toBeGreaterThanOrEqual(10)
    expect(focusable[0]).toBe(screen.getByTestId("library-create"))
  })
})

// ── 10. 199-10 Task 2 — THE CREATE CONTROL'S COLOUR TOKENS ACTUALLY RESOLVE ──────────

/**
 * ⚠ THIS FENCE EXISTS BECAUSE A TAILWIND UTILITY NAMING AN UNDECLARED KEY COMPILES TO NOTHING,
 * SILENTLY. `bg-warning` did exactly that across four components and shipped unguarded until
 * 192.2 measured it — `class="… bg-warning"` is a perfectly valid string to `tsc`, to eslint
 * and to every rendering test in this repository. Sheet 178 makes the risk concrete rather than
 * theoretical: 15 of its 18 colour tokens (`primary-container`, `tertiary`, `on-surface`, …)
 * are declared in NEITHER `tailwind.config.js` NOR `index.css`, so a re-presentation that
 * transcribed the sheet's palette would render an UNPAINTED control that looks, in every
 * automated check, exactly like a deliberately quiet one.
 *
 * The re-skinned create control uses `bg-primary` and `text-primary-foreground`. Both links of
 * the chain are checked: the key under `theme.extend.colors`, and its CSS variable in BOTH
 * `:root` and `.dark`.
 *
 * ⚠ THE READ GOES THROUGH `vi.importActual("node:fs")`, NEVER `?raw`. Vite's `css` handling
 * under vitest defaults `test.css` to `false`, which replaces a CSS module's contents with the
 * EMPTY STRING and swallows the `?raw` query with it — nothing throws and nothing warns, and a
 * fence sweeping "" passes green while defending nothing. `gutterTokens.fences.test.ts` records
 * measuring exactly that. Non-vacuity is therefore asserted BEFORE any contents.
 */
const nodeFs199 = await vi.importActual<{ readFileSync(path: string, encoding: string): string }>(
  "node:fs",
)

/** `file:///…/frontend/src/components/workflows/library/<this file>` → `…/frontend/`. */
const FRONTEND_ROOT_199 = (() => {
  const here = decodeURIComponent(import.meta.url).replace(/^file:\/\/\/?/, "")
  const marker = "/src/components/workflows/library/"
  const at = here.indexOf(marker)
  if (at === -1) throw new Error("fence cannot locate its own subtree in: " + here)
  return here.slice(0, at) + "/"
})()

describe("LibraryToolbar 199-10 — the create control's colour tokens resolve (the whole chain)", () => {
  const configSource = nodeFs199.readFileSync(FRONTEND_ROOT_199 + "tailwind.config.js", "utf8")
  const cssSource199 = nodeFs199.readFileSync(FRONTEND_ROOT_199 + "src/index.css", "utf8")

  it("both sources are non-empty (the `?raw`-returns-`\"\"` trap, asserted before anything else)", () => {
    expect(configSource.length).toBeGreaterThan(500)
    expect(cssSource199.length).toBeGreaterThan(500)
  })

  it("the control really does name the two tokens under test (non-vacuity of the fence itself)", () => {
    renderToolbar()
    const cls = screen.getByTestId("library-create").getAttribute("class") ?? ""
    expect(cls).toContain("bg-primary")
    expect(cls).toContain("text-primary-foreground")
  })

  it("L2 — `primary` is declared under theme.extend.colors, with a `foreground` member", () => {
    expect(configSource).toMatch(/primary:\s*\{[^}]*DEFAULT:\s*"hsl\(var\(--primary\)\)"/)
    expect(configSource).toMatch(/foreground:\s*"hsl\(var\(--primary-foreground\)\)"/)
  })

  it("L3 — both CSS variables are declared in BOTH themes, never dark-only", () => {
    // A dark-only variable is the SECOND half of the 192.2 defect and is invisible to L2.
    const block = (selector: string): string => {
      const at = cssSource199.indexOf(selector)
      expect(at, selector + " block not found").toBeGreaterThan(-1)
      const open = cssSource199.indexOf("{", at)
      const close = cssSource199.indexOf("}", open)
      return cssSource199.slice(open, close)
    }
    for (const selector of [":root", ".dark"]) {
      const body = block(selector)
      expect(body.length, selector + " block is empty").toBeGreaterThan(50)
      expect(body, selector + " is missing --primary").toContain("--primary:")
      expect(body, selector + " is missing --primary-foreground").toContain(
        "--primary-foreground:",
      )
    }
  })

  it("POSITIVE CONTROL — the L2 matcher DOES fail on a key nobody declared", () => {
    // `primary-container` is one of sheet 178's own tokens and is absent from this config.
    // Without this control, L2 would pass identically on a regex that matches anything.
    expect(configSource).not.toMatch(/"?primary-container"?:/)
    expect(cssSource199).not.toContain("--primary-container:")
  })
})
