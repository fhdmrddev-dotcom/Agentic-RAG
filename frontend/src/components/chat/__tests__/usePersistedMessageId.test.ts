/**
 * BUG-261020-04 — "Check citations" missing on a freshly finished answer.
 *
 * A finished live answer keeps its optimistic `temp-…` id until the thread is refetched, and the
 * check route needs the STORED id, so the action stayed hidden until the thread was re-opened.
 * The hook resolves the stored id once the run has settled, by run id, from the thread's
 * messages — one GET per finished answer, never while it streams.
 */
import { afterEach, describe, expect, it, vi } from "vitest"
import { renderHook, waitFor } from "@testing-library/react"

const api = vi.hoisted(() => ({ getMessages: vi.fn() }))
vi.mock("@/lib/api/threads", () => api)

import { usePersistedMessageId, resetPersistedMessageIds } from "../usePersistedMessageId"
import type { Message } from "@/types"

const live = (over: Partial<Message> = {}): Message =>
  ({
    id: "temp-123",
    thread_id: "t-1",
    role: "assistant",
    content: "answer [1]",
    created_at: "2026-10-20T08:00:00Z",
    runId: "run-1",
    runStatus: "completed",
    ...over,
  }) as Message

afterEach(() => {
  api.getMessages.mockReset()
  resetPersistedMessageIds()
})

describe("usePersistedMessageId", () => {
  it("returns a stored id unchanged and asks for nothing", () => {
    const { result } = renderHook(() => usePersistedMessageId(live({ id: "m-stored" }), false))
    expect(result.current).toBe("m-stored")
    expect(api.getMessages).not.toHaveBeenCalled()
  })

  it("keeps today's rule for a stored row: hidden only while the row streams", () => {
    const { result } = renderHook(() => usePersistedMessageId(live({ id: "m-stored" }), true))
    expect(result.current).toBeUndefined()
  })

  it("returns nothing while the answer streams, and asks for nothing", () => {
    const { result } = renderHook(() => usePersistedMessageId(live({ runStatus: "streaming" }), false))
    expect(result.current).toBeUndefined()
    const { result: r2 } = renderHook(() => usePersistedMessageId(live(), true))
    expect(r2.current).toBeUndefined()
    expect(api.getMessages).not.toHaveBeenCalled()
  })

  it("resolves a finished temp answer to its stored twin by run id", async () => {
    api.getMessages.mockResolvedValue([
      { id: "u-1", role: "user", runId: undefined },
      { id: "m-other", role: "assistant", runId: "run-0" },
      { id: "m-twin", role: "assistant", runId: "run-1" },
    ])
    const { result } = renderHook(() => usePersistedMessageId(live(), false))
    expect(result.current).toBeUndefined()
    await waitFor(() => expect(result.current).toBe("m-twin"))
    expect(api.getMessages).toHaveBeenCalledTimes(1)
    expect(api.getMessages).toHaveBeenCalledWith("t-1")
  })

  it("asks once per run, however many rows mount for it", async () => {
    api.getMessages.mockResolvedValue([{ id: "m-twin", role: "assistant", runId: "run-1" }])
    const a = renderHook(() => usePersistedMessageId(live(), false))
    const b = renderHook(() => usePersistedMessageId(live(), false))
    await waitFor(() => expect(a.result.current).toBe("m-twin"))
    await waitFor(() => expect(b.result.current).toBe("m-twin"))
    expect(api.getMessages).toHaveBeenCalledTimes(1)
  })

  it("stays hidden when no stored twin exists, rather than inventing an id", async () => {
    api.getMessages.mockResolvedValue([{ id: "m-other", role: "assistant", runId: "run-0" }])
    const { result } = renderHook(() => usePersistedMessageId(live(), false))
    await waitFor(() => expect(api.getMessages).toHaveBeenCalled())
    await new Promise((r) => setTimeout(r, 0))
    expect(result.current).toBeUndefined()
  })

  it("stays hidden on a failed request", async () => {
    api.getMessages.mockRejectedValue(new Error("boom"))
    const { result } = renderHook(() => usePersistedMessageId(live(), false))
    await waitFor(() => expect(api.getMessages).toHaveBeenCalled())
    await new Promise((r) => setTimeout(r, 0))
    expect(result.current).toBeUndefined()
  })

  it("never resolves a temp row without a run id (a failed send)", () => {
    const { result } = renderHook(() => usePersistedMessageId(live({ runId: undefined }), false))
    expect(result.current).toBeUndefined()
    expect(api.getMessages).not.toHaveBeenCalled()
  })
})
