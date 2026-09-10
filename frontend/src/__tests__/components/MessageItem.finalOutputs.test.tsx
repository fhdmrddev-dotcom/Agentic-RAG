/**
 * Phase 075.2 Plan 02 Task 2 — MessageItem Final Outputs panel render coverage
 * (BUG-260521-02 / D-075.2-05 / D-075.2-07).
 *
 * Locks the new behaviour: the pinned output-files panel in MessageItem
 * renders an OutputFileCard per file, with url-optional back-compat, and
 * continues to honor the empty-state guard (panel does not render when
 * finalOutputFiles is absent or empty).
 *
 * Phase 095.1 Plan 05 (D-095.1-06) REVERSAL — the FLAT "Generated files" list:
 *   - the hero/working split (the old 095-05/08 visual) is REMOVED per the
 *     operator-approved CONTEXT.md decision. Output files now render as ONE
 *     equal flat list — no "★ Your file" hero crown, no hero/working split, no
 *     "Working files (N)" collapse group;
 *   - a multi-file fixture (some with is_hero: true) renders exactly N flat
 *     rows; the frontend IGNORES is_hero (no read, no crash);
 *   - every file is present and downloadable;
 *   - a url-less file → affordance CLEARLY DISABLED (dead state), never a silent
 *     dead anchor (the orthogonal honesty fix is KEPT).
 *
 * Helpers mirror Plan04.frontend.test.tsx so the two files stay independent.
 */
import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import type { ReactElement } from "react"
import { TooltipProvider } from "@/components/ui/tooltip"
import { MessageItem } from "@/components/chat/MessageItem"
import type { Message } from "@/types"

const NOW = new Date().toISOString()

function renderWithTooltip(ui: ReactElement) {
  return render(<TooltipProvider>{ui}</TooltipProvider>)
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
  } as Message
}

describe("MessageItem — output-files panel (BUG-260521-02)", () => {
  it("D-075.2-05: renders an OutputFileCard with anchor + download attr when url is present", () => {
    const m = makeMessage({
      finalOutputFiles: [
        { filename: "chart1.png", url: "/sandbox-outputs/chart1.png" },
      ],
    } as Partial<Message>)
    const { container } = renderWithTooltip(<MessageItem message={m} isStreaming={false} />)
    const link = container.querySelector("a[download='chart1.png']") as HTMLAnchorElement | null
    expect(link).not.toBeNull()
    expect(link?.getAttribute("href")).toContain("/sandbox-outputs/chart1.png")
    expect(screen.getByText("chart1.png")).toBeTruthy()
  })

  it("D-075.2-07: empty-state — panel does not render when finalOutputFiles is absent", () => {
    const m = makeMessage({ content: "Done." })
    renderWithTooltip(<MessageItem message={m} isStreaming={false} />)
    expect(screen.queryByTestId("final-outputs-panel")).toBeNull()
  })

  it("D-075.2-07: empty-state — panel does not render when finalOutputFiles is empty array", () => {
    const m = makeMessage({ finalOutputFiles: [] } as Partial<Message>)
    renderWithTooltip(<MessageItem message={m} isStreaming={false} />)
    expect(screen.queryByTestId("final-outputs-panel")).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Phase 095.1 Plan 05 (D-095.1-06) — flat "Generated files" list (reverses the
// 095-05/08 hero/working split per the operator-approved CONTEXT.md decision)
// ---------------------------------------------------------------------------
describe("MessageItem — flat Generated-files list (Phase 095.1 D-06)", () => {
  it("renders ALL files as one flat list of equal rows; NO hero crown, NO Working-files group, is_hero ignored", () => {
    const m = makeMessage({
      finalOutputFiles: [
        // is_hero is present on the first entry — the frontend must IGNORE it.
        { filename: "report.docx", url: "/sandbox-outputs/report.docx", is_hero: true },
        { filename: "scratch.csv", url: "/sandbox-outputs/scratch.csv" },
        { filename: "chart.png", url: "/sandbox-outputs/chart.png" },
      ],
    } as Partial<Message>)
    const { container } = renderWithTooltip(<MessageItem message={m} isStreaming={false} />)

    // the eyebrow + the panel data-testid are preserved
    const panel = screen.getByTestId("final-outputs-panel")
    expect(panel).toBeTruthy()
    expect(screen.getByText("Generated files")).toBeTruthy()

    // exactly N flat download rows, all downloadable
    expect(container.querySelectorAll("a[download]").length).toBe(3)
    expect(container.querySelector("a[download='report.docx']")).not.toBeNull()
    expect(container.querySelector("a[download='scratch.csv']")).not.toBeNull()
    expect(container.querySelector("a[download='chart.png']")).not.toBeNull()

    // NO hero crown / caption, NO hero block, NO working-files split group
    expect(screen.queryByText("★ Your file")).toBeNull()
    expect(screen.queryByTestId("final-outputs-hero")).toBeNull()
    expect(screen.queryByTestId("final-outputs-working")).toBeNull()
    expect(screen.queryByText(/Working files/)).toBeNull()
  })

  it("D-06 dead-link KEPT: a url-less file renders a clearly-disabled affordance, NOT a silent dead anchor", () => {
    const m = makeMessage({
      finalOutputFiles: [
        { filename: "legacy.png" }, // no url → dead state affordance (orthogonal honesty fix, kept)
      ],
    } as Partial<Message>)
    const { container } = renderWithTooltip(<MessageItem message={m} isStreaming={false} />)
    // filename still shown
    expect(screen.getByText("legacy.png")).toBeTruthy()
    // NO download anchor (it has no url)
    expect(container.querySelector("a[download='legacy.png']")).toBeNull()
    // but a CLEARLY-DISABLED affordance is present (not a silent plain filename)
    expect(container.querySelector("[data-dead='true']")).not.toBeNull()
    expect(screen.getByText("Download unavailable")).toBeTruthy()
  })

  it("graceful: a fixture with NO is_hero on any file → identical flat list (no hero block, no crash)", () => {
    const m = makeMessage({
      finalOutputFiles: [
        { filename: "a.png", url: "/sandbox-outputs/a.png" },
        { filename: "b.png", url: "/sandbox-outputs/b.png" },
      ],
    } as Partial<Message>)
    const { container } = renderWithTooltip(<MessageItem message={m} isStreaming={false} />)
    // no hero block, no crown
    expect(screen.queryByTestId("final-outputs-hero")).toBeNull()
    expect(screen.queryByText("★ Your file")).toBeNull()
    // both files flat + downloadable
    expect(container.querySelectorAll("a[download]").length).toBe(2)
    expect(container.querySelector("a[download='a.png']")).not.toBeNull()
    expect(container.querySelector("a[download='b.png']")).not.toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Phase 095.1 Plan 05 (D-095.1-07) — deliverable-aware Resume gate
// A run that already produced its deliverables (execute_code output files) before
// a later iteration failed/timed_out does NOT falsely offer Resume. Closes
// BUG-260518-01 (resume-after-success genuine-terminal case 075 didn't cover).
// ---------------------------------------------------------------------------
describe("MessageItem — deliverable-aware Resume gate (Phase 095.1 D-07)", () => {
  const onResume = vi.fn()

  function queryResume() {
    return screen.queryByRole("button", { name: /retry turn/i })
  }

  it("failed run WITH deliverables → NO Resume button (the BUG-260518-01 case)", () => {
    // content present so the Resume gate (nested in the content block) is genuinely
    // exercised — the run succeeded enough to answer + produce a file, then failed.
    const m = makeMessage({
      runStatus: "failed",
      content: "Here is your report. (the run later failed)",
      finalOutputFiles: [{ filename: "report.docx", url: "/sandbox-outputs/report.docx" }],
    } as Partial<Message>)
    renderWithTooltip(<MessageItem message={m} isStreaming={false} onResume={onResume} />)
    expect(queryResume()).toBeNull()
  })

  it("failed run with NO deliverables → Resume button shown (unchanged)", () => {
    const m = makeMessage({ runStatus: "failed", content: "Something broke." } as Partial<Message>)
    renderWithTooltip(<MessageItem message={m} isStreaming={false} onResume={onResume} />)
    expect(queryResume()).not.toBeNull()
  })

  it("timed_out run WITH deliverables → NO Resume button", () => {
    const m = makeMessage({
      runStatus: "timed_out",
      content: "Generated the CSV before the run timed out.",
      finalOutputFiles: [{ filename: "out.csv", url: "/sandbox-outputs/out.csv" }],
    } as Partial<Message>)
    renderWithTooltip(<MessageItem message={m} isStreaming={false} onResume={onResume} />)
    expect(queryResume()).toBeNull()
  })

  it("timed_out run with NO deliverables → Resume button shown (unchanged)", () => {
    const m = makeMessage({ runStatus: "timed_out", content: "Took too long." } as Partial<Message>)
    renderWithTooltip(<MessageItem message={m} isStreaming={false} onResume={onResume} />)
    expect(queryResume()).not.toBeNull()
  })

  it("completed run → NO Resume button (unchanged)", () => {
    const m = makeMessage({ runStatus: "completed", content: "All done." } as Partial<Message>)
    renderWithTooltip(<MessageItem message={m} isStreaming={false} onResume={onResume} />)
    expect(queryResume()).toBeNull()
  })
})
