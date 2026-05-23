/**
 * 075.6 Plan 02 / SPEC Req #4 — Collapsible live code panel unit tests.
 *
 * Covers:
 *   1. Body renders with contentText when expanded
 *   2. Body hides when expanded=false but byte counter stays in header
 *   3. Chevron click fires onToggle exactly once
 *   4. W-4 / SPEC Req #4 headline rule — default-expand-for-active vs
 *      collapsed-for-past: with two preparing panels and
 *      lastPreparingIndex = items.length - 1, only the second body is
 *      visible (the first collapses as "past preparing"). Unit-tests the
 *      consumer-side `i === lastPreparingIndex` computation; Task 5 wires
 *      the rule end-to-end inside ToolCallPanel.
 */
import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { ToolArgsLivePanel } from "@/components/chat/ToolArgsLivePanel"

describe("ToolArgsLivePanel", () => {
  it("renders <pre><code> body with contentText when expanded", () => {
    render(
      <ToolArgsLivePanel
        title="Generating code…"
        contentText="import matplotlib"
        byteCount={5121}
        expanded={true}
        onToggle={() => {}}
      />,
    )
    expect(screen.getByText("import matplotlib")).toBeInTheDocument()
  })

  it("hides body when expanded=false but keeps byte counter in header", () => {
    render(
      <ToolArgsLivePanel
        title="Generating code…"
        contentText="import matplotlib"
        byteCount={5121}
        expanded={false}
        onToggle={() => {}}
      />,
    )
    // Body text is not rendered when collapsed.
    expect(screen.queryByText("import matplotlib")).not.toBeInTheDocument()
    // Header byte counter is still visible.
    expect(screen.getByText(/5\.0 KB/)).toBeInTheDocument()
  })

  it("calls onToggle when chevron clicked", () => {
    const onToggle = vi.fn()
    render(
      <ToolArgsLivePanel
        title="Generating code…"
        contentText="x"
        byteCount={1024}
        expanded={true}
        onToggle={onToggle}
      />,
    )
    fireEvent.click(screen.getByRole("button"))
    expect(onToggle).toHaveBeenCalledTimes(1)
  })

  // W-4 / SPEC Req #4 headline rule: default-expand-for-active rule. Unit-
  // tests the SHAPE of values the consumer (Task 5 in ToolCallPanel) will
  // compute via `i === lastPreparingIndex`. Two preparing panels, second is
  // the active preparing tool → second body visible, first body hidden.
  it("default-expand-for-active rule: with two preparing panels and lastPreparingIndex = items.length - 1, only the second body is visible", () => {
    const items = [
      { tc: { id: "t1", status: "preparing", argsCodeText: "PAST_CODE", argsBytesStreamed: 5121 } },
      { tc: { id: "t2", status: "preparing", argsCodeText: "ACTIVE_CODE", argsBytesStreamed: 5121 } },
    ]
    const lastPreparingIndex = items.length - 1
    render(
      <>
        {items.map((it, i) => (
          <ToolArgsLivePanel
            key={it.tc.id}
            title={`Generating code (${it.tc.id})…`}
            contentText={it.tc.argsCodeText}
            byteCount={it.tc.argsBytesStreamed}
            expanded={i === lastPreparingIndex}
            onToggle={() => {}}
          />
        ))}
      </>,
    )
    // Past-preparing panel: body hidden (expanded=false).
    expect(screen.queryByText("PAST_CODE")).not.toBeInTheDocument()
    // Active-preparing panel: body visible (expanded=true).
    expect(screen.getByText("ACTIVE_CODE")).toBeInTheDocument()
  })
})
