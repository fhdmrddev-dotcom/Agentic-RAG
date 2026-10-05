/**
 * Phase 273-05 (D-16 · I-2) — the artifact's two wire doors in `lib/api/threads.ts`.
 *
 * LIVE: an `artifact` SSE frame calls `onArtifact` once with the record object, and the branch
 * carries NO `return`, so the stream cursor still advances for that frame (the 063.1 contract).
 *
 * RELOAD: `_mapMessageResponse` (reached through `getMessages` / `getSnapshot`, its only callers)
 * maps the backend's `artifacts` field onto `message.artifacts` — the SAME objects the live frame
 * carried (273-04 attaches them server-side; the mapper never re-derives them from tool_calls).
 */
import { afterEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/api/_core", async (importActual) => {
  const actual = await importActual<typeof import("@/lib/api/_core")>()
  return { ...actual, API_BASE: "http://api.test", getAuthHeaders: vi.fn().mockResolvedValue({}) }
})

import { getMessages, getSnapshot, subscribeToRun, type StreamCallbacks } from "@/lib/api/threads"
import { chartBar, missing, table16 } from "@/components/chat/artifacts/__tests__/fixtures"

function mockSseFetch(chunks: string[]) {
  const encoder = new TextEncoder()
  const queue = chunks.map((c) => encoder.encode(c))
  const body = {
    getReader() {
      return {
        async read() {
          const next = queue.shift()
          if (next === undefined) return { done: true, value: undefined }
          return { done: false, value: next }
        },
      }
    },
  }
  return vi.fn().mockResolvedValue({ ok: true, status: 200, body })
}

function serveJson(body: unknown) {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => body }))
}

const NOW = "2026-10-03T09:41:12.512Z"

function wireMessage(extra: Record<string, unknown> = {}) {
  return {
    id: "m-1",
    thread_id: "t-1",
    user_id: "u-1",
    role: "assistant",
    content: "Revenue grew every quarter.",
    created_at: NOW,
    updated_at: NOW,
    tool_calls: [],
    ...extra,
  }
}

afterEach(() => vi.unstubAllGlobals())

describe("subscribeToRun — the `artifact` SSE branch", () => {
  it("calls onArtifact once with the record object, and the cursor still advances", async () => {
    const onArtifact = vi.fn()
    const onCursor = vi.fn()
    const cbs: StreamCallbacks = { onTerminal: () => {}, onDelta: () => {}, onArtifact, onCursor } as unknown as StreamCallbacks
    const wire =
      `id: 7-0\ndata: ${JSON.stringify({ type: "artifact", artifact: chartBar })}\n\n` +
      'data: {"type":"stream_end"}\n\n'
    vi.stubGlobal("fetch", mockSseFetch([wire]))
    await subscribeToRun("run-1", "0", cbs)
    expect(onArtifact).toHaveBeenCalledTimes(1)
    expect(onArtifact.mock.calls[0][0]).toEqual(chartBar)
    // No `return` on the branch: the frame's id is recorded like every non-terminal event.
    expect(onCursor).toHaveBeenCalledWith("7-0")
  })

  it("a frame with no onArtifact callback is consumed silently and still advances the cursor", async () => {
    const onCursor = vi.fn()
    const cbs = { onTerminal: () => {}, onDelta: () => {}, onCursor } as unknown as StreamCallbacks
    const wire =
      `id: 8-0\ndata: ${JSON.stringify({ type: "artifact", artifact: table16 })}\n\n` +
      'data: {"type":"stream_end"}\n\n'
    vi.stubGlobal("fetch", mockSseFetch([wire]))
    await subscribeToRun("run-2", "0", cbs)
    expect(onCursor).toHaveBeenCalledWith("8-0")
  })
})

describe("_mapMessageResponse — the reload `artifacts` field", () => {
  it("maps `artifacts: [rec]` onto message.artifacts, deep-equal to the wire records", async () => {
    serveJson([wireMessage({ artifacts: [chartBar, missing] })])
    const [m] = await getMessages("t-1")
    expect(m.artifacts).toEqual([chartBar, missing])
  })

  it("`artifacts: null` and an absent key both map to undefined", async () => {
    serveJson([wireMessage({ artifacts: null }), wireMessage({ id: "m-2" })])
    const [a, b] = await getMessages("t-1")
    expect(a.artifacts).toBeUndefined()
    expect(b.artifacts).toBeUndefined()
    // Destructured out of `...rest` and re-set: the wire `null` never leaks through unmapped.
    expect(a.artifacts === null).toBe(false)
  })

  it("a non-array `artifacts` value never reaches the message", async () => {
    serveJson([wireMessage({ artifacts: { id: "a_k3j9x0p2qd" } })])
    const [m] = await getMessages("t-1")
    expect(m.artifacts).toBeUndefined()
  })

  it("the snapshot path maps through the same mapper", async () => {
    serveJson({ messages: [wireMessage({ artifacts: [table16] })], active_runs: [], since_cursors: {} })
    const snap = await getSnapshot("t-1")
    expect(snap.messages[0].artifacts).toEqual([table16])
  })
})
