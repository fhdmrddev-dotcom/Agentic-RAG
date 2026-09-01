import { describe, expect, it } from "vitest"
import {
  MCP_AUTH_OAUTH_BYO_DESC,
  MCP_AUTH_OAUTH_DCR_DESC,
  MCP_AUTH_OPEN_DESC,
  MCP_AUTH_TOKEN_DESC,
  MCP_PROBING_STATUS,
  MCP_REFUSAL_POLICY_HEADING,
  MCP_TOO_LARGE_HEADING,
  MCP_UNREACHABLE_HEADING,
  mcpAuthActionLabel,
  mcpPolicyRefusalMessage,
} from "../connectionFormCopy"
import { getCuratedServiceEntry } from "../servicesCatalog"

describe("Phase 222 — MCP Auth Presentation Copy & Catalog Derivations", () => {
  it("resolves Notion catalog entry with shape 'mcp' and default host 'mcp.notion.com/mcp'", () => {
    const notion = getCuratedServiceEntry("notion")
    expect(notion).not.toBeNull()
    expect(notion?.shape).toBe("mcp")
    expect(notion?.defaultHost).toBe("mcp.notion.com/mcp")
  })

  it("exports exact copy tokens for probing, open, and error headings", () => {
    expect(MCP_PROBING_STATUS).toBe("Checking server authentication...")
    expect(MCP_AUTH_OPEN_DESC).toBe(
      "No credentials required. This server allows direct connection.",
    )
    expect(MCP_REFUSAL_POLICY_HEADING).toBe(
      "Connection refused by security policy",
    )
    expect(MCP_UNREACHABLE_HEADING).toBe("Server did not respond")
    expect(MCP_TOO_LARGE_HEADING).toBe("Response too large")
  })

  it("formats OAuth DCR and BYO guidance correctly", () => {
    expect(MCP_AUTH_OAUTH_DCR_DESC("accounts.notion.com")).toBe(
      "Authentication required. Sign in with accounts.notion.com to connect.",
    )
    expect(MCP_AUTH_OAUTH_BYO_DESC("accounts.google.com")).toBe(
      "Authentication required. Supply your client credentials to sign in with accounts.google.com.",
    )
  })

  it("handles token description with fallback and verbatim backend detail", () => {
    expect(MCP_AUTH_TOKEN_DESC(null)).toBe(
      "This server requires an API token or personal access token.",
    )
    expect(
      MCP_AUTH_TOKEN_DESC(
        "Enter a Personal Access Token with repo scope.",
      ),
    ).toBe("Enter a Personal Access Token with repo scope.")
  })

  it("derives action labels based on kind and DCR registration status", () => {
    expect(mcpAuthActionLabel("open")).toBe("Connect")
    expect(mcpAuthActionLabel("oauth", false, "accounts.notion.com")).toBe(
      "Sign in with accounts.notion.com",
    )
    expect(mcpAuthActionLabel("oauth", true, "accounts.notion.com")).toBe(
      "Authorize & Connect",
    )
    expect(mcpAuthActionLabel("token")).toBe("Save & Connect")
    expect(mcpAuthActionLabel("unreachable")).toBe("Connect")
  })

  it("derives distinct messages for security egress reason codes", () => {
    expect(mcpPolicyRefusalMessage("address_not_public")).toBe(
      "The target server address is not public or belongs to a restricted internal network.",
    )
    expect(mcpPolicyRefusalMessage("scheme_not_tls")).toBe(
      "Only secure HTTPS URLs are permitted for remote MCP servers.",
    )
    expect(mcpPolicyRefusalMessage("host_not_allowed")).toBe(
      "The requested host is not permitted by security egress policy.",
    )
    expect(mcpPolicyRefusalMessage("host_not_ascii")).toBe(
      "The host contains invalid non-ASCII characters.",
    )
    expect(mcpPolicyRefusalMessage("unresolvable")).toBe(
      "The server host address could not be resolved by DNS.",
    )
    expect(mcpPolicyRefusalMessage("redirected")).toBe(
      "The server attempted an unpermitted HTTP redirect.",
    )
    expect(mcpPolicyRefusalMessage("other_reason", "Custom egress failure")).toBe(
      "Custom egress failure",
    )
  })
})
