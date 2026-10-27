/**
 * Phase 294-05 Task 1 (D-13, D-16, D-17, D-20a) — the References-header action, sketch 294 A.
 *
 * States: nothing until availability is known · "Check citations · <engine>" · "Checking N
 * citations…" · per-verdict count pills + Re-check + "checked by …" · the ⓘ reason line. A failed
 * POST shows one fixed line and never hides a stored result.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"

const api = vi.hoisted(() => ({ getCitationChecks: vi.fn(), runCitationCheck: vi.fn() }))
vi.mock("@/lib/api/citationChecks", () => api)

import { CitationCheckAction } from "../CitationCheckAction"
import { useCitationCheckStore } from "@/stores/citationCheckStore"
import type { CitationCheckResult, CitationCheckAvailability } from "@/lib/api/citationChecks"

const RESULT: CitationCheckResult = {
  version: 1,
  engine: "jev",
  model: "typesafe/jev-1.14",
  checked_at: new Date(Date.now() - 2 * 60_000).toISOString(),
  claims: [
    { ordinal: 0, n: 1, sentence: "a", verdict: "supported", confidence: 0.93 },
    { ordinal: 1, n: 2, sentence: "b", verdict: "contradicted", confidence: 0.87 },
    { ordinal: 2, n: 3, sentence: "c", verdict: "couldnt_check", confidence: null },
  ],
  counts: { supported: 1, partly_supported: 0, not_supported: 0, contradicted: 1, couldnt_check: 1 },
  usage: { input_tokens: 10, cost_usd: 0.00001 },
}

function serve(availability: CitationCheckAvailability, checks: Record<string, CitationCheckResult> = {}) {
  api.getCitationChecks.mockResolvedValue({ availability, checks })
}

beforeAll(async () => {
  // the store loads its client lazily; pre-warm the (mocked) module so timing is not the test
  await import("@/lib/api/citationChecks")
})

afterEach(() => {
  cleanup()
  api.getCitationChecks.mockReset()
  api.runCitationCheck.mockReset()
})

describe("CitationCheckAction", () => {
  it("renders nothing until availability is known, and asks once on mount", async () => {
    api.getCitationChecks.mockReturnValue(new Promise(() => {}))
    const { container } = render(<CitationCheckAction messageId="m1" citationCount={3} />)
    await act(async () => {
      for (let i = 0; i < 5; i++) await new Promise((r) => setTimeout(r, 0))
    })
    expect(container.innerHTML).toBe("")
    expect(api.getCitationChecks).toHaveBeenCalledTimes(1)
    expect(api.getCitationChecks.mock.calls[0][0]).toEqual(["m1"])
  })

  // 296-04 (294-IN-08) REWRITTEN IN PLACE: the count is the answer's SOURCES (citations.length),
  // so the word is "sources". It read `/Checking 3 citations…/`.
  it("available → 'Check citations · Jev'; click → 'Checking 3 sources…' disabled; never runs by itself", async () => {
    serve({ available: true, engine: "jev", reason: null })
    let resolve: (r: CitationCheckResult) => void = () => {}
    api.runCitationCheck.mockReturnValue(new Promise<CitationCheckResult>((r) => (resolve = r)))
    render(<CitationCheckAction messageId="m1" citationCount={3} />)
    const btn = await screen.findByRole("button", { name: "Check citations · Jev" })
    expect(api.runCitationCheck).not.toHaveBeenCalled()
    fireEvent.click(btn)
    const busy = await screen.findByRole("button", { name: /Checking 3 sources…/ })
    expect(busy).toBeDisabled()
    expect(api.runCitationCheck).toHaveBeenCalledWith("m1")
    await act(async () => resolve(RESULT))
    expect(await screen.findByRole("button", { name: "Re-check" })).toBeInTheDocument()
  })

  it("OpenAI Decisions is named by its short name", async () => {
    serve({ available: true, engine: "openai_decisions", reason: null })
    render(<CitationCheckAction messageId="m1" citationCount={1} />)
    expect(await screen.findByRole("button", { name: "Check citations · OpenAI Decisions" })).toBeInTheDocument()
  })

  it("a stored result → one pill per non-zero count, Re-check, and the checked-by line", async () => {
    serve({ available: true, engine: "jev", reason: null }, { m1: RESULT })
    render(<CitationCheckAction messageId="m1" citationCount={3} />)
    await screen.findByRole("button", { name: "Re-check" })
    const pills = screen.getAllByTestId("citation-verdict-pill").map((p) => p.textContent)
    expect(pills).toEqual(["✓ 1 supported", "✕ 1 contradicted", "? 1 couldn't check"])
    expect(screen.getByText(/checked by Jev · saved with this answer · 2 min ago/)).toBeInTheDocument()
    // glyphs are decorative; the word carries the meaning
    for (const g of screen.getAllByTestId("citation-verdict-pill")) {
      expect(g.querySelector('[aria-hidden="true"]')).not.toBeNull()
    }
  })

  it("Re-check runs the POST again", async () => {
    serve({ available: true, engine: "jev", reason: null }, { m1: RESULT })
    api.runCitationCheck.mockResolvedValue(RESULT)
    render(<CitationCheckAction messageId="m1" citationCount={3} />)
    fireEvent.click(await screen.findByRole("button", { name: "Re-check" }))
    await waitFor(() => expect(api.runCitationCheck).toHaveBeenCalledWith("m1"))
  })

  it.each([
    [{ available: false, engine: null, reason: "off" }, "Citation check is off while reranking is off."],
    [
      { available: false, engine: null, reason: "engine_reorders_only" },
      "Citation check needs Jev or OpenAI Decisions (Settings → Reranking).",
    ],
    [
      { available: false, engine: "jev", reason: "key_missing" },
      "Citation check can't run: no saved OpenRouter key (Settings → Reranking).",
    ],
  ] as [CitationCheckAvailability, string][])("unavailable %j → the ⓘ line, no button", async (a, line) => {
    serve(a)
    render(<CitationCheckAction messageId="m1" citationCount={3} />)
    expect(await screen.findByText(line)).toBeInTheDocument()
    expect(screen.queryByRole("button")).toBeNull()
  })

  it("D-16 — stored verdicts still render when the engine is now unavailable (ⓘ instead of Re-check)", async () => {
    serve({ available: false, engine: null, reason: "engine_reorders_only" }, { m1: RESULT })
    render(<CitationCheckAction messageId="m1" citationCount={3} />)
    expect(
      await screen.findByText("Citation check needs Jev or OpenAI Decisions (Settings → Reranking)."),
    ).toBeInTheDocument()
    expect(screen.getAllByTestId("citation-verdict-pill")).toHaveLength(3)
    expect(screen.queryByRole("button", { name: "Re-check" })).toBeNull()
  })

  it("a 409 shows one line and keeps the stored pills", async () => {
    serve({ available: true, engine: "jev", reason: null }, { m1: RESULT })
    api.runCitationCheck.mockRejectedValue(Object.assign(new Error("409"), { status: 409, reason: "in_flight" }))
    render(<CitationCheckAction messageId="m1" citationCount={3} />)
    fireEvent.click(await screen.findByRole("button", { name: "Re-check" }))
    expect(await screen.findByText("A check is already running for this answer.")).toBeInTheDocument()
    expect(screen.getAllByTestId("citation-verdict-pill")).toHaveLength(3)
  })

  it("294-REVIEW CR-01 — a 503 engine_failed Re-check shows the fixed line and keeps the saved verdicts", async () => {
    serve({ available: true, engine: "jev", reason: null }, { m1: RESULT })
    api.runCitationCheck.mockRejectedValue(
      Object.assign(new Error("503"), { status: 503, reason: "engine_failed" }),
    )
    render(<CitationCheckAction messageId="m1" citationCount={3} />)
    fireEvent.click(await screen.findByRole("button", { name: "Re-check" }))
    expect(
      await screen.findByText("The engine didn't answer, so nothing was saved. Try again in a moment."),
    ).toBeInTheDocument()
    const pills = screen.getAllByTestId("citation-verdict-pill").map((p) => p.textContent)
    expect(pills).toEqual(["✓ 1 supported", "✕ 1 contradicted", "? 1 couldn't check"])
    expect(screen.getByText(/checked by Jev · saved with this answer/)).toBeInTheDocument()
    expect(screen.queryByText("The check didn't finish. Try again.")).toBeNull()
  })
})

describe("CitationCheckAction — 296-04 (294-IN-06 / 294-IN-08 / SEED-365)", () => {
  it("one source reads 'Checking 1 source…' (singular)", async () => {
    serve({ available: true, engine: "jev", reason: null })
    api.runCitationCheck.mockReturnValue(new Promise(() => {}))
    render(<CitationCheckAction messageId="m1" citationCount={1} />)
    fireEvent.click(await screen.findByRole("button", { name: "Check citations · Jev" }))
    expect(await screen.findByRole("button", { name: /Checking 1 source…/ })).toBeDisabled()
  })

  it("a 429 rate_limited reads the rate sentence in the message's error slot", async () => {
    serve({ available: true, engine: "jev", reason: null })
    api.runCitationCheck.mockRejectedValue(Object.assign(new Error("429"), { status: 429, reason: "rate_limited" }))
    render(<CitationCheckAction messageId="m1" citationCount={3} />)
    fireEvent.click(await screen.findByRole("button", { name: "Check citations · Jev" }))
    expect(
      await screen.findByText("You've run a lot of checks just now. Try again in a minute."),
    ).toBeInTheDocument()
  })

  it("a 429 with no readable reason still reads the rate sentence (status alone)", async () => {
    serve({ available: true, engine: "jev", reason: null })
    api.runCitationCheck.mockRejectedValue(Object.assign(new Error("429"), { status: 429, reason: null }))
    render(<CitationCheckAction messageId="m1" citationCount={3} />)
    fireEvent.click(await screen.findByRole("button", { name: "Check citations · Jev" }))
    expect(
      await screen.findByText("You've run a lot of checks just now. Try again in a minute."),
    ).toBeInTheDocument()
  })

  it.each([
    ["off", "Citation check is off while reranking is off."],
    ["key_missing", "Citation check can't run: no saved OpenRouter key (Settings → Reranking)."],
    ["engine_reorders_only", "Citation check needs Jev or OpenAI Decisions (Settings → Reranking)."],
  ])("a 409 %s updates the shared availability, so every message shows the reason line", async (reason, line) => {
    serve({ available: true, engine: "jev", reason: null })
    api.runCitationCheck.mockRejectedValue(Object.assign(new Error("409"), { status: 409, reason }))
    render(
      <>
        <CitationCheckAction messageId="m1" citationCount={3} />
        <CitationCheckAction messageId="m2" citationCount={2} />
      </>,
    )
    const buttons = await screen.findAllByRole("button", { name: "Check citations · Jev" })
    expect(buttons).toHaveLength(2)
    fireEvent.click(buttons[0])
    await waitFor(() => expect(screen.getAllByText(line).length).toBeGreaterThanOrEqual(2))
    expect(screen.queryByRole("button", { name: "Check citations · Jev" })).toBeNull()
  })

  // 296 review FE-WR-03: the asking message showed the reason TWICE — once as the shared ⓘ line
  // and once as its own red error line (`checkErrorLine` maps the same codes to the same words).
  it.each([
    ["off", "Citation check is off while reranking is off."],
    ["key_missing", "Citation check can't run: no saved OpenRouter key (Settings → Reranking)."],
    ["engine_reorders_only", "Citation check needs Jev or OpenAI Decisions (Settings → Reranking)."],
  ])("a 409 %s shows the reason ONCE per message, the asking one included", async (reason, line) => {
    serve({ available: true, engine: "jev", reason: null })
    api.runCitationCheck.mockRejectedValue(Object.assign(new Error("409"), { status: 409, reason }))
    render(
      <>
        <CitationCheckAction messageId="m1" citationCount={3} />
        <CitationCheckAction messageId="m2" citationCount={2} />
      </>,
    )
    const buttons = await screen.findAllByRole("button", { name: "Check citations · Jev" })
    fireEvent.click(buttons[0])
    await waitFor(() => expect(screen.queryByRole("button", { name: "Check citations · Jev" })).toBeNull())
    await act(async () => {
      for (let i = 0; i < 5; i++) await new Promise((r) => setTimeout(r, 0))
    })
    expect(screen.getAllByText(line)).toHaveLength(2)
    expect(useCitationCheckStore.getState().errors.m1).toBeUndefined()
  })

  it("a failed availability read is retried once", async () => {
    api.getCitationChecks
      .mockRejectedValueOnce(new Error("503"))
      .mockResolvedValueOnce({ availability: { available: true, engine: "jev", reason: null }, checks: {} })
    render(<CitationCheckAction messageId="m1" citationCount={3} />)
    expect(await screen.findByRole("button", { name: "Check citations · Jev" })).toBeInTheDocument()
    expect(api.getCitationChecks).toHaveBeenCalledTimes(2)
  })

  it("a second failure gives up (one retry, never a loop)", async () => {
    api.getCitationChecks.mockRejectedValue(new Error("503"))
    const { container } = render(<CitationCheckAction messageId="m1" citationCount={3} />)
    await act(async () => {
      for (let i = 0; i < 10; i++) await new Promise((r) => setTimeout(r, 0))
    })
    expect(api.getCitationChecks).toHaveBeenCalledTimes(2)
    expect(container.innerHTML).toBe("")
  })
})
