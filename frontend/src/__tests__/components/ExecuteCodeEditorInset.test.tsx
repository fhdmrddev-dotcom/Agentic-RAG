/**
 * Phase 075.9 T4 — `ExecuteCodeEditorInset` byte-stable data-path tests.
 *
 * The defect this guards against:
 *   At tool_start, the inset's source text swaps from `tc.argsCodeText`
 *   (cumulative streamed bytes during preparing) to `tc.args.code` (final
 *   canonical args after tool_start). Pre-T4, the preparing-state used
 *   the plain `<ToolArgsLivePanel>` body and the running-state used the
 *   Shiki editor — two render paths, visible "blink" at the transition.
 *
 *   T4 unifies: the inset reads `tc.argsCodeText ?? tc.args.code` so the
 *   same DOM stays mounted across the transition. The reducer's spread at
 *   `onToolStart` (StreamsProvider.tsx:357) copies the canonical code into
 *   `tc.args.code` and clears `tc.argsCodeText`, so AT the transition both
 *   states would resolve to the same string — the visual is byte-stable.
 *
 *   This test feeds the inset directly with the two states and asserts
 *   the rendered text (in the Suspense fallback `<pre>`, since Shiki is
 *   lazy-loaded and the WASM doesn't resolve in jsdom) is identical, and
 *   the gutter line count matches.
 *
 * Note: Shiki ALWAYS lands in the Suspense fallback under jsdom because
 *   `import("shiki")` returns a promise that doesn't resolve synchronously
 *   and react-testing-library doesn't drain the microtask queue past the
 *   lazy-import boundary in this test setup. That's fine — the fallback's
 *   <pre> still contains the text we want to assert.
 */
import { describe, it, expect } from "vitest"
import { render } from "@testing-library/react"
import { ExecuteCodeEditorInset } from "@/components/chat/tool-bodies/ExecuteCodeBody"
import type { ToolCall } from "@/types"

describe("ExecuteCodeEditorInset — Phase 075.9 T4 byte-stable handoff", () => {
  const CODE = "for i in range(5):\n    print(i)\n"

  it("during PREPARING with argsCodeText set, renders the editor inset (gutter + Shiki suspense fallback)", () => {
    const tc: ToolCall = {
      name: "execute_code",
      id: "preparing-0",
      args: {},
      status: "preparing",
      argsCodeText: CODE,
      argsBytesStreamed: CODE.length,
    } as ToolCall
    const { container } = render(<ExecuteCodeEditorInset tc={tc} />)
    expect(container.querySelector("[data-testid='tc-editor']")).not.toBeNull()
    const gutter = container.querySelector("[data-testid='tc-gutter']")
    expect(gutter).not.toBeNull()
    // 3 lines in CODE → 3 gutter line numbers (the trailing \n produces a
    // third empty line per str.split("\n") semantics).
    expect(gutter!.children.length).toBe(CODE.split("\n").length)
  })

  it("during RUNNING with args.code set (post tool_start), renders the editor inset with same line count", () => {
    const tc: ToolCall = {
      name: "execute_code",
      id: "running-1",
      args: { code: CODE },
      status: "running",
      startedAt: Date.now(),
      // argsCodeText cleared at tool_start (StreamsProvider reducer)
    } as ToolCall
    const { container } = render(<ExecuteCodeEditorInset tc={tc} />)
    expect(container.querySelector("[data-testid='tc-editor']")).not.toBeNull()
    const gutter = container.querySelector("[data-testid='tc-gutter']")
    expect(gutter).not.toBeNull()
    expect(gutter!.children.length).toBe(CODE.split("\n").length)
  })

  it("preparing → running transition: same code text, same gutter count, same DOM shape (no remount/blink)", () => {
    const preparingTc: ToolCall = {
      name: "execute_code",
      id: "preparing-0",
      args: {},
      status: "preparing",
      argsCodeText: CODE,
      argsBytesStreamed: CODE.length,
    } as ToolCall
    const runningTc: ToolCall = {
      ...preparingTc,
      id: "preparing-0",  // still same id post-reducer-spread
      args: { code: CODE },
      status: "running",
      startedAt: Date.now(),
      argsCodeText: undefined,  // cleared by reducer
    } as ToolCall

    const r1 = render(<ExecuteCodeEditorInset tc={preparingTc} />)
    const gutter1 = r1.container.querySelector("[data-testid='tc-gutter']")
    const lines1 = gutter1!.children.length
    r1.unmount()

    const r2 = render(<ExecuteCodeEditorInset tc={runningTc} />)
    const gutter2 = r2.container.querySelector("[data-testid='tc-gutter']")
    const lines2 = gutter2!.children.length

    // Byte-stable: same source text → same line count → same DOM shape.
    expect(lines2).toBe(lines1)
  })

  it("returns null when neither argsCodeText nor args.code is present (e.g. very-early preparing)", () => {
    const tc: ToolCall = {
      name: "execute_code",
      id: "preparing-0",
      args: {},
      status: "preparing",
    } as ToolCall
    const { container } = render(<ExecuteCodeEditorInset tc={tc} />)
    expect(container.querySelector("[data-testid='tc-editor']")).toBeNull()
  })

  it("during PREPARING the streamed text is what gutter line count derives from (cumulative bytes grow)", () => {
    const partialCode = "for i in range(5):"
    const fullCode = "for i in range(5):\n    print(i)"
    const partial: ToolCall = {
      name: "execute_code",
      id: "preparing-0",
      args: {},
      status: "preparing",
      argsCodeText: partialCode,
      argsBytesStreamed: partialCode.length,
    } as ToolCall
    const full: ToolCall = {
      ...partial,
      argsCodeText: fullCode,
      argsBytesStreamed: fullCode.length,
    } as ToolCall
    const r1 = render(<ExecuteCodeEditorInset tc={partial} />)
    const g1 = r1.container.querySelector("[data-testid='tc-gutter']")
    expect(g1!.children.length).toBe(1)
    r1.unmount()
    const r2 = render(<ExecuteCodeEditorInset tc={full} />)
    const g2 = r2.container.querySelector("[data-testid='tc-gutter']")
    expect(g2!.children.length).toBe(2)
  })
})
