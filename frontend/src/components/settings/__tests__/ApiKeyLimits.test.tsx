/**
 * Phase 293-03 (START-02 / D-14) — the operator's two per-key limits in Settings → Integrations.
 *
 * The `AgentRoundLimits` shape (292.1): the leaf owns its fetch and drafts, has NO save button,
 * and hands the tab's one Save its changed fields through `changes()` / `adopt()`. The cases drive
 * the leaf alone with `getSettings` mocked at the `@/lib/api` barrel and assert the rendered
 * CONTENT and the exact body handed over. The click-to-PUT end lives in `pages/SettingsPage.test.tsx`.
 */
import { createRef } from "react"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react"

import * as api from "@/lib/api"
import { ApiKeyLimits, type ApiKeyLimitsHandle } from "../ApiKeyLimits"
import { API_KEYS_COPY } from "../apiKeys/apiKeysCopy"
import settingsPageRaw from "@/pages/SettingsPage.tsx?raw"

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>()
  return { ...actual, getSettings: vi.fn(), updateSettings: vi.fn() }
})

const getSettings = vi.mocked(api.getSettings)
const updateSettings = vi.mocked(api.updateSettings)
const COPY = API_KEYS_COPY.limits

const starts = () => screen.getByLabelText(COPY.startsLabel) as HTMLInputElement
const reads = () => screen.getByLabelText(COPY.readsLabel) as HTMLInputElement

function settingsWith(over: Record<string, unknown>) {
  return over as unknown as Awaited<ReturnType<typeof api.getSettings>>
}

function renderLeaf() {
  const ref = createRef<ApiKeyLimitsHandle>()
  render(<ApiKeyLimits ref={ref} />)
  return ref
}

beforeEach(() => {
  getSettings.mockReset()
  updateSettings.mockReset()
})

describe("ApiKeyLimits — loading (293-03)", () => {
  it("shows the stored limits, with the card's words", async () => {
    getSettings.mockResolvedValue(
      settingsWith({ api_key_starts_per_minute: 10, api_key_reads_per_minute: 120 }),
    )
    renderLeaf()
    await waitFor(() => expect(starts().value).toBe("10"))
    expect(reads().value).toBe("120")
    expect(screen.getByText(COPY.title)).toBeInTheDocument()
    expect(screen.getByText(COPY.title).textContent).toBe("API keys")
    expect(screen.getByText(COPY.startsHint).textContent).toBe("Default 10.")
    expect(screen.getByText(COPY.readsHint).textContent).toBe("Default 120.")
    expect(screen.getByText(COPY.footer).textContent).toBe(
      "Applies to every key once you click Save Integrations.",
    )
    expect(getSettings).toHaveBeenCalledTimes(1)
  })

  it("while loading the inputs are empty and locked, and nothing can be handed over", async () => {
    getSettings.mockReturnValue(new Promise(() => {}))
    const ref = renderLeaf()
    await waitFor(() => expect(getSettings).toHaveBeenCalledTimes(1))
    expect(starts().value).toBe("")
    expect(starts()).toBeDisabled()
    expect(reads()).toBeDisabled()
    expect(ref.current!.changes()).toEqual({})
  })

  it("a failed read says so with Retry, never shows a default as live", async () => {
    getSettings.mockRejectedValueOnce(new Error("Failed to get settings"))
    getSettings.mockResolvedValueOnce(
      settingsWith({ api_key_starts_per_minute: 4, api_key_reads_per_minute: 60 }),
    )
    const ref = renderLeaf()
    const alert = await screen.findByRole("alert")
    expect(alert).toHaveTextContent(COPY.loadFailed)
    expect(alert).toHaveTextContent("Failed to get settings")
    expect(starts().value).toBe("")
    expect(reads().value).toBe("")
    expect(ref.current!.changes()).toEqual({})
    fireEvent.click(screen.getByRole("button", { name: /retry/i }))
    await waitFor(() => expect(starts().value).toBe("4"))
    expect(reads().value).toBe("60")
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  })
})

describe("ApiKeyLimits — through the tab's one save (293-03)", () => {
  beforeEach(() => {
    getSettings.mockResolvedValue(
      settingsWith({ api_key_starts_per_minute: 10, api_key_reads_per_minute: 120 }),
    )
  })

  it("has no save button of its own and never PUTs", async () => {
    renderLeaf()
    await waitFor(() => expect(starts().value).toBe("10"))
    fireEvent.change(starts(), { target: { value: "5" } })
    fireEvent.blur(starts())
    expect(screen.queryByRole("button", { name: /save/i })).not.toBeInTheDocument()
    expect(updateSettings).not.toHaveBeenCalled()
  })

  it("hands over only the changed field", async () => {
    const ref = renderLeaf()
    await waitFor(() => expect(starts().value).toBe("10"))
    expect(ref.current!.changes()).toEqual({})
    fireEvent.change(reads(), { target: { value: "200" } })
    expect(ref.current!.changes()).toEqual({ api_key_reads_per_minute: 200 })
  })

  it("clamps 1..60 and 10..600, on hand-over and on blur", async () => {
    const ref = renderLeaf()
    await waitFor(() => expect(starts().value).toBe("10"))
    fireEvent.change(starts(), { target: { value: "99" } })
    fireEvent.change(reads(), { target: { value: "3" } })
    expect(ref.current!.changes()).toEqual({
      api_key_starts_per_minute: 60,
      api_key_reads_per_minute: 10,
    })
    fireEvent.blur(starts())
    fireEvent.blur(reads())
    expect(starts().value).toBe("60")
    expect(reads().value).toBe("10")
    fireEvent.change(starts(), { target: { value: "0" } })
    expect(ref.current!.changes().api_key_starts_per_minute).toBe(1)
    fireEvent.change(reads(), { target: { value: "9999" } })
    expect(ref.current!.changes().api_key_reads_per_minute).toBe(600)
  })

  it("a cleared field is never sent", async () => {
    const ref = renderLeaf()
    await waitFor(() => expect(starts().value).toBe("10"))
    fireEvent.change(starts(), { target: { value: "" } })
    expect(ref.current!.changes()).toEqual({})
    fireEvent.blur(starts())
    expect(starts().value).toBe("10")
  })

  it("after the save, shows the SERVER's values as the new baseline", async () => {
    const ref = renderLeaf()
    await waitFor(() => expect(starts().value).toBe("10"))
    fireEvent.change(starts(), { target: { value: "20" } })
    act(() => ref.current!.adopt({ api_key_starts_per_minute: 19, api_key_reads_per_minute: 90 }))
    expect(starts().value).toBe("19")
    expect(reads().value).toBe("90")
    expect(ref.current!.changes()).toEqual({})
  })

  it("the inputs carry the bounds the server enforces", async () => {
    renderLeaf()
    await waitFor(() => expect(starts().value).toBe("10"))
    expect(starts().min).toBe("1")
    expect(starts().max).toBe("60")
    expect(reads().min).toBe("10")
    expect(reads().max).toBe("600")
  })
})

describe("SettingsPage wiring (293-03, G-5: one ref, one spread, one adopt)", () => {
  it("mounts the card once in Integrations and rides Save Integrations", () => {
    const src = settingsPageRaw.replace(/\r\n/g, "\n")
    expect(src.split("<ApiKeyLimits").length - 1).toBe(1)
    expect(src).toContain("useRef<ApiKeyLimitsHandle>(null)")
    expect(src).toContain("...apiKeyLimitsRef.current?.changes()")
    expect(src).toContain("apiKeyLimitsRef.current?.adopt(")
    expect(src.split("useState(").length - 1).toBe(49)
    const card = src.indexOf("<ApiKeyLimits")
    expect(card).toBeGreaterThan(src.indexOf("<SourceFileCeilingCard"))
    expect(card).toBeLessThan(src.indexOf("Save Integrations", card))
  })
})
