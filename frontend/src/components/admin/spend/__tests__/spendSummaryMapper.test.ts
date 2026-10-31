/**
 * Phase 305-03 (D-31 / D-55) — the spend ledger mapper carries an MCP row's key and tool.
 *
 * `getSpendRuns` maps the server's ledger items onto `SpendRunItem`. An MCP usage row arrives with
 * `source: "mcp"`, its key id + label and the tool; a run row with `source: "run"` (or, from an
 * older backend, no source at all) and null key fields.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/api/_core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/_core")>()
  return { ...actual, getAuthHeaders: vi.fn(async () => ({})) }
})

import { getSpendRuns } from "@/lib/api/spend"

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

let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  fetchMock = vi.fn()
  vi.stubGlobal("fetch", fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function respond(runs: unknown[]) {
  fetchMock.mockResolvedValue({ ok: true, json: async () => ({ runs, total_count: runs.length }) })
}

describe("305-03 getSpendRuns — the ledger's source and key", () => {
  it("an MCP row maps source, key id, key label and tool", async () => {
    respond([{ ...ROW, source: "mcp", api_key_id: "k1", api_key_label: "Laptop", mcp_tool: "search_knowledge_base" }])
    const { runs } = await getSpendRuns()
    expect(runs[0]).toMatchObject({
      source: "mcp", apiKeyId: "k1", apiKeyLabel: "Laptop", mcpTool: "search_knowledge_base", isRated: false,
    })
  })

  it("a run row, and a row from an older backend, read as run with null key fields", async () => {
    respond([{ ...ROW, source: "run", api_key_id: null, api_key_label: null, mcp_tool: null }, ROW])
    const { runs } = await getSpendRuns()
    for (const r of runs) {
      expect(r).toMatchObject({ source: "run", apiKeyId: null, apiKeyLabel: null, mcpTool: null })
    }
  })
})
