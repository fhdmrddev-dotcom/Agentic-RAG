/**
 * Phase 304-05 (D-19, D-30; KEY-06) — the ONE switched-off sentence, by scope and by where it sits.
 *
 * The UI words begin with the server's own refusal words on purpose (UI-SPEC §Copywriting), so
 * the screen and a refused tool call say the same thing. Deployment off wins over org off.
 */
import { describe, expect, it } from "vitest"
import { render, screen } from "@testing-library/react"
import { McpOffNotice } from "../McpOffNotice"
import principalLivenessPy from "../../../../../../backend/app/security/principal_liveness.py?raw"

describe("304-05 McpOffNotice", () => {
  it("renders nothing when MCP is on", () => {
    const { container } = render(<McpOffNotice scope={null} />)
    expect(container).toBeEmptyDOMElement()
  })

  it("card: the org and deployment sentences, with what happens next", () => {
    const { rerender } = render(<McpOffNotice scope="org" variant="card" />)
    expect(screen.getByTestId("mcp-off-notice")).toHaveTextContent(
      "MCP access is switched off for this organisation by an admin. This key works again when they switch it back on.",
    )
    rerender(<McpOffNotice scope="deployment" variant="card" />)
    expect(screen.getByTestId("mcp-off-notice")).toHaveTextContent(
      "MCP access is switched off for this deployment by the operator. This key works again when they switch it back on.",
    )
  })

  it("member header and tile: the short sentence", () => {
    const { rerender } = render(<McpOffNotice scope="org" />)
    expect(screen.getByTestId("mcp-off-notice")).toHaveTextContent(/^MCP access is switched off for this organisation by an admin\.$/)
    rerender(<McpOffNotice scope="org" variant="tile" />)
    expect(screen.getByTestId("mcp-off-notice")).toHaveTextContent(/^MCP access is switched off for this organisation by an admin\.$/)
    rerender(<McpOffNotice scope="deployment" />)
    expect(screen.getByTestId("mcp-off-notice")).toHaveTextContent(/^MCP access is switched off for this deployment by the operator\.$/)
  })

  it("unknown (a failed switch read): its own sentence in every variant, never the operator's (304-REVIEW WR-02)", () => {
    const unknown = "Couldn't check whether AI tool access is on. Reload to try again."
    for (const variant of ["member", "card", "tile", "admin"] as const) {
      const { unmount } = render(<McpOffNotice scope="unknown" variant={variant} orgName="Acme" />)
      const notice = screen.getByTestId("mcp-off-notice")
      expect(notice).toHaveTextContent(new RegExp(`^${unknown.replace(/[.?]/g, "\\$&")}$`))
      expect(notice).toHaveAttribute("data-scope", "unknown")
      unmount()
    }
  })

  it("admin: names the org", () => {
    const { rerender } = render(<McpOffNotice scope="org" variant="admin" orgName="Acme" />)
    expect(screen.getByTestId("mcp-off-notice")).toHaveTextContent(
      "MCP access is switched off for Acme. Every member's AI tool key and connected app is refused until you switch it back on in the Settings tab.", // 307-04 (D-21)
    )
    rerender(<McpOffNotice scope="org" variant="admin" />)
    expect(screen.getByTestId("mcp-off-notice")).toHaveTextContent("MCP access is switched off for this organisation.")
  })

  it("the screen's words start with the server's refusal sentences (D-19)", () => {
    const sentences = [...principalLivenessPy.matchAll(/MCP_OFF_(?:ORG|DEPLOYMENT)_SENTENCE = "([^"]+)"/g)].map((m) => m[1])
    expect(sentences).toHaveLength(2)
    const { rerender } = render(<McpOffNotice scope="org" variant="card" />)
    expect(screen.getByTestId("mcp-off-notice").textContent).toContain(sentences[0])
    rerender(<McpOffNotice scope="deployment" variant="card" />)
    expect(screen.getByTestId("mcp-off-notice").textContent).toContain(sentences[1])
  })
})
