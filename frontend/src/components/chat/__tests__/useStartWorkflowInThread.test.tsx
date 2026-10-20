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
