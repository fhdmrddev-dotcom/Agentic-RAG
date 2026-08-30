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
      expect(api.submitToolApproval).toHaveBeenCalledWith("thread-123", "call_abc123", "allow")
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
      expect(api.submitToolApproval).toHaveBeenCalledWith("thread-123", "call_abc123", "reject")
      expect(onDecision).toHaveBeenCalledWith("reject")
      expect(screen.getByText("Rejected")).toBeDefined()
    })
  })
})
