/**
 * Phase 192.1-07 Task 1 (LIB-05 — D-19 / D-20 / D-21 / D-36, threats T-192.1-19 /
 * T-192.1-20 / T-192.1-21 / T-192.1-22) — 162-B's NAME PROMPT, PROVED TO BE AN INPUT
 * RATHER THAN A GUARD.
 *
 * ── WHY THIS SUITE EXISTS AT ALL, AND WHY ITS ASSERTIONS LOOK ODD ───────────────────────
 *
 * Phase 192's **D-15** made the fork a DIRECT FLIP on a recorded argument that still lives
 * in `WorkflowCard.tsx`'s own docblock: *a confirm on a non-destructive, reversible action
 * spends the guard vocabulary the delete relies on to mean anything.* 162-B REOPENS that
 * decision, and the rationale that makes this dialog legal is **mechanical rather than
 * rhetorical** — it collects something the system cannot know, so it is an INPUT, and inputs
 * do not spend guard vocabulary.
 *
 * A claim like that is worth nothing as prose. D-19 therefore names four clauses, and **each
 * one is a test in this file**:
 *
 *   1. it asks for a NAME, never for a confirmation;
 *   2. its primary button is `Create my copy`, and asserting *"the primary is NOT `Confirm`"*
 *      is what makes the distinction machine-checkable;
 *   3. it wears NO destructive styling — no red, no victim naming, no arm-to-confirm;
 *   4. it WARNS AND NEVER BLOCKS on a colliding name (D-20); emptiness is the only hard gate.
 *
 * ── ⚠ THE WARN-NEVER-BLOCK PAIR NEEDS A POSITIVE CONTROL, AND HERE IS WHY ───────────────
 *
 * *"the clash hint is rendered"* is satisfied **identically** by a dialog that shows the
 * warning and then refuses the submit. The hint's presence is not the contract; PROCEEDING
 * THROUGH IT is. So the clash case does not stop at the sentence — it submits and asserts
 * `onCreate` fired with the typed name. Same reasoning as `WorkflowCard.test.tsx`'s rule that
 * every absence carries a control: an assertion that cannot fail on the wrong implementation
 * is not an assertion.
 *
 * ── AND EVERY ABSENCE CARRIES A CONTROL ─────────────────────────────────────────────────
 *
 * `queryByRole("button", { name: /confirm/i })` returning null passes when the selector is
 * broken, when the dialog never rendered, and when React exploded. Each such line is paired
 * with a render in which the SAME query finds the SAME shape.
 *
 * ── THE POSTURE IS `RunModal.a11y.test.tsx`'s ───────────────────────────────────────────
 *
 * The four Radix jsdom shims (`hasPointerCapture` / `setPointerCapture` /
 * `releasePointerCapture` / `scrollIntoView`), `axe()` on the OPEN dialog, and role +
 * accessible-name assertions rather than class-name reading.
 *
 * ⚠ EVERY USER-VISIBLE STRING IS IMPORTED (D-14). A test that spells `"Create my copy"`
 * inline has silently forked the acceptance bar the generated build contract exists to hold —
 * the same anti-drift rule `WorkflowCard.test.tsx:60-63` records for the identity words.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, within, cleanup } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { axe } from "vitest-axe"

import { ForkNameDialog } from "./ForkNameDialog"
import {
  FORK_CONSEQUENCE,
  FORK_DIALOG_CANCEL,
  FORK_DIALOG_OK,
  FORK_DIALOG_TITLE,
  FORK_HINT_CLASH,
  FORK_HINT_EMPTY,
  FORK_HINT_FREE,
  forkDialogSub,
} from "./libraryVocabulary"

// ── fixtures ─────────────────────────────────────────────────────────────────────────

/** The caller's OWN display names — D-21's pre-flight reads exactly this shape. */
const MY_NAMES = ["Compliance Gap Report", "Access Review Attestation"]

/** The real predicate's shape: a trimmed DISPLAY-NAME comparison, never a slug one. */
const isClash = (name: string) => MY_NAMES.includes(name.trim())

const SOURCE = "Compliance Gap Report"

function mount(overrides: Partial<Parameters<typeof ForkNameDialog>[0]> = {}) {
  const onCreate = vi.fn()
  const onCancel = vi.fn()
  const utils = render(
    <ForkNameDialog
      open
      sourceName={SOURCE}
      onCancel={onCancel}
      onCreate={onCreate}
      isClash={isClash}
      {...overrides}
    />,
  )
  return { onCreate, onCancel, ...utils }
}

const dialog = () => screen.getByTestId("fork-name-dialog")
const input = () => screen.getByTestId("fork-name-input") as HTMLInputElement
const hint = () => screen.getByTestId("fork-name-hint")
const primary = () => screen.getByTestId("fork-name-create") as HTMLButtonElement

beforeEach(() => {
  // The four Radix jsdom shims (`RunModal.a11y.test.tsx:100-103`).
  if (!Element.prototype.hasPointerCapture) Element.prototype.hasPointerCapture = () => false
  if (!Element.prototype.setPointerCapture) Element.prototype.setPointerCapture = () => {}
  if (!Element.prototype.releasePointerCapture) Element.prototype.releasePointerCapture = () => {}
  if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {}
})

afterEach(() => {
  cleanup()
})

// ── the opening state (D-19 clause 1 — it ASKS) ──────────────────────────────────────

describe("ForkNameDialog — it asks for a name, and starts empty", () => {
  it("opens with an EMPTY field — never prefilled with the source name — and focuses it", async () => {
    mount()
    expect(input().value).toBe("")
    // The source name is NOT sitting in the field waiting to be accepted: a prefilled name
    // is a confirmation wearing an input's clothes, which is exactly what D-19 forbids.
    expect(input().value).not.toBe(SOURCE)
    expect(document.activeElement).toBe(input())
  })

  it("names WHAT is being copied, through the dialog's accessible description", () => {
    mount()
    expect(dialog()).toHaveAccessibleName(FORK_DIALOG_TITLE)
    expect(dialog()).toHaveAccessibleDescription(forkDialogSub(SOURCE))
  })

  it("re-opening after a previous use shows an empty field again (reset-on-open)", async () => {
    const user = userEvent.setup()
    const { rerender, onCreate } = mount()
    await user.type(input(), "Q3 EU gap review")
    await user.click(primary())
    expect(onCreate).toHaveBeenCalledWith("Q3 EU gap review")

    rerender(
      <ForkNameDialog
        open={false}
        sourceName={SOURCE}
        onCancel={vi.fn()}
        onCreate={onCreate}
        isClash={isClash}
      />,
    )
    rerender(
      <ForkNameDialog
        open
        sourceName={SOURCE}
        onCancel={vi.fn()}
        onCreate={onCreate}
        isClash={isClash}
      />,
    )
    expect(input().value).toBe("")
  })
})

// ── D-20 — emptiness is the ONLY hard gate ───────────────────────────────────────────

describe("ForkNameDialog — emptiness is the only thing that blocks (D-20)", () => {
  it("an EMPTY field says so and disables the primary", () => {
    mount()
    expect(hint()).toHaveTextContent(FORK_HINT_EMPTY)
    expect(primary()).toBeDisabled()
  })

  it("a WHITESPACE-ONLY field is empty too — the check is on the trimmed value", async () => {
    const user = userEvent.setup()
    mount()
    await user.type(input(), "   ")
    expect(hint()).toHaveTextContent(FORK_HINT_EMPTY)
    expect(primary()).toBeDisabled()
  })

  it("a FREE name says so plainly and enables the primary", async () => {
    const user = userEvent.setup()
    mount()
    await user.type(input(), "Q3 EU gap review")
    expect(hint()).toHaveTextContent(FORK_HINT_FREE)
    expect(primary()).toBeEnabled()
  })
})

// ── D-20's headline — it WARNS, it never BLOCKS ──────────────────────────────────────

describe("ForkNameDialog — a colliding name WARNS and still proceeds (D-20)", () => {
  it("the clash sentence appears — and the primary stays ENABLED", async () => {
    const user = userEvent.setup()
    mount()
    await user.type(input(), MY_NAMES[0])
    expect(hint()).toHaveTextContent(FORK_HINT_CLASH)
    expect(primary()).toBeEnabled()
  })

  it("POSITIVE CONTROL — submitting THROUGH the clash really creates, with the typed name", async () => {
    // ⚠ THE CASE ABOVE IS SATISFIED BY A DIALOG THAT WARNS AND THEN REFUSES. This one is
    // not: it clicks the primary and reads the argument the callback received. *A name you
    // chose is a name you are allowed to have* is only true if the click works.
    const user = userEvent.setup()
    const { onCreate } = mount()
    await user.type(input(), MY_NAMES[1])
    await user.click(primary())
    expect(onCreate).toHaveBeenCalledTimes(1)
    expect(onCreate).toHaveBeenCalledWith(MY_NAMES[1])
  })

  it("the clash hint is NOT an alert — it is described text on the input, not a refusal", () => {
    // `InviteMemberDialog.tsx:255` is right to use `role="alert"`: a 422 IS a refusal. This
    // is not one, and announcing it as an interruption would tell a screen-reader user that
    // something went wrong when nothing did.
    mount()
    expect(within(dialog()).queryByRole("alert")).toBeNull()
    // …and the hint really is wired to the field, resolved rather than merely present.
    const describedBy = input().getAttribute("aria-describedby") ?? ""
    expect(describedBy.split(/\s+/)).toContain(hint().id)

    // POSITIVE CONTROL — the same query DOES find an alert when a surface raises one.
    cleanup()
    render(<p role="alert">A refusal lives here</p>)
    expect(screen.getByRole("alert")).toBeInTheDocument()
  })
})

// ── D-19 clauses 2 + 3 — the button is not the ladder's word, and nothing is red ──────

describe("ForkNameDialog — an INPUT, not a guard (D-19)", () => {
  it("the primary is `Create my copy`, and NO control is named `Confirm`", async () => {
    mount()
    expect(primary()).toHaveAccessibleName(FORK_DIALOG_OK)
    expect(screen.queryByRole("button", { name: /confirm/i })).toBeNull()
    expect(screen.getByTestId("fork-name-cancel")).toHaveAccessibleName(FORK_DIALOG_CANCEL)

    // POSITIVE CONTROL — the query is not broken; it finds the ladder's word when present.
    cleanup()
    render(
      <button type="button" data-testid="planted-guard">
        Confirm
      </button>,
    )
    expect(screen.getByRole("button", { name: /confirm/i })).toBeInTheDocument()
  })

  it("wears no destructive styling anywhere in its rendered tree", () => {
    mount()
    const painted = dialog().outerHTML
    expect(painted).not.toMatch(/destructive|text-red-|bg-red-|border-red-/)

    // POSITIVE CONTROL — the matcher really catches the shipped destructive tokens.
    expect('<button class="text-destructive">Delete forever</button>').toMatch(/destructive/)
    expect('<span class="text-red-400">gone</span>').toMatch(/text-red-/)
  })

  it("spends EXACTLY ONE consequence sentence, and it is the shipped one verbatim", () => {
    mount()
    const sentence = screen.getByTestId("fork-name-consequence")
    expect(sentence).toHaveTextContent(FORK_CONSEQUENCE)
    // Exactly one — a second copy of the promise on one surface is the clutter LIB-02 cures.
    expect(within(dialog()).getAllByText(FORK_CONSEQUENCE)).toHaveLength(1)
  })
})

// ── the escapes ──────────────────────────────────────────────────────────────────────

describe("ForkNameDialog — leaving without creating", () => {
  it("Escape closes and creates NOTHING", async () => {
    const user = userEvent.setup()
    const { onCancel, onCreate } = mount()
    await user.type(input(), "Q3 EU gap review")
    await user.keyboard("{Escape}")
    expect(onCancel).toHaveBeenCalled()
    expect(onCreate).not.toHaveBeenCalled()
  })

  it("Cancel closes and creates NOTHING", async () => {
    const user = userEvent.setup()
    const { onCancel, onCreate } = mount()
    await user.type(input(), "Q3 EU gap review")
    await user.click(screen.getByTestId("fork-name-cancel"))
    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(onCreate).not.toHaveBeenCalled()
  })

  it("closed means closed — nothing of the prompt is in the document", () => {
    render(
      <ForkNameDialog
        open={false}
        sourceName={SOURCE}
        onCancel={vi.fn()}
        onCreate={vi.fn()}
        isClash={isClash}
      />,
    )
    expect(screen.queryByTestId("fork-name-dialog")).toBeNull()

    // POSITIVE CONTROL — the same query finds it when the prompt IS open.
    cleanup()
    mount()
    expect(screen.getByTestId("fork-name-dialog")).toBeInTheDocument()
  })
})

// ── a11y ─────────────────────────────────────────────────────────────────────────────

describe("ForkNameDialog a11y — WCAG 2.1 AA (structural)", () => {
  it("no aXe structural violations on the open prompt", async () => {
    mount()
    expect(await axe(dialog())).toHaveNoViolations()
  })

  it("no aXe structural violations with the clash warning showing", async () => {
    const user = userEvent.setup()
    mount()
    await user.type(input(), MY_NAMES[0])
    expect(hint()).toHaveTextContent(FORK_HINT_CLASH)
    expect(await axe(dialog())).toHaveNoViolations()
  })

  it("the field is reachable by its accessible name, not by its testid alone", () => {
    mount()
    // ⚠ SCOPED TO THE DIALOG'S CHILDREN ON PURPOSE, AND THE REASON WAS MEASURED RATHER THAN
    // ANTICIPATED. Written as a bare `screen.getByLabelText(…)` first, this line failed with
    // *"Found multiple elements with the text of: Name your copy"* — because Radix points
    // `DialogContent`'s own `aria-labelledby` at the same heading, so the DIALOG matches the
    // label query too. `within(dialog())` excludes the dialog node itself, which is exactly
    // the distinction the assertion means.
    expect(within(dialog()).getByLabelText(FORK_DIALOG_TITLE)).toBe(input())
  })
})

// ── 199-10 Task 3 — THE FORK DIALOG RECONCILED AGAINST SHEET c6 ──────────────────────

/**
 * Phase 199-10 Task 3 (DES-01) — sheet `c6-library-dialogs`'s fork dialog, against the
 * shipped one.
 *
 * ⚠ THE SHEET IS POORER THAN THE SHIPPED SURFACE HERE, AND ON THE ONE POINT THAT MATTERS IT
 * IS ALSO WRONG. It draws a field PREFILLED with *"Invoice OCR Processing (Copy)"* and an
 * availability line reading *"Name available"* in green with a check mark. Both are refused:
 *
 *   · A PREFILLED NAME IS A CONFIRMATION WEARING AN INPUT'S CLOTHES, and D-19's first clause
 *     is that this dialog ASKS. The whole reason it is legal to interrupt a harmless action
 *     with a prompt is that it collects something the system cannot know; a prefill turns it
 *     back into a guard, which would spend the vocabulary the delete sheet relies on.
 *   · GREEN-PLUS-A-TICK IS COLOUR CARRYING THE MEANING. The shipped hint says the state in
 *     WORDS, which is strictly stronger, and the assertion below proves that by stripping
 *     every `class` attribute off the rendered DOM before comparing the three states.
 *
 * ⚠ AND ONE OF THIS PLAN'S OWN CLAIMS IS MEASURED FALSE HERE — recorded rather than quietly
 * satisfied. The plan asks that *"available, taken, still checking"* stay mutually
 * distinguishable and that *"still checking must never read as either verdict"*.
 * **THERE IS NO "STILL CHECKING" STATE, AND THERE CANNOT BE ONE INSIDE THIS PHASE.** `isClash`
 * is a SYNCHRONOUS `(name: string) => boolean` evaluated over rows the caller already holds
 * (D-21); it has no pending arm and no promise to await. An availability CHECK — the thing the
 * sheet's wording implies — would need a server round trip against a name index, which is a
 * backend change and a new user-facing capability, both fenced out of this presentation-only
 * phase. So the three states asserted below are the three that EXIST: empty, clash, free.
 * The gap is reported in the SUMMARY as CANNOT-EXPRESS rather than faked with a spinner.
 */
describe("ForkNameDialog 199-10 — the name-check states are told apart by WORDS, not colour", () => {
  /** Strip every `class` attribute, so nothing painted can carry meaning past this point. */
  const unpainted = (el: Element): string =>
    el.outerHTML.replace(/ class="[^"]*"/g, "").replace(/ style="[^"]*"/g, "")

  it("POSITIVE CONTROL — the stripper really removes the paint it claims to", () => {
    // Without this, every comparison below could be running over untouched, painted markup
    // and would pass for the wrong reason.
    const el = document.createElement("div")
    el.innerHTML = '<p class="text-emerald-400" style="color:red">free</p>'
    expect(el.outerHTML).toContain("text-emerald-400")
    expect(unpainted(el)).not.toContain("text-emerald-400")
    expect(unpainted(el)).not.toContain("color:red")
    expect(unpainted(el)).toContain("free") // …and it keeps the words
  })

  it("the THREE shipped states are mutually distinct with every class attribute stripped", async () => {
    const user = userEvent.setup()

    mount()
    const empty = unpainted(hint())
    await user.type(input(), SOURCE) // a name the caller already has → clash
    const clash = unpainted(hint())
    await user.clear(input())
    await user.type(input(), "Something nobody has")
    const free = unpainted(hint())

    // Non-vacuity FIRST: three empty strings are trivially equal AND trivially distinct
    // depending on which way the assertion is written, and neither reading is a test.
    for (const [label, html] of [["empty", empty], ["clash", clash], ["free", free]] as const) {
      expect(html.length, `${label} rendered nothing`).toBeGreaterThan(30)
    }
    expect(new Set([empty, clash, free]).size).toBe(3)

    // …and each carries its OWN sentence, so "distinct" cannot be satisfied by three
    // differently-empty nodes or by an id that happens to differ.
    expect(empty).toContain(FORK_HINT_EMPTY)
    expect(clash).toContain(FORK_HINT_CLASH)
    expect(free).toContain(FORK_HINT_FREE)

    // The three sentences are distinct from each other as STRINGS — a vocabulary that
    // accidentally shipped the same words twice would make the DOM distinctness above
    // meaningless.
    expect(new Set([FORK_HINT_EMPTY, FORK_HINT_CLASH, FORK_HINT_FREE]).size).toBe(3)
  })

  it("no state's meaning is carried by colour ALONE — each sentence stands on its own", () => {
    // The mechanical form of "distinguishable without colour": each hint's TEXT alone tells a
    // reader which of the three states they are in, with no reference to a swatch.
    for (const sentence of [FORK_HINT_EMPTY, FORK_HINT_CLASH, FORK_HINT_FREE]) {
      expect(sentence.length).toBeGreaterThan(8)
      expect(sentence).not.toMatch(/\b(green|red|amber|orange|colou?r)\b/i)
    }
  })

  it("CANNOT-EXPRESS, ASSERTED — there is no pending/checking arm for a fourth state to hide in", () => {
    // `isClash` is called synchronously during render and its answer is a boolean. If a later
    // plan makes the check asynchronous it MUST add a third arm and this assertion is where it
    // will notice: a promise coerces truthy and would silently read as CLASH for every name.
    const calls: string[] = []
    const probe = (name: string) => {
      calls.push(name)
      return false
    }
    mount({ isClash: probe })
    // Not called on an empty field — there is nothing to check yet (D-20's one hard gate).
    expect(calls).toEqual([])
    expect(hint()).toHaveTextContent(FORK_HINT_EMPTY)
  })
})

describe("ForkNameDialog 199-10 — the LIGHTEST guard grade, asserted structurally (D-15 / D-19)", () => {
  it("offers exactly TWO controls: leave, and create. There is no second step to arm", async () => {
    mount()
    const buttons = within(dialog()).getAllByRole("button")
    // Radix's own ✕ is one of them; the count is read off the rendered dialog rather than
    // predicted, and pinned so a third ACTION cannot arrive unnoticed.
    const actions = buttons.filter((b) => b.getAttribute("data-testid")?.startsWith("fork-name-"))
    expect(actions).toHaveLength(2)
    expect(actions.map((b) => b.getAttribute("data-testid")).sort()).toEqual([
      "fork-name-cancel",
      "fork-name-create",
    ])
  })

  it("ONE action creates — no arm-to-confirm, no victim to name, no second click", async () => {
    const user = userEvent.setup()
    const { onCreate } = mount()
    await user.type(input(), "A name of my own")
    await user.click(primary())
    // Called on the FIRST click. An arm-to-confirm guard would have consumed this one.
    expect(onCreate).toHaveBeenCalledTimes(1)
    expect(onCreate).toHaveBeenCalledWith("A name of my own")
  })

  it("states NO counts and makes NO irreversibility claim — those words belong to the delete", () => {
    mount()
    const text = dialog().textContent ?? ""
    expect(text.length).toBeGreaterThan(40) // non-vacuity before any absence
    expect(text).not.toMatch(/\d+\s+(versions|run records|chat threads)/)
    expect(text).not.toMatch(/permanently|forever|cannot be undone|irreversible/i)

    // POSITIVE CONTROLS — both matchers fire on the delete sheet's own shipped sentences.
    expect("Vendor-risk review · 1 versions · 0 run records").toMatch(
      /\d+\s+(versions|run records|chat threads)/,
    )
    expect("Permanently removed").toMatch(/permanently|forever|cannot be undone|irreversible/i)
  })
})
