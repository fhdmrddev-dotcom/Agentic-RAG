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
    // 305-03 (D-54): the reads limit now also governs AI tool list/read calls, so it says so.
    expect(screen.getByText(COPY.readsHint).textContent).toBe(
      "Default 120. Workflow status reads, and AI tool list and read calls.",
    )
    // 306-02 (UI-SPEC §Surface 2): reworded, since the card now also holds org- and
    // provider-wide limits that are not "every key".
    expect(screen.getByText(COPY.footer).textContent).toBe("Applies once you click Save Integrations.")
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

describe("ApiKeyLimits — the AI tool searches limit (305-03, D-54)", () => {
  const searches = () => screen.getByLabelText("Searches per minute, per key") as HTMLInputElement

  beforeEach(() => {
    getSettings.mockResolvedValue(
      settingsWith({ api_key_starts_per_minute: 10, api_key_reads_per_minute: 120, api_key_searches_per_minute: 30 }),
    )
  })

  it("a third field with its words, and the reads field relabelled", async () => {
    renderLeaf()
    await waitFor(() => expect(searches().value).toBe("30"))
    expect(screen.getByText("Default 30. AI tool searches only; each one runs an embedding call.")).toBeInTheDocument()
    expect(screen.getByLabelText("Reads per minute, per key")).toBeInTheDocument()
    expect(searches().min).toBe("1")
    expect(searches().max).toBe("120")
  })

  it("hands over only a changed searches limit, clamped to 1..120", async () => {
    const ref = renderLeaf()
    await waitFor(() => expect(searches().value).toBe("30"))
    expect(ref.current!.changes()).toEqual({})
    fireEvent.change(searches(), { target: { value: "45" } })
    expect(ref.current!.changes()).toEqual({ api_key_searches_per_minute: 45 })
    fireEvent.change(searches(), { target: { value: "500" } })
    expect(ref.current!.changes()).toEqual({ api_key_searches_per_minute: 120 })
    fireEvent.change(searches(), { target: { value: "0" } })
    expect(ref.current!.changes()).toEqual({ api_key_searches_per_minute: 1 })
    fireEvent.change(searches(), { target: { value: "" } })
    expect(ref.current!.changes()).toEqual({})
  })

  it("adopts the server's searches value after the save", async () => {
    const ref = renderLeaf()
    await waitFor(() => expect(searches().value).toBe("30"))
    act(() => ref.current!.adopt({ api_key_starts_per_minute: 10, api_key_reads_per_minute: 120, api_key_searches_per_minute: 12 }))
    expect(searches().value).toBe("12")
    expect(ref.current!.changes()).toEqual({})
  })

  it("an older backend without the field reads the default 30 once loaded", async () => {
    getSettings.mockResolvedValue(settingsWith({ api_key_starts_per_minute: 10, api_key_reads_per_minute: 120 }))
    renderLeaf()
    await waitFor(() => expect(searches().value).toBe("30"))
  })
})

describe("ApiKeyLimits — questions and runs from outside (306-02, D-36 / D-35)", () => {
  const L = COPY as unknown as Record<string, string>
  const askWait = () => screen.getByLabelText("Answer wait, in seconds") as HTMLInputElement
  const perKey = () => screen.getByLabelText("Running at once, per key") as HTMLInputElement
  const perOrg = () => screen.getByLabelText("Running at once, per organisation") as HTMLInputElement
  const perProvider = () => screen.getByLabelText("Running at once, per AI provider") as HTMLInputElement
  const four = () => [askWait(), perKey(), perOrg(), perProvider()]
  const STORED = {
    api_key_starts_per_minute: 10,
    api_key_reads_per_minute: 120,
    api_key_searches_per_minute: 30,
    mcp_ask_wait_seconds: 20,
    outside_inflight_per_key: 3,
    outside_inflight_per_org: 5,
    outside_inflight_per_provider: 7,
  }

  beforeEach(() => {
    getSettings.mockResolvedValue(settingsWith(STORED))
  })

  it("a second group with its words, its ids and its own label", async () => {
    renderLeaf()
    await waitFor(() => expect(askWait().value).toBe("20"))
    expect(four().map((i) => i.value)).toEqual(["20", "3", "5", "7"])
    expect(four().map((i) => i.id)).toEqual([
      "api-key-limit-ask-wait",
      "api-key-limit-inflight-key",
      "api-key-limit-inflight-org",
      "api-key-limit-inflight-provider",
    ])
    const group = screen.getByRole("group", { name: "Questions and runs from outside" })
    expect(group).toHaveAttribute("data-outside-limits")
    const heading = document.getElementById(group.getAttribute("aria-labelledby")!)!
    expect(heading.tagName).toBe("P")
    expect(heading.textContent).toBe("Questions and runs from outside")
    for (const input of four()) expect(group).toContainElement(input)
    expect(group.closest("[data-api-key-limits]")).not.toBeNull()
    expect(
      screen.getByText(
        "For questions and workflow runs that AI tools and API keys start. A start over a limit is refused and told to try again in a few seconds. In-app chats are never counted or held back.",
      ),
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        "Default 30, from 5 to 45. How long an AI tool waits for an answer before it gets a handle to fetch it later. AI tools give up on a call after about a minute.",
      ),
    ).toBeInTheDocument()
    expect(screen.getByText("Default 2. Questions and runs one key can have in progress.")).toBeInTheDocument()
    expect(screen.getByText("Default 4. Across every key in one organisation.")).toBeInTheDocument()
    expect(screen.getByText("Default 6. Across the whole deployment, for each AI provider.")).toBeInTheDocument()
    expect(L.outsideTitle).toBe("Questions and runs from outside")
    // The footer stays the card's last line, after the new group.
    const footer = screen.getByText("Applies once you click Save Integrations.")
    expect(group.compareDocumentPosition(footer) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it("the inputs carry the bounds the server enforces (5..45, 1..50)", async () => {
    renderLeaf()
    await waitFor(() => expect(askWait().value).toBe("20"))
    expect([askWait().min, askWait().max]).toEqual(["5", "45"])
    for (const i of [perKey(), perOrg(), perProvider()]) expect([i.min, i.max]).toEqual(["1", "50"])
  })

  it("while loading they are empty and locked — never a guessed 30 / 2 / 4 / 6", async () => {
    getSettings.mockReturnValue(new Promise(() => {}))
    const ref = renderLeaf()
    await waitFor(() => expect(getSettings).toHaveBeenCalledTimes(1))
    for (const i of four()) {
      expect(i.value).toBe("")
      expect(i).toBeDisabled()
    }
    expect(ref.current!.changes()).toEqual({})
  })

  it("a failed read shows the alert with Retry and no number in any of the four", async () => {
    getSettings.mockReset()
    getSettings.mockRejectedValueOnce(new Error("Failed to get settings"))
    getSettings.mockResolvedValueOnce(settingsWith(STORED))
    const ref = renderLeaf()
    await screen.findByRole("alert")
    expect(four().map((i) => i.value)).toEqual(["", "", "", ""])
    expect(ref.current!.changes()).toEqual({})
    fireEvent.click(screen.getByRole("button", { name: /retry/i }))
    await waitFor(() => expect(askWait().value).toBe("20"))
    expect(perProvider().value).toBe("7")
  })

  it("an older backend without the fields reads the defaults once loaded", async () => {
    getSettings.mockResolvedValue(settingsWith({ api_key_starts_per_minute: 10, api_key_reads_per_minute: 120 }))
    const ref = renderLeaf()
    await waitFor(() => expect(askWait().value).toBe("30"))
    expect(four().map((i) => i.value)).toEqual(["30", "2", "4", "6"])
    expect(ref.current!.changes()).toEqual({})
  })

  it("hands over only the changed field", async () => {
    const ref = renderLeaf()
    await waitFor(() => expect(askWait().value).toBe("20"))
    expect(ref.current!.changes()).toEqual({})
    fireEvent.change(perOrg(), { target: { value: "9" } })
    expect(ref.current!.changes()).toEqual({ outside_inflight_per_org: 9 })
    fireEvent.change(askWait(), { target: { value: "40" } })
    expect(ref.current!.changes()).toEqual({ outside_inflight_per_org: 9, mcp_ask_wait_seconds: 40 })
  })

  it("a cleared or non-numeric field is never sent, and blur restores the loaded value", async () => {
    const ref = renderLeaf()
    await waitFor(() => expect(askWait().value).toBe("20"))
    fireEvent.change(perKey(), { target: { value: "" } })
    fireEvent.change(perProvider(), { target: { value: "abc" } })
    expect(ref.current!.changes()).toEqual({})
    fireEvent.blur(perKey())
    expect(perKey().value).toBe("3")
  })

  it("clamps 5..45 and 1..50, on hand-over and on blur", async () => {
    const ref = renderLeaf()
    await waitFor(() => expect(askWait().value).toBe("20"))
    fireEvent.change(askWait(), { target: { value: "4" } })
    fireEvent.change(perKey(), { target: { value: "0" } })
    fireEvent.change(perOrg(), { target: { value: "51" } })
    fireEvent.change(perProvider(), { target: { value: "500" } })
    expect(ref.current!.changes()).toEqual({
      mcp_ask_wait_seconds: 5,
      outside_inflight_per_key: 1,
      outside_inflight_per_org: 50,
      outside_inflight_per_provider: 50,
    })
    fireEvent.change(askWait(), { target: { value: "99" } })
    expect(ref.current!.changes().mcp_ask_wait_seconds).toBe(45)
    for (const i of four()) fireEvent.blur(i)
    expect(four().map((i) => i.value)).toEqual(["45", "1", "50", "50"])
  })

  it("after the save, shows the SERVER's values as the new baseline", async () => {
    const ref = renderLeaf()
    await waitFor(() => expect(askWait().value).toBe("20"))
    fireEvent.change(perKey(), { target: { value: "8" } })
    act(() =>
      ref.current!.adopt({
        ...STORED,
        mcp_ask_wait_seconds: 25,
        outside_inflight_per_key: 6,
        outside_inflight_per_org: 11,
        outside_inflight_per_provider: 12,
      } as Parameters<ApiKeyLimitsHandle["adopt"]>[0]),
    )
    expect(four().map((i) => i.value)).toEqual(["25", "6", "11", "12"])
    expect(ref.current!.changes()).toEqual({})
  })

  // The inline snapshot was written from the BASE component (before 306-02 touched it), so a
  // change to any shipped row's DOM reds here.
  it("the shipped three rows render exactly as before", async () => {
    renderLeaf()
    await waitFor(() => expect(starts().value).toBe("10"))
    const shipped = ["api-key-limit-starts", "api-key-limit-reads", "api-key-limit-searches"].map(
      (id) => document.getElementById(id)!.closest(".py-1")!.outerHTML,
    )
    expect(shipped).toMatchInlineSnapshot(`
      [
        "<div class="py-1"><div class="flex items-center justify-between gap-4"><label class="font-medium peer-disabled:cursor-not-allowed peer-disabled:opacity-70 w-56 shrink-0 text-sm text-muted-foreground" for="api-key-limit-starts">Starts per minute, per key</label><div class="max-w-xs flex-1"><input class="flex rounded-md border border-input px-3 py-2 ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm h-8 w-24 bg-muted/30 font-mono text-sm ghost-border" id="api-key-limit-starts" inputmode="numeric" min="1" max="60" type="number" value="10"></div></div><p class="mt-1 text-xs text-muted-foreground">Default 10.</p></div>",
        "<div class="py-1"><div class="flex items-center justify-between gap-4"><label class="font-medium peer-disabled:cursor-not-allowed peer-disabled:opacity-70 w-56 shrink-0 text-sm text-muted-foreground" for="api-key-limit-reads">Reads per minute, per key</label><div class="max-w-xs flex-1"><input class="flex rounded-md border border-input px-3 py-2 ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm h-8 w-24 bg-muted/30 font-mono text-sm ghost-border" id="api-key-limit-reads" inputmode="numeric" min="10" max="600" type="number" value="120"></div></div><p class="mt-1 text-xs text-muted-foreground">Default 120. Workflow status reads, and AI tool list and read calls.</p></div>",
        "<div class="py-1"><div class="flex items-center justify-between gap-4"><label class="font-medium peer-disabled:cursor-not-allowed peer-disabled:opacity-70 w-56 shrink-0 text-sm text-muted-foreground" for="api-key-limit-searches">Searches per minute, per key</label><div class="max-w-xs flex-1"><input class="flex rounded-md border border-input px-3 py-2 ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm h-8 w-24 bg-muted/30 font-mono text-sm ghost-border" id="api-key-limit-searches" inputmode="numeric" min="1" max="120" type="number" value="30"></div></div><p class="mt-1 text-xs text-muted-foreground">Default 30. AI tool searches only; each one runs an embedding call.</p></div>",
      ]
    `)
  })
})

describe("SettingsPage wiring (293-03, G-5: one ref, one spread, one adopt)", () => {
  it("mounts the card once in Integrations and rides Save Integrations", () => {
    const src = settingsPageRaw.replace(/\r\n/g, "\n")
    // `<ApiKeyLimits ` with the space: `useRef<ApiKeyLimitsHandle>` also starts with the bare name.
    expect(src.split("<ApiKeyLimits ").length - 1).toBe(1)
    expect(src).toContain("useRef<ApiKeyLimitsHandle>(null)")
    expect(src).toContain("...apiKeyLimitsRef.current?.changes()")
    expect(src).toContain("apiKeyLimitsRef.current?.adopt(")
    expect(src.split("useState(").length - 1).toBe(49)
    const card = src.indexOf("<ApiKeyLimits ")
    expect(card).toBeGreaterThan(src.indexOf("<SourceFileCeilingCard"))
    expect(card).toBeLessThan(src.indexOf("Save Integrations", card))
  })
})
