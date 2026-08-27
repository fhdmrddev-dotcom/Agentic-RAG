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

// 211-04 — the `?raw` self-read this file's new source fence needs. The house idiom
// (`ExternalActionSection.test.tsx:27`), read through the same loader.
import mcpToolPickerSource from "./McpToolPicker?raw"
import {
  McpToolPicker,
  isToolGranted,
  MCP_TOOL_PICKER_HEADING,
  MCP_DISCOVER_BUTTON_LABEL,
  MCP_GRANT_GRANTED_LABEL,
  MCP_GRANT_DENIED_LABEL,
} from "./McpToolPicker"
import type { ConnectorConnection, McpConnectionConfig, ToolGrantPosture } from "@/lib/api"
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
  // ⚠ 211-04 — REQUIRED, not decoration. Plan 211-02 made `service_id` a REQUIRED member of
  // the wire type precisely so a client could not branch on an absence migration 127
  // guarantees cannot exist. This fixture was the ONE typecheck error this plan owns, and it
  // is closed by SATISFYING the contract rather than by softening it to `service_id?`.
  service_id: "atlassian",
  name: "Atlassian MCP",
  config: {} as McpConnectionConfig,
  is_enabled: true,
  mcp_server_url: "https://mcp.atlassian.com/v1",
  default_approval_posture: "ask",
  tool_grants: {
    jira_create_issue: "allow",
    jira_delete_issue: "deny",
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

  // ⚠ REPLACED BY 211-04, AND THE REPLACEMENT IS THE PHASE. The shipped case here read
  // *"renders null if connection has no mcp_server_url"* and it asserted THE DEFECT
  // D-211-12 removes: a bound capability connection carrying a perfectly-shaped
  // `discovered_tools` list rendered NOTHING, so plan 211-01's descriptors could never be
  // displayed. The card now gates on BOUNDNESS; the endpoint decides nothing about
  // rendering anywhere in this component. Its replacement is the pair below — the positive
  // (a bound capability row DOES render) and the honest negative (no connection at all).
  it("renders the card for a bound connection with NO mcp_server_url (D-211-12)", () => {
    const nonMcpConn: ConnectorConnection = {
      ...mockMcpConnection,
      mcp_server_url: null,
    }
    render(<McpToolPicker connection={nonMcpConn} />)
    expect(screen.getByTestId("mcp-tool-picker")).toBeInTheDocument()
  })

  it("NEGATIVE CONTROL — a null connection renders nothing at all", () => {
    const { container } = render(<McpToolPicker connection={null} />)
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
      jira_create_issue: "allow",
      jira_delete_issue: "deny",
      confluence_search: "allow",
    })
  })

  it("the merge is derived from the SERVER-OWNED PROP, so a re-rendered row is what is sent", async () => {
    mockUpdateGrants.mockResolvedValue({ ...mockMcpConnection })
    const { rerender } = renderPicker()
    rerender(
      <McpToolPicker
        connection={{ ...mockMcpConnection, tool_grants: { late_arrival: "allow" } }}
        toolName={deniedTool}
      />,
    )
    fireEvent.click(screen.getByTestId("mcp-grant-toggle"))
    await waitFor(() => expect(mockUpdateGrants).toHaveBeenCalledTimes(1))
    const [, payload] = mockUpdateGrants.mock.calls[0] as [string, Record<string, ToolGrantPosture>]
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
        connection={{ ...mockMcpConnection, tool_grants: { [deniedTool]: "allow" } }}
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

// ═══════════════════════════════════════════════════════════════════════════════════════
// ⚠ ADDED, NEVER RE-BASELINED — 211-04 (D-211-12 / T-211-22), the closed loop.
//
// THE DEFECT THIS BLOCK EXISTS TO MAKE UNREPEATABLE. D-211-12 says the picker must read the
// TOOL LIST rather than the endpoint. The NAIVE form of that — *render when
// `discovered_tools.length > 0`, else return `null`* — creates a state whose only remedy is a
// control that state has hidden: the list is empty, so the card returns null, so the Refresh
// button (which lives AFTER the early return) never renders, so nothing can populate the list.
// It was caught in plan review rather than in production, and these cases are what stop it
// coming back.
//
// ⚠ EVERY CASE BELOW USES THE **REAL EMPTY-ARRAY SHAPE A SHIPPED ROW CARRIES** — `[]`, never a
// synthetic populated fixture. A populated fixture is exactly what would have let the closed
// loop ship: it can never reach the branch that returns null.
// ═══════════════════════════════════════════════════════════════════════════════════════

/** The LEGACY shape — a first-party capability connection as it exists on disk after
 *  migration 127 §2b. `capability` is set, there is NO `mcp_server_url`, and the action list
 *  is the one thing that varies between the two cases below. */
const legacyConnection: ConnectorConnection = {
  id: "conn-slack-1",
  org_id: "org-1",
  service_id: "slack",
  capability: "post_message",
  name: "#ops-alerts",
  config: {} as McpConnectionConfig,
  is_enabled: true,
  mcp_server_url: null,
  default_approval_posture: "ask",
  tool_grants: {},
  discovered_tools: [],
}

/** Plan 211-01's descriptor, in its REAL four-key shape — `name` / `title` / `description` /
 *  `inputSchema`, with `required` arriving INSIDE `inputSchema` because `inputSchema` IS the
 *  adapter's own declaration (211-01: "no REQUIRED_ARGS constant exists anywhere"). Mirrored
 *  rather than invented, which is what makes the populated case a proof about the wire. */
const POST_MESSAGE_DESCRIPTOR = {
  name: "post_message",
  title: "Post message",
  description: "Post one plain-text message to the channel configured on this connection.",
  inputSchema: {
    type: "object",
    additionalProperties: false,
    required: ["text"],
    properties: { text: { type: "string" } },
  },
}

describe("211-04 · the action card renders for EVERY bound shape (D-211-12)", () => {
  it("⭐ LEGACY + EMPTY LIST — the card, the sentence AND an enabled Refresh control", () => {
    // ⭐ THE CASE THE REST OF THE PHASE STRUCTURALLY CANNOT PRODUCE. Every other fixture in
    // this phase is pre-populated, and a pre-populated fixture can never reach the branch
    // that would return null. This is the row shape that existed before migration 127 — and
    // the row shape a FAILED descriptor write, or a capability added by a later phase with
    // no backfill, still produces today.
    render(<McpToolPicker connection={legacyConnection} toolName="" />)
    expect(screen.getByTestId("mcp-tool-picker")).toBeInTheDocument()
    expect(screen.getByTestId("mcp-no-tools")).toHaveTextContent(MCP_NO_TOOLS_DISCOVERED)
    const refresh = screen.getByTestId("mcp-discover-btn")
    expect(refresh).toBeInTheDocument()
    expect(refresh).not.toBeDisabled()
  })

  it("⭐ LEGACY + ONE DESCRIPTOR — the action is listed, by its human label", () => {
    render(
      <McpToolPicker
        connection={{ ...legacyConnection, discovered_tools: [POST_MESSAGE_DESCRIPTOR] }}
        toolName=""
      />,
    )
    const toolSelect = screen.getByTestId("mcp-tool-select") as HTMLSelectElement
    // The WIRE VALUE is the tool's `name`; the LABEL is its `title`. Both are asserted,
    // because binding writes the value and the author reads the label.
    expect(Array.from(toolSelect.options).map((o) => o.value)).toContain("post_message")
    expect(screen.getByText("Post message")).toBeInTheDocument()
    expect(screen.queryByTestId("mcp-no-tools")).not.toBeInTheDocument()
  })

  it("a tool with NO title falls back to its name — `title` is optional on the wire", () => {
    // 211-02's type makes `title` optional and its ABSENCE meaningful: the sanitizer omits
    // the key entirely for a blank or non-string, so `name` must stay a reachable fallback.
    render(
      <McpToolPicker
        connection={{ ...legacyConnection, discovered_tools: [{ name: "bare_tool" }] }}
        toolName=""
      />,
    )
    expect(screen.getByText("bare_tool")).toBeInTheDocument()
  })

  it("⭐ THE REFRESH CONTROL REALLY REACHES THE ENDPOINT ON THE LEGACY SHAPE", async () => {
    // ⭐ `handleDiscover` is the ONLY caller of `POST /connections/{id}/discover` in the whole
    // product, so this press is what makes plan 211-02's capability arm reachable at all.
    // Without it, a capability row whose action list is empty could never be repaired from
    // inside the product.
    mockDiscover.mockResolvedValueOnce([POST_MESSAGE_DESCRIPTOR])
    render(<McpToolPicker connection={legacyConnection} toolName="" />)
    fireEvent.click(screen.getByTestId("mcp-discover-btn"))
    await waitFor(() => {
      expect(mockDiscover).toHaveBeenCalledWith("conn-slack-1")
      expect(screen.getByText("Post message")).toBeInTheDocument()
    })
  })

  it("MEMBER + LEGACY + EMPTY — no Refresh control, and the member's own sentence", () => {
    mockUseOrgOptional.mockReturnValue(orgValue({ canManage: false, role: "member" }))
    render(<McpToolPicker connection={legacyConnection} toolName="" />)
    expect(screen.getByTestId("mcp-tool-picker")).toBeInTheDocument()
    expect(screen.queryByTestId("mcp-discover-btn")).not.toBeInTheDocument()
    expect(screen.getByTestId("mcp-no-tools")).toHaveTextContent(MCP_NO_TOOLS_ADMIN_ONLY)
  })

  it("⭐ THE LOOP CANNOT CLOSE ON EITHER SHAPE — empty list, Refresh present, both times", () => {
    // The invariant stated once, over both shapes: there is NO state in which the only way to
    // populate the list is a control the empty list has hidden.
    for (const row of [
      legacyConnection,
      { ...mockMcpConnection, discovered_tools: [] },
    ] as ConnectorConnection[]) {
      const { unmount } = render(<McpToolPicker connection={row} toolName="" />)
      expect(screen.getByTestId("mcp-no-tools")).toBeInTheDocument()
      expect(screen.getByTestId("mcp-discover-btn")).toBeEnabled()
      unmount()
    }
  })

  it("the endpoint decides NOTHING about rendering — source fence over the component", () => {
    // Asserted MECHANICALLY, because the failure mode is a future editor re-introducing the
    // gate as a "harmless" guard somewhere lower in the tree. Comment lines are stripped
    // first: this component's docblocks NAME the field it must not branch on.
    const live = mcpToolPickerSource
      .split("\n")
      .filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line))
      .join("\n")
    // ⚠ THE NEEDLE IS ASSEMBLED AT RUNTIME — the 187-24 trap. Spelling it whole would put the
    // token into a file that also `?raw`-reads its own subject's siblings.
    const needle = "mcp_server" + "_url"
    expect(live).not.toContain(needle)
    // POSITIVE CONTROL — the needle really can find the gate it forbids.
    expect(`if (!connection?.${needle}) return null`).toContain(needle)
    // …and the haystack is this component's real source.
    expect(mcpToolPickerSource).toContain("export function McpToolPicker")
  })
})

describe("211-04 · the grant surface follows the ENFORCEMENT, not the card (Rule 2)", () => {
  it("⚠ grantsEnforced=false — no badge, no switch, no scope note, no refusal sentence", () => {
    // ⚠ THE BADGE WOULD OTHERWISE BE A MEASURED LIE. `phase_types.py`'s grant gate lives
    // INSIDE `if getattr(connection, "mcp_server_url", None):`, so `tool_grants` is not
    // consulted at all on the capability path — a step bound to a legacy connection is NOT
    // "refused by policy at run time", whatever the map says. Before this plan the card never
    // rendered for such a row, so the sentence could not appear; making the card render is
    // what creates the obligation, and it is discharged here rather than shipped.
    render(
      <McpToolPicker
        connection={{ ...legacyConnection, discovered_tools: [POST_MESSAGE_DESCRIPTOR] }}
        toolName="post_message"
        grantsEnforced={false}
      />,
    )
    for (const id of [
      "mcp-grant-status",
      "mcp-grant-toggle",
      "mcp-grant-scope-note",
      "mcp-grant-admin-only",
    ]) {
      expect(screen.queryByTestId(id), id).not.toBeInTheDocument()
    }
    // …and the rest of the chosen-tool surface is UNAFFECTED: the description and the
    // arguments editor are facts about the tool, not about a permission.
    expect(screen.getByTestId("mcp-tool-description")).toBeInTheDocument()
    expect(screen.getByTestId("mcp-tool-args")).toBeInTheDocument()
  })

  it("NON-VACUITY — the DEFAULT still renders the whole grant surface", () => {
    // Without this, `grantsEnforced={false}` above would pass against a component that had
    // simply stopped rendering the grant control for everybody.
    render(
      <McpToolPicker
        connection={{ ...legacyConnection, discovered_tools: [POST_MESSAGE_DESCRIPTOR] }}
        toolName="post_message"
      />,
    )
    expect(screen.getByTestId("mcp-grant-status")).toBeInTheDocument()
    expect(screen.getByTestId("mcp-grant-toggle")).toBeInTheDocument()
    expect(screen.getByTestId("mcp-grant-scope-note")).toBeInTheDocument()
  })
})
