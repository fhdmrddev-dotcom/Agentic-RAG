import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { McpAuthDoor } from "./McpAuthDoor"
import { EMPTY_DRAFT } from "./connectionFormCopy"
import { ConnectorApiError } from "@/lib/api"
import * as api from "@/lib/api"

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>()
  return {
    ...actual,
    probeMcpAuth: vi.fn(),
    createMcpOAuthAuthorizeUrl: vi.fn(),
  }
})

describe("Phase 222 — McpAuthDoor Component", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("renders Server URL input and check button", () => {
    render(
      <McpAuthDoor
        draft={{ ...EMPTY_DRAFT, mcpServerUrl: "https://mcp.notion.com/mcp" }}
        onDraftChange={vi.fn()}
        mode="create"
        canWrite={true}
        isOrgAdmin={true}
        liveConnectorsOn={true}
      />,
    )

    expect(screen.getByTestId("mcp-server-url-input")).toBeInTheDocument()
    expect(screen.getByTestId("connection-probe-mcp-btn")).toBeInTheDocument()
  })

  it("renders State 2: kind === 'open' with direct connection info", async () => {
    vi.mocked(api.probeMcpAuth).mockResolvedValueOnce({
      kind: "open",
      authorization_host: null,
      registration_required: false,
      code_challenge_methods: [],
      detail: null,
      resource_status: 200,
    })

    render(
      <McpAuthDoor
        draft={{ ...EMPTY_DRAFT, mcpServerUrl: "https://mcp.deepwiki.com/sse" }}
        onDraftChange={vi.fn()}
        mode="create"
        canWrite={true}
        isOrgAdmin={true}
        liveConnectorsOn={true}
      />,
    )

    await waitFor(() => {
      expect(screen.getByTestId("mcp-open-card")).toBeInTheDocument()
    })
    expect(
      screen.getByText("No credentials required. This server allows direct connection."),
    ).toBeInTheDocument()
  })

  it("renders State 3: kind === 'oauth' with DCR and 1-click Sign In button", async () => {
    vi.mocked(api.probeMcpAuth).mockResolvedValueOnce({
      kind: "oauth",
      authorization_host: "accounts.notion.com",
      registration_required: false,
      code_challenge_methods: ["S256"],
      detail: null,
      resource_status: 401,
    })

    render(
      <McpAuthDoor
        draft={{ ...EMPTY_DRAFT, mcpServerUrl: "https://mcp.notion.com/mcp" }}
        onDraftChange={vi.fn()}
        mode="create"
        canWrite={true}
        isOrgAdmin={true}
        liveConnectorsOn={true}
      />,
    )

    await waitFor(() => {
      expect(screen.getByTestId("mcp-oauth-card")).toBeInTheDocument()
    })
    expect(
      screen.getByText(
        "Authentication required. Sign in with accounts.notion.com to connect.",
      ),
    ).toBeInTheDocument()
    expect(screen.getByTestId("mcp-oauth-connect-btn")).toHaveTextContent(
      "Sign in with accounts.notion.com",
    )
    expect(screen.queryByTestId("mcp-byo-fields")).not.toBeInTheDocument()
  })

  it("renders State 4: kind === 'oauth' with BYO client credentials", async () => {
    vi.mocked(api.probeMcpAuth).mockResolvedValueOnce({
      kind: "oauth",
      authorization_host: "auth.enterprise.com",
      registration_required: true,
      code_challenge_methods: ["S256"],
      detail: null,
      resource_status: 401,
    })

    render(
      <McpAuthDoor
        draft={{
          ...EMPTY_DRAFT,
          mcpServerUrl: "https://custom.enterprise.com/mcp",
          customClientId: "client-abc",
          customClientSecret: "secret-xyz",
        }}
        onDraftChange={vi.fn()}
        mode="create"
        canWrite={true}
        isOrgAdmin={true}
        liveConnectorsOn={true}
      />,
    )

    await waitFor(() => {
      expect(screen.getByTestId("mcp-byo-fields")).toBeInTheDocument()
    })
    expect(screen.getByTestId("mcp-client-id-input")).toBeInTheDocument()
    expect(screen.getByTestId("mcp-client-secret-input")).toBeInTheDocument()
    expect(screen.getByTestId("mcp-oauth-connect-btn")).toHaveTextContent(
      "Authorize & Connect",
    )
  })

  it("renders State 5a: kind === 'token' with secret input", async () => {
    vi.mocked(api.probeMcpAuth).mockResolvedValueOnce({
      kind: "token",
      authorization_host: null,
      registration_required: false,
      code_challenge_methods: [],
      detail: "Enter personal access token with repo scope.",
      resource_status: 401,
    })

    render(
      <McpAuthDoor
        draft={{ ...EMPTY_DRAFT, mcpServerUrl: "https://api.github.com/mcp" }}
        onDraftChange={vi.fn()}
        mode="create"
        canWrite={true}
        isOrgAdmin={true}
        liveConnectorsOn={true}
      />,
    )

    await waitFor(() => {
      expect(screen.getByTestId("mcp-token-section")).toBeInTheDocument()
    })
    expect(
      screen.getByText("Enter personal access token with repo scope."),
    ).toBeInTheDocument()
    expect(screen.getByTestId("mcp-token-secret-input")).toBeInTheDocument()
  })

  it("renders State 5b: 422 Policy Refusal error banner", async () => {
    vi.mocked(api.probeMcpAuth).mockRejectedValueOnce(
      new ConnectorApiError(
        "Connection refused by security policy",
        422,
        "address_not_public",
      ),
    )

    render(
      <McpAuthDoor
        draft={{ ...EMPTY_DRAFT, mcpServerUrl: "http://192.168.1.1/mcp" }}
        onDraftChange={vi.fn()}
        mode="create"
        canWrite={true}
        isOrgAdmin={true}
        liveConnectorsOn={true}
      />,
    )

    await waitFor(() => {
      expect(screen.getByTestId("mcp-policy-refusal-alert")).toBeInTheDocument()
    })
    expect(
      screen.getByText(
        "The target server address is not public or belongs to a restricted internal network.",
      ),
    ).toBeInTheDocument()
  })

  it("executes popup window redirect safely during OAuth click gesture", async () => {
    vi.mocked(api.probeMcpAuth).mockResolvedValueOnce({
      kind: "oauth",
      authorization_host: "accounts.notion.com",
      registration_required: false,
      code_challenge_methods: ["S256"],
      detail: null,
      resource_status: 401,
    })

    vi.mocked(api.createMcpOAuthAuthorizeUrl).mockResolvedValueOnce({
      authorize_url: "https://accounts.notion.com/oauth/authorize?response_type=code&client_id=123",
      authorization_host: "accounts.notion.com",
    })

    const mockPopup = { location: { href: "" }, close: vi.fn() }
    const windowOpenSpy = vi.spyOn(window, "open").mockReturnValue(mockPopup as unknown as Window)

    const onCreateMock = vi.fn().mockResolvedValue({ id: "conn-notion-new" })

    render(
      <McpAuthDoor
        draft={{ ...EMPTY_DRAFT, mcpServerUrl: "https://mcp.notion.com/mcp", name: "Notion" }}
        onDraftChange={vi.fn()}
        mode="create"
        canWrite={true}
        isOrgAdmin={true}
        liveConnectorsOn={true}
        onCreate={onCreateMock}
      />,
    )

    await waitFor(() => {
      expect(screen.getByTestId("mcp-oauth-connect-btn")).toBeInTheDocument()
    })

    fireEvent.click(screen.getByTestId("mcp-oauth-connect-btn"))

    expect(windowOpenSpy).toHaveBeenCalledWith("about:blank", "_blank")
    await waitFor(() => {
      expect(onCreateMock).toHaveBeenCalled()
      expect(api.createMcpOAuthAuthorizeUrl).toHaveBeenCalledWith("conn-notion-new")
      expect(mockPopup.location.href).toContain("accounts.notion.com/oauth/authorize")
    })
  })

  it("handles blocked popup gracefully without minting handles or creating connections", async () => {
    vi.mocked(api.probeMcpAuth).mockResolvedValueOnce({
      kind: "oauth",
      authorization_host: "accounts.notion.com",
      registration_required: false,
      code_challenge_methods: ["S256"],
      detail: null,
      resource_status: 401,
    })

    vi.spyOn(window, "open").mockReturnValue(null)
    const onCreateMock = vi.fn()

    render(
      <McpAuthDoor
        draft={{ ...EMPTY_DRAFT, mcpServerUrl: "https://mcp.notion.com/mcp", name: "Notion" }}
        onDraftChange={vi.fn()}
        mode="create"
        canWrite={true}
        isOrgAdmin={true}
        liveConnectorsOn={true}
        onCreate={onCreateMock}
      />,
    )

    await waitFor(() => {
      expect(screen.getByTestId("mcp-oauth-connect-btn")).toBeInTheDocument()
    })

    fireEvent.click(screen.getByTestId("mcp-oauth-connect-btn"))

    expect(onCreateMock).not.toHaveBeenCalled()
    expect(api.createMcpOAuthAuthorizeUrl).not.toHaveBeenCalled()
    await waitFor(() => {
      expect(screen.getByTestId("mcp-oauth-error-alert")).toBeInTheDocument()
    })
    expect(screen.getByText(/Popup was blocked by your browser/)).toBeInTheDocument()
  })

  it("preserves config and does not wipe custom_client_id in edit mode (BUS-053)", async () => {
    vi.mocked(api.probeMcpAuth).mockResolvedValueOnce({
      kind: "oauth",
      authorization_host: "accounts.notion.com",
      registration_required: false,
      code_challenge_methods: ["S256"],
      detail: null,
      resource_status: 401,
    })

    vi.mocked(api.createMcpOAuthAuthorizeUrl).mockResolvedValueOnce({
      authorize_url: "https://accounts.notion.com/oauth/authorize",
      authorization_host: "accounts.notion.com",
    })

    const mockPopup = { location: { href: "" }, close: vi.fn() }
    vi.spyOn(window, "open").mockReturnValue(mockPopup as unknown as Window)

    const onUpdateMock = vi.fn().mockResolvedValue({})

    render(
      <McpAuthDoor
        draft={{ ...EMPTY_DRAFT, mcpServerUrl: "https://mcp.notion.com/mcp", name: "Notion" }}
        connection={{
          id: "conn-notion-existing",
          org_id: "org-1",
          service_id: "notion",
          name: "Notion",
          // ⚠ NULL, not "mcp". `ConnectorCapability` is the closed three-member set of
          // FIRST-PARTY capabilities; an MCP row carries `capability = NULL` by
          // construction (migration 126), which is exactly why `api/connectors.py:716`
          // keys the MCP refusal on `mcp_server_url` and never on a capability value.
          capability: null,
          mcp_server_url: "https://mcp.notion.com/mcp",
          config: { custom_client_id: "bD78Ksp3xBJew1kL" },
          is_enabled: true,
          created_at: "",
          updated_at: "",
        }}
        onDraftChange={vi.fn()}
        mode="edit"
        canWrite={true}
        isOrgAdmin={true}
        liveConnectorsOn={true}
        onUpdate={onUpdateMock}
      />,
    )

    await waitFor(() => {
      expect(screen.getByTestId("mcp-oauth-connect-btn")).toBeInTheDocument()
    })

    fireEvent.click(screen.getByTestId("mcp-oauth-connect-btn"))

    await waitFor(() => {
      expect(onUpdateMock).toHaveBeenCalledWith("conn-notion-existing", {
        name: "Notion",
        mcp_server_url: "https://mcp.notion.com/mcp",
      })
    })
  })
})
