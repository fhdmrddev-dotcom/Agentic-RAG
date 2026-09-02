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

/**
 * ⚠ 2026-08-31 — THE CARD WAS TOO LOUD, AND THE SKETCH HAD ALREADY SAID SO.
 *
 * The first three-button cut printed, on every call and permanently: a sentence naming
 * what "Always allow" would change, a `Parameters:` label, and the pretty-printed JSON of
 * every argument — and kept the JSON after the decision, where it answers nothing. Across
 * a conversation with several tool calls that is a wall of braces.
 *
 * `GRANTS_COPY` had specified the fix before the bug existed: `ASK_ARGS_LABEL` ("What it
 * will send") and `ASK_ARGS_MORE` ("Show N more lines") only mean anything as progressive
 * disclosure. The card imported that table and ignored what it implied.
 *
 * ⚠ AND THE ARGUMENTS ARE FOLDED, NEVER HIDDEN. What a tool will send IS the thing being
 * approved; a card that asked for consent while showing nothing would be worse than a
 * noisy one. These cases pin BOTH halves — quiet, and never silent.
 */
describe("ChatToolApprovalCard — quiet by default", () => {
  const manyArgs = {
    callId: "call_x",
    connectionId: "conn-9",
    serviceId: "slack",
    serviceName: "Slack Ops",
    toolName: "post_message",
    args: { channel: "#ops", text: "Deploying", thread_ts: "1", unfurl: "false" },
  }

  it("shows the first two argument lines and folds the rest behind a count", () => {
    render(<ChatToolApprovalCard threadId="t-1" approval={manyArgs} />)
    expect(screen.getByText("channel: #ops")).toBeDefined()
    expect(screen.getByText("text: Deploying")).toBeDefined()
    // ⭐ Folded, not gone — and the count is the copy table's own wording.
    expect(screen.queryByText("thread_ts: 1")).toBeNull()
    expect(screen.getByTestId("approval-args-toggle").textContent).toContain("2 more")
  })

  it("the toggle reveals every remaining line", async () => {
    render(<ChatToolApprovalCard threadId="t-1" approval={manyArgs} />)
    fireEvent.click(screen.getByTestId("approval-args-toggle"))
    await waitFor(() => expect(screen.getByText("thread_ts: 1")).toBeDefined())
    expect(screen.getByText("unfurl: false")).toBeDefined()
    expect(screen.getByTestId("approval-args-toggle").textContent).toContain("Show less")
  })

  it("shows NO toggle when everything already fits", () => {
    render(
      <ChatToolApprovalCard
        threadId="t-1"
        approval={{ ...manyArgs, args: { file_id: "abc" } }}
      />,
    )
    expect(screen.getByText("file_id: abc")).toBeDefined()
    expect(screen.queryByTestId("approval-args-toggle")).toBeNull()
  })

  it("⚠ renders arguments as key: value LINES, never pretty-printed JSON braces", () => {
    render(
      <ChatToolApprovalCard
        threadId="t-1"
        approval={{ ...manyArgs, args: { file_id: "abc" } }}
      />,
    )
    const card = screen.getByTestId("tool-approval-card-call_x")
    // `{"file_id": "abc"}` costs three lines of syntax to carry one fact, and
    // `ASK_ARGS_MORE` counts LINES — so the unit must be one argument.
    expect(card.textContent).not.toContain("Parameters:")
    expect(card.textContent).toContain("What it will send")
  })

  it("⚠ a SETTLED card drops the arguments, the explanation and the buttons", async () => {
    vi.mocked(api.submitToolApproval).mockResolvedValue({
      status: "ok", call_id: "call_x", decision: "allow",
    } as any)
    render(<ChatToolApprovalCard threadId="t-1" approval={manyArgs} />)
    fireEvent.click(screen.getByTestId("approval-allow-btn"))

    await waitFor(() => expect(screen.getByText("Approved")).toBeDefined())
    // The act is done: the arguments answer nothing, and "Nothing has been sent yet" is
    // now simply false.
    expect(screen.queryByText("channel: #ops")).toBeNull()
    expect(screen.queryByText("What it will send")).toBeNull()
    expect(screen.queryByText(/Nothing has been sent yet/)).toBeNull()
    expect(screen.queryByTestId("approval-allow-btn")).toBeNull()
    expect(screen.queryByTestId("approval-always-btn")).toBeNull()
    // ⭐ It still says WHO and WHAT — a receipt, not a disappearance.
    expect(screen.getByText("Slack Ops")).toBeDefined()
    expect(screen.getByText("· post_message")).toBeDefined()
  })

  it("the 'what Always changes' sentence is a tooltip, not permanent body text", () => {
    render(<ChatToolApprovalCard threadId="t-1" approval={manyArgs} />)
    const card = screen.getByTestId("tool-approval-card-call_x")
    expect(card.textContent).not.toContain("changes the setting for")
    expect(screen.getByTestId("approval-always-btn").getAttribute("title")).toContain(
      "post_message",
    )
  })

  it("a long argument value is elided rather than filling the card", () => {
    render(
      <ChatToolApprovalCard
        threadId="t-1"
        approval={{ ...manyArgs, args: { body: "x".repeat(500) } }}
      />,
    )
    const card = screen.getByTestId("tool-approval-card-call_x")
    expect(card.textContent).toContain("…")
    expect(card.textContent!.length).toBeLessThan(600)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════════════
// SEED-235 — the SECOND approval in one run
// ═══════════════════════════════════════════════════════════════════════════════════════
//
// ⛔ THIS IS THE LOAD-BEARING BLOCK IN THIS FILE. It is not a rendering nicety: when this
// property is false a run PARKS FOREVER. The server asks a second question, the card keeps
// the FIRST decision's word, no controls are offered, and `handleDecision` early-returns on
// the stale `decisionState` even if something did click. The run sits in `runs:active` with
// no error and no assistant message — indistinguishable from a dead run, which is exactly
// how it was reported.
//
// REPRODUCED 2026-09-01: one chat turn chained `create_doc` then `append_to_doc`. The first
// approval worked. The second rendered as `append_to_doc · Approved` with no buttons. The
// run's Redis buffer ended on `tool_approval_required` — the server was waiting correctly.
// A page reload (fresh mount, fresh state) rendered the card and approving finished the run.
describe("ChatToolApprovalCard — a NEW call_id is a NEW question", () => {
  const first = {
    callId: "call_first",
    connectionId: "conn-1",
    serviceId: "google",
    serviceName: "Google Workspace",
    toolName: "create_doc",
    args: { title: "Q3 report" },
  }
  const second = {
    ...first,
    callId: "call_second",
    toolName: "append_to_doc",
    args: { document_id: "1abc", content: "written through chat" },
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(api.submitToolApproval).mockResolvedValue({
      status: "ok",
      call_id: "call_first",
      decision: "allow",
      grant_persisted: true,
    } as any)
  })

  it("⭐ after deciding, a DIFFERENT call_id offers its buttons again", async () => {
    const { rerender } = render(<ChatToolApprovalCard threadId="t-1" approval={first} />)

    fireEvent.click(screen.getByTestId("approval-allow-btn"))
    await waitFor(() => expect(screen.queryByTestId("approval-allow-btn")).toBeNull())

    // The run continues and asks about the NEXT tool call.
    rerender(<ChatToolApprovalCard threadId="t-1" approval={second} />)

    expect(screen.getByTestId("approval-allow-btn")).toBeDefined()
    expect(screen.getByTestId("approval-reject-btn")).toBeDefined()
  })

  it("⭐ the second question does not wear the first answer's word", async () => {
    const { rerender } = render(<ChatToolApprovalCard threadId="t-1" approval={first} />)
    fireEvent.click(screen.getByTestId("approval-allow-btn"))
    await waitFor(() => expect(screen.getByTestId("tool-approval-card-call_first").textContent)
      .toContain("Approved"))

    rerender(<ChatToolApprovalCard threadId="t-1" approval={second} />)

    const card = screen.getByTestId("tool-approval-card-call_second")
    expect(card.textContent).not.toContain("Approved")
    expect(card.textContent).toContain("append_to_doc")
  })

  it("⭐ the second question is ANSWERABLE — a stale decision must not gate the submit", async () => {
    // ⚠ `handleDecision` early-returns on `submitting || decisionState`. A card that
    // rendered its buttons but refused to act on them would pass the two tests above and
    // still park the run, so the submit is driven rather than the DOM inspected.
    const { rerender } = render(<ChatToolApprovalCard threadId="t-1" approval={first} />)
    fireEvent.click(screen.getByTestId("approval-allow-btn"))
    await waitFor(() => expect(api.submitToolApproval).toHaveBeenCalledTimes(1))

    rerender(<ChatToolApprovalCard threadId="t-1" approval={second} />)
    fireEvent.click(screen.getByTestId("approval-allow-btn"))

    await waitFor(() => expect(api.submitToolApproval).toHaveBeenCalledTimes(2))
    expect(vi.mocked(api.submitToolApproval).mock.calls[1][1]).toBe("call_second")
  })

  it("the SAME call_id keeps its settled state — this must not reset on every render", async () => {
    // ⚠ The counterweight. Resetting on any prop change would make a settled card flicker
    // back into a question on an unrelated re-render, which is a worse bug than the one
    // being fixed: it would invite a second decision on a call already decided.
    const { rerender } = render(<ChatToolApprovalCard threadId="t-1" approval={first} />)
    fireEvent.click(screen.getByTestId("approval-allow-btn"))
    await waitFor(() => expect(screen.queryByTestId("approval-allow-btn")).toBeNull())

    rerender(<ChatToolApprovalCard threadId="t-1" approval={{ ...first }} />)

    expect(screen.queryByTestId("approval-allow-btn")).toBeNull()
    expect(screen.getByTestId("tool-approval-card-call_first").textContent).toContain("Approved")
  })

  describe("countdown & wire deadline (Phase 224 Plan 03)", () => {
    it("renders ticking countdown clock when timeoutSeconds is provided", () => {
      render(
        <ChatToolApprovalCard
          threadId="t-1"
          approval={{
            ...first,
            timeoutSeconds: 120,
          }}
        />,
      )
      const cd = screen.getByTestId("approval-countdown")
      expect(cd).toBeInTheDocument()
      expect(cd.textContent).toMatch(/remaining/)
    })

    it("renders ticking countdown clock when expiresAt is provided", () => {
      const expiresAt = new Date(Date.now() + 45000).toISOString()
      render(
        <ChatToolApprovalCard
          threadId="t-1"
          approval={{
            ...first,
            expiresAt,
          }}
        />,
      )
      const cd = screen.getByTestId("approval-countdown")
      expect(cd).toBeInTheDocument()
      expect(cd.textContent).toMatch(/45s remaining|44s remaining/)
    })

    it("disables action buttons and shows timed out copy when deadline has passed", () => {
      render(
        <ChatToolApprovalCard
          threadId="t-1"
          approval={{
            ...first,
            connectionId: "conn-1",
            timeoutSeconds: 0,
          }}
        />,
      )
      const cd = screen.getByTestId("approval-countdown")
      expect(cd).toBeInTheDocument()
      expect(cd.textContent).toContain("Approval timed out")

      const allowBtn = screen.getByTestId("approval-allow-btn") as HTMLButtonElement
      const rejectBtn = screen.getByTestId("approval-reject-btn") as HTMLButtonElement
      const alwaysBtn = screen.getByTestId("approval-always-btn") as HTMLButtonElement

      expect(allowBtn.disabled).toBe(true)
      expect(rejectBtn.disabled).toBe(true)
      expect(alwaysBtn.disabled).toBe(true)
    })

    it("gracefully renders standard card when expiresAt and timeoutSeconds are omitted", () => {
      render(
        <ChatToolApprovalCard
          threadId="t-1"
          approval={{
            ...first,
          }}
        />,
      )
      expect(screen.queryByTestId("approval-countdown")).toBeNull()
      expect(screen.getByText("Approval Required")).toBeInTheDocument()

      const allowBtn = screen.getByTestId("approval-allow-btn") as HTMLButtonElement
      expect(allowBtn.disabled).toBe(false)
    })

    it("renders initial settled state when approval carries a decision", () => {
      render(
        <ChatToolApprovalCard
          threadId="t-1"
          approval={{
            ...first,
            decision: "allow",
          }}
        />,
      )
      expect(screen.getByText("Approved")).toBeInTheDocument()
      expect(screen.queryByTestId("approval-allow-btn")).toBeNull()
    })
  })
})
