/**
 * Phase 137.1 Plan 10 (EVAL-05 / D-11, D-12 / sketch 060-A) — JudgeModelPicker tests.
 *
 * The independent judge knob, reusing the 024-A idiom: a registry-only `<select>` bound
 * to harness_judge_model + an ALWAYS-ON 🔒 footer showing the EFFECTIVE judge.
 *
 * Locks asserted here:
 *   - D-12: the select offers ONLY registry-known models (never an unknown one).
 *   - D-11: the footer shows the effective judge (claude-opus-4-8 when unset), NEVER
 *     blank, and names its double duty (eval verdicts + publish-gauntlet judge).
 *   - Selecting a model calls setJudgeModel and the effective footer follows the server.
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { JudgeModelPicker } from "./JudgeModelPicker"
import { getJudgeModel, setJudgeModel } from "@/lib/api"
import type { FullAppSettings } from "@/lib/api"

vi.mock("@/lib/api", () => ({
  getJudgeModel: vi.fn(),
  setJudgeModel: vi.fn(),
}))

const mockGet = vi.mocked(getJudgeModel)
const mockSet = vi.mocked(setJudgeModel)

const REGISTRY = ["claude-opus-4-8", "gpt-5.4", "gemini-2.5-pro"]

function settings(overrides: Partial<FullAppSettings> = {}): FullAppSettings {
  return {
    harness_judge_model: "",
    resolved_harness_judge_model: "claude-opus-4-8",
    ...overrides,
  } as unknown as FullAppSettings
}

beforeEach(() => {
  vi.clearAllMocks()
  mockGet.mockResolvedValue({ judge_model: "", resolved_judge_model: "claude-opus-4-8" })
  mockSet.mockResolvedValue(
    settings({ harness_judge_model: "gpt-5.4", resolved_harness_judge_model: "gpt-5.4" }),
  )
})

describe("JudgeModelPicker — 024-A registry-only + effective footer (D-11/D-12)", () => {
  it("lists ONLY registry-known models (plus the Auto default), never an unknown model", async () => {
    render(<JudgeModelPicker registryModels={REGISTRY} />)
    await screen.findByTestId("judge-effective")
    const select = screen.getByRole("combobox", { name: /judge model/i })
    const options = within(select).getAllByRole("option")
    // Auto default + the 3 registry models — nothing else.
    expect(options).toHaveLength(REGISTRY.length + 1)
    for (const m of REGISTRY) {
      expect(within(select).getByRole("option", { name: m })).toBeInTheDocument()
    }
    expect(within(select).queryByRole("option", { name: "totally-made-up-model" })).toBeNull()
  })

  it("shows the effective judge (claude-opus-4-8) when unset — never blank (D-11)", async () => {
    render(<JudgeModelPicker registryModels={REGISTRY} />)
    const footer = await screen.findByTestId("judge-effective")
    expect(footer.textContent).toMatch(/claude-opus-4-8/)
    expect(footer.textContent).toMatch(/publish-gauntlet judge/i)
    expect(footer.textContent?.trim()).not.toBe("")
  })

  it("selecting a registry model calls setJudgeModel and updates the effective footer", async () => {
    const user = userEvent.setup()
    render(<JudgeModelPicker registryModels={REGISTRY} />)
    await screen.findByTestId("judge-effective")
    const select = screen.getByRole("combobox", { name: /judge model/i })
    await user.selectOptions(select, "gpt-5.4")
    expect(mockSet).toHaveBeenCalledWith("gpt-5.4")
    await waitFor(() =>
      expect(screen.getByTestId("judge-effective").textContent).toMatch(/gpt-5\.4/),
    )
  })

  it("never renders a blank footer even when the resolver default is null", async () => {
    mockGet.mockResolvedValue({ judge_model: "", resolved_judge_model: null })
    render(<JudgeModelPicker registryModels={REGISTRY} />)
    const footer = await screen.findByTestId("judge-effective")
    // Falls back to the hard floor claude-opus-4-8 — never blank.
    expect(footer.textContent).toMatch(/claude-opus-4-8/)
  })
})
