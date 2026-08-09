/**
 * Phase 167 Plan 07 (VIS-02 / D-167-04 / SEED-116) — ModelDefaultPreference tests.
 *
 * The per-user default-model picker, cloning the 024-A JudgeModelPicker idiom: a
 * registry-only <select> bound to the caller's `/me/preferences` default, plus an
 * ALWAYS-ON 🔒 footer that surfaces the EFFECTIVE model and — when the operator lock
 * is on — DISABLES the select and names the governed default (the two-layer proof).
 *
 * Locks asserted here (the four <behavior> beats + the round-trip guard):
 *   - the select offers ONLY the allowed/enabled models (never one outside the set);
 *   - selecting a model calls setModelDefault and the footer follows the server
 *     (server-derived, never a separate optimistic store);
 *   - when `locked`, the select is DISABLED and the footer names the governed default;
 *   - when unset, the footer shows the effective default — NEVER blank;
 *   - a persisted UNKNOWN value stays selectable as "(current)" (round-trip safe).
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { ModelDefaultPreference } from "./ModelDefaultPreference"
import { getModelDefault, setModelDefault, type ModelDefault } from "@/lib/api"

vi.mock("@/lib/api", () => ({
  getModelDefault: vi.fn(),
  setModelDefault: vi.fn(),
}))

const mockGet = vi.mocked(getModelDefault)
const mockSet = vi.mocked(setModelDefault)

const ALLOWED = ["claude-opus-4-8", "gpt-5.4", "gemini-2.5-pro"]

function pref(overrides: Partial<ModelDefault> = {}): ModelDefault {
  return {
    default_model: null,
    effective_model: "claude-opus-4-8",
    locked: false,
    allowed_models: ALLOWED,
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockGet.mockResolvedValue(pref())
  mockSet.mockResolvedValue(
    pref({ default_model: "gpt-5.4", effective_model: "gpt-5.4" }),
  )
})

describe("ModelDefaultPreference — VIS-02 registry-only + lock-honoring footer (D-167-04)", () => {
  it("offers ONLY the allowed/enabled models (plus the Auto default), never a disallowed model", async () => {
    render(<ModelDefaultPreference />)
    await screen.findByTestId("model-default-effective")
    const select = screen.getByRole("combobox", { name: /default model/i })
    const options = within(select).getAllByRole("option")
    // Auto default + the 3 allowed models — nothing else.
    expect(options).toHaveLength(ALLOWED.length + 1)
    for (const m of ALLOWED) {
      expect(within(select).getByRole("option", { name: m })).toBeInTheDocument()
    }
    // A model the operator has NOT enabled is never selectable.
    expect(within(select).queryByRole("option", { name: "totally-disallowed-model" })).toBeNull()
  })

  it("selecting an allowed model calls setModelDefault and re-reads the effective footer", async () => {
    const user = userEvent.setup()
    render(<ModelDefaultPreference />)
    await screen.findByTestId("model-default-effective")
    const select = screen.getByRole("combobox", { name: /default model/i })
    await user.selectOptions(select, "gpt-5.4")
    expect(mockSet).toHaveBeenCalledWith("gpt-5.4")
    await waitFor(() =>
      expect(screen.getByTestId("model-default-effective").textContent).toMatch(/gpt-5\.4/),
    )
  })

  it("clearing back to Auto calls setModelDefault(null)", async () => {
    const user = userEvent.setup()
    mockGet.mockResolvedValue(pref({ default_model: "gpt-5.4", effective_model: "gpt-5.4" }))
    mockSet.mockResolvedValue(pref({ default_model: null, effective_model: "claude-opus-4-8" }))
    render(<ModelDefaultPreference />)
    await screen.findByTestId("model-default-effective")
    const select = screen.getByRole("combobox", { name: /default model/i })
    await user.selectOptions(select, "")
    expect(mockSet).toHaveBeenCalledWith(null)
  })

  it("when locked, the select is DISABLED and the footer names the governed default (SEED-116)", async () => {
    mockGet.mockResolvedValue(
      pref({ default_model: null, effective_model: "gemini-2.5-pro", locked: true }),
    )
    render(<ModelDefaultPreference />)
    const footer = await screen.findByTestId("model-default-effective")
    const select = screen.getByRole("combobox", { name: /default model/i })
    expect(select).toBeDisabled()
    expect(footer.textContent).toMatch(/gemini-2\.5-pro/)
    expect(footer.textContent).toMatch(/administrator/i)
  })

  it("when unset, the footer shows the effective default — never blank (D-167-04)", async () => {
    render(<ModelDefaultPreference />)
    const footer = await screen.findByTestId("model-default-effective")
    expect(footer.textContent).toMatch(/claude-opus-4-8/)
    expect(footer.textContent?.trim()).not.toBe("")
  })

  it("keeps a persisted UNKNOWN value selectable as (current) so a round-trip never drops it", async () => {
    mockGet.mockResolvedValue(
      pref({ default_model: "legacy-retired-model", effective_model: "legacy-retired-model" }),
    )
    render(<ModelDefaultPreference />)
    await screen.findByTestId("model-default-effective")
    const select = screen.getByRole("combobox", { name: /default model/i }) as HTMLSelectElement
    // The unknown persisted value is preserved as a "(current)" option and stays selected.
    expect(within(select).getByText(/legacy-retired-model \(current\)/i)).toBeInTheDocument()
    await waitFor(() => expect(select.value).toBe("legacy-retired-model"))
  })
})
