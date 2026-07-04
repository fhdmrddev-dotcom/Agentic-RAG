/**
 * Phase 137 Plan 03 Task 3 (PANEL-01 / D-12) — RunBar tests.
 * Phase 137.1 Plan 08 Task 1 (EVAL-05 / 058-A) — + matrix launcher tests.
 *
 * RunBar is the compact controlled provider/model picker + Run button. It holds no
 * launch logic — pressing Run just calls onRun (the container owns startEvalRun).
 * Asserted here:
 *   - The Run button is disabled while running AND when provider/model is empty.
 *   - Clicking Run calls onRun.
 *   - Changing the provider calls onProviderChange (and resets the model).
 *   - 058-A: the matrix launcher renders ONLY when onRunMatrix is wired; the matrix
 *     button calls onRunMatrix; the gate-feeder select calls onGateProviderChange;
 *     both disable while `running` (one claim per skill, D-06); RunBar stays pure
 *     (no fetch inside).
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

// The additive 058-A matrix launcher props (wired by EvalsTab; absent → no matrix UI).
const matrixProps = {
  configuredProviders: PROVIDERS,
  gateProvider: "openai",
  onGateProviderChange: vi.fn(),
  onRunMatrix: vi.fn(),
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

describe("RunBar — 058-A matrix launcher (EVAL-05 / D-05 / D-06)", () => {
  it("does NOT render the matrix launcher when onRunMatrix is absent (single-run path unchanged)", () => {
    render(<RunBar {...baseProps} />)
    expect(screen.queryByTestId("matrix-launch")).toBeNull()
    expect(screen.queryByTestId("run-matrix")).toBeNull()
    // The single-run Run button still stands alone.
    expect(screen.getByRole("button", { name: /run eval/i })).toBeInTheDocument()
  })

  it("renders the matrix launcher with the configured count and a gate-feeder select", () => {
    render(<RunBar {...baseProps} {...matrixProps} />)
    expect(screen.getByTestId("matrix-launch")).toBeInTheDocument()
    // Label reads "Run matrix (N configured)" off configuredProviders.length.
    expect(screen.getByRole("button", { name: /run matrix \(2 configured\)/i })).toBeInTheDocument()
    expect(screen.getByLabelText("Gate feeder")).toBeInTheDocument()
  })

  it("clicking the matrix button calls onRunMatrix", async () => {
    const user = userEvent.setup()
    const onRunMatrix = vi.fn()
    render(<RunBar {...baseProps} {...matrixProps} onRunMatrix={onRunMatrix} />)
    await user.click(screen.getByTestId("run-matrix"))
    expect(onRunMatrix).toHaveBeenCalledTimes(1)
  })

  it("changing the gate-feeder select calls onGateProviderChange (controlled — no fetch inside)", async () => {
    const user = userEvent.setup()
    const onGateProviderChange = vi.fn()
    render(
      <RunBar {...baseProps} {...matrixProps} onGateProviderChange={onGateProviderChange} />,
    )
    await user.selectOptions(screen.getByLabelText("Gate feeder"), "anthropic")
    expect(onGateProviderChange).toHaveBeenCalledWith("anthropic")
  })

  it("disables BOTH launchers while a run is live (one claim per skill, D-06)", () => {
    render(<RunBar {...baseProps} {...matrixProps} running={true} />)
    expect(screen.getByRole("button", { name: /run eval/i })).toBeDisabled()
    expect(screen.getByTestId("run-matrix")).toBeDisabled()
    expect(screen.getByLabelText("Gate feeder")).toBeDisabled()
  })

  it("disables the matrix button when no providers are configured", () => {
    render(<RunBar {...baseProps} {...matrixProps} configuredProviders={[]} />)
    expect(screen.getByRole("button", { name: /run matrix \(0 configured\)/i })).toBeDisabled()
  })
})
