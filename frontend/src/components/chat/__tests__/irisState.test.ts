/**
 * Phase 276-06 (D-24 / D-27) — the Iris avatar's state derivation, as a table.
 *
 * `irisStateFor` is the ONE home of the precedence order recorded in
 * `.planning/sketches/276-iris-avatar/README.md` §"State → motion":
 *   error > cancelled > waiting > idle-when-not-streaming > tool > thinking > streaming.
 * Waiting MUST beat tool, because `ask_user` is itself a tool whose status is `running` —
 * a paused question must never read as "working" (T-276-30).
 */
import { describe, it, expect } from "vitest"
import type { Message, ToolCall } from "@/types"
import { irisStateFor, hasPendingAsk, type IrisState } from "../irisState"

function msg(over: Partial<Message> = {}): Message {
  return {
    id: "m1",
    thread_id: "t1",
    user_id: "u1",
    role: "assistant",
    content: "",
    created_at: "2026-10-04T00:00:00Z",
    updated_at: "2026-10-04T00:00:00Z",
    ...over,
  }
}

function tool(name: string, status: ToolCall["status"]): ToolCall {
  return { name, args: {}, status }
}

const approval = (decision?: "allow" | "reject" | "always"): NonNullable<Message["toolApproval"]> => ({
  callId: "c1",
  serviceId: "s1",
  serviceName: "Drive",
  toolName: "list_files",
  args: {},
  ...(decision ? { decision } : {}),
})

const CASES: Array<[string, Message, boolean | undefined, IrisState]> = [
  ["failed + a running tool → error", msg({ runStatus: "failed", tool_calls: [tool("execute_code", "running")] }), undefined, "error"],
  ["timed_out → error", msg({ runStatus: "timed_out" }), undefined, "error"],
  ["cancelled + a pending ask_user → cancelled", msg({ runStatus: "cancelled", tool_calls: [tool("ask_user", "running")] }), undefined, "cancelled"],
  ["streaming + ask_user running → waiting (waiting beats tool)", msg({ runStatus: "streaming", tool_calls: [tool("ask_user", "running")] }), undefined, "waiting"],
  // 276-REVIEW B-WR-01: ~~completed + ask_user interrupted → waiting~~ — Stop marks every running tool
  // interrupted, ask_user included, so a finished row must settle; ask/approval wait only while live.
  ["completed + ask_user interrupted → idle (a finished row settles)", msg({ runStatus: "completed", tool_calls: [tool("ask_user", "interrupted")] }), undefined, "idle"],
  ["streaming + ask_user interrupted → waiting", msg({ runStatus: "streaming", tool_calls: [tool("ask_user", "interrupted")] }), undefined, "waiting"],
  ["completed + an undecided approval → idle (decision not always written back)", msg({ runStatus: "completed", content: "done", toolApproval: approval() }), undefined, "idle"],
  ["runStatus undefined + a running ask_user → idle (historic row)", msg({ tool_calls: [tool("ask_user", "running")] }), undefined, "idle"],
  ["failed + capPaused → error (terminal states outrank the pause)", msg({ runStatus: "failed" }), true, "error"],
  ["streaming + an undecided tool approval → waiting", msg({ runStatus: "streaming", toolApproval: approval() }), undefined, "waiting"],
  ["streaming + an allowed approval, no content, no tools → thinking", msg({ runStatus: "streaming", toolApproval: approval("allow") }), undefined, "thinking"],
  ["completed + capPaused → waiting", msg({ runStatus: "completed", content: "partial" }), true, "waiting"],
  ["completed + capPaused exhausted (caller passes false) → idle", msg({ runStatus: "completed", content: "partial" }), false, "idle"],
  ["completed + not capPaused → idle", msg({ runStatus: "completed", content: "done" }), false, "idle"],
  ["runStatus undefined → idle", msg({ content: "historic row" }), undefined, "idle"],
  ["streaming, no content, no tools → thinking", msg({ runStatus: "streaming" }), undefined, "thinking"],
  ["streaming + content + isPlanning → thinking", msg({ runStatus: "streaming", content: "hello", isPlanning: true }), undefined, "thinking"],
  ["streaming + reasoning only (content empty) → thinking", msg({ runStatus: "streaming", content: "", reasoningContent: "Let me think" }), undefined, "thinking"],
  ["streaming + a preparing tool → tool", msg({ runStatus: "streaming", tool_calls: [tool("search_documents", "preparing")] }), undefined, "tool"],
  ["streaming + a running tool → tool", msg({ runStatus: "streaming", content: "x", tool_calls: [tool("execute_code", "running")] }), undefined, "tool"],
  ["streaming + content + all tools done → streaming", msg({ runStatus: "streaming", content: "The total is 42", tool_calls: [tool("execute_code", "done")] }), undefined, "streaming"],
]

describe("irisStateFor — the precedence table (D-24 / D-27)", () => {
  it.each(CASES)("%s", (_name, m, capPaused, expected) => {
    expect(irisStateFor(m, capPaused)).toBe(expected)
  })
})

describe("hasPendingAsk — moved verbatim from MessageItem (one home)", () => {
  it.each<[string, ToolCall[] | undefined, boolean]>([
    ["ask_user running → true", [tool("ask_user", "running")], true],
    ["ask_user interrupted → true", [tool("ask_user", "interrupted")], true],
    ["ask_user done → false", [tool("ask_user", "done")], false],
    ["another tool running → false", [tool("execute_code", "running")], false],
    ["undefined → false", undefined, false],
  ])("%s", (_name, calls, expected) => {
    expect(hasPendingAsk(calls)).toBe(expected)
  })
})
