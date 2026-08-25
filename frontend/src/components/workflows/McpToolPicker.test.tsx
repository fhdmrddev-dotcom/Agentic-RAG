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
  updateConnectorGrants: mockUpdateGrants,
}))

// ── ⚠ ADDED, NEVER RE-BASELINED (206.2-04) ────────────────────────────────────────────
// The mock budget is spent in the SAME COMMIT as the import that makes it live. 196-08's
// lesson is that an inert factory fails at MOUNT, loudly — 249 red tests from one added
// export — so the factory above is widened rather than left one-key.
//
// `useOrgOptional` is faked with the `NavPanel.test.tsx:30-33` idiom. The default
// implementation is ADMIN and it is given to `vi.fn()` ITSELF, not only through a
// `beforeEach`: the shipped describe below opens with `vi.clearAllMocks()`, and a default
// that lived only in a return-value would be at that hook's mercy.
const { mockUpdateGrants, mockUseOrgOptional } = vi.hoisted(() => {
  const ADMIN = {
    activeOrgId: "org-1",
    orgs: [],
    role: "org-admin",
    canManage: true,
    canAuditView: false,
    canManageSso: false,
    loading: false,
    switchOrg: () => {},
  }
  return { mockUpdateGrants: vi.fn(), mockUseOrgOptional: vi.fn((): unknown => ADMIN) }
})
vi.mock("@/providers/OrgProvider", () => ({ useOrgOptional: mockUseOrgOptional }))

import {
  McpToolPicker,
  isToolGranted,
  MCP_TOOL_PICKER_HEADING,
  MCP_DISCOVER_BUTTON_LABEL,
  MCP_GRANT_GRANTED_LABEL,
  MCP_GRANT_DENIED_LABEL,
} from "./McpToolPicker"
import type { ConnectorConnection, McpConnectionConfig } from "@/lib/api"
import type { OrgValue } from "@/providers/OrgProvider"
import {
  MCP_GRANT_ADMIN_ONLY_NOTE,
  MCP_GRANT_RECEIPT_ALLOWED,
  MCP_GRANT_RECEIPT_DENIED,
  MCP_GRANT_SAVING,
  MCP_GRANT_SCOPE_NOTE,
  MCP_GRANT_TOGGLE_LABEL,
  MCP_GRANT_WRITE_FAILED,
  MCP_NO_TOOLS_ADMIN_ONLY,
  MCP_NO_TOOLS_DISCOVERED,
} from "./McpToolPicker"

/** An `OrgValue`, defaulted to the ADMIN answer. `canManage` decides RENDERING ONLY —
 *  `require_org_manage` plus an RLS policy are the wall (OrgProvider.tsx:20). */
function orgValue(over: Partial<OrgValue> = {}): OrgValue {
  return {
    activeOrgId: "org-1",
    orgs: [],
    role: "org-admin",
    canManage: true,
    canAuditView: false,
    canManageSso: false,
    loading: false,
    switchOrg: vi.fn(),
    ...over,
  } as OrgValue
}

// EVERY test starts from the ADMIN answer, so a member/unknown case cannot leak forward.
beforeEach(() => {
  mockUseOrgOptional.mockReturnValue(orgValue())
  mockUpdateGrants.mockReset()
})

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

// ═══════════════════════════════════════════════════════════════════════════════════════
// ⚠ ADDED, NEVER RE-BASELINED — 206.2-04, the grant control.
//
// Everything ABOVE this banner is Phase 206's own suite and is UNEDITED apart from ONE
// INSERTED line in the `@/lib/api` factory. That matters twice: `MCP_GRANT_GRANTED_LABEL`
// and `MCP_GRANT_DENIED_LABEL`'s two cases are SC#2c's byte-identity pin on the badge, and
// the switch is deliberately sited OUTSIDE that badge so they pass untouched.
//
// ⚠ AND THIS WHOLE FILE IS TIER 1 — the tier that SHIPPED the defect. Every case here
// constructs the component's props by hand, which is fine for the component's OWN contract
// and is structurally unable to see that nothing in production constructs them. The tier
// that can is `McpToolPicker.reachability.test.tsx`'s leg (b).
// ═══════════════════════════════════════════════════════════════════════════════════════

/** The element count of the DENIED-arm render, MEASURED against the PRE-PHASE component
 *  (base `42af355d`) BEFORE any source edit in this plan — `container.querySelectorAll("*")`
 *  read 33, over a 4,008-character `innerHTML`. It is the whole contract of the arm that has
 *  no measured caller: a provider-less render adds ZERO NEW NODES, so this number must still
 *  compare equal afterwards. The UI-SPEC's evidence row permits a node COUNT or an innerHTML
 *  identity; the count is chosen because a 4 KB single-line capture makes every failure
 *  unreadable, and the non-vacuity case below is what stops the number being a tautology. */
const BASE_DENIED_NODE_COUNT = 33

const deniedTool = "confluence_search"

function renderPicker(props: Partial<React.ComponentProps<typeof McpToolPicker>> = {}) {
  return render(
    <McpToolPicker connection={mockMcpConnection} toolName={deniedTool} {...props} />,
  )
}

describe("206.2-04 · the grant control's audience arms (AR-01 / D-206.2-13)", () => {
  it("ADMIN — the switch, its label, the scope note and the Discover button all render", () => {
    renderPicker()
    const toggle = screen.getByTestId("mcp-grant-toggle")
    expect(toggle).toHaveAttribute("role", "switch")
    expect(toggle).toHaveAttribute("aria-checked", "false")
    expect(toggle).toHaveTextContent(MCP_GRANT_TOGGLE_LABEL)
    expect(screen.getByTestId("mcp-grant-scope-note")).toHaveTextContent(MCP_GRANT_SCOPE_NOTE)
    expect(screen.getByTestId("mcp-discover-btn")).toBeInTheDocument()
    expect(screen.queryByTestId("mcp-grant-admin-only")).not.toBeInTheDocument()
  })

  it("ADMIN — a GRANTED tool reads aria-checked=true, from the predicate the badge uses", () => {
    renderPicker({ toolName: "jira_create_issue" })
    expect(screen.getByTestId("mcp-grant-toggle")).toHaveAttribute("aria-checked", "true")
    expect(screen.getByTestId("mcp-grant-status")).toHaveAttribute("data-granted", "true")
  })

  it("MEMBER — NO switch and NO Discover button; ONE sentence in their place", () => {
    // ⚠ REMOVED, not `aria-disabled`. Gate 1 refuses a credential the author can go and
    // fix; org role is not fixable by the person looking at it. And removal ALONE would
    // fold two facts into one — this tool is not granted, and you cannot grant it — so the
    // sentence is the second fact, not decoration.
    mockUseOrgOptional.mockReturnValue(orgValue({ canManage: false, role: "member" }))
    renderPicker()
    expect(screen.queryByTestId("mcp-grant-toggle")).not.toBeInTheDocument()
    expect(screen.queryByTestId("mcp-discover-btn")).not.toBeInTheDocument()
    expect(screen.queryByTestId("mcp-grant-scope-note")).not.toBeInTheDocument()
    expect(screen.getByTestId("mcp-grant-admin-only")).toHaveTextContent(
      MCP_GRANT_ADMIN_ONLY_NOTE,
    )
    // The badge is a fact about the GRANT, not about the caller — it still renders.
    expect(screen.getByTestId("mcp-grant-status")).toHaveAttribute("data-granted", "false")
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  })

  it("MEMBER — the discover-shaped empty note is replaced, because there is no such button", () => {
    // The shipped sentence tells the reader to click Discover Tools. Showing it to someone
    // who has no such button is a measured lie this phase would otherwise ship.
    mockUseOrgOptional.mockReturnValue(orgValue({ canManage: false, role: "member" }))
    render(
      <McpToolPicker
        connection={{ ...mockMcpConnection, discovered_tools: [] }}
        toolName=""
      />,
    )
    expect(screen.getByTestId("mcp-no-tools")).toHaveTextContent(MCP_NO_TOOLS_ADMIN_ONLY)
    expect(screen.queryByText(MCP_NO_TOOLS_DISCOVERED)).not.toBeInTheDocument()
  })

  it("PROBING — org present but loading: no switch, no Discover button, and NO sentence", () => {
    // Printing an admin-only sentence while the permission probe is in flight would state a
    // fact about the caller that has not been measured.
    mockUseOrgOptional.mockReturnValue(orgValue({ canManage: false, loading: true }))
    renderPicker()
    expect(screen.queryByTestId("mcp-grant-toggle")).not.toBeInTheDocument()
    expect(screen.queryByTestId("mcp-discover-btn")).not.toBeInTheDocument()
    expect(screen.queryByTestId("mcp-grant-admin-only")).not.toBeInTheDocument()
    expect(screen.queryByTestId("mcp-grant-scope-note")).not.toBeInTheDocument()
  })

  it("NO PROVIDER — the render is NODE-IDENTICAL to the pre-phase one: ZERO new nodes", () => {
    // ⚠ THIS IS THE ARM THAT KEEPS SIX SHIPPED SUITES UNAFFECTED. ExternalActionSection,
    // PhaseFormPanel.rails and the four WorkflowBuilderPage suites all mount with no
    // OrgProvider. A null context means nothing new appears, nothing throws, no request opens.
    //
    // ⚠ AND IT IS WHY A NULL CONTEXT KEEPS THE DISCOVER BUTTON while a MEASURED member
    // loses it: byte-identity is impossible if a node is removed, and a null context is not
    // a measurement of anybody's role. In production OrgProvider wraps the whole app, so the
    // only real caller who is not measured is one whose probe is still in flight — and that
    // is the PROBING arm above, which does hide the button.
    mockUseOrgOptional.mockReturnValue(null as unknown as OrgValue)
    const { container } = renderPicker()
    expect(container.querySelectorAll("*").length).toBe(BASE_DENIED_NODE_COUNT)
    for (const id of [
      "mcp-grant-toggle",
      "mcp-grant-scope-note",
      "mcp-grant-admin-only",
      "mcp-grant-write-state",
      "mcp-grant-error",
    ]) {
      expect(screen.queryByTestId(id)).not.toBeInTheDocument()
    }
    // The shipped nodes are all still there — this is an ADDITION of nothing, not a removal.
    expect(screen.getByTestId("mcp-discover-btn")).toBeInTheDocument()
    expect(screen.getByTestId("mcp-grant-status")).toBeInTheDocument()
  })

  it("NON-VACUITY — the ADMIN render has STRICTLY MORE nodes, so the count above can fail", () => {
    // Without this, `33` would be a number that happened to match rather than a budget.
    const { container } = renderPicker()
    expect(container.querySelectorAll("*").length).toBeGreaterThan(BASE_DENIED_NODE_COUNT)
  })
})

describe("206.2-04 · the grant write — REPLACE semantics (D-206.2-16 / T-206.2-04-T1)", () => {
  it("sends the FULL MERGED MAP — SET EQUALITY over the payload keys", async () => {
    // ⚠ connector_service.update_connection_grants does a whole-column REPLACE. A payload
    // carrying only the pressed tool wipes every other grant, and it typechecks perfectly.
    // A SUPERSET check would pass a payload that dropped one, which is exactly the defect,
    // so the assertion is an equality.
    mockUpdateGrants.mockResolvedValueOnce({
      ...mockMcpConnection,
      tool_grants: { ...mockMcpConnection.tool_grants, [deniedTool]: true },
    })
    renderPicker()
    fireEvent.click(screen.getByTestId("mcp-grant-toggle"))
    await waitFor(() => expect(mockUpdateGrants).toHaveBeenCalledTimes(1))
    const [id, payload] = mockUpdateGrants.mock.calls[0] as [string, Record<string, boolean>]
    expect(id).toBe("conn-mcp-1")
    expect(Object.keys(payload).sort()).toStrictEqual([
      "confluence_search",
      "jira_create_issue",
      "jira_delete_issue",
    ])
    expect(payload).toStrictEqual({
      jira_create_issue: true,
      jira_delete_issue: false,
      confluence_search: true,
    })
  })

  it("the merge is derived from the SERVER-OWNED PROP, so a re-rendered row is what is sent", async () => {
    mockUpdateGrants.mockResolvedValue({ ...mockMcpConnection })
    const { rerender } = renderPicker()
    rerender(
      <McpToolPicker
        connection={{ ...mockMcpConnection, tool_grants: { late_arrival: true } }}
        toolName={deniedTool}
      />,
    )
    fireEvent.click(screen.getByTestId("mcp-grant-toggle"))
    await waitFor(() => expect(mockUpdateGrants).toHaveBeenCalledTimes(1))
    const [, payload] = mockUpdateGrants.mock.calls[0] as [string, Record<string, boolean>]
    expect(Object.keys(payload).sort()).toStrictEqual(["confluence_search", "late_arrival"])
  })

  it("busy guard — two rapid presses make exactly ONE call", async () => {
    let settle: (row: unknown) => void = () => {}
    mockUpdateGrants.mockReturnValueOnce(
      new Promise<unknown>((resolve) => {
        settle = resolve
      }),
    )
    renderPicker()
    const toggle = screen.getByTestId("mcp-grant-toggle")
    fireEvent.click(toggle)
    fireEvent.click(toggle)
    expect(mockUpdateGrants).toHaveBeenCalledTimes(1)
    settle({ ...mockMcpConnection })
    await waitFor(() =>
      expect(screen.getByTestId("mcp-grant-toggle")).toHaveAttribute("data-grant-write", "idle"),
    )
  })

  it("NO OPTIMISTIC FLIP — the switch does not move while the write is in flight", () => {
    mockUpdateGrants.mockReturnValueOnce(new Promise(() => {}))
    renderPicker()
    const toggle = screen.getByTestId("mcp-grant-toggle")
    expect(toggle).toHaveAttribute("aria-checked", "false")
    fireEvent.click(toggle)
    expect(screen.getByTestId("mcp-grant-toggle")).toHaveAttribute("aria-checked", "false")
    expect(screen.getByTestId("mcp-grant-toggle")).toHaveAttribute("data-grant-write", "pending")
    expect(screen.getByTestId("mcp-grant-toggle")).toHaveAttribute("aria-busy", "true")
    // The switch does not move, so the reading is REQUIRED — without it the control looks
    // broken to the person who just pressed it.
    expect(screen.getByTestId("mcp-grant-write-state")).toHaveTextContent(MCP_GRANT_SAVING)
    expect(screen.getByTestId("mcp-grant-write-state")).toHaveAttribute("role", "status")
  })

  it("TWO DIRECTIONS, TWO RECEIPTS — a single Saved would hide which way it went", async () => {
    mockUpdateGrants.mockResolvedValueOnce({ ...mockMcpConnection })
    const { unmount } = renderPicker()
    fireEvent.click(screen.getByTestId("mcp-grant-toggle"))
    await waitFor(() =>
      expect(screen.getByTestId("mcp-grant-write-state")).toHaveTextContent(
        MCP_GRANT_RECEIPT_ALLOWED,
      ),
    )
    unmount()

    mockUpdateGrants.mockResolvedValueOnce({ ...mockMcpConnection })
    renderPicker({ toolName: "jira_create_issue" })
    fireEvent.click(screen.getByTestId("mcp-grant-toggle"))
    await waitFor(() =>
      expect(screen.getByTestId("mcp-grant-write-state")).toHaveTextContent(
        MCP_GRANT_RECEIPT_DENIED,
      ),
    )
  })

  it("a FAILED write says so, and the switch is at the server old value — nothing to roll back", async () => {
    mockUpdateGrants.mockRejectedValueOnce(new Error("boom"))
    renderPicker()
    fireEvent.click(screen.getByTestId("mcp-grant-toggle"))
    await waitFor(() =>
      expect(screen.getByTestId("mcp-grant-error")).toHaveTextContent(MCP_GRANT_WRITE_FAILED),
    )
    expect(screen.getByTestId("mcp-grant-error")).toHaveAttribute("role", "alert")
    const toggle = screen.getByTestId("mcp-grant-toggle")
    expect(toggle).toHaveAttribute("aria-checked", "false")
    expect(toggle).toHaveAttribute("data-grant-write", "failed")
  })

  it("the RESPONSE ROW is handed upstream — the freshness route, not an optimisation", async () => {
    // Without this the picker own list keeps the stale row and the NEXT toggle merges from a
    // stale map. A re-fetch nonce is the rejected alternative: the response IS the row.
    const updated = { ...mockMcpConnection, tool_grants: { [deniedTool]: true } }
    mockUpdateGrants.mockResolvedValueOnce(updated)
    const onConnectionUpdated = vi.fn()
    renderPicker({ onConnectionUpdated })
    fireEvent.click(screen.getByTestId("mcp-grant-toggle"))
    await waitFor(() => expect(onConnectionUpdated).toHaveBeenCalledWith(updated))
  })

  it("the switch moves when the ROW it renders from changes, never before", async () => {
    mockUpdateGrants.mockResolvedValueOnce({ ...mockMcpConnection })
    const { rerender } = renderPicker()
    fireEvent.click(screen.getByTestId("mcp-grant-toggle"))
    await waitFor(() => expect(mockUpdateGrants).toHaveBeenCalledTimes(1))
    expect(screen.getByTestId("mcp-grant-toggle")).toHaveAttribute("aria-checked", "false")
    rerender(
      <McpToolPicker
        connection={{ ...mockMcpConnection, tool_grants: { [deniedTool]: true } }}
        toolName={deniedTool}
      />,
    )
    expect(screen.getByTestId("mcp-grant-toggle")).toHaveAttribute("aria-checked", "true")
    expect(screen.getByTestId("mcp-grant-status")).toHaveAttribute("data-granted", "true")
  })

  it("NO TOOL SELECTED — no switch at all; the control is scoped to the chosen tool", () => {
    renderPicker({ toolName: "" })
    expect(screen.queryByTestId("mcp-grant-toggle")).not.toBeInTheDocument()
    expect(screen.queryByTestId("mcp-grant-scope-note")).not.toBeInTheDocument()
  })

  it("THE CONTROL SPENDS NO COLOUR and offers no tooltip", () => {
    renderPicker()
    const toggle = screen.getByTestId("mcp-grant-toggle")
    expect(toggle).not.toHaveAttribute("title")
    expect(toggle.className).not.toMatch(/emerald|amber|bg-success|bg-primary|text-primary/)
    // The switch is OUTSIDE the badge — a control nested in a tinted status chip makes a
    // state reading look like a button, and would put a control inside SC#2c pinned region.
    expect(screen.getByTestId("mcp-grant-status").contains(toggle)).toBe(false)
  })
})
