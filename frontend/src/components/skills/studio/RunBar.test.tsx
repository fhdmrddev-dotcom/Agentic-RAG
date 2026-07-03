/**
 * Phase 137 Plan 03 Task 3 (PANEL-01 / D-12) — RunBar tests.
 *
 * RunBar is the compact controlled provider/model picker + Run button. It holds no
 * launch logic — pressing Run just calls onRun (the container owns startEvalRun).
 * Asserted here:
 *   - The Run button is disabled while running AND when provider/model is empty.
 *   - Clicking Run calls onRun.
 *   - Changing the provider calls onProviderChange (and resets the model).
 */
import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { RunBar } from "./RunBar"

const PROVIDERS = [
  { id: "openai", name: "OpenAI", models: ["gpt-5.4-mini", "gpt-5.4"] },
  { id: "anthropic", name: "Anthropic", models: ["claude-haiku-4-5"] },
]

const baseProps = {
  providers: PROVIDERS,
  provider: "openai",
  model: "gpt-5.4-mini",
  models: ["gpt-5.4-mini", "gpt-5.4"],
  onProviderChange: vi.fn(),
  onModelChange: vi.fn(),
  running: false,
  onRun: vi.fn(),
}

describe("RunBar — compact controlled picker + Run (D-12)", () => {
  it("enables Run when idle with a provider and model selected", () => {
    render(<RunBar {...baseProps} />)
    expect(screen.getByRole("button", { name: /run eval/i })).toBeEnabled()
  })

  it("disables Run while a run is streaming", () => {
    render(<RunBar {...baseProps} running={true} />)
    expect(screen.getByRole("button", { name: /run eval/i })).toBeDisabled()
  })

  it("disables Run when the provider is empty", () => {
    render(<RunBar {...baseProps} provider="" />)
    expect(screen.getByRole("button", { name: /run eval/i })).toBeDisabled()
  })

  it("disables Run when the model is empty", () => {
    render(<RunBar {...baseProps} model="" />)
    expect(screen.getByRole("button", { name: /run eval/i })).toBeDisabled()
  })

  it("clicking Run calls onRun", async () => {
    const user = userEvent.setup()
    const onRun = vi.fn()
    render(<RunBar {...baseProps} onRun={onRun} />)
    await user.click(screen.getByRole("button", { name: /run eval/i }))
    expect(onRun).toHaveBeenCalledTimes(1)
  })

  it("changing the provider calls onProviderChange and resets the model to the new provider's first model", async () => {
    const user = userEvent.setup()
    const onProviderChange = vi.fn()
    const onModelChange = vi.fn()
    render(
      <RunBar {...baseProps} onProviderChange={onProviderChange} onModelChange={onModelChange} />,
    )
    await user.selectOptions(screen.getByLabelText("Provider"), "anthropic")
    expect(onProviderChange).toHaveBeenCalledWith("anthropic")
    expect(onModelChange).toHaveBeenCalledWith("claude-haiku-4-5")
  })
})
