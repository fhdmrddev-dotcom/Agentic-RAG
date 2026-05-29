/**
 * Phase 087 Plan 05 — Chat↔Panel Seam contract (D-05, sketch 007).
 *
 * Wave 0 (Plan 01) shipped this file as GREEN-only `it.todo(...)` contracts;
 * Plan 05 flips them to live tests as the seam renderers land.
 *
 * Mental model (LOCKED): panel = now, chat = happened. Live runs render quiet
 * one-line pointers in chat (SeamPointer); reloaded history resolves to
 * self-contained cards (SeamCard). PausedRunCue is the chat-side paused cue. All
 * three are ADDITIVE — they must NOT modify RunCard / ToolCallPanel internals
 * (BUG-260529-02 kept SEPARATE), and they NEVER leak raw JSON.
 */
import { describe, it, expect, afterEach } from "vitest"
import { render, screen, cleanup } from "@testing-library/react"
import { SeamPointer } from "../SeamPointer"
import { SeamCard } from "../SeamCard"
import { PausedRunCue } from "../PausedRunCue"

afterEach(cleanup)

describe("Chat↔Panel Seam (D-05) — live pointer vs reload card", () => {
  it("live mode → renders SeamPointer: a quiet one-line 'see panel' pointer, NOT a rich duplicate card", () => {
    const { container } = render(<SeamPointer kind="write_todos" />)
    expect(screen.getByText(/updated todos/i)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /see panel/i })).toBeInTheDocument()
    // a quiet one-liner, not a rich card: no bordered card chrome / no headings
    expect(container.querySelector("[role='region']")).toBeNull()
    expect(container.querySelector("h1,h2,h3,h4")).toBeNull()
  })

  it("live workspace_write pointer names the file ('wrote <file> · see panel')", () => {
    render(<SeamPointer kind="workspace_write" label="summary.md" />)
    expect(screen.getByText(/wrote summary\.md/i)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /see panel/i })).toBeInTheDocument()
  })

  it("reload mode → renders SeamCard: a self-contained card carrying the resolved Q&A (closes the ask_user reload gap)", () => {
    render(
      <SeamCard
        kind="ask_user"
        payload={{ question: "Which dataset for the Q3 rollup?", answer: "prod_sales_2026" }}
      />,
    )
    expect(screen.getByText(/which dataset for the q3 rollup\?/i)).toBeInTheDocument()
    expect(screen.getByText(/you answered/i)).toBeInTheDocument()
    expect(screen.getByText("prod_sales_2026")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /open panel/i })).toBeInTheDocument()
  })

  it("reload SeamCard for workspace_write renders a file chip + version", () => {
    render(<SeamCard kind="workspace_write" payload={{ path: "summary.md", version: 3 }} />)
    expect(screen.getByText("summary.md")).toBeInTheDocument()
    expect(screen.getByText("· v3")).toBeInTheDocument()
  })

  it("reload SeamCard for write_todos renders the final-state note '☑ N todos · all done'", () => {
    render(<SeamCard kind="write_todos" payload={{ todoTotal: 3, todoDone: 3 }} />)
    expect(screen.getByText(/☑ 3 todos · all done/i)).toBeInTheDocument()
  })

  it("never renders raw JSON / a raw byte dump for a panel-owned tool (write_todos / workspace_write / ask_user)", () => {
    const { container: c1 } = render(
      <SeamPointer kind="workspace_write" label="summary.md" />,
    )
    const { container: c2 } = render(
      <SeamCard
        kind="ask_user"
        payload={{ question: "Q?", answer: "A", path: "x.md", version: 1, todoTotal: 1, todoDone: 1 }}
      />,
    )
    // no stringified object braces in the rendered text
    expect(c1.textContent).not.toMatch(/[{}]/)
    expect(c2.textContent).not.toMatch(/[{}]/)
  })

  it("PausedRunCue is additive: a calm-loud paused cue + composer-lock hint, no RunCard internals", () => {
    render(<PausedRunCue />)
    expect(screen.getByText(/awaiting your answer/i)).toBeInTheDocument()
    expect(screen.getByText(/agent is paused/i)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /answer in panel/i })).toBeInTheDocument()
  })
})
