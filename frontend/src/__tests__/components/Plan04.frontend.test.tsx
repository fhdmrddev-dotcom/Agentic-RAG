/**
 * Phase 075.1 Plan 04 Task 3 — frontend polish bundle tests.
 *
 * Covers 6 atoms (A is verified by Task 4 UAT; G is a frontmatter file change):
 *   - Atom B: ToolCallPanel dedup keyed on tool_call_id (B-260519-10)
 *   - Atom C: code_stdout vs code_stderr styling routes by channel
 *     (B-260519-07 stdout portion — successful stdout no longer rendered red)
 *   - Atom D: tool-card renders "Sub-agent: {model_id}" line when present
 *     (B-260519-05 frontend metadata)
 *   - Atom E pt 1: output-files delta — backend already filters per-cell;
 *     this test pins the wire contract (tc.outputFiles is rendered verbatim)
 *   - Atom E pt 2: final pinned panel renders message.finalOutputFiles
 *     below the tool_calls block (B-260519-11 + BUG-260514-01)
 *   - Atom F: Settings UI already ships a sub-agent dropdown (verified by
 *     a snapshot grep on SettingsPage.tsx — the UI surface predates this plan
 *     so we just lock that it stays).
 */
import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { TooltipProvider } from "@/components/ui/tooltip"
import { ToolCallPanel } from "@/components/chat/ToolCallPanel"
// Phase 075.7 Plan 01 (D-02): legacy execute-code wrapper renamed to
// ExecuteCodeBody and relocated under tool-bodies/. Default export.
import ExecuteCodeBody from "@/components/chat/tool-bodies/ExecuteCodeBody"
import { MessageItem } from "@/components/chat/MessageItem"
import type { Message, ToolCall } from "@/types"

const NOW = new Date().toISOString()

function renderWithTooltip(ui: React.ReactElement) {
  return render(<TooltipProvider>{ui}</TooltipProvider>)
}

function makeToolCall(overrides: Partial<ToolCall> = {}): ToolCall {
  return {
    id: "tc-1",
    name: "search_documents",
    args: { query: "test" },
    status: "done",
    result: JSON.stringify([]),
    startedAt: Date.now() - 1000,
    endedAt: Date.now(),
    ...overrides,
  }
}

function makeMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: "msg-1",
    thread_id: "thread-1",
    user_id: "user-1",
    role: "assistant",
    content: "",
    created_at: NOW,
    updated_at: NOW,
    tool_calls: [],
    ...overrides,
  }
}

// ── Atom B: ToolCallPanel dedup keyed on tool_call_id (B-260519-10) ──────


describe("Atom B — ToolCallPanel dedup", () => {
  it("renders exactly one card when two tool calls share the same tool_call_id", () => {
    const duplicateTc: ToolCall = makeToolCall({ id: "shared-id", name: "search_documents" })
    const sameAgain: ToolCall = makeToolCall({ id: "shared-id", name: "search_documents" })

    renderWithTooltip(
      <ToolCallPanel toolCalls={[duplicateTc, sameAgain]} />,
    )

    // Both rows render the toolLabel "Searching documents" — count occurrences
    // to verify dedup. Without the dedup, the toolCalls.map() would render
    // 2 rows; with dedup, exactly 1.
    const labels = screen.getAllByText("Searching documents")
    expect(labels.length).toBe(1)
  })

  it("retains both cards when tool_call_ids differ", () => {
    const a: ToolCall = makeToolCall({ id: "id-a", name: "search_documents" })
    const b: ToolCall = makeToolCall({ id: "id-b", name: "search_documents" })

    renderWithTooltip(
      <ToolCallPanel toolCalls={[a, b]} />,
    )

    // Distinct IDs → both render
    const labels = screen.getAllByText("Searching documents")
    expect(labels.length).toBe(2)
  })
})

// ── Atom C: code_stdout vs code_stderr channel-based styling (B-260519-07) ──


describe("Atom C — stdout/stderr terminal-output styling routes by channel", () => {
  it("stdout lines use the emerald-400 class; stderr lines use red-400", () => {
    const tc: ToolCall = makeToolCall({
      id: "exec-1",
      name: "execute_code",
      args: { code: "print('ok')", description: "test" },
      status: "done",
      result: JSON.stringify({
        status: "completed",
        exit_code: 0,
        duration_ms: 100,
        output_files: [],
        stdout: "ok line\n",
        stderr: "",
      }),
      outputLines: [
        { kind: "stdout", content: "ok line 1" },
        { kind: "stderr", content: "warning line" },
        { kind: "stdout", content: "ok line 2" },
      ],
      exitCode: 0,
    })

    const { container } = renderWithTooltip(<ExecuteCodeBody tc={tc} />)

    // Verify that each line's parent div has the expected class for its channel.
    // Map text → expected channel + class.
    const expectations = [
      { text: "ok line 1", channel: "stdout", cls: "text-emerald-400" },
      { text: "warning line", channel: "stderr", cls: "text-red-400" },
      { text: "ok line 2", channel: "stdout", cls: "text-emerald-400" },
    ]
    for (const { text, channel: _channel, cls } of expectations) {
      const node = Array.from(container.querySelectorAll("div"))
        .find((d) => d.textContent === text)
      expect(node, `Could not find rendered line "${text}"`).toBeTruthy()
      expect(node!.className).toContain(cls)
    }
  })
})

// ── Atom D: sub_agent_model line on tool-card (B-260519-05 frontend) ─────


describe("Atom D — tool-card renders Sub-agent line when sub_agent_model present", () => {
  it("renders 'Sub-agent: <model_id>' below the tool name when tc.sub_agent_model is set", () => {
    const tc: ToolCall = makeToolCall({
      id: "tc-sa",
      name: "analyze_document",
      args: { filename: "doc.pdf", task: "summarize" },
      status: "done",
      result: "Summary text",
      // Plan 04 Atom D — new field on ToolCall.
      sub_agent_model: "claude-haiku-4-5-20251001",
    } as ToolCall & { sub_agent_model?: string })

    renderWithTooltip(
      <ToolCallPanel toolCalls={[tc]} />,
    )

    // The literal string "Sub-agent: claude-haiku-4-5-20251001" must appear.
    expect(screen.getByText(/Sub-agent: claude-haiku-4-5-20251001/i)).toBeTruthy()
  })

  it("does NOT render the Sub-agent line when sub_agent_model is absent", () => {
    const tc: ToolCall = makeToolCall({
      id: "tc-no-sa",
      name: "analyze_document",
      args: { filename: "doc.pdf", task: "summarize" },
      status: "done",
      result: "Summary text",
    })

    renderWithTooltip(
      <ToolCallPanel toolCalls={[tc]} />,
    )

    // Sub-agent line absent
    expect(screen.queryByText(/Sub-agent:/i)).toBeNull()
  })
})

// ── Atom E pt 2: pinned Final outputs panel on MessageItem (B-260519-11) ──


describe("Atom E — final pinned output-files panel renders when set", () => {
  it("renders the panel listing each filename when message.finalOutputFiles is non-empty", () => {
    const m: Message = makeMessage({
      content: "Done.",
      runStatus: "completed",
      // Plan 04 Atom E — new field on Message.
      finalOutputFiles: [
        { filename: "chart1.png" },
        { filename: "chart2.png" },
        { filename: "report.pptx" },
      ],
    } as Message & { finalOutputFiles?: { filename: string }[] })

    renderWithTooltip(<MessageItem message={m} isStreaming={false} />)

    // Phase 095 Plan 05 (D-07): the panel header was relabeled "Final outputs"
    // → "Generated files" (sketch §"Output files area"); each filename must
    // still appear (re-rank, never hide).
    expect(screen.getByText("Generated files")).toBeTruthy()
    expect(screen.getByText("chart1.png")).toBeTruthy()
    expect(screen.getByText("chart2.png")).toBeTruthy()
    expect(screen.getByText("report.pptx")).toBeTruthy()
  })

  it("renders nothing when finalOutputFiles is absent or empty", () => {
    const m: Message = makeMessage({
      content: "Done.",
      runStatus: "completed",
    })

    renderWithTooltip(<MessageItem message={m} isStreaming={false} />)

    expect(screen.queryByTestId("final-outputs-panel")).toBeNull()
  })
})

// ── Atom F: Settings dropdown surface exists (lock-in regression) ────────


describe("Atom F — Settings sub-agent override surface remains in place", () => {
  it("SettingsPage.tsx source file contains a Sub-agent model dropdown surface", async () => {
    // The Settings dropdown already shipped pre-Plan-04 in SettingsPage.tsx
    // (line ~843). Lock that fact in: a grep-style assertion on the source.
    const src = await import("@/pages/SettingsPage?raw")
    const text = src.default as string
    expect(text).toMatch(/Sub-agent model/i)
    expect(text).toMatch(/setSubAgentModel|sub_agent_model/)
  })
})
