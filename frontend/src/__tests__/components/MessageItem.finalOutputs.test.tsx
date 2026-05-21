/**
 * Phase 075.2 Plan 02 Task 2 — MessageItem Final Outputs panel render coverage
 * (BUG-260521-02 / D-075.2-05 / D-075.2-07).
 *
 * Locks the new behaviour: the pinned "Final outputs" panel in MessageItem
 * renders an OutputFileCard per file, with url-optional back-compat (plain
 * filename row when url is absent), and continues to honor the empty-state
 * guard (panel does not render when finalOutputFiles is absent or empty).
 *
 * Helpers mirror Plan04.frontend.test.tsx so the two files stay independent.
 */
import { describe, it, expect } from "vitest"
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

describe("MessageItem — Final Outputs panel (BUG-260521-02)", () => {
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

  it("D-075.2-05 back-compat: renders plain-text row (no anchor) when url is absent", () => {
    const m = makeMessage({
      finalOutputFiles: [{ filename: "legacy.png" }],
    } as Partial<Message>)
    const { container } = renderWithTooltip(<MessageItem message={m} isStreaming={false} />)
    expect(screen.getByText("legacy.png")).toBeTruthy()
    const link = container.querySelector("a[download='legacy.png']")
    expect(link).toBeNull()
  })

  it("D-075.2-07: empty-state — panel does not render when finalOutputFiles is absent", () => {
    const m = makeMessage({ content: "Done." })
    renderWithTooltip(<MessageItem message={m} isStreaming={false} />)
    expect(screen.queryByText("Final outputs")).toBeNull()
  })

  it("D-075.2-07: empty-state — panel does not render when finalOutputFiles is empty array", () => {
    const m = makeMessage({ finalOutputFiles: [] } as Partial<Message>)
    renderWithTooltip(<MessageItem message={m} isStreaming={false} />)
    expect(screen.queryByText("Final outputs")).toBeNull()
  })

  it("mixed: renders anchor for url-present entries and plain row for url-absent (same array)", () => {
    const m = makeMessage({
      finalOutputFiles: [
        { filename: "chart1.png", url: "/sandbox-outputs/chart1.png" },
        { filename: "legacy.png" },
      ],
    } as Partial<Message>)
    const { container } = renderWithTooltip(<MessageItem message={m} isStreaming={false} />)
    expect(container.querySelector("a[download='chart1.png']")).not.toBeNull()
    expect(container.querySelector("a[download='legacy.png']")).toBeNull()
    expect(screen.getByText("chart1.png")).toBeTruthy()
    expect(screen.getByText("legacy.png")).toBeTruthy()
  })
})
