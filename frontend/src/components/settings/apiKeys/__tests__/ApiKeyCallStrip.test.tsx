/**
 * Phase 293-04 (D-17) — the call strip: one tab stop, arrow keys between bars, Enter/Space for
 * the one-line detail, each bar named by its full sentence, read bars shorter than start bars.
 */
import { describe, expect, it } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { callDetailLine } from "../apiKeyFacts"
import { ApiKeyCallStrip } from "../ApiKeyCallStrip"
import { NOW, iso, makeCall } from "./fixtures"

// newest first, as the server sends them
const CALLS = [
  makeCall({ at: iso(2026, 9, 25, 10, 44), ok: false, reason: "unpublished", run_id: null, outcome: null }),
  makeCall({ at: iso(2026, 9, 25, 10, 43), verb: "read", outcome: "running", detail: { step_index: 1, step_total: 3 } }),
  makeCall({ at: iso(2026, 9, 25, 10, 42) }),
]

describe("293-04 ApiKeyCallStrip", () => {
  it("renders the bars oldest first with one tab stop and the caption", () => {
    render(<ApiKeyCallStrip calls={CALLS} now={NOW} label="n8n-prod" />)
    const bars = screen.getAllByTestId("call-bar")
    expect(bars.map((b) => b.getAttribute("data-kind"))).toEqual(["start", "read", "refused"])
    expect(bars.filter((b) => b.tabIndex === 0)).toHaveLength(1)
    expect(screen.getByTestId("call-strip-caption")).toHaveTextContent("last 3 calls · ■ start ■ read ■ refused · tap one")
  })

  it("each bar's accessible name is its full detail sentence", () => {
    render(<ApiKeyCallStrip calls={CALLS} now={NOW} label="n8n-prod" />)
    expect(screen.getByRole("button", { name: callDetailLine(CALLS[2], {}, NOW) })).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "10:44 · start · Contract review · no run · ✕ refused: workflow is no longer published" }),
    ).toBeInTheDocument()
  })

  it("read bars are shorter than start bars", () => {
    render(<ApiKeyCallStrip calls={CALLS} now={NOW} label="n8n-prod" />)
    const [start, read, refused] = screen.getAllByTestId("call-bar-mark")
    expect(start.className).toContain("h-4")
    expect(read.className).toContain("h-3")
    expect(refused.className).toContain("h-4")
  })

  it("ArrowRight / ArrowLeft move focus; Enter and Space open the detail line", async () => {
    const user = userEvent.setup()
    render(<ApiKeyCallStrip calls={CALLS} now={NOW} label="n8n-prod" />)
    const bars = screen.getAllByTestId("call-bar")
    await user.tab()
    expect(document.activeElement).toBe(bars[2]) // the newest call holds the tab stop
    await user.keyboard("{ArrowLeft}")
    expect(document.activeElement).toBe(bars[1])
    expect(bars[1].tabIndex).toBe(0)
    expect(bars[2].tabIndex).toBe(-1)
    await user.keyboard("{Enter}")
    expect(screen.getByTestId("call-detail")).toHaveTextContent("10:43 · read · Contract review · run 7f3a91 · ✓ running · step 1 of 3")
    await user.keyboard("{ArrowLeft}")
    await user.keyboard(" ")
    expect(screen.getByTestId("call-detail")).toHaveTextContent("✓ started")
    await user.keyboard("{ArrowRight}{ArrowRight}{ArrowRight}")
    expect(document.activeElement).toBe(bars[2])
  })

  it("no calls → the no-calls caption and no bars", () => {
    render(<ApiKeyCallStrip calls={[]} now={NOW} label="n8n-prod" />)
    expect(screen.queryAllByTestId("call-bar")).toHaveLength(0)
    expect(screen.getByText("no calls yet")).toBeInTheDocument()
  })
})
