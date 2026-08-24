/**
 * Phase 206 (CONN-02 / CONN-03 / D-206-05 / D-206-06 / F-1 / F-2 / F-7) —
 * McpToolPicker Unit Tests.
 */

import { describe, it, expect, vi, beforeEach } from "vitest"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"

const { mockDiscover } = vi.hoisted(() => ({
  mockDiscover: vi.fn(),
}))

vi.mock("@/lib/api", () => ({
  discoverConnectorTools: mockDiscover,
}))

import {
  McpToolPicker,
  isToolGranted,
  MCP_TOOL_PICKER_HEADING,
  MCP_DISCOVER_BUTTON_LABEL,
  MCP_GRANT_GRANTED_LABEL,
  MCP_GRANT_DENIED_LABEL,
} from "./McpToolPicker"
import type { ConnectorConnection, McpConnectionConfig } from "@/lib/api"

const mockMcpConnection: ConnectorConnection = {
  id: "conn-mcp-1",
  org_id: "org-1",
  name: "Atlassian MCP",
  config: {} as McpConnectionConfig,
  is_enabled: true,
  mcp_server_url: "https://mcp.atlassian.com/v1",
  tool_grants: {
    jira_create_issue: true,
    jira_delete_issue: false,
  },
  discovered_tools: [
    {
      name: "jira_create_issue",
      description: "Create a Jira issue",
      inputSchema: { type: "object", properties: { summary: { type: "string" } } },
    },
    {
      name: "jira_delete_issue",
      description: "Delete a Jira issue",
      inputSchema: { type: "object", properties: { issueId: { type: "string" } } },
    },
    {
      name: "confluence_search",
      description: "Search Confluence pages",
      inputSchema: { type: "object" },
    },
  ],
}

describe("isToolGranted (F-1 / F-2)", () => {
  it("returns true when tool grant is explicitly true", () => {
    expect(isToolGranted({ jira_create_issue: true }, "jira_create_issue")).toBe(true)
  })

  it("returns false when tool grant is explicitly false", () => {
    expect(isToolGranted({ jira_delete_issue: false }, "jira_delete_issue")).toBe(false)
  })

  it("returns false when tool grant key is missing", () => {
    expect(isToolGranted({ jira_create_issue: true }, "confluence_search")).toBe(false)
  })

  it("returns false when grants object is null or undefined", () => {
    expect(isToolGranted(null, "jira_create_issue")).toBe(false)
    expect(isToolGranted(undefined, "jira_create_issue")).toBe(false)
  })
})

describe("McpToolPicker Component", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("renders null if connection has no mcp_server_url", () => {
    const nonMcpConn: ConnectorConnection = {
      ...mockMcpConnection,
      mcp_server_url: null,
    }
    const { container } = render(<McpToolPicker connection={nonMcpConn} />)
    expect(container).toBeEmptyDOMElement()
  })

  it("renders tool picker heading and tools list for MCP connection", () => {
    render(<McpToolPicker connection={mockMcpConnection} toolName="" />)
    expect(screen.getByText(MCP_TOOL_PICKER_HEADING)).toBeInTheDocument()
    expect(screen.getByTestId("mcp-discover-btn")).toBeInTheDocument()
    expect(screen.getByTestId("mcp-tool-select")).toBeInTheDocument()
  })

  it("displays granted status badge when selected tool has permission grant", () => {
    render(
      <McpToolPicker
        connection={mockMcpConnection}
        toolName="jira_create_issue"
      />
    )
    const status = screen.getByTestId("mcp-grant-status")
    expect(status).toHaveAttribute("data-granted", "true")
    expect(screen.getByText(MCP_GRANT_GRANTED_LABEL)).toBeInTheDocument()
  })

  it("displays not-granted status warning badge when selected tool lacks permission grant", () => {
    render(
      <McpToolPicker
        connection={mockMcpConnection}
        toolName="confluence_search"
      />
    )
    const status = screen.getByTestId("mcp-grant-status")
    expect(status).toHaveAttribute("data-granted", "false")
    expect(screen.getByText(MCP_GRANT_DENIED_LABEL)).toBeInTheDocument()
  })

  it("calls onSelectTool callback when tool selection changes", () => {
    const onSelect = vi.fn()
    render(
      <McpToolPicker
        connection={mockMcpConnection}
        toolName=""
        onSelectTool={onSelect}
      />
    )
    const select = screen.getByTestId("mcp-tool-select")
    fireEvent.change(select, { target: { value: "jira_create_issue" } })
    expect(onSelect).toHaveBeenCalledWith("jira_create_issue")
  })

  it("discovers tools when Discover Tools button is clicked", async () => {
    mockDiscover.mockResolvedValueOnce([
      { name: "github_create_issue", description: "Create GitHub issue" },
    ])

    const emptyConn: ConnectorConnection = {
      ...mockMcpConnection,
      discovered_tools: [],
    }

    render(<McpToolPicker connection={emptyConn} toolName="" />)
    const discoverBtn = screen.getByTestId("mcp-discover-btn")
    // The label is asserted, not just the test id: the id is ours and the label is the
    // operator's, and only one of the two is what they read.
    expect(discoverBtn).toHaveTextContent(MCP_DISCOVER_BUTTON_LABEL)
    fireEvent.click(discoverBtn)

    await waitFor(() => {
      expect(mockDiscover).toHaveBeenCalledWith("conn-mcp-1")
      expect(screen.getByText("github_create_issue")).toBeInTheDocument()
    })
  })

  it("validates and updates JSON arguments", () => {
    const onChangeArgs = vi.fn()
    render(
      <McpToolPicker
        connection={mockMcpConnection}
        toolName="jira_create_issue"
        onChangeArgs={onChangeArgs}
      />
    )

    const textarea = screen.getByTestId("mcp-tool-args")
    fireEvent.change(textarea, { target: { value: '{"summary": "Test bug"}' } })

    expect(onChangeArgs).toHaveBeenCalledWith({ summary: "Test bug" })
    expect(screen.queryByTestId("mcp-args-error")).not.toBeInTheDocument()
  })

  it("shows error message on invalid JSON syntax in arguments", () => {
    const onChangeArgs = vi.fn()
    render(
      <McpToolPicker
        connection={mockMcpConnection}
        toolName="jira_create_issue"
        onChangeArgs={onChangeArgs}
      />
    )

    const textarea = screen.getByTestId("mcp-tool-args")
    fireEvent.change(textarea, { target: { value: '{summary: invalid}' } })

    expect(screen.getByTestId("mcp-args-error")).toBeInTheDocument()
  })
})
