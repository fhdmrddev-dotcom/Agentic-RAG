/**
 * 268-REVIEW WR-05 / D-268-28 — the summary wire field `partly_priced_harness_runs` reaches the page as
 * `partlyPricedHarnessRuns`, and an older payload without it reads 0 (never undefined / NaN).
 */
import { afterEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/api/_core", () => ({
  API_BASE: "http://api.test",
  getAuthHeaders: vi.fn().mockResolvedValue({}),
}))

import { getSpendSummary } from "@/lib/api/spend"

const WIRE = {
  total_spend_usd: "1.0000",
  rated_runs_count: 1,
  unrated_runs_count: 1,
  unmeasured_runs_count: 0,
  incomplete_coverage_count: 0,
  total_input_tokens: 10,
  total_output_tokens: 5,
  daily_spend: [],
  model_breakdown: [],
  expert_breakdown: [],
  window_total_usd: "1.0000",
  window_run_count: 2,
  unpriced_subagents: 0,
}

function serve(body: object) {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => body }))
}

afterEach(() => vi.unstubAllGlobals())

describe("getSpendSummary — partly priced harness runs (D-268-28)", () => {
  it("maps the wire count", async () => {
    serve({ ...WIRE, partly_priced_harness_runs: 2 })
    expect((await getSpendSummary()).partlyPricedHarnessRuns).toBe(2)
  })

  it("reads 0 when the field is absent", async () => {
    serve(WIRE)
    expect((await getSpendSummary()).partlyPricedHarnessRuns).toBe(0)
  })
})
