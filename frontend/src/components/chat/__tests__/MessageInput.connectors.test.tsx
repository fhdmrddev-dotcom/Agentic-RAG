import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { MessageInput } from "../MessageInput"
import * as api from "@/lib/api"

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<any>("@/lib/api")
  return {
    ...actual,
    listConnectorConnections: vi.fn(),
  }
})

describe("MessageInput Connectors & Plus Menu", () => {
  const mockConnections = [
    {
      id: "conn-1",
      org_id: "org-1",
      name: "Slack Ops",
      service_id: "slack",
      capability: "post_message",
      is_enabled: true,
      config: { default_channel: "general" },
      created_at: "2026-08-30T00:00:00Z",
      updated_at: "2026-08-30T00:00:00Z",
    },
    {
      id: "conn-2",
      org_id: "org-1",
      name: "Google Workspace",
      service_id: "google_workspace",
      capability: null,
      is_enabled: true,
      config: {},
      created_at: "2026-08-30T00:00:00Z",
      updated_at: "2026-08-30T00:00:00Z",
    },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    if (!Element.prototype.hasPointerCapture) Element.prototype.hasPointerCapture = () => false
    if (!Element.prototype.setPointerCapture) Element.prototype.setPointerCapture = () => {}
    if (!Element.prototype.releasePointerCapture) Element.prototype.releasePointerCapture = () => {}
    if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {}
    vi.mocked(api.listConnectorConnections).mockResolvedValue(mockConnections as any)
  })

  it("renders the plus menu button and opens connectors flyout", async () => {
    const user = userEvent.setup()
    render(<MessageInput onSend={vi.fn()} disabled={false} />)

    const plusBtn = screen.getByTestId("composer-plus-btn")
    expect(plusBtn).toBeDefined()

    // Open dropdown via userEvent
    await user.click(plusBtn)

    await waitFor(() => {
      expect(screen.getByText("Connectors")).toBeDefined()
      expect(screen.getByText("Slack Ops")).toBeDefined()
      expect(screen.getByText("Google Workspace")).toBeDefined()
    })
  })

  it("toggles connector and displays active connector chip", async () => {
    const user = userEvent.setup()
    const onSend = vi.fn()
    render(<MessageInput onSend={onSend} disabled={false} />)

    // Open flyout
    await user.click(screen.getByTestId("composer-plus-btn"))

    const toggle = await screen.findByTestId("connector-toggle-conn-1")
    expect(toggle).toBeDefined()

    // Toggle Slack connector ON
    await user.click(toggle)

    // Verify chip renders
    await waitFor(() => {
      expect(screen.getByTestId("active-connector-chip-conn-1")).toBeDefined()
    })

    // Type and send message
    const textarea = screen.getByPlaceholderText("Ask anything…")
    await user.type(textarea, "Post a message to team")
    await user.click(screen.getByTestId("composer-send"))

    expect(onSend).toHaveBeenCalledWith("Post a message to team", ["conn-1"])
  })

  it("removes active connector when clicking chip dismiss button", async () => {
    const user = userEvent.setup()
    render(<MessageInput onSend={vi.fn()} disabled={false} />)

    // Open flyout & toggle on
    await user.click(screen.getByTestId("composer-plus-btn"))
    const toggle = await screen.findByTestId("connector-toggle-conn-1")
    await user.click(toggle)

    await waitFor(() => {
      expect(screen.getByTestId("active-connector-chip-conn-1")).toBeDefined()
    })

    // Click remove on chip
    const removeBtn = screen.getByLabelText("Remove Slack Ops")
    await user.click(removeBtn)

    await waitFor(() => {
      expect(screen.queryByTestId("active-connector-chip-conn-1")).toBeNull()
    })
  })
})
