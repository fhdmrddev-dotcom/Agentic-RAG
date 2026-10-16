/**
 * BUG-261015-05 — the assistant reply rendered twice (one finished, one still "Thinking…") for
 * ~36 s on a local model. The reply is saved, then the run makes one more model call (the
 * suggestions) before it ends. A messages reload inside that window returned the saved reply
 * beside the live streaming copy.
 *
 * With the backend now linking the run to its reply at save time, the saved row carries the
 * runId. While that run is still streaming on a live subscription, the reload keeps the LIVE
 * copy (it still receives the suggestions and the done event) and hides its saved twin.
 */
import { describe, expect, it } from "vitest"
import type { Message } from "@/types"
import { liveStreamingRunIds, withoutLiveTwins } from "@/lib/liveRunTwin"

const user: Message = { id: "u1", role: "user", content: "hi", created_at: "2026-10-15T17:00:24Z" } as Message
const saved: Message = {
  id: "b0873011", role: "assistant", content: "Hi there!", created_at: "2026-10-15T17:00:45Z",
  runId: "run-1", runStatus: "streaming",
} as Message
const live: Message = {
  id: "temp-a1", role: "assistant", content: "Hi there!", created_at: "2026-10-15T17:00:24Z",
  runId: "run-1", runStatus: "streaming",
} as Message

const subscribed = (ids: string[]) => (id: string) => ids.includes(id)

describe("liveRunTwin", () => {
  it("names a run whose live copy is still streaming on a live subscription", () => {
    expect([...liveStreamingRunIds([user, live], subscribed(["run-1"]))]).toEqual(["run-1"])
  })

  it("does not name a run without a live subscription or one that has ended", () => {
    expect(liveStreamingRunIds([live], subscribed([])).size).toBe(0)
    expect(liveStreamingRunIds([{ ...live, runStatus: "completed" }], subscribed(["run-1"])).size).toBe(0)
    expect(liveStreamingRunIds([{ ...live, id: "persisted-x" }], subscribed(["run-1"])).size).toBe(0)
  })

  it("hides the saved twin of a live run and nothing else", () => {
    const other = { ...saved, id: "older", runId: "run-0", runStatus: "completed" } as Message
    const out = withoutLiveTwins([user, other, saved], new Set(["run-1"]))
    expect(out.map((m) => m.id)).toEqual(["u1", "older"])
  })

  it("keeps the saved row once the database says the run ended (missed terminal event)", () => {
    const ended = { ...saved, runStatus: "completed" } as Message
    expect(withoutLiveTwins([user, ended], new Set(["run-1"])).map((m) => m.id)).toEqual(["u1", "b0873011"])
  })

  it("is the identity when no run is live", () => {
    const fetched = [user, saved]
    expect(withoutLiveTwins(fetched, new Set())).toBe(fetched)
  })
})
