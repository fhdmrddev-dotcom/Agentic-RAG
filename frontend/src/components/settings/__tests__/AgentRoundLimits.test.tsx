/**
 * Phase 292.1 (BUG-261024-03, D-17 / D-18) — the two tool-round caps in Settings → AI model.
 *
 * The leaf owns its own fetch and save (SettingsPage is G-5 FIRING with its state split owed), so
 * these cases drive the leaf alone with `getSettings` / `updateSettings` mocked at the `@/lib/api`
 * barrel. They assert rendered CONTENT and the exact PUT body, never mere presence: the words of a
 * refusal and "changed fields only" are the deliverable.
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"

import * as api from "@/lib/api"
import { AgentRoundLimits } from "../AgentRoundLimits"

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>()
  return {
    ...actual,
    getSettings: vi.fn(),
    updateSettings: vi.fn(),
  }
})

const getSettings = vi.mocked(api.getSettings)
const updateSettings = vi.mocked(api.updateSettings)

const CHAT = "Tool rounds per chat turn"
const EXPLORER = "Tool rounds per explorer turn"

function chatInput() {
  return screen.getByLabelText(CHAT) as HTMLInputElement
}
function explorerInput() {
  return screen.getByLabelText(EXPLORER) as HTMLInputElement
}
function saveButton() {
  return screen.getByRole("button", { name: /save/i })
}

function settingsWith(over: Record<string, unknown>) {
  return over as unknown as Awaited<ReturnType<typeof api.getSettings>>
}

beforeEach(() => {
  getSettings.mockReset()
  updateSettings.mockReset()
})

describe("loading", () => {
  it("fetches once and shows the stored caps", async () => {
    getSettings.mockResolvedValue(settingsWith({ chat_max_tool_rounds: 12, explorer_max_tool_rounds: 6 }))
    render(<AgentRoundLimits />)
    await waitFor(() => expect(chatInput().value).toBe("12"))
    expect(explorerInput().value).toBe("6")
    expect(getSettings).toHaveBeenCalledTimes(1)
  })

  it("shows 15 / 8 when an older backend omits the fields", async () => {
    getSettings.mockResolvedValue(settingsWith({}))
    render(<AgentRoundLimits />)
    await waitFor(() => expect(getSettings).toHaveBeenCalledTimes(1))
    expect(chatInput().value).toBe("15")
    expect(explorerInput().value).toBe("8")
  })

  // 292.1-REVIEW WR-05: a failed read used to leave 15 / 8 on screen AS IF loaded. With the server
  // holding 3, the operator saw 15, typing 15 was "not dirty", and the cap silently stayed at 3.
  it("says it could not load, never presents 15 / 8 as live, and cannot save when the fetch fails", async () => {
    getSettings.mockRejectedValue(new Error("Failed to get settings"))
    render(<AgentRoundLimits />)
    const alert = await screen.findByRole("alert")
    expect(alert).toHaveTextContent("Couldn't load the current tool-round limits")
    expect(alert).toHaveTextContent("Failed to get settings")
    expect(chatInput().value).toBe("")
    expect(explorerInput().value).toBe("")
    expect(chatInput()).toBeDisabled()
    expect(explorerInput()).toBeDisabled()
    expect(saveButton()).toBeDisabled()
  })

  it("Retry loads the real caps after a failed read", async () => {
    getSettings.mockRejectedValueOnce(new Error("Failed to get settings"))
    getSettings.mockResolvedValueOnce(settingsWith({ chat_max_tool_rounds: 3, explorer_max_tool_rounds: 6 }))
    render(<AgentRoundLimits />)
    fireEvent.click(await screen.findByRole("button", { name: /retry/i }))
    await waitFor(() => expect(chatInput().value).toBe("3"))
    expect(explorerInput().value).toBe("6")
    expect(chatInput()).not.toBeDisabled()
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
    expect(getSettings).toHaveBeenCalledTimes(2)
  })

  it("nothing can be saved before the read answers", async () => {
    getSettings.mockReturnValue(new Promise(() => {}))
    render(<AgentRoundLimits />)
    await waitFor(() => expect(getSettings).toHaveBeenCalledTimes(1))
    expect(chatInput()).toBeDisabled()
    expect(saveButton()).toBeDisabled()
    expect(chatInput().value).toBe("")
  })

  it("states each cap's meaning and default in words", async () => {
    getSettings.mockResolvedValue(settingsWith({ chat_max_tool_rounds: 15, explorer_max_tool_rounds: 8 }))
    render(<AgentRoundLimits />)
    await waitFor(() => expect(getSettings).toHaveBeenCalled())
    expect(
      screen.getByText("When a turn reaches this many tool rounds it stops with a Continue button. Default 15."),
    ).toBeInTheDocument()
    expect(screen.getByText("Default 8.")).toBeInTheDocument()
  })
})

describe("saving", () => {
  beforeEach(() => {
    getSettings.mockResolvedValue(settingsWith({ chat_max_tool_rounds: 15, explorer_max_tool_rounds: 8 }))
  })

  it("sends only the changed field and then says Saved", async () => {
    updateSettings.mockResolvedValue(settingsWith({ chat_max_tool_rounds: 4, explorer_max_tool_rounds: 8 }))
    render(<AgentRoundLimits />)
    await waitFor(() => expect(chatInput().value).toBe("15"))

    fireEvent.change(chatInput(), { target: { value: "4" } })
    fireEvent.click(saveButton())

    await waitFor(() => expect(updateSettings).toHaveBeenCalledTimes(1))
    expect(updateSettings).toHaveBeenCalledWith({ chat_max_tool_rounds: 4 })
    expect(await screen.findByText(/✓ Saved/)).toBeInTheDocument()
  })

  it("never sends 0 for a cleared field", async () => {
    render(<AgentRoundLimits />)
    await waitFor(() => expect(chatInput().value).toBe("15"))

    fireEvent.change(chatInput(), { target: { value: "" } })
    fireEvent.click(saveButton())

    // Nothing else changed, so nothing is sent at all — and certainly never a 0.
    expect(updateSettings).not.toHaveBeenCalled()
    for (const call of updateSettings.mock.calls) {
      expect(call[0]).not.toHaveProperty("chat_max_tool_rounds", 0)
    }
  })

  it("a cleared field is left out while another changed field is still sent", async () => {
    updateSettings.mockResolvedValue(settingsWith({ chat_max_tool_rounds: 15, explorer_max_tool_rounds: 3 }))
    render(<AgentRoundLimits />)
    await waitFor(() => expect(chatInput().value).toBe("15"))

    fireEvent.change(chatInput(), { target: { value: "" } })
    fireEvent.change(explorerInput(), { target: { value: "3" } })
    fireEvent.click(saveButton())

    await waitFor(() => expect(updateSettings).toHaveBeenCalledTimes(1))
    expect(updateSettings).toHaveBeenCalledWith({ explorer_max_tool_rounds: 3 })
  })

  it("clamps 99 to 50 and 1 to 2 before sending", async () => {
    updateSettings.mockResolvedValue(settingsWith({ chat_max_tool_rounds: 50, explorer_max_tool_rounds: 2 }))
    render(<AgentRoundLimits />)
    await waitFor(() => expect(chatInput().value).toBe("15"))

    fireEvent.change(chatInput(), { target: { value: "99" } })
    fireEvent.change(explorerInput(), { target: { value: "1" } })
    fireEvent.click(saveButton())

    await waitFor(() => expect(updateSettings).toHaveBeenCalledTimes(1))
    expect(updateSettings).toHaveBeenCalledWith({ chat_max_tool_rounds: 50, explorer_max_tool_rounds: 2 })
  })

  it("renders the server's refusal verbatim and never says Saved", async () => {
    const refusal =
      "Tool rounds per chat turn must be between 2 and 50. At 1 no tool could ever run; above 50 a single turn can run for a very long time."
    updateSettings.mockRejectedValue(new Error(refusal))
    render(<AgentRoundLimits />)
    await waitFor(() => expect(chatInput().value).toBe("15"))

    fireEvent.change(chatInput(), { target: { value: "20" } })
    fireEvent.click(saveButton())

    expect(await screen.findByText(refusal)).toBeInTheDocument()
    expect(screen.queryByText(/✓ Saved/)).not.toBeInTheDocument()
  })

  it("the inputs carry the 2..50 bounds the server enforces", async () => {
    render(<AgentRoundLimits />)
    await waitFor(() => expect(getSettings).toHaveBeenCalled())
    for (const input of [chatInput(), explorerInput()]) {
      expect(input.min).toBe("2")
      expect(input.max).toBe("50")
    }
  })
})
