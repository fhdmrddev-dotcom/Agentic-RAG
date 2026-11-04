/**
 * Phase 305-03 (KEY-07; D-53; UI-SPEC §Surface 3) — an AI tool key's activity table, by its WORDS.
 *
 * Three columns, Time · Tool · Result (an MCP read has no workflow and no run); the tool name in
 * the read pill, or — when a call was refused before a tool was known; the MCP empty sentence; and
 * never any query text (none is recorded).
 */
import { describe, expect, it } from "vitest"
import { render, screen, within } from "@testing-library/react"
import { ApiKeyActivity } from "../ApiKeyActivity"
import { NOW, iso, makeCall, makeMcpKey } from "./fixtures"

const KEY = makeMcpKey()
const LIMITS = { starts_per_minute: 10, reads_per_minute: 120, searches_per_minute: 30 }

const mcpCall = (over = {}) =>
  makeCall({ verb: "read", workflow_id: null, workflow_name: null, run_id: null, outcome: "ok", tool: "list_documents", ...over })

describe("305-03 ApiKeyActivity — an MCP key", () => {
  it("three columns, Time · Tool · Result, with the tool pill and the result words", () => {
    render(
      <ApiKeyActivity
        calls={[
          mcpCall({ at: iso(2026, 9, 25, 10, 42), ok: false, outcome: "refused", reason: "rate_limited:expensive",
                    detail: { limit: 30 }, tool: "search_knowledge_base" }),
          mcpCall({ at: iso(2026, 9, 25, 10, 41) }),
          mcpCall({ at: iso(2026, 9, 25, 10, 40), ok: false, outcome: null, reason: "mcp_off_org", tool: null }),
        ]}
        revoked={false}
        lastUsed="10:42"
        now={NOW}
        ctx={{ key: KEY, limits: LIMITS, now: NOW }}
      />,
    )
    const headers = screen.getAllByRole("columnheader").map((h) => h.textContent)
    expect(headers).toEqual(["Time", "Tool", "Result"])
    const rows = screen.getAllByRole("row").slice(1)
    expect(rows.map((r) => within(r).getAllByRole("cell").map((c) => c.textContent))).toEqual([
      ["10:42", "search_knowledge_base", "✕ refused: over the limit: 30 searches a minute"],
      ["10:41", "list_documents", "✓ answered"],
      ["10:40", "—", "✕ refused: MCP access is switched off for this organisation"],
    ])
    expect(screen.queryByText(/no run/)).toBeNull()
  })

  it("an MCP key never called reads the MCP empty sentence", () => {
    render(<ApiKeyActivity calls={[]} revoked={false} lastUsed="—" now={NOW} ctx={{ key: KEY, now: NOW }} />)
    expect(screen.getByText("No calls yet. The first call from an AI tool will show here.") /* 306-05 reworded */).toBeInTheDocument()
  })

  it("a revoked MCP key with no calls keeps the shipped revoked sentence", () => {
    render(<ApiKeyActivity calls={[]} revoked lastUsed="—" now={NOW} ctx={{ key: KEY, now: NOW }} />)
    expect(screen.getByText("Revoked before any calls in the last 30 days.")).toBeInTheDocument()
  })

  it("a workflow key still renders its five columns", () => {
    render(<ApiKeyActivity calls={[makeCall()]} revoked={false} lastUsed="10:42" now={NOW} />)
    expect(screen.getAllByRole("columnheader").map((h) => h.textContent)).toEqual(["Time", "Call", "Workflow", "Run", "Result"])
  })
})
