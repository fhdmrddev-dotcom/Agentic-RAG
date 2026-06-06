/**
 * Phase 075.2 Plan 02 Task 2 — MessageItem Final Outputs panel render coverage
 * (BUG-260521-02 / D-075.2-05 / D-075.2-07).
 *
 * Locks the new behaviour: the pinned output-files panel in MessageItem
 * renders an OutputFileCard per file, with url-optional back-compat, and
 * continues to honor the empty-state guard (panel does not render when
 * finalOutputFiles is absent or empty).
 *
 * Phase 095 Plan 05 (D-07) EXTENSION — the hero / working split:
 *   - a fixture with 1 is_hero + N working → hero rendered emphasized/separate
 *     ("★ Your file"), working in a collapsible group, ALL downloadable when url
 *     present;
 *   - a url-less file → affordance CLEARLY DISABLED (dead state), never a silent
 *     dead anchor;
 *   - an older fixture with NO is_hero on any file → all render as working
 *     (graceful, no crash).
 *
 * Helpers mirror Plan04.frontend.test.tsx so the two files stay independent.
 */
import { describe, it, expect } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
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
// Phase 095 Plan 05 (D-07) — hero / working split
// ---------------------------------------------------------------------------
describe("MessageItem — hero / working split (Phase 095 D-07)", () => {
  it("heroes the is_hero file in a separate emphasized block above a collapsible Working files group; ALL files downloadable", () => {
    const m = makeMessage({
      finalOutputFiles: [
        { filename: "report.docx", url: "/sandbox-outputs/report.docx", is_hero: true },
        { filename: "scratch.csv", url: "/sandbox-outputs/scratch.csv" },
        { filename: "chart.png", url: "/sandbox-outputs/chart.png" },
      ],
    } as Partial<Message>)
    const { container } = renderWithTooltip(<MessageItem message={m} isStreaming={false} />)

    // hero block present + separate; carries the "★ Your file" caption
    const heroGroup = screen.getByTestId("final-outputs-hero")
    expect(heroGroup).toBeTruthy()
    expect(heroGroup.querySelector("a[download='report.docx']")).not.toBeNull()
    expect(screen.getAllByText("★ Your file").length).toBe(1)

    // working group present, labelled with the count (2 = the non-hero files)
    // + the sketch-016 intermediates copy (095-08 GAP-095-03 LOW)
    expect(screen.getByText(/Working files \(2\) — intermediates, all downloadable/)).toBeTruthy()
    const workingGroup = screen.getByTestId("final-outputs-working")
    // ALL files downloadable (re-rank, never hide) — both working files are anchors
    expect(workingGroup.querySelector("a[download='scratch.csv']")).not.toBeNull()
    expect(workingGroup.querySelector("a[download='chart.png']")).not.toBeNull()
    // the hero is NOT duplicated inside the working group
    expect(workingGroup.querySelector("a[download='report.docx']")).toBeNull()

    // every emitted file has a download affordance somewhere in the panel
    expect(container.querySelectorAll("a[download]").length).toBe(3)
  })

  it("the Working files group is collapsible (visible by default, toggles closed)", () => {
    const m = makeMessage({
      finalOutputFiles: [
        { filename: "deck.pptx", url: "/sandbox-outputs/deck.pptx", is_hero: true },
        { filename: "notes.md", url: "/sandbox-outputs/notes.md" },
      ],
    } as Partial<Message>)
    renderWithTooltip(<MessageItem message={m} isStreaming={false} />)

    const toggle = screen.getByRole("button", { name: /Working files \(1\)/ })
    // visible by default
    expect(toggle.getAttribute("aria-expanded")).toBe("true")
    expect(screen.getByText("notes.md")).toBeTruthy()
    // collapse
    fireEvent.click(toggle)
    expect(toggle.getAttribute("aria-expanded")).toBe("false")
    expect(screen.queryByText("notes.md")).toBeNull()
  })

  it("D-07 dead-link: a url-less file renders a clearly-disabled affordance, NOT a silent dead anchor", () => {
    const m = makeMessage({
      finalOutputFiles: [
        { filename: "legacy.png" }, // no url, no is_hero → working, dead state
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

  it("graceful: an older fixture with NO is_hero on any file → all render as working (no hero block, no crash)", () => {
    const m = makeMessage({
      finalOutputFiles: [
        { filename: "a.png", url: "/sandbox-outputs/a.png" },
        { filename: "b.png", url: "/sandbox-outputs/b.png" },
      ],
    } as Partial<Message>)
    const { container } = renderWithTooltip(<MessageItem message={m} isStreaming={false} />)
    // no hero block
    expect(screen.queryByTestId("final-outputs-hero")).toBeNull()
    expect(screen.queryByText("★ Your file")).toBeNull()
    // all files in the working group, all downloadable
    expect(screen.getByText(/Working files \(2\) — intermediates, all downloadable/)).toBeTruthy()
    expect(container.querySelector("a[download='a.png']")).not.toBeNull()
    expect(container.querySelector("a[download='b.png']")).not.toBeNull()
  })
})
