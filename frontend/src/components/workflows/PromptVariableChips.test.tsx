/**
 * Phase 205 (STATE-01 / D-08 / N-2) — PromptVariableChips tests.
 */
import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { PromptVariableChips, STATEFUL_VARIABLES } from "./PromptVariableChips"

describe("PromptVariableChips", () => {
  it("renders nothing when isStateful is false or omitted", () => {
    const { container } = render(<PromptVariableChips onInsert={vi.fn()} isStateful={false} />)
    expect(container.firstChild).toBeNull()
  })

  it("renders chips when isStateful is true", () => {
    const onInsert = vi.fn()
    render(<PromptVariableChips onInsert={onInsert} isStateful={true} />)

    expect(screen.getByTestId("prompt-variable-chips")).toBeInTheDocument()
    for (const v of STATEFUL_VARIABLES) {
      const chip = screen.getByTestId(`variable-chip-${v.token}`)
      expect(chip).toBeInTheDocument()
      expect(chip.textContent).toContain(v.label)
    }
  })

  it("clicking a chip triggers onInsert with token", () => {
    const onInsert = vi.fn()
    render(<PromptVariableChips onInsert={onInsert} isStateful={true} />)

    const chip = screen.getByTestId("variable-chip-{{prior_run.output}}")
    fireEvent.click(chip)

    expect(onInsert).toHaveBeenCalledTimes(1)
    expect(onInsert).toHaveBeenCalledWith("{{prior_run.output}}")
  })
})
