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
  // 302-02: a 409 lock carries the code the real provider's lock arm stamps (FE-IN-01 / D-26).
  class FakeApiError extends Error {
    status: number
    code?: string
    constructor(message: string, status: number, code?: string) {
      super(message)
      this.status = status
      this.code = code ?? (status === 409 ? "workflow_locked" : undefined)
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

/**
 * 298-02 (ORG-05 / D-14 / UI-D12) — the ONE refusal the hook shows in the server's words.
 *
 * A workflow bound to a folder in another organization is refused with a 422 carrying the code
 * `folder_in_other_org` and a sentence authored server-side for exactly this surface (it names the
 * folder, and its org only when the person can see it). Every other 422 still reads
 * "some of its inputs weren't accepted" — the code, never the prose, decides which.
 */
describe("useStartWorkflowInThread — 298-02: a folder refusal shows the server's sentence", () => {
  const SENTENCE =
    "“Q3 Contracts” is in Acme Legal, not in this workflow's organization (Personal). Pick a folder from Personal."

  class CodedApiError extends Error {
    status: number
    code?: string
    constructor(message: string, status: number, code?: string) {
      super(message)
      this.status = status
      this.code = code
    }
  }

  beforeEach(() => {
    useStreamsStore.setState({ failedSendDrafts: new Map(), reconcileErrors: new Map() })
  })

  async function startPlain(result: { current: ReturnType<typeof useStartWorkflowInThread> }) {
    act(() => result.current.openPicker())
    await waitFor(() => expect(result.current.workflows).toHaveLength(2))
    act(() => result.current.start(PLAIN, {}))
  }

  it("a rejected send carrying the code → kind folder, the server's message verbatim", async () => {
    mockSend.mockRejectedValue(new CodedApiError(SENTENCE, 422, "folder_in_other_org"))
    const { result } = renderHook(() => useStartWorkflowInThread("t-1"))
    await startPlain(result)
    await waitFor(() =>
      expect(result.current.failure).toEqual({ kind: "folder", message: SENTENCE }),
    )
  })

  it("the provider's recorded refusal carrying the code → kind folder too", async () => {
    mockSend.mockImplementation(async (threadId: string) => {
      useStreamsStore.setState((s) => ({
        reconcileErrors: new Map(s.reconcileErrors).set(
          threadId,
          new CodedApiError(SENTENCE, 422, "folder_in_other_org"),
        ),
      }))
    })
    const { result } = renderHook(() => useStartWorkflowInThread("t-1"))
    await startPlain(result)
    await waitFor(() => expect(result.current.failure?.kind).toBe("folder"))
    expect(result.current.failure?.message).toBe(SENTENCE)
  })

  it("a 422 with any other code (or none) still reads the inputs sentence", async () => {
    mockSend.mockRejectedValue(new CodedApiError("server words", 422, "something_else"))
    const { result } = renderHook(() => useStartWorkflowInThread("t-1"))
    await startPlain(result)
    await waitFor(() => expect(result.current.failure?.kind).toBe("inputs"))
    expect(result.current.failure?.message).not.toContain("server words")
  })

  // 302-02 (FE-IN-01): the folder CODE still never decides a 409 — but a 409 is no longer always
  // "locked". Without the provider's workflow_locked code it is worded by its server sentence.
  it("a 409 is never a folder refusal", async () => {
    mockSend.mockRejectedValue(new CodedApiError("x", 409, "folder_in_other_org"))
    const { result } = renderHook(() => useStartWorkflowInThread("t-1"))
    await startPlain(result)
    await waitFor(() => expect(result.current.failure?.kind).toBe("refused"))
  })

  it("no Retry for a folder refusal: the same published workflow would be refused again", async () => {
    mockSend.mockRejectedValueOnce(new CodedApiError(SENTENCE, 422, "folder_in_other_org"))
    const { result } = renderHook(() => useStartWorkflowInThread("t-1"))
    await startPlain(result)
    await waitFor(() => expect(result.current.failure?.kind).toBe("folder"))
    act(() => result.current.retry())
    expect(mockSend).toHaveBeenCalledTimes(1)
  })
})

/**
 * 302-02 (FE-IN-01 / D-09 / D-26) — a 409 is worded by its CAUSE. The lock is told by the code the
 * provider stamps on its own constructed error; a paused workflow by the server's wire prefix
 * (cross-pinned below); every other 409 shows "{name} didn't start. {server sentence}". None of
 * the three offers a Retry: the same start would be refused again.
 */
describe("useStartWorkflowInThread — 302-02: a refused 409 says why", () => {
  const ORG = "Switch to this chat's organization to keep chatting with its Expert."
  const PAUSED =
    "This thread's workflow is paused, waiting for your answer. Answer it in the panel or on the run page."

  class CodedApiError extends Error {
    status: number
    code?: string
    constructor(message: string, status: number, code?: string) {
      super(message)
      this.status = status
      this.code = code
    }
  }

  beforeEach(() => {
    useStreamsStore.setState({ failedSendDrafts: new Map(), reconcileErrors: new Map() })
  })

  async function startPlain(result: { current: ReturnType<typeof useStartWorkflowInThread> }) {
    act(() => result.current.openPicker())
    await waitFor(() => expect(result.current.workflows).toHaveLength(2))
    act(() => result.current.start(PLAIN, {}))
  }

  it("the provider's lock-arm error (code workflow_locked) → locked, the startLocked sentence", async () => {
    mockSend.mockImplementation(async (threadId: string) => {
      useStreamsStore.setState((s) => ({
        reconcileErrors: new Map(s.reconcileErrors).set(
          threadId,
          new CodedApiError(
            "This thread is running a workflow — cancel it to send a Deep message.",
            409,
            "workflow_locked",
          ),
        ),
      }))
    })
    const { result } = renderHook(() => useStartWorkflowInThread("t-1"))
    await startPlain(result)
    await waitFor(() =>
      expect(result.current.failure).toEqual({
        kind: "locked",
        message: "A workflow is already running in this thread, so Plain flow didn't start.",
      }),
    )
  })

  it("a paused 409 (no code) → locked, the startPaused sentence, never startLocked", async () => {
    mockSend.mockRejectedValue(new CodedApiError(PAUSED, 409))
    const { result } = renderHook(() => useStartWorkflowInThread("t-1"))
    await startPlain(result)
    await waitFor(() => expect(result.current.failure?.kind).toBe("locked"))
    expect(result.current.failure?.message).toBe(
      "Plain flow didn't start because this thread's workflow is paused, waiting for your answer. Answer it in the panel or on the run page.",
    )
    expect(result.current.failure?.message).not.toContain("already running")
  })

  it("any other 409 with a sentence → refused, '{name} didn't start. {sentence}'", async () => {
    mockSend.mockRejectedValue(new CodedApiError(ORG, 409))
    const { result } = renderHook(() => useStartWorkflowInThread("t-1"))
    await startPlain(result)
    await waitFor(() =>
      expect(result.current.failure).toEqual({ kind: "refused", message: `Plain flow didn't start. ${ORG}` }),
    )
  })

  it("a 409 with an empty message → failed, the generic sentence", async () => {
    mockSend.mockRejectedValue(new CodedApiError("", 409))
    const { result } = renderHook(() => useStartWorkflowInThread("t-1"))
    await startPlain(result)
    await waitFor(() =>
      expect(result.current.failure).toEqual({ kind: "failed", message: "Plain flow didn't start. Nothing ran." }),
    )
  })

  it("no Retry for a refused start", async () => {
    mockSend.mockRejectedValueOnce(new CodedApiError(ORG, 409))
    const { result } = renderHook(() => useStartWorkflowInThread("t-1"))
    await startPlain(result)
    await waitFor(() => expect(result.current.failure?.kind).toBe("refused"))
    act(() => result.current.retry())
    expect(mockSend).toHaveBeenCalledTimes(1)
  })

  it("the paused prefix the hook keys on is the backend's literal (?raw)", async () => {
    const mod = await import("../useStartWorkflowInThread")
    const prefix = (mod as unknown as { WORKFLOW_PAUSED_DETAIL_PREFIX?: string }).WORKFLOW_PAUSED_DETAIL_PREFIX
    // @ts-ignore — Vite `?raw` import, typed by vite/client at build time only.
    const py = (await import("../../../../../backend/app/services/workflow_kickoff.py?raw")).default as string
    // @ts-ignore — Vite `?raw` import, typed by vite/client at build time only.
    const ts = (await import("../useStartWorkflowInThread.ts?raw")).default as string
    expect(py.length).toBeGreaterThan(0)
    expect(ts.length).toBeGreaterThan(0)
    expect(typeof prefix).toBe("string")
    expect(prefix!.length).toBeGreaterThan(10)
    expect(ts).toContain(prefix!)
    expect(py).toContain(prefix!)
  })
})
