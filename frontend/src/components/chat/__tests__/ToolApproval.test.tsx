import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { ChatToolApprovalCard } from "../ChatToolApprovalCard"
import * as api from "@/lib/api"

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<any>("@/lib/api")
  return {
    ...actual,
    submitToolApproval: vi.fn(),
  }
})

describe("ChatToolApprovalCard", () => {
  const mockApproval = {
    callId: "call_abc123",
    serviceId: "slack",
    serviceName: "Slack Ops",
    toolName: "post_message",
    args: { message: "Deploying to production" },
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(api.submitToolApproval).mockResolvedValue({
      status: "ok",
      call_id: "call_abc123",
      decision: "allow",
    })
  })

  it("renders tool details and parameter box", () => {
    render(
      <ChatToolApprovalCard
        threadId="thread-123"
        approval={mockApproval}
      />,
    )

    expect(screen.getByText("Slack Ops")).toBeDefined()
    expect(screen.getByText("· post_message")).toBeDefined()
    expect(screen.getByText("Approval Required")).toBeDefined()
    expect(screen.getByText(/Deploying to production/)).toBeDefined()
    expect(screen.getByTestId("approval-allow-btn")).toBeDefined()
    expect(screen.getByTestId("approval-reject-btn")).toBeDefined()
  })

  it("submits allow decision when clicking Allow Action", async () => {
    const onDecision = vi.fn()
    render(
      <ChatToolApprovalCard
        threadId="thread-123"
        approval={mockApproval}
        onDecision={onDecision}
      />,
    )

    fireEvent.click(screen.getByTestId("approval-allow-btn"))

    await waitFor(() => {
      expect(api.submitToolApproval).toHaveBeenCalledWith("thread-123", "call_abc123", "allow", {
        connectionId: undefined,
        toolName: "post_message",
      })
      expect(onDecision).toHaveBeenCalledWith("allow")
      expect(screen.getByText("Approved")).toBeDefined()
    })
  })

  it("submits reject decision when clicking Reject", async () => {
    vi.mocked(api.submitToolApproval).mockResolvedValue({
      status: "ok",
      call_id: "call_abc123",
      decision: "reject",
    })
    const onDecision = vi.fn()
    render(
      <ChatToolApprovalCard
        threadId="thread-123"
        approval={mockApproval}
        onDecision={onDecision}
      />,
    )

    fireEvent.click(screen.getByTestId("approval-reject-btn"))

    await waitFor(() => {
      expect(api.submitToolApproval).toHaveBeenCalledWith("thread-123", "call_abc123", "reject", {
        connectionId: undefined,
        toolName: "post_message",
      })
      expect(onDecision).toHaveBeenCalledWith("reject")
      expect(screen.getByText("Rejected")).toBeDefined()
    })
  })
})

/**
 * ⚠ 2026-08-31 — THE THIRD BUTTON WAS DESIGNED AND NEVER BUILT.
 *
 * `grantsVocabulary.ts` has carried `ASK_ALWAYS` ("Always allow {tool} on this
 * connection") since Phase 213 and the settings panel has offered all three postures for
 * just as long — but this card shipped with Allow and Reject. So the only way to stop
 * being asked the same question was to leave the conversation and change the connection
 * in Settings, for a decision the person was already being asked to make right here.
 *
 * ⚠ AND "ALWAYS" IS TWO ACTS THAT CAN COME APART. Releasing the call needs the thread to
 * be yours; changing a grant needs `org:manage`. The cases below pin the halves as
 * SEPARATE facts, because reporting the setting as changed when it was not is the exact
 * class of lie the connector surface has spent this whole session removing.
 */
describe("ChatToolApprovalCard — Always allow", () => {
  const withConnection = {
    callId: "call_abc123",
    connectionId: "conn-9",
    serviceId: "slack",
    serviceName: "Slack Ops",
    toolName: "post_message",
    args: { message: "Deploying to production" },
  }

  it("sends the 'always' decision NAMING the connection and the tool", async () => {
    vi.mocked(api.submitToolApproval).mockResolvedValue({
      status: "ok", call_id: "call_abc123", decision: "always", grant_persisted: true,
    } as any)
    const onDecision = vi.fn()
    render(
      <ChatToolApprovalCard threadId="t-1" approval={withConnection} onDecision={onDecision} />,
    )
    fireEvent.click(screen.getByTestId("approval-always-btn"))

    await waitFor(() => {
      // ⭐ THE CONNECTION IS NAMED, NOT INFERRED FROM `service_id` — two rows can share a
      // service, and this install has two `slack` connections in different orgs.
      expect(api.submitToolApproval).toHaveBeenCalledWith("t-1", "call_abc123", "always", {
        connectionId: "conn-9",
        toolName: "post_message",
      })
      expect(onDecision).toHaveBeenCalledWith("always")
    })
  })

  it("says 'Always allowed' only when the grant actually persisted", async () => {
    vi.mocked(api.submitToolApproval).mockResolvedValue({
      status: "ok", call_id: "call_abc123", decision: "always", grant_persisted: true,
    } as any)
    render(<ChatToolApprovalCard threadId="t-1" approval={withConnection} />)
    fireEvent.click(screen.getByTestId("approval-always-btn"))
    await waitFor(() => expect(screen.getByText("Always allowed")).toBeDefined())
    expect(screen.queryByTestId("approval-grant-problem")).toBeNull()
  })

  it("⚠ allowed-once-but-setting-unchanged says SO, and does not claim 'Always allowed'", async () => {
    vi.mocked(api.submitToolApproval).mockResolvedValue({
      status: "ok",
      call_id: "call_abc123",
      decision: "always",
      grant_persisted: false,
      grant_problem: "this action was allowed once, but the setting was not changed — " +
        "changing what a connection may do needs an organisation admin",
    } as any)
    render(<ChatToolApprovalCard threadId="t-1" approval={withConnection} />)
    fireEvent.click(screen.getByTestId("approval-always-btn"))

    await waitFor(() => {
      expect(screen.getByTestId("approval-grant-problem")).toBeDefined()
    })
    // ⭐ The run WAS released — the person is not stranded over a permission they did not
    // need for this call.
    expect(screen.getByText("Approved")).toBeDefined()
    // ⭐ And the card does not claim the setting stuck.
    expect(screen.queryByText("Always allowed")).toBeNull()
    expect(screen.getByTestId("approval-grant-problem").textContent).toContain(
      "organisation admin",
    )
  })

  it("offers NO Always button when the approval carries no connection id", () => {
    const { callId, serviceId, serviceName, toolName, args } = withConnection
    render(
      <ChatToolApprovalCard
        threadId="t-1"
        approval={{ callId, serviceId, serviceName, toolName, args }}
      />,
    )
    // ⚠ A run that paused before the field existed has no row to change. Not rendered,
    // rather than rendered and broken — the BUILD-OR-DROP rule in the other direction.
    expect(screen.queryByTestId("approval-always-btn")).toBeNull()
    expect(screen.getByTestId("approval-allow-btn")).toBeDefined()
    expect(screen.getByTestId("approval-reject-btn")).toBeDefined()
  })

  it("names what the setting would change, in the card, before it is clicked", () => {
    render(<ChatToolApprovalCard threadId="t-1" approval={withConnection} />)
    const card = screen.getByTestId("tool-approval-card-call_abc123")
    expect(card.textContent).toContain("post_message")
    expect(card.textContent).toContain("Slack Ops")
  })
})
