/**
 * BUG-260626-01 — unit tests for the shared dedupMessagesByRunId helper.
 *
 * Pins the bucket-read dedup used by both MessageList (render keys) and
 * useDerivedPanel (workspace todos): collapse same-runId temp/persisted twins,
 * keep the persisted (non-`temp-`) row, leave everything else untouched.
 */
import { describe, it, expect } from "vitest"
import { dedupMessagesByRunId } from "@/lib/dedupMessages"
import type { Message } from "@/types"

const NOW = "2026-06-26T00:00:00Z"

function asst(overrides: Partial<Message> = {}): Message {
  return {
    id: "a-1",
    thread_id: "t",
    user_id: "u",
    role: "assistant",
    content: "x",
    created_at: NOW,
    updated_at: NOW,
    ...overrides,
  }
}

function usr(overrides: Partial<Message> = {}): Message {
  return { ...asst({ role: "user", id: "u-1", content: "hi" }), ...overrides }
}

describe("dedupMessagesByRunId", () => {
  it("collapses a temp + persisted twin sharing a runId, keeping the persisted row", () => {
    const out = dedupMessagesByRunId([
      asst({ id: "real-uuid", runId: "R" }),
      asst({ id: "temp-1", runId: "R" }),
    ])
    expect(out).toHaveLength(1)
    expect(out[0].id).toBe("real-uuid")
  })

  it("keeps the persisted row even when the temp appears first", () => {
    const out = dedupMessagesByRunId([
      asst({ id: "temp-1", runId: "R" }),
      asst({ id: "real-uuid", runId: "R" }),
    ])
    expect(out).toHaveLength(1)
    expect(out[0].id).toBe("real-uuid")
  })

  it("preserves a lone temp when no persisted twin exists", () => {
    const out = dedupMessagesByRunId([asst({ id: "temp-1", runId: "R", runStatus: "streaming" })])
    expect(out).toHaveLength(1)
    expect(out[0].id).toBe("temp-1")
  })

  it("does not collapse different runIds", () => {
    const out = dedupMessagesByRunId([asst({ id: "a1", runId: "R1" }), asst({ id: "a2", runId: "R2" })])
    expect(out).toHaveLength(2)
  })

  it("leaves rows without a runId untouched (user rows, harness answers)", () => {
    const out = dedupMessagesByRunId([
      usr({ id: "u1" }),
      asst({ id: "h1", runId: undefined }),
      asst({ id: "h2", runId: undefined }),
    ])
    expect(out).toHaveLength(3)
  })

  it("is order-preserving across mixed roles and runs", () => {
    const out = dedupMessagesByRunId([
      usr({ id: "u1" }),
      asst({ id: "temp-1", runId: "R1" }),
      asst({ id: "real-1", runId: "R1" }),
      usr({ id: "u2" }),
      asst({ id: "real-2", runId: "R2" }),
    ])
    expect(out.map((m) => m.id)).toEqual(["u1", "real-1", "u2", "real-2"])
  })
})
