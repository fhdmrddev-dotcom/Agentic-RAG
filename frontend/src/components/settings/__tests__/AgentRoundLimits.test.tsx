/**
 * Phase 292.1 (BUG-261024-03, D-17 / D-18) — the two tool-round caps in Settings → AI model.
 *
 * The leaf owns its own fetch and drafts (SettingsPage is G-5 FIRING with its state split owed), so
 * these cases drive the leaf alone with `getSettings` mocked at the `@/lib/api` barrel. They assert
 * rendered CONTENT and the exact body the leaf hands the page, never mere presence.
 *
 * ⚠ RESHAPED (292.1 UAT, operator 2026-10-24: "I set the limit of the rounds to 2 and hit save, but
 * it is not saving"). The leaf used to carry its own "Save tool rounds" button and PUT; the operator
 * pressed the section's "Save AI Model" instead, whose body never carried the caps. There is now ONE
 * save per section: the leaf has no button and no PUT, and exposes `changes()` / `adopt()` through a
 * ref that the page's save merges into its single PUT. So the "saving" cases below drive that handle
 * rather than a button, and the click-to-PUT end of the contract (the body, "Saved!", the verbatim
 * refusal in the section banner) is asserted where the button lives — `pages/SettingsPage.test.tsx`
 * → "the tool-round limits ride Save AI Model (292.1 UAT)".
 */
import { createRef } from "react"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react"

import * as api from "@/lib/api"
import { AgentRoundLimits, type AgentRoundLimitsHandle } from "../AgentRoundLimits"

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

function settingsWith(over: Record<string, unknown>) {
  return over as unknown as Awaited<ReturnType<typeof api.getSettings>>
}

/** Render the leaf with the ref the page holds. */
function renderLeaf() {
  const ref = createRef<AgentRoundLimitsHandle>()
  render(<AgentRoundLimits ref={ref} />)
  return ref
}

beforeEach(() => {
  getSettings.mockReset()
  updateSettings.mockReset()
})

describe("loading", () => {
  it("fetches once and shows the stored caps", async () => {
    getSettings.mockResolvedValue(settingsWith({ chat_max_tool_rounds: 12, explorer_max_tool_rounds: 6 }))
    renderLeaf()
    await waitFor(() => expect(chatInput().value).toBe("12"))
    expect(explorerInput().value).toBe("6")
    expect(getSettings).toHaveBeenCalledTimes(1)
  })

  it("shows 15 / 8 when an older backend omits the fields", async () => {
    getSettings.mockResolvedValue(settingsWith({}))
    renderLeaf()
    await waitFor(() => expect(getSettings).toHaveBeenCalledTimes(1))
    expect(chatInput().value).toBe("15")
    expect(explorerInput().value).toBe("8")
  })

  // 292.1-REVIEW WR-05: a failed read used to leave 15 / 8 on screen AS IF loaded. With the server
  // holding 3, the operator saw 15, typing 15 was "not dirty", and the cap silently stayed at 3.
  // (Reshaped for one-save: "cannot save" is now "hands the page nothing to save".)
  it("says it could not load, never presents 15 / 8 as live, and hands the page nothing to save", async () => {
    getSettings.mockRejectedValue(new Error("Failed to get settings"))
    const ref = renderLeaf()
    const alert = await screen.findByRole("alert")
    expect(alert).toHaveTextContent("Couldn't load the current tool-round limits")
    expect(alert).toHaveTextContent("Failed to get settings")
    expect(chatInput().value).toBe("")
    expect(explorerInput().value).toBe("")
    expect(chatInput()).toBeDisabled()
    expect(explorerInput()).toBeDisabled()
    expect(ref.current!.changes()).toEqual({})
  })

  it("Retry loads the real caps after a failed read", async () => {
    getSettings.mockRejectedValueOnce(new Error("Failed to get settings"))
    getSettings.mockResolvedValueOnce(settingsWith({ chat_max_tool_rounds: 3, explorer_max_tool_rounds: 6 }))
    renderLeaf()
    fireEvent.click(await screen.findByRole("button", { name: /retry/i }))
    await waitFor(() => expect(chatInput().value).toBe("3"))
    expect(explorerInput().value).toBe("6")
    expect(chatInput()).not.toBeDisabled()
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
    expect(getSettings).toHaveBeenCalledTimes(2)
  })

  it("nothing can be saved before the read answers", async () => {
    getSettings.mockReturnValue(new Promise(() => {}))
    const ref = renderLeaf()
    await waitFor(() => expect(getSettings).toHaveBeenCalledTimes(1))
    expect(chatInput()).toBeDisabled()
    expect(chatInput().value).toBe("")
    expect(ref.current!.changes()).toEqual({})
  })

  it("states each cap's meaning and default in words", async () => {
    getSettings.mockResolvedValue(settingsWith({ chat_max_tool_rounds: 15, explorer_max_tool_rounds: 8 }))
    renderLeaf()
    await waitFor(() => expect(getSettings).toHaveBeenCalled())
    expect(
      screen.getByText("When a turn reaches this many tool rounds it stops with a Continue button. Default 15."),
    ).toBeInTheDocument()
    expect(screen.getByText("Default 8.")).toBeInTheDocument()
  })
})

describe("saving — through the section's one save", () => {
  beforeEach(() => {
    getSettings.mockResolvedValue(settingsWith({ chat_max_tool_rounds: 15, explorer_max_tool_rounds: 8 }))
  })

  it("has no save button of its own, and never PUTs by itself", async () => {
    renderLeaf()
    await waitFor(() => expect(chatInput().value).toBe("15"))
    fireEvent.change(chatInput(), { target: { value: "4" } })
    fireEvent.blur(chatInput())
    expect(screen.queryByRole("button", { name: /save/i })).not.toBeInTheDocument()
    expect(screen.getByText("Applies to every chat once you click Save AI Model.")).toBeInTheDocument()
    expect(updateSettings).not.toHaveBeenCalled()
  })

  it("hands over only the changed field", async () => {
    const ref = renderLeaf()
    await waitFor(() => expect(chatInput().value).toBe("15"))
    expect(ref.current!.changes()).toEqual({})

    fireEvent.change(chatInput(), { target: { value: "4" } })
    expect(ref.current!.changes()).toEqual({ chat_max_tool_rounds: 4 })
  })

  it("never hands over 0 for a cleared field", async () => {
    const ref = renderLeaf()
    await waitFor(() => expect(chatInput().value).toBe("15"))

    fireEvent.change(chatInput(), { target: { value: "" } })
    // Nothing else changed, so nothing is handed over at all — and certainly never a 0.
    expect(ref.current!.changes()).toEqual({})
  })

  it("a cleared field is left out while another changed field is still handed over", async () => {
    const ref = renderLeaf()
    await waitFor(() => expect(chatInput().value).toBe("15"))

    fireEvent.change(chatInput(), { target: { value: "" } })
    fireEvent.change(explorerInput(), { target: { value: "3" } })
    expect(ref.current!.changes()).toEqual({ explorer_max_tool_rounds: 3 })
  })

  it("clamps 99 to 50 and 1 to 2 before handing over", async () => {
    const ref = renderLeaf()
    await waitFor(() => expect(chatInput().value).toBe("15"))

    fireEvent.change(chatInput(), { target: { value: "99" } })
    fireEvent.change(explorerInput(), { target: { value: "1" } })
    expect(ref.current!.changes()).toEqual({ chat_max_tool_rounds: 50, explorer_max_tool_rounds: 2 })
  })

  it("after the save, shows the SERVER's values and treats them as the new baseline", async () => {
    const ref = renderLeaf()
    await waitFor(() => expect(chatInput().value).toBe("15"))

    fireEvent.change(chatInput(), { target: { value: "20" } })
    act(() => ref.current!.adopt({ chat_max_tool_rounds: 19, explorer_max_tool_rounds: 7 }))

    expect(chatInput().value).toBe("19")
    expect(explorerInput().value).toBe("7")
    expect(ref.current!.changes()).toEqual({})
  })

  it("a save response is not adopted while the read never answered (WR-05)", async () => {
    getSettings.mockReset()
    getSettings.mockRejectedValue(new Error("Failed to get settings"))
    const ref = renderLeaf()
    await screen.findByRole("alert")

    act(() => ref.current!.adopt({ chat_max_tool_rounds: 19, explorer_max_tool_rounds: 7 }))
    expect(chatInput().value).toBe("")
    expect(chatInput()).toBeDisabled()
  })

  it("the inputs carry the 2..50 bounds the server enforces", async () => {
    renderLeaf()
    await waitFor(() => expect(getSettings).toHaveBeenCalled())
    for (const input of [chatInput(), explorerInput()]) {
      expect(input.min).toBe("2")
      expect(input.max).toBe("50")
    }
  })
})
