/**
 * Phase 304-05 (KEY-01; D-27, D-28, D-29, D-45; T-293-21, T-304-38, T-304-40) — "Connect a tool".
 *
 * Client tabs (words only, no logos), three steps each, a copy-ready snippet that reads the key from
 * SYREL_MCP_KEY and puts it in a header, the Claude Desktop bridge labelled as a workaround, and the
 * Claude.ai organisation-connector warning on every tab and in the no-address state.
 *
 * ⛔ THE COMPONENT NEVER RECEIVES THE SECRET. Its only data prop is the server's MCP URL; a secret on
 *   the same page must never appear in its output.
 */
import { describe, expect, it } from "vitest"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import snippetsTsxRaw from "../McpConnectSnippets.tsx?raw"
import { McpConnectSnippets } from "../McpConnectSnippets"
import { MCP_URL } from "./fixtures"

const SECRET = "srl_mcp_TESTsecretNOTreal0000000000000000000000"
const WARNING =
  "⚠ Don't paste this key into Claude.ai's organisation connector settings. Everyone in that Claude organisation would act as you. Claude.ai and Claude Desktop will connect with sign-in instead."

describe("304-05 McpConnectSnippets", () => {
  it("tabs in order, Claude Code first; the Desktop tab carries the Workaround chip", () => {
    render(<McpConnectSnippets mcpUrl={MCP_URL} />)
    expect(screen.getByText("Connect a tool")).toBeInTheDocument()
    const tabs = screen.getAllByRole("tab")
    expect(tabs.map((t) => t.textContent)).toEqual(["Claude Code", "Cursor", "VS Code", "Claude DesktopWorkaround"])
    expect(tabs[0]).toHaveAttribute("aria-selected", "true")
  })

  it("Claude Code: the env step, placement, the .mcp.json snippet, the terminal form, reload", () => {
    render(<McpConnectSnippets mcpUrl={MCP_URL} />)
    const panel = screen.getByRole("tabpanel")
    expect(within(panel).getByText("Put the secret in an environment variable named SYREL_MCP_KEY.")).toBeInTheDocument()
    expect(
      within(panel).getByText("Add this to .mcp.json in your project's folder, or run the command under it from that folder."),
    ).toBeInTheDocument()
    const snippet = within(panel).getByTestId("mcp-snippet-claudeCode").textContent ?? ""
    expect(snippet).toContain('"Authorization": "Bearer ${SYREL_MCP_KEY}"')
    expect(snippet).toContain(`"url": "${MCP_URL}"`)
    expect(within(panel).getByTestId("mcp-snippet-claudeCodeCli").textContent).toContain("claude mcp add-json syrel '")
    expect(within(panel).getByText(/run \/mcp to check it is connected/)).toBeInTheDocument()
  })

  it("Copy copies that client's setup and says Copied", async () => {
    const user = userEvent.setup()
    render(<McpConnectSnippets mcpUrl={MCP_URL} />)
    const copy = screen.getByRole("button", { name: "Copy the Claude Code setup" })
    await user.click(copy)
    expect(await navigator.clipboard.readText()).toContain("${SYREL_MCP_KEY}")
    expect(copy).toHaveTextContent("✓ Copied")
    expect(screen.getByText("Copied.")).toBeInTheDocument()
  })

  it("Cursor and VS Code read ${env:SYREL_MCP_KEY}; VS Code uses servers", async () => {
    const user = userEvent.setup()
    render(<McpConnectSnippets mcpUrl={MCP_URL} />)
    await user.click(screen.getByRole("tab", { name: "Cursor" }))
    expect(screen.getByTestId("mcp-snippet-cursor").textContent).toContain("Bearer ${env:SYREL_MCP_KEY}")
    expect(screen.getByRole("button", { name: "Copy the Cursor setup" })).toBeInTheDocument()
    await user.click(screen.getByRole("tab", { name: "VS Code" }))
    const vs = screen.getByTestId("mcp-snippet-vscode").textContent ?? ""
    expect(vs).toContain('"servers"')
    expect(vs).toContain("Bearer ${env:SYREL_MCP_KEY}")
  })

  it("Claude Desktop leads with the workaround line, its own env step, and the pinned bridge", async () => {
    const user = userEvent.setup()
    render(<McpConnectSnippets mcpUrl={MCP_URL} />)
    await user.click(screen.getByRole("tab", { name: /Claude Desktop/ }))
    const panel = screen.getByRole("tabpanel")
    expect(
      within(panel).getByText(
        "A developer workaround until Claude Desktop connects with sign-in. It needs Node.js and runs a small bridge on your computer.",
      ),
    ).toBeInTheDocument()
    expect(within(panel).getByText(/Claude Desktop can't read environment variables/)).toBeInTheDocument()
    expect(within(panel).getByTestId("mcp-snippet-desktop").textContent).toContain("mcp-remote@0.15.2")
    expect(within(panel).queryByText(/version couldn't be checked/)).toBeNull()
  })

  it("the Claude.ai warning is a note on every tab", async () => {
    const user = userEvent.setup()
    render(<McpConnectSnippets mcpUrl={MCP_URL} />)
    for (const name of ["Claude Code", "Cursor", "VS Code", /Claude Desktop/]) {
      await user.click(screen.getByRole("tab", { name }))
      expect(screen.getByRole("note")).toHaveTextContent(WARNING)
    }
  })

  it("no public address: the no-address line and the warning, no tabs, no snippet (D-28, 305 D-49)", () => {
    render(<McpConnectSnippets mcpUrl={null} />)
    // 305 D-49: production refuses an unset, loopback or http base, so the line names https.
    expect(
      screen.getByText(
        "This deployment doesn't have a public https address for AI tools yet, so the connection address can't be shown. Ask your operator to set it.",
      ),
    ).toBeInTheDocument()
    expect(screen.getByRole("note")).toHaveTextContent(WARNING)
    expect(screen.queryByRole("tab")).toBeNull()
    expect(document.querySelector("pre")).toBeNull()
  })

  it("an address carrying a query string is treated as no address", () => {
    render(<McpConnectSnippets mcpUrl={`${MCP_URL}?key=abc`} />)
    expect(screen.queryByRole("tab")).toBeNull()
    expect(document.body.textContent).not.toContain("?key=abc")
  })

  it("a secret elsewhere on the page never appears in its output (T-293-21)", async () => {
    const user = userEvent.setup()
    render(
      <div>
        <span data-testid="elsewhere">{SECRET}</span>
        <div data-testid="snippets">
          <McpConnectSnippets mcpUrl={MCP_URL} />
        </div>
      </div>,
    )
    for (const name of ["Claude Code", "Cursor", "VS Code", /Claude Desktop/]) {
      await user.click(screen.getByRole("tab", { name }))
      expect(screen.getByTestId("snippets").textContent).not.toContain(SECRET)
      expect(screen.getByTestId("snippets").textContent).not.toContain("srl_")
    }
  })

  it("takes no secret: the component's code never names one", () => {
    const code = snippetsTsxRaw
      .split("\n")
      .filter((l) => !/^\s*(\/\/|\*|\/\*|\{\/\*)/.test(l))
      .join("\n")
    expect(code).not.toMatch(/secret/i)
  })
})
