/**
 * Phase 287-03 Task 2 (START-01 / A-01, A-09, D-07) - the in-thread workflow starter hook.
 *
 * The hook lists on open, decides form-or-start per declared inputs, and calls the provider's
 * `sendMessage` UN-AWAITED with the fixed kickoff text `Run <name>`. It never creates a thread
 * and never reads the conversation.
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook, act, waitFor } from "@testing-library/react"

const { mockList, mockSend } = vi.hoisted(() => ({
  mockList: vi.fn(),
  mockSend: vi.fn(),
}))

vi.mock("@/lib/api", async (importActual) => {
  const actual = await importActual<typeof import("@/lib/api")>()
  return { ...actual, listPublishedWorkflows: mockList }
})
vi.mock("@/providers/StreamsProvider", async (importActual) => {
  const actual = await importActual<typeof import("@/providers/StreamsProvider")>()
  return { ...actual, useStreamActions: () => ({ sendMessage: mockSend }) }
})

import { useStartWorkflowInThread } from "../useStartWorkflowInThread"
import { useStreamsStore } from "@/stores/streamsStore"

const PLAIN = { id: "wf-plain", slug: "plain", name: "Plain flow", definition: {} }
const DECLARED = {
  id: "wf-decl",
  slug: "decl",
  name: "Mail flow",
  definition: { inputs: [{ key: "to", label: "Recipient", required: true }] },
}

beforeEach(() => {
  vi.clearAllMocks()
  mockList.mockResolvedValue([PLAIN, DECLARED])
  mockSend.mockReturnValue(new Promise(() => {}))
})

describe("useStartWorkflowInThread", () => {
  it("makes no network call until opened", () => {
    renderHook(() => useStartWorkflowInThread("t-1"))
    expect(mockList).not.toHaveBeenCalled()
  })

  it("lists published workflows when opened", async () => {
    const { result } = renderHook(() => useStartWorkflowInThread("t-1"))
    act(() => result.current.openPicker())
    await waitFor(() => expect(result.current.workflows).toHaveLength(2))
    expect(mockList).toHaveBeenCalledTimes(1)
  })

  it("surfaces a list failure in words", async () => {
    mockList.mockRejectedValue(new Error("boom"))
    const { result } = renderHook(() => useStartWorkflowInThread("t-1"))
    act(() => result.current.openPicker())
    await waitFor(() => expect(result.current.error).toMatch(/could not load/i))
  })

  it("a workflow with no declared inputs starts immediately, un-awaited, on this thread", async () => {
    const { result } = renderHook(() => useStartWorkflowInThread("t-1"))
    act(() => result.current.openPicker())
    await waitFor(() => expect(result.current.workflows).toHaveLength(2))
    act(() => result.current.pick(PLAIN))
    expect(mockSend).toHaveBeenCalledTimes(1)
    expect(mockSend).toHaveBeenCalledWith("t-1", "Run Plain flow", {
      workflowDefinitionId: "wf-plain",
      inputs: {},
      surfaceId: "chat",
    })
    expect(result.current.pending).toBeNull()
  })

  it("a workflow with declared inputs waits for the form instead of sending", async () => {
    const { result } = renderHook(() => useStartWorkflowInThread("t-1"))
    act(() => result.current.openPicker())
    await waitFor(() => expect(result.current.workflows).toHaveLength(2))
    act(() => result.current.pick(DECLARED))
    expect(mockSend).not.toHaveBeenCalled()
    expect(result.current.pending?.id).toBe("wf-decl")
    act(() => result.current.start(DECLARED, { to: "a@b.test" }))
    expect(mockSend).toHaveBeenCalledWith("t-1", "Run Mail flow", {
      workflowDefinitionId: "wf-decl",
      inputs: { to: "a@b.test" },
      surfaceId: "chat",
    })
  })

  it("cancelling the form sends nothing", async () => {
    const { result } = renderHook(() => useStartWorkflowInThread("t-1"))
    act(() => result.current.openPicker())
    await waitFor(() => expect(result.current.workflows).toHaveLength(2))
    act(() => result.current.pick(DECLARED))
    act(() => result.current.cancelForm())
    expect(result.current.pending).toBeNull()
    expect(mockSend).not.toHaveBeenCalled()
  })

  it("a second start while starting is ignored (double-fire guard)", async () => {
    const { result } = renderHook(() => useStartWorkflowInThread("t-1"))
    act(() => result.current.openPicker())
    await waitFor(() => expect(result.current.workflows).toHaveLength(2))
    act(() => result.current.start(PLAIN, {}))
    act(() => result.current.start(PLAIN, {}))
    expect(mockSend).toHaveBeenCalledTimes(1)
    expect(result.current.starting).toBe(true)
  })
})

/**
 * 296-04 (287-WR-02 / 287-IN-03) — a refused in-thread start is the hook's to word.
 *
 * Two shapes reach the hook. A REJECTION of the send promise (classified by its HTTP status), and
 * the real provider's own shape: it catches the refusal, records it per thread (`reconcileErrors`)
 * and stashes the sent text as a failed draft, which ChatArea then pre-fills into the composer.
 * For a kickoff that text is `Run <name>`, and a person pressing Send on it posts a plain chat
 * message. So the hook takes the failure over and the composer is never pre-filled with it.
 */
describe("useStartWorkflowInThread — 296-04: a refused start is worded, never pre-filled", () => {
  class FakeApiError extends Error {
    status: number
    constructor(message: string, status: number) {
      super(message)
      this.status = status
    }
  }

  async function startPlain(result: { current: ReturnType<typeof useStartWorkflowInThread> }) {
    act(() => result.current.openPicker())
    await waitFor(() => expect(result.current.workflows).toHaveLength(2))
    act(() => result.current.start(PLAIN, {}))
  }

  beforeEach(() => {
    useStreamsStore.setState({ failedSendDrafts: new Map(), reconcileErrors: new Map() })
  })

  it.each([
    [409, "locked", "A workflow is already running in this thread, so Plain flow didn't start."],
    [422, "inputs", "Plain flow didn't start because some of its inputs weren't accepted."],
    [500, "failed", "Plain flow didn't start. Nothing ran."],
  ] as const)("a rejected send (%s) becomes failure %s with its sentence", async (status, kind, message) => {
    mockSend.mockRejectedValue(new FakeApiError("x", status))
    const { result } = renderHook(() => useStartWorkflowInThread("t-1"))
    await startPlain(result)
    await waitFor(() => expect(result.current.failure).toEqual({ kind, message }))
    expect(result.current.starting).toBe(false)
  })

  it("296 review FE-CR-01: the provider's kickoff refusal (error, no draft) is worded by the hook", async () => {
    mockSend.mockImplementation(async (threadId: string) => {
      useStreamsStore.setState((s) => ({
        reconcileErrors: new Map(s.reconcileErrors).set(threadId, new FakeApiError("refused", 422)),
      }))
    })
    const { result } = renderHook(() => useStartWorkflowInThread("t-1"))
    await startPlain(result)
    await waitFor(() => expect(result.current.failure?.kind).toBe("inputs"))
    expect(useStreamsStore.getState().reconcileErrors.has("t-1")).toBe(false)
  })

  it("a new reconcile failure (500) during the start is not mistaken for a refusal", async () => {
    mockSend.mockImplementation(async (threadId: string) => {
      useStreamsStore.setState((s) => ({
        reconcileErrors: new Map(s.reconcileErrors).set(threadId, new FakeApiError("snapshot", 500)),
      }))
    })
    const { result } = renderHook(() => useStartWorkflowInThread("t-1"))
    await startPlain(result)
    await waitFor(() => expect(result.current.starting).toBe(false))
    expect(result.current.failure).toBeNull()
  })

  it("the provider's own failure shape: the hook words it and the composer is NOT pre-filled", async () => {
    mockSend.mockImplementation(async (threadId: string, content: string) => {
      useStreamsStore.setState((s) => ({
        reconcileErrors: new Map(s.reconcileErrors).set(threadId, new FakeApiError("refused", 422)),
        failedSendDrafts: new Map(s.failedSendDrafts).set(threadId, content),
      }))
    })
    const { result } = renderHook(() => useStartWorkflowInThread("t-1"))
    await startPlain(result)
    await waitFor(() => expect(result.current.failure?.kind).toBe("inputs"))
    expect(
      useStreamsStore.getState().failedSendDrafts.get("t-1"),
      "the composer would be pre-filled with the kickoff text",
    ).toBeUndefined()
  })

  it("a send that succeeds leaves no failure", async () => {
    mockSend.mockResolvedValue(undefined)
    const { result } = renderHook(() => useStartWorkflowInThread("t-1"))
    await startPlain(result)
    await waitFor(() => expect(result.current.starting).toBe(false))
    expect(result.current.failure).toBeNull()
  })

  it("no unhandled rejection escapes the send chain", async () => {
    const unhandled = vi.fn()
    process.on("unhandledRejection", unhandled)
    try {
      mockSend.mockRejectedValue(new FakeApiError("x", 500))
      const { result } = renderHook(() => useStartWorkflowInThread("t-1"))
      await startPlain(result)
      await waitFor(() => expect(result.current.failure).not.toBeNull())
      await new Promise((r) => setTimeout(r, 0))
      expect(unhandled).not.toHaveBeenCalled()
    } finally {
      process.off("unhandledRejection", unhandled)
    }
  })

  it("Dismiss clears the failure", async () => {
    mockSend.mockRejectedValue(new FakeApiError("x", 500))
    const { result } = renderHook(() => useStartWorkflowInThread("t-1"))
    await startPlain(result)
    await waitFor(() => expect(result.current.failure).not.toBeNull())
    act(() => result.current.dismiss())
    expect(result.current.failure).toBeNull()
  })

  it("Retry after a plain failure re-calls start with the same workflow and inputs", async () => {
    mockSend.mockRejectedValueOnce(new FakeApiError("x", 500))
    const { result } = renderHook(() => useStartWorkflowInThread("t-1"))
    act(() => result.current.openPicker())
    await waitFor(() => expect(result.current.workflows).toHaveLength(2))
    act(() => result.current.start(DECLARED, { to: "a@b.test" }))
    await waitFor(() => expect(result.current.failure?.kind).toBe("failed"))
    mockSend.mockReturnValue(new Promise(() => {}))
    act(() => result.current.retry())
    expect(mockSend).toHaveBeenCalledTimes(2)
    expect(mockSend.mock.calls[1][2]).toEqual({ workflowDefinitionId: "wf-decl", inputs: { to: "a@b.test" }, surfaceId: "chat" })
    expect(result.current.failure).toBeNull()
  })

  it("Retry after a 422 re-opens the form with the typed values", async () => {
    mockSend.mockRejectedValueOnce(new FakeApiError("x", 422))
    const { result } = renderHook(() => useStartWorkflowInThread("t-1"))
    act(() => result.current.openPicker())
    await waitFor(() => expect(result.current.workflows).toHaveLength(2))
    act(() => result.current.start(DECLARED, { to: "a@b.test" }))
    await waitFor(() => expect(result.current.failure?.kind).toBe("inputs"))
    act(() => result.current.retry())
    expect(result.current.pending?.id).toBe("wf-decl")
    expect(result.current.pendingValues).toEqual({ to: "a@b.test" })
    expect(mockSend).toHaveBeenCalledTimes(1)
  })

  it("no Retry while locked: retry() does nothing", async () => {
    mockSend.mockRejectedValueOnce(new FakeApiError("x", 409))
    const { result } = renderHook(() => useStartWorkflowInThread("t-1"))
    await startPlain(result)
    await waitFor(() => expect(result.current.failure?.kind).toBe("locked"))
    act(() => result.current.retry())
    expect(mockSend).toHaveBeenCalledTimes(1)
  })
})
