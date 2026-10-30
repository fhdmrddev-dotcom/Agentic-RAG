/**
 * Phase 293-04 (D-05, D-17) — one key card in every state, read by its RENDERED WORDS.
 *
 * Prices UI-SPEC failure 3 (an unpublished workflow on a key that still reads `● active`) and
 * the admin view's owner line; run cells are links only when the caller can open a run.
 */
import { describe, expect, it, vi } from "vitest"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { ApiKeyCard } from "../ApiKeyCard"
import { MCP_CATALOGUE, MCP_URL, NOW, iso, makeCall, makeKey, makeMcpKey } from "./fixtures"

describe("293-04 ApiKeyCard", () => {
  it("an active key: label, ● active, prefix, plain chip, meta facts, Revoke", () => {
    render(<ApiKeyCard apiKey={makeKey()} now={NOW} onRevoke={() => {}} />)
    const card = screen.getByTestId("api-key-card")
    expect(within(card).getByText("n8n-prod")).toBeInTheDocument()
    expect(within(card).getByText("● active")).toBeInTheDocument()
    expect(within(card).getByText("srl_live_Ab3d…")).toBeInTheDocument()
    expect(within(card).getByTestId("api-key-chip")).toHaveTextContent("Contract review")
    expect(within(card).getByTestId("api-key-chip")).toHaveAttribute("data-refused", "false")
    const meta = within(card).getByTestId("api-key-meta")
    expect(meta).toHaveTextContent("expires Fri 22 Jan 2027 (in 89 days)")
    expect(meta).toHaveTextContent("last used 10:42")
    expect(meta).toHaveTextContent("created Thu 1 Oct")
    expect(meta).not.toHaveTextContent("owner")
    expect(within(card).getByRole("button", { name: "Revoke n8n-prod" })).toBeInTheDocument()
    expect(card).toHaveAttribute("data-dead", "false")
  })

  it("an unpublished workflow → amber tag, dashed chip and the refusal line, never ● active", () => {
    render(
      <ApiKeyCard
        apiKey={makeKey({
          workflows: [
            { id: "w1", name: "Contract review", state: "startable" },
            { id: "w2", name: "Renewal brief", state: "unpublished" },
          ],
        })}
        now={NOW}
      />,
    )
    expect(screen.getByText("⚠ 1 workflow refused")).toBeInTheDocument()
    expect(screen.queryByText("● active")).toBeNull()
    const chips = screen.getAllByTestId("api-key-chip")
    expect(chips[1]).toHaveTextContent("⚠ Renewal brief · no longer published")
    expect(chips[1]).toHaveAttribute("data-refused", "true")
    expect(chips[1].className).toContain("border-dashed")
    expect(
      screen.getByText("Renewal brief was unpublished, so calls to it are refused. Publish it again, or make a key without it."),
    ).toBeInTheDocument()
  })

  it("an expired key is dimmed, has no Revoke and no receipt", () => {
    render(<ApiKeyCard apiKey={makeKey({ state: "expired", expires_at: iso(2026, 9, 22) })} now={NOW} onRevoke={() => {}} />)
    const card = screen.getByTestId("api-key-card")
    expect(card).toHaveAttribute("data-dead", "true")
    expect(within(card).getByText("expired")).toBeInTheDocument()
    expect(within(card).queryByRole("button", { name: /Revoke/ })).toBeNull()
    expect(within(card).getByTestId("api-key-meta")).toHaveTextContent("(expired 3 days ago)")
  })

  it("a revoked key shows the receipt where the button was", () => {
    render(
      <ApiKeyCard
        apiKey={makeKey({ state: "revoked", revoked_at: iso(2026, 9, 20), revoked_by_name: "Priya Shah", revoked_by_admin: true })}
        now={NOW}
        onRevoke={() => {}}
      />,
    )
    expect(screen.getByText("revoked")).toBeInTheDocument()
    expect(screen.getByTestId("api-key-receipt")).toHaveTextContent("✎ Revoked by Priya Shah, an admin · Tue 20 Oct · recorded")
    expect(screen.queryByRole("button", { name: /Revoke/ })).toBeNull()
  })

  it("showOwner prepends the owner, with (you) on the viewer's own key", () => {
    const { rerender } = render(<ApiKeyCard apiKey={makeKey()} now={NOW} showOwner />)
    expect(screen.getByTestId("api-key-meta")).toHaveTextContent(/^owner Dana Kim \(you\)/)
    rerender(<ApiKeyCard apiKey={makeKey({ owner_is_you: false, owner_name: "Priya Shah" })} now={NOW} showOwner />)
    expect(screen.getByTestId("api-key-meta")).toHaveTextContent(/^owner Priya Shah ·?/)
    expect(screen.getByTestId("api-key-meta")).not.toHaveTextContent("(you)")
  })

  it("Show activity opens the table; run ids are links only when onOpenRun is given", async () => {
    const user = userEvent.setup()
    const onOpenRun = vi.fn()
    const k = makeKey({ calls: [makeCall(), makeCall({ ok: false, reason: "unpublished", run_id: null, outcome: null })] })
    const { rerender } = render(<ApiKeyCard apiKey={k} now={NOW} onOpenRun={onOpenRun} />)
    await user.click(screen.getByRole("button", { name: "Show activity" }))
    const table = screen.getByRole("table")
    expect(within(table).getByText("✓ started")).toBeInTheDocument()
    expect(within(table).getByText("✕ refused: workflow is no longer published")).toBeInTheDocument()
    expect(within(table).getByText("no run")).toBeInTheDocument()
    await user.click(within(table).getByRole("button", { name: "run 7f3a91" }))
    expect(onOpenRun).toHaveBeenCalledWith("7f3a91c2-0000-4000-8000-000000000000")
    expect(screen.getByRole("button", { name: "Hide activity" })).toBeInTheDocument()

    rerender(<ApiKeyCard apiKey={k} now={NOW} />)
    expect(within(screen.getByRole("table")).queryByRole("button", { name: "run 7f3a91" })).toBeNull()
    expect(within(screen.getByRole("table")).getByText("run 7f3a91")).toBeInTheDocument()
  })

  it("a key with no calls has no activity toggle; the strip says no calls yet", () => {
    render(<ApiKeyCard apiKey={makeKey()} now={NOW} />)
    expect(screen.queryByRole("button", { name: "Show activity" })).toBeNull()
    expect(screen.getByText("no calls yet")).toBeInTheDocument()
  })

  it("304-05: a workflow key gains only the Workflow kind chip", () => {
    render(<ApiKeyCard apiKey={makeKey()} now={NOW} />)
    expect(screen.getByTestId("api-key-kind")).toHaveTextContent("Workflow")
    expect(screen.queryByRole("button", { name: "How to connect" })).toBeNull()
  })

  it("the audit link appears only when onOpenAudit is given", async () => {
    const user = userEvent.setup()
    const onOpenAudit = vi.fn()
    render(<ApiKeyCard apiKey={makeKey({ calls: [makeCall()] })} now={NOW} onOpenAudit={onOpenAudit} />)
    await user.click(screen.getByRole("button", { name: "Show activity" }))
    await user.click(screen.getByRole("button", { name: "All in the audit log →" }))
    expect(onOpenAudit).toHaveBeenCalledTimes(1)
  })
})

describe("304-05 ApiKeyCard — an MCP key (KEY-05)", () => {
  it("kind chip, ● active, the scope chips, and the meta line with Not used yet", () => {
    render(<ApiKeyCard apiKey={makeMcpKey()} now={NOW} mcpTools={MCP_CATALOGUE} mcpUrl={MCP_URL} onRevoke={() => {}} />)
    const card = screen.getByTestId("api-key-card")
    expect(within(card).getByTestId("api-key-kind")).toHaveTextContent("AI tool · MCP")
    expect(within(card).getByText("● active")).toBeInTheDocument()
    expect(within(card).getByText("srl_mcp_Xy12…")).toBeInTheDocument()
    expect(within(card).getAllByTestId("api-key-chip").map((c) => c.textContent)).toEqual(["Read only", "All folders"])
    const meta = within(card).getByTestId("api-key-meta")
    expect(meta).toHaveTextContent("acts in Acme")
    expect(meta).toHaveTextContent("expires Sat 23 Jan 2027 (in 90 days)")
    expect(meta).toHaveTextContent("Not used yet")
    expect(meta).not.toHaveTextContent("last used")
    expect(meta).toHaveTextContent("created Thu 1 Oct")
    expect(within(card).getByRole("button", { name: "Revoke claude-code-laptop" })).toBeInTheDocument()
  })

  it("no call strip and no activity toggle (per-call records are KEY-07)", () => {
    render(<ApiKeyCard apiKey={makeMcpKey({ calls: [makeCall()] })} now={NOW} mcpTools={MCP_CATALOGUE} mcpUrl={MCP_URL} />)
    expect(screen.queryByText("no calls yet")).toBeNull()
    expect(screen.queryByRole("group", { name: /Recent calls/ })).toBeNull()
    expect(screen.queryByRole("button", { name: "Show activity" })).toBeNull()
  })

  it("used: last used {time}", () => {
    render(<ApiKeyCard apiKey={makeMcpKey({ last_used_at: iso(2026, 9, 25, 10, 42) })} now={NOW} mcpTools={MCP_CATALOGUE} />)
    expect(screen.getByTestId("api-key-meta")).toHaveTextContent("last used 10:42")
  })

  it("switched off: the ⏸ tag and the card line; deployment's words when the deployment is off", () => {
    const { rerender } = render(<ApiKeyCard apiKey={makeMcpKey({ mcp_off: "org" })} now={NOW} mcpTools={MCP_CATALOGUE} />)
    expect(screen.getByText("⏸ switched off")).toBeInTheDocument()
    expect(screen.queryByText("● active")).toBeNull()
    expect(screen.getByTestId("mcp-off-notice")).toHaveTextContent(
      "MCP access is switched off for this organisation by an admin. This key works again when they switch it back on.",
    )
    rerender(<ApiKeyCard apiKey={makeMcpKey({ mcp_off: "deployment" })} now={NOW} mcpTools={MCP_CATALOGUE} />)
    expect(screen.getByTestId("mcp-off-notice")).toHaveTextContent(/for this deployment by the operator/)
    expect(screen.getByTestId("api-key-card")).toHaveAttribute("data-dead", "false")
  })

  it("unknown (a failed switch read): no ⏸ switched-off tag, and the card says we couldn't check (304-REVIEW WR-02)", () => {
    render(<ApiKeyCard apiKey={makeMcpKey({ mcp_off: "unknown" })} now={NOW} mcpTools={MCP_CATALOGUE} />)
    expect(screen.queryByText("⏸ switched off")).toBeNull()
    expect(screen.getByTestId("mcp-off-notice")).toHaveTextContent(
      "Couldn't check whether AI tool access is on. Reload to try again.",
    )
    expect(screen.queryByText(/by the operator/)).toBeNull()
    expect(screen.getByTestId("api-key-card")).toHaveAttribute("data-dead", "false")
  })

  it("How to connect toggles the snippets on an active key; never the secret", async () => {
    const user = userEvent.setup()
    render(<ApiKeyCard apiKey={makeMcpKey()} now={NOW} mcpTools={MCP_CATALOGUE} mcpUrl={MCP_URL} />)
    await user.click(screen.getByRole("button", { name: "How to connect" }))
    expect(screen.getByText("Connect a tool")).toBeInTheDocument()
    expect(screen.getByTestId("mcp-snippet-claudeCode").textContent).toContain("${SYREL_MCP_KEY}")
    await user.click(screen.getByRole("button", { name: "Hide how to connect" }))
    expect(screen.queryByText("Connect a tool")).toBeNull()
  })

  it("no How to connect in the admin view, or on a key that no longer works", () => {
    const { rerender } = render(<ApiKeyCard apiKey={makeMcpKey()} now={NOW} mcpTools={MCP_CATALOGUE} showOwner />)
    expect(screen.queryByRole("button", { name: "How to connect" })).toBeNull()
    rerender(<ApiKeyCard apiKey={makeMcpKey({ state: "expired", expires_at: iso(2026, 9, 22) })} now={NOW} mcpTools={MCP_CATALOGUE} />)
    expect(screen.queryByRole("button", { name: "How to connect" })).toBeNull()
  })
})
