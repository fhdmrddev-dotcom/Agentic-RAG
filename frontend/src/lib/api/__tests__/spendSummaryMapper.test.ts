/**
 * 268-REVIEW WR-05 / D-268-28 — the summary wire field `partly_priced_harness_runs` reaches the page as
 * `partlyPricedHarnessRuns`, and an older payload without it reads 0 (never undefined / NaN).
 */
import { afterEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/api/_core", () => ({
  API_BASE: "http://api.test",
  getAuthHeaders: vi.fn().mockResolvedValue({}),
}))

import { getSpendRuns, getSpendSummary } from "@/lib/api/spend"

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

// 305-03 (D-31 / D-55): the ledger mapper carries an MCP row's key and tool; a run row (or an
// older backend's row with no source) reads as run with null key fields.
const ROW = {
  run_id: "11111111-1111-4111-8111-111111111111",
  thread_id: null,
  model: "text-embedding-3-small",
  provider: "openai",
  status: "completed",
  started_at: "2026-10-31T10:00:00Z",
  completed_at: "2026-10-31T10:00:00Z",
  input_tokens: 12,
  output_tokens: 0,
  cost_usd: null,
  is_rated: false,
  token_coverage: null,
  is_coverage_complete: false,
  expert_id: null,
  expert_name: null,
  expert_deleted: false,
  expert_attributed: true,
  subagent_count: 0,
}

describe("305-03 getSpendRuns — the ledger's source and key", () => {
  it("an MCP row maps source, key id, key label and tool", async () => {
    serve({ runs: [{ ...ROW, source: "mcp", api_key_id: "k1", api_key_label: "Laptop", mcp_tool: "search_knowledge_base" }], total_count: 1 })
    const { runs } = await getSpendRuns()
    expect(runs[0]).toMatchObject({
      source: "mcp", apiKeyId: "k1", apiKeyLabel: "Laptop", mcpTool: "search_knowledge_base", isRated: false,
    })
  })

  it("a run row, and a row from an older backend, read as run with null key fields", async () => {
    serve({ runs: [{ ...ROW, source: "run", api_key_id: null, api_key_label: null, mcp_tool: null }, ROW], total_count: 2 })
    const { runs } = await getSpendRuns()
    for (const r of runs) {
      expect(r).toMatchObject({ source: "run", apiKeyId: null, apiKeyLabel: null, mcpTool: null })
    }
  })
})
