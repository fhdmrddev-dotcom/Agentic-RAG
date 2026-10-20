/**
 * Phase 295-05 (D-02 / D-37 contract, shared with 295-03 and 295-06) — the `ask_user_prompt`
 * SSE mapper carries the engine's `engine_pause` object onto `PendingAsk`.
 *
 * The mapper builds `PendingAsk` FIELD BY FIELD, so a key it does not name is dropped and the
 * pause card could never learn that the question is an engine pause (no deadline, folder
 * choices). Driven through the real `subscribeToRun` parser, not a hand-built `PendingAsk`.
 */
import { afterEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/api/_core", async (importActual) => {
  const actual = await importActual<typeof import("@/lib/api/_core")>()
  return { ...actual, API_BASE: "http://api.test", getAuthHeaders: vi.fn().mockResolvedValue({}) }
})

import { subscribeToRun, type StreamCallbacks } from "@/lib/api/threads"
import type { EnginePause, PendingAsk } from "@/types"

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

afterEach(() => vi.unstubAllGlobals())

const ENGINE_PAUSE: EnginePause = {
  kind: "no_sources",
  phase: "research",
  continue_allowed: true,
  locked: false,
  folders: [{ id: "f-2", name: "Q3 reports", depth: 1 }],
}

async function drive(payload: Record<string, unknown>): Promise<PendingAsk> {
  const onAskUserPrompt = vi.fn()
  const cbs = { onTerminal: () => {}, onDelta: () => {}, onAskUserPrompt } as unknown as StreamCallbacks
  const wire = `id: 1-0\ndata: ${JSON.stringify({ type: "ask_user_prompt", ...payload })}\n\n` +
    'data: {"type":"stream_end"}\n\n'
  vi.stubGlobal("fetch", mockSseFetch([wire]))
  await subscribeToRun("run-1", "0", cbs)
  expect(onAskUserPrompt).toHaveBeenCalledTimes(1)
  return onAskUserPrompt.mock.calls[0][0] as PendingAsk
}

describe("ask_user_prompt SSE — engine_pause rides the mapper (295-05)", () => {
  it("an engine pause arrives with its kind, phase, lock and folders, and no deadline", async () => {
    const ask = await drive({
      tool_call_id: "t1",
      prompt: "Searched Weekly reports and found nothing for “Find the evidence”.",
      options: ["Search another folder", "Continue without sources", "Stop the run"],
      timeout_seconds: null,
      engine_pause: ENGINE_PAUSE,
    })
    expect(ask.engine_pause).toEqual(ENGINE_PAUSE)
    expect(ask.timeout_seconds).toBeNull()
    expect(ask.options).toEqual(["Search another folder", "Continue without sources", "Stop the run"])
  })

  it("an ordinary prompt carries no engine_pause", async () => {
    const ask = await drive({ tool_call_id: "t2", prompt: "Approve?", options: ["Yes"], timeout_seconds: 300 })
    expect(ask.engine_pause).toBeUndefined()
    expect(ask.timeout_seconds).toBe(300)
  })
})
