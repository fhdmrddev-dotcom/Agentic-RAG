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

  // ── Phase 174-04 (STATE-04 / D-12): same-send pre-runId double-mount collapse ──
  // The mount / first-SSE race can leave TWO empty optimistic assistant
  // placeholders for the SAME send in the bucket BEFORE a runId exists (the
  // window dedupMessagesByRunId's runId key can't see). Collapse ONLY that
  // same-send twin — two ADJACENT empty temp/no-runId assistant rows with NO
  // intervening user row — NEVER a blind "any two temp rows" rule that would
  // erase the STATE-01b amber (blockedNotice) bubble or a failed-send placeholder.
  describe("STATE-04 pre-runId same-send twin (D-12)", () => {
    it("collapses the same-send double-mount (two adjacent empty temp/no-runId assistant rows) to one, keeping the first (original placeholder)", () => {
      const out = dedupMessagesByRunId([
        usr({ id: "u1" }),
        asst({ id: "temp-a", runId: undefined, content: "" }),
        asst({ id: "temp-b", runId: undefined, content: "" }),
      ])
      expect(out.map((m) => m.id)).toEqual(["u1", "temp-a"])
    })

    it("MANDATORY REGRESSION — a STATE-01b amber (blockedNotice) temp row + a LATER send's own temp placeholder BOTH survive (never collapsed)", () => {
      const out = dedupMessagesByRunId([
        usr({ id: "u1" }),
        asst({
          id: "temp-amber",
          runId: undefined,
          content: "",
          blockedNotice: { message: "Workflows are currently disabled by the administrator" },
        }),
        usr({ id: "u2" }),
        asst({ id: "temp-new", runId: undefined, content: "" }),
      ])
      expect(out.filter((m) => m.role === "assistant")).toHaveLength(2)
      expect(out.map((m) => m.id)).toEqual(["u1", "temp-amber", "u2", "temp-new"])
    })

    it("MANDATORY REGRESSION — a failed-send temp row + a LATER send's own temp placeholder BOTH survive (never collapsed)", () => {
      const out = dedupMessagesByRunId([
        usr({ id: "u1" }),
        asst({ id: "temp-failed", runId: undefined, content: "", runStatus: "failed" }),
        usr({ id: "u2" }),
        asst({ id: "temp-new", runId: undefined, content: "" }),
      ])
      expect(out.filter((m) => m.role === "assistant")).toHaveLength(2)
    })

    it("never collapses an amber(blockedNotice) row even when an empty temp placeholder is DIRECTLY adjacent (defensive both-sides guard)", () => {
      const out = dedupMessagesByRunId([
        asst({
          id: "temp-amber",
          runId: undefined,
          content: "",
          blockedNotice: { message: "blocked" },
        }),
        asst({ id: "temp-new", runId: undefined, content: "" }),
      ])
      expect(out).toHaveLength(2)
      expect(out.map((m) => m.id)).toContain("temp-amber")
    })

    it("does NOT collapse two temp/no-runId placeholders separated by a user row (genuinely different sends)", () => {
      const out = dedupMessagesByRunId([
        asst({ id: "temp-a", runId: undefined, content: "" }),
        usr({ id: "u1" }),
        asst({ id: "temp-b", runId: undefined, content: "" }),
      ])
      expect(out).toHaveLength(3)
    })

    it("does NOT collapse genuine harness answers (assistant rows without a runId but with REAL, non-temp ids) even when adjacent", () => {
      const out = dedupMessagesByRunId([
        asst({ id: "harness-1", runId: undefined, content: "answer one" }),
        asst({ id: "harness-2", runId: undefined, content: "answer two" }),
      ])
      expect(out).toHaveLength(2)
    })

    it("preserves a lone pre-runId temp placeholder (no twin) untouched", () => {
      const out = dedupMessagesByRunId([
        usr({ id: "u1" }),
        asst({ id: "temp-a", runId: undefined, content: "" }),
      ])
      expect(out.map((m) => m.id)).toEqual(["u1", "temp-a"])
    })
  })
})
