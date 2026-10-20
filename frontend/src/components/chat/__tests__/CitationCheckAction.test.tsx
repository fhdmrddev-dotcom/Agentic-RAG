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

  it("available → 'Check citations · Jev'; click → 'Checking 3 citations…' disabled; never runs by itself", async () => {
    serve({ available: true, engine: "jev", reason: null })
    let resolve: (r: CitationCheckResult) => void = () => {}
    api.runCitationCheck.mockReturnValue(new Promise<CitationCheckResult>((r) => (resolve = r)))
    render(<CitationCheckAction messageId="m1" citationCount={3} />)
    const btn = await screen.findByRole("button", { name: "Check citations · Jev" })
    expect(api.runCitationCheck).not.toHaveBeenCalled()
    fireEvent.click(btn)
    const busy = await screen.findByRole("button", { name: /Checking 3 citations…/ })
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
