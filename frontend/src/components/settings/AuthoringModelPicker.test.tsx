/**
 * Migration 212 (operator direction 2026-10-23: every non-secret setting lives in the UI) —
 * AuthoringModelPicker. The workflow-drafting model used to be env-only, so moving off a provider
 * with no credit needed an .env edit and a restart (291 UAT S1).
 *
 * Locks asserted here:
 *   - the select offers ONLY the server's drafting-capable models (plus Auto);
 *   - the footer always names the model drafting will actually use, never a blank;
 *   - a pick saves through setAuthoringModel and the footer follows the server's answer;
 *   - a refused save shows the server's words and keeps the previous value.
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { AuthoringModelPicker } from "./AuthoringModelPicker"
import { getAuthoringModel, setAuthoringModel } from "@/lib/api"
import type { FullAppSettings } from "@/lib/api"

vi.mock("@/lib/api", () => ({
  getAuthoringModel: vi.fn(),
  setAuthoringModel: vi.fn(),
}))

const mockGet = vi.mocked(getAuthoringModel)
const mockSet = vi.mocked(setAuthoringModel)
const OPTIONS = ["claude-opus-4-8", "deepseek-v4-pro", "gpt-5.5"]

beforeEach(() => {
  vi.clearAllMocks()
  mockGet.mockResolvedValue({ model: "", resolved: "gpt-5.5", options: OPTIONS })
  mockSet.mockResolvedValue({
    harness_authoring_model: "deepseek-v4-pro",
    resolved_harness_authoring_model: "deepseek-v4-pro",
    authoring_model_options: OPTIONS,
  } as unknown as FullAppSettings)
})

describe("AuthoringModelPicker", () => {
  it("offers only the server's drafting-capable models, plus Auto", async () => {
    render(<AuthoringModelPicker />)
    await screen.findByTestId("authoring-effective")
    const select = screen.getByRole("combobox", { name: /workflow drafting model/i })
    const options = within(select).getAllByRole("option")
    expect(options).toHaveLength(OPTIONS.length + 1)
    for (const m of OPTIONS) expect(within(select).getByRole("option", { name: m })).toBeInTheDocument()
    expect(within(select).getByRole("option", { name: /auto · gpt-5\.5/i })).toBeInTheDocument()
  })

  it("names the model drafting will actually use when nothing is picked", async () => {
    render(<AuthoringModelPicker />)
    expect(await screen.findByTestId("authoring-effective")).toHaveTextContent("Drafts with: gpt-5.5")
  })

  it("saves a pick and shows what the server says drafting now uses", async () => {
    const user = userEvent.setup()
    render(<AuthoringModelPicker />)
    await screen.findByTestId("authoring-effective")
    await user.selectOptions(screen.getByRole("combobox", { name: /workflow drafting model/i }), "deepseek-v4-pro")
    expect(mockSet).toHaveBeenCalledWith("deepseek-v4-pro")
    await waitFor(() =>
      expect(screen.getByTestId("authoring-effective")).toHaveTextContent("Drafts with: deepseek-v4-pro"),
    )
  })

  it("shows the server's refusal and keeps the previous value", async () => {
    mockSet.mockRejectedValueOnce(new Error("gpt-4o can't draft workflows"))
    const user = userEvent.setup()
    render(<AuthoringModelPicker />)
    await screen.findByTestId("authoring-effective")
    const select = screen.getByRole("combobox", { name: /workflow drafting model/i }) as HTMLSelectElement
    await user.selectOptions(select, "gpt-5.5")
    expect(await screen.findByText("gpt-4o can't draft workflows")).toBeInTheDocument()
    expect(select.value).toBe("")
  })

  it("says so when the server sends no drafting-capable models", async () => {
    mockGet.mockResolvedValueOnce({ model: "", resolved: null, options: [] })
    render(<AuthoringModelPicker />)
    expect(await screen.findByTestId("authoring-effective")).toHaveTextContent(
      "No model that can draft workflows is set up",
    )
  })
})
