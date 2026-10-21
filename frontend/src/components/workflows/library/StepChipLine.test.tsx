/**
 * Phase 290-02 (2026-10-21, VIS-04 / D-03 / D-05) — `StepChipLine`, the card's one chip line,
 * rendered (sketch 290-card-chip-line winner B).
 *
 * ⚠ The words are asserted EXACTLY, against `PHASE_TYPE_SENTENCES` (imported) and the
 * `libraryVocabulary.ts` entries. The toggle is queried by its own testid inside `row-steps`,
 * because `+N more` is also what `automationMoreCount(n)` prints on the same card.
 */
import { describe, it, expect } from "vitest"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { StepChipLine } from "./StepChipLine"
import type { StepChip, StepLine } from "./stepLine"
import {
  STEP_LINE_JOINER,
  STEP_LINE_LABEL,
  STEP_LINE_LESS,
  stepLineMore,
  stepLineMoreLabel,
} from "./libraryVocabulary"
import { PHASE_TYPE_SENTENCES } from "../phaseVocabulary"

const S = PHASE_TYPE_SENTENCES

const chip = (type: string): StepChip => ({ type, words: S[type] ?? type })

const lineOf = (chips: StepChip[]): StepLine => ({
  chips,
  shown: chips.slice(0, 3),
  more: Math.max(0, chips.length - 3),
})

const TWO = lineOf([chip("llm_agent"), chip("llm_emit")])

const SEVEN_TYPES = [
  "programmatic",
  "llm_single",
  "llm_agent",
  "llm_batch_agents",
  "llm_human_input",
  "llm_emit",
  "external_action",
]
const SEVEN = lineOf(SEVEN_TYPES.map(chip))

const chipTexts = (list: HTMLElement) =>
  within(list)
    .getAllByTestId("row-steps-chip")
    .map((li) => {
      // The joiner is decorative and aria-hidden; the chip's WORDS are what is compared.
      const clone = li.cloneNode(true) as HTMLElement
      clone.querySelectorAll('[aria-hidden="true"]').forEach((n) => n.remove())
      return clone.textContent ?? ""
    })

describe("StepChipLine — a short line (2 steps)", () => {
  it("is an ordered list named for what it is, one item per step, in words", () => {
    render(<StepChipLine line={TWO} />)
    const root = screen.getByTestId("row-steps")
    const list = within(root).getByRole("list", { name: STEP_LINE_LABEL })
    expect(list.tagName).toBe("OL")
    expect(within(list).getAllByRole("listitem")).toHaveLength(2)
    expect(chipTexts(list)).toEqual([S.llm_agent, S.llm_emit])
  })

  it("joins the two chips with ONE decorative arrow", () => {
    render(<StepChipLine line={TWO} />)
    const root = screen.getByTestId("row-steps")
    const joiners = Array.from(root.querySelectorAll('[aria-hidden="true"]')).filter(
      (n) => n.textContent === STEP_LINE_JOINER,
    )
    expect(joiners).toHaveLength(1)
  })

  it("has no toggle when nothing is left out", () => {
    render(<StepChipLine line={TWO} />)
    const root = screen.getByTestId("row-steps")
    expect(within(root).queryByTestId("row-steps-toggle")).toBeNull()
    expect(within(root).queryByRole("button")).toBeNull()
  })
})

describe("StepChipLine — a long line (7 steps), first three then +N more (D-03)", () => {
  it("collapsed: three chips, then a toggle OUTSIDE the clipped list", () => {
    render(<StepChipLine line={SEVEN} />)
    const root = screen.getByTestId("row-steps")
    const list = within(root).getByRole("list", { name: STEP_LINE_LABEL })
    expect(chipTexts(list)).toEqual([S.programmatic, S.llm_single, S.llm_agent])
    const toggle = within(root).getByTestId("row-steps-toggle")
    expect(toggle.tagName).toBe("BUTTON")
    expect(toggle).toHaveAttribute("type", "button")
    expect(list.contains(toggle)).toBe(false)
    expect(toggle).toHaveTextContent(stepLineMore(4))
    expect(toggle.textContent).toBe(stepLineMore(4))
    expect(toggle).toHaveAttribute("aria-label", stepLineMoreLabel(4))
    expect(toggle).toHaveAttribute("aria-expanded", "false")
    // The accessible name is the full sentence, so a screen reader hears what the toggle does.
    expect(within(root).getByRole("button", { name: "Show 4 more steps" })).toBe(toggle)
  })

  it("collapsed: the list never wraps; the toggle group never shrinks", () => {
    render(<StepChipLine line={SEVEN} />)
    const root = screen.getByTestId("row-steps")
    const list = within(root).getByRole("list")
    expect(list.className).toMatch(/\bflex-nowrap\b/)
    expect(list.className).toMatch(/\boverflow-hidden\b/)
    expect(list.className).not.toMatch(/\bflex-wrap\b/)
    const toggle = within(root).getByTestId("row-steps-toggle")
    expect(toggle.parentElement?.className).toMatch(/\bflex-none\b/)
  })

  it("pressing it names EVERY step in visible chips, and says Show less", async () => {
    const user = userEvent.setup()
    render(<StepChipLine line={SEVEN} />)
    const root = screen.getByTestId("row-steps")
    const toggle = within(root).getByTestId("row-steps-toggle")
    await user.click(toggle)

    const list = within(root).getByRole("list", { name: STEP_LINE_LABEL })
    expect(chipTexts(list)).toEqual(SEVEN_TYPES.map((t) => S[t]))
    const after = within(root).getByTestId("row-steps-toggle")
    expect(after.textContent).toBe(STEP_LINE_LESS)
    expect(after).toHaveAttribute("aria-expanded", "true")
    expect(within(root).getByRole("button", { name: STEP_LINE_LESS })).toBe(after)
    expect(document.activeElement).toBe(after)
    expect(list.className).toMatch(/\bflex-wrap\b/)
  })

  it("a second press folds it back to three", async () => {
    const user = userEvent.setup()
    render(<StepChipLine line={SEVEN} />)
    const root = screen.getByTestId("row-steps")
    await user.click(within(root).getByTestId("row-steps-toggle"))
    await user.click(within(root).getByTestId("row-steps-toggle"))
    const list = within(root).getByRole("list")
    expect(chipTexts(list)).toEqual([S.programmatic, S.llm_single, S.llm_agent])
    const toggle = within(root).getByTestId("row-steps-toggle")
    expect(toggle.textContent).toBe(stepLineMore(4))
    expect(toggle).toHaveAttribute("aria-expanded", "false")
    expect(document.activeElement).toBe(toggle)
  })

  it("one step left out says it in the singular", () => {
    const four = lineOf(SEVEN_TYPES.slice(0, 4).map(chip))
    render(<StepChipLine line={four} />)
    const toggle = within(screen.getByTestId("row-steps")).getByTestId("row-steps-toggle")
    expect(toggle).toHaveAttribute("aria-label", "Show 1 more step")
    expect(toggle.textContent).toBe("+1 more")
  })
})

describe("StepChipLine — the glyph", () => {
  it("a known type draws its mark, hidden from assistive tech", () => {
    render(<StepChipLine line={lineOf([chip("llm_agent")])} />)
    const li = within(screen.getByTestId("row-steps")).getByTestId("row-steps-chip")
    const marks = li.querySelectorAll("svg, img")
    expect(marks).toHaveLength(1)
    expect(marks[0]).toHaveAttribute("aria-hidden", "true")
  })

  it("an unknown type draws NO mark — no fallback dot, no emoji", () => {
    render(<StepChipLine line={lineOf([{ type: "constructor", words: "constructor" }])} />)
    const li = within(screen.getByTestId("row-steps")).getByTestId("row-steps-chip")
    expect(li.querySelectorAll("svg, img")).toHaveLength(0)
    expect(li.textContent).toBe("constructor")
  })

  it("POSITIVE CONTROL — the mark query really does see an svg when one is present", () => {
    const host = document.createElement("li")
    host.innerHTML = '<svg aria-hidden="true"></svg><span>x</span>'
    expect(host.querySelectorAll("svg, img")).toHaveLength(1)
  })
})
