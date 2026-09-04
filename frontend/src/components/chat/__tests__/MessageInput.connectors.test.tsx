import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { MessageInput, _resetComposerDraftsForTest } from "../MessageInput"
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
    _resetComposerDraftsForTest()
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

/**
 * ⚠ 2026-08-31 — THE COMPOSER'S OFF STATE MEANT "ALL", WHICH IS THE OPPOSITE.
 *
 * `onSend(trimmed, ids.length > 0 ? ids : undefined)` here, `...(ids && ids.length > 0)`
 * in `api/threads.ts`, and an `else` arm in `agent_loop.py` that offered EVERY enabled
 * connection when the field was absent. Three layers, each individually defensible,
 * together meaning that selecting NOTHING asked for EVERYTHING — and the composer's
 * initial state is an empty list, so it was true of every message ever sent from a fresh
 * one. The operator caught it: a chat about local files searched Google Drive on a
 * connection they had never switched on.
 *
 * These cases pin the FRONTEND half at the only place it is observable — the argument
 * handed to `onSend`. The backend half is fenced separately
 * (`test_chat_connector_scoping.py`), because that is the boundary that actually decides.
 */
describe("MessageInput — an empty connector selection means NONE, never all", () => {
  it("sends an EMPTY ARRAY, not undefined, when nothing is selected", async () => {
    const user = userEvent.setup()
    const onSend = vi.fn()
    render(<MessageInput onSend={onSend} disabled={false} />)
    await waitFor(() => expect(api.listConnectorConnections).toHaveBeenCalled())

    const box = screen.getByPlaceholderText("Ask anything…")
    await user.type(box, "what files do I have")
    await user.click(screen.getByTestId("composer-send"))

    // ⭐ THE LOAD-BEARING ASSERTION. `undefined` here reached a backend arm that read it
    // as "every enabled connection"; `[]` is the person saying none, and says so.
    expect(onSend).toHaveBeenCalledWith("what files do I have", [])
    expect(onSend).not.toHaveBeenCalledWith("what files do I have", undefined)
  })

  it("still sends exactly the ids that are lit", async () => {
    const user = userEvent.setup()
    const onSend = vi.fn()
    render(<MessageInput onSend={onSend} disabled={false} />)
    await waitFor(() => expect(api.listConnectorConnections).toHaveBeenCalled())

    await user.click(screen.getByTestId("composer-plus-btn"))
    await user.click(await screen.findByTestId("connector-toggle-conn-1"))

    const box = screen.getByPlaceholderText("Ask anything…")
    await user.type(box, "post it")
    await user.click(screen.getByTestId("composer-send"))
    expect(onSend).toHaveBeenCalledWith("post it", ["conn-1"])
  })
})

describe("MessageInput — Decision 2 armed connectors restoration", () => {
  it("restores armed connectors from the last user message when unvisited in session", async () => {
    const onSend = vi.fn()
    const messages = [
      { id: "1", role: "user", content: "first", activeConnectorIds: ["conn-1"] },
      { id: "2", role: "assistant", content: "reply" },
    ] as any

    render(<MessageInput onSend={onSend} disabled={false} threadId="thread-1" messages={messages} />)
    await waitFor(() => expect(api.listConnectorConnections).toHaveBeenCalled())

    await waitFor(() => {
      expect(screen.getByTestId("active-connector-chip-conn-1")).toBeDefined()
    })
  })

  it("restores empty array when the last user message was explicitly cleared ([])", async () => {
    const onSend = vi.fn()
    const messages = [
      { id: "1", role: "user", content: "first with connectors", activeConnectorIds: ["conn-1"] },
      { id: "2", role: "assistant", content: "reply" },
      { id: "3", role: "user", content: "second cleared", activeConnectorIds: [] },
      { id: "4", role: "assistant", content: "reply 2" },
    ] as any

    render(<MessageInput onSend={onSend} disabled={false} threadId="thread-2" messages={messages} />)
    await waitFor(() => expect(api.listConnectorConnections).toHaveBeenCalled())

    expect(screen.queryByTestId("active-connector-chip-conn-1")).toBeNull()
  })

  it("ignores trailing assistant messages without activeConnectorIds", async () => {
    const onSend = vi.fn()
    const messages = [
      { id: "1", role: "user", content: "search drive", activeConnectorIds: ["conn-2"] },
      { id: "2", role: "assistant", content: "found 3 files" },
    ] as any

    render(<MessageInput onSend={onSend} disabled={false} threadId="thread-3" messages={messages} />)
    await waitFor(() => expect(api.listConnectorConnections).toHaveBeenCalled())

    await waitFor(() => {
      expect(screen.getByTestId("active-connector-chip-conn-2")).toBeDefined()
    })
  })

  it("respects Map.has() when user explicitly disarms in session, never re-arming from messages", async () => {
    const user = userEvent.setup()
    const onSend = vi.fn()
    const messages = [
      { id: "1", role: "user", content: "initial", activeConnectorIds: ["conn-1"] },
      { id: "2", role: "assistant", content: "reply" },
    ] as any

    const { rerender } = render(
      <MessageInput onSend={onSend} disabled={false} threadId="thread-4" messages={messages} />,
    )
    await waitFor(() => expect(api.listConnectorConnections).toHaveBeenCalled())
    await waitFor(() => expect(screen.getByTestId("active-connector-chip-conn-1")).toBeDefined())

    // Explicitly remove connector in session
    const removeBtn = screen.getByLabelText("Remove Slack Ops")
    await user.click(removeBtn)
    await waitFor(() => expect(screen.queryByTestId("active-connector-chip-conn-1")).toBeNull())

    // Switch to another thread and switch back
    rerender(<MessageInput onSend={onSend} disabled={false} threadId="thread-other" messages={[]} />)
    rerender(<MessageInput onSend={onSend} disabled={false} threadId="thread-4" messages={messages} />)

    // Must REMAIN disarmed (empty array in Map.has()) — SC#2 guard
    expect(screen.queryByTestId("active-connector-chip-conn-1")).toBeNull()
  })
})

