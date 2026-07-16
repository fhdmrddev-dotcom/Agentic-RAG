/**
 * Phase 156 (POLISH-01, Wave 1) — ChatHistoryColumn live contract (SC#2 inline +
 * SC#3 + D-09).
 *
 * Replaces the Wave-0 `it.todo` scaffold: the column now exists (the lifted
 * NavPanel.renderThreadList wrapped with the inline filter + date grouping). These
 * tests lock the inline search (SC#2 — narrow / highlight / fold / honest empty),
 * the date grouping (SC#3 — grouped headers + counts), and every preserved row
 * behavior the MOVE-not-rewrite keeps intact (D-09 — folder chip, options menu,
 * delete-confirm, SEED-064 dot + Stop, inline rename, row select).
 *
 * StreamsProvider is MOCKED (RESEARCH Pitfall 5) so the SEED-064 dot / Stop and the
 * ActiveRunsTray render without a real provider.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, within, fireEvent, cleanup } from "@testing-library/react"
import type { Thread, Folder } from "@/types"

// A controllable streaming-ids Set + a stop spy, shared by the column and its
// ActiveRunsTray — both pull these hooks from StreamsProvider.
const { streamingIds, stopThread } = vi.hoisted(() => ({
  streamingIds: new Set<string>(),
  stopThread: vi.fn(),
}))

vi.mock("@/providers/StreamsProvider", () => ({
  useStreamingThreadIds: () => streamingIds,
  useStreamActions: () => ({ stopThread }),
  getActiveRunStartMs: () => null,
}))

import { ChatHistoryColumn } from "../ChatHistoryColumn"

// Fixed base instant so bucketing + within-bucket order are deterministic (no fake
// timers — the component's groupByDate() reads real `new Date()`, milliseconds after
// these, well inside every bucket margin).
const NOW = Date.now()
const iso = (msAgo: number) => new Date(NOW - msAgo).toISOString()
const HOUR = 3_600_000
const DAY = 86_400_000

const folders: Folder[] = [
  { id: "f-fin", user_id: "u", name: "Finance", parent_id: null, is_global: false, created_at: iso(90 * DAY), updated_at: iso(90 * DAY) },
  { id: "f-eng", user_id: "u", name: "Engineering", parent_id: null, is_global: false, created_at: iso(90 * DAY), updated_at: iso(90 * DAY) },
]

function mkThread(id: string, title: string, folderId: string | null, msAgo: number): Thread {
  return { id, user_id: "u", title, folder_id: folderId, created_at: iso(msAgo), updated_at: iso(msAgo) }
}

// t-today-1 is the MOST recent (1h) → sorts first within Today (DESC) → the [0] row.
const threads: Thread[] = [
  mkThread("t-today-1", "Q3 revenue variance analysis", "f-fin", 1 * HOUR), // Today
  mkThread("t-today-2", "Debug embedding drift", "f-eng", 2 * HOUR),        // Today
  mkThread("t-week", "Compare GPT-5.6 vs Opus", "f-eng", 3 * DAY),          // Last 7 days
  mkThread("t-month", "Board deck outline", "f-fin", 15 * DAY),             // Last 30 days
  mkThread("t-older", "Old prototype brainstorm", null, 60 * DAY),          // Older
]

type ColProps = React.ComponentProps<typeof ChatHistoryColumn>

function renderColumn(overrides: Partial<ColProps> = {}) {
  const props: ColProps = {
    threads,
    selectedThread: null,
    onSelectThread: vi.fn(),
    onNewThread: vi.fn(),
    onDeleteThread: vi.fn().mockResolvedValue(undefined),
    onRenameThread: vi.fn().mockResolvedValue(undefined),
    folders,
    ...overrides,
  }
  const utils = render(<ChatHistoryColumn {...props} />)
  return { ...utils, props }
}

beforeEach(() => {
  streamingIds.clear()
  stopThread.mockClear()
})
afterEach(() => cleanup())

describe("ChatHistoryColumn — date grouping (SC#3)", () => {
  it("renders threads grouped by date with a group header per bucket", () => {
    renderColumn()
    expect(screen.getByText("Today")).toBeInTheDocument()
    expect(screen.getByText("Last 7 days")).toBeInTheDocument()
    expect(screen.getByText("Last 30 days")).toBeInTheDocument()
    expect(screen.getByText("Older")).toBeInTheDocument()
  })

  it("shows the per-group count in each group header", () => {
    renderColumn()
    const todayHead = screen.getByText("Today").closest("div")!
    expect(within(todayHead).getByText("2")).toBeInTheDocument() // 2 threads Today
    const olderHead = screen.getByText("Older").closest("div")!
    expect(within(olderHead).getByText("1")).toBeInTheDocument()
  })
})

describe("ChatHistoryColumn — inline filter (SC#2)", () => {
  it('typing in the "Filter this list…" input narrows rows to title-substring matches', () => {
    renderColumn()
    expect(screen.getByText("Board deck outline")).toBeInTheDocument()

    const input = screen.getByPlaceholderText("Filter this list…")
    fireEvent.change(input, { target: { value: "revenue" } })

    // non-matching rows are gone; the matching row survives (title now split by <mark>)
    expect(screen.queryByText("Board deck outline")).not.toBeInTheDocument()
    expect(screen.queryByText("Debug embedding drift")).not.toBeInTheDocument()
    expect(screen.getByText("revenue")).toBeInTheDocument()

    // clearing the box restores all rows
    fireEvent.change(input, { target: { value: "" } })
    expect(screen.getByText("Board deck outline")).toBeInTheDocument()
  })

  it("wraps the matched substring in a <mark> (safe JSX highlight, no innerHTML)", () => {
    const { container } = renderColumn()
    fireEvent.change(screen.getByPlaceholderText("Filter this list…"), { target: { value: "revenue" } })
    const mark = container.querySelector("mark")
    expect(mark).not.toBeNull()
    expect(mark).toHaveTextContent("revenue")
  })

  it("folds away groups whose rows no longer match", () => {
    renderColumn()
    fireEvent.change(screen.getByPlaceholderText("Filter this list…"), { target: { value: "revenue" } })
    // "revenue" is a Today thread → only the Today header remains
    expect(screen.getByText("Today")).toBeInTheDocument()
    expect(screen.queryByText("Last 7 days")).not.toBeInTheDocument()
    expect(screen.queryByText("Last 30 days")).not.toBeInTheDocument()
    expect(screen.queryByText("Older")).not.toBeInTheDocument()
  })

  it('shows the honest empty-state "No chats match your search." when nothing matches', () => {
    renderColumn()
    fireEvent.change(screen.getByPlaceholderText("Filter this list…"), { target: { value: "zzz-no-such-chat" } })
    expect(screen.getByText("No chats match your search.")).toBeInTheDocument()
  })
})

describe("ChatHistoryColumn — preserved row behaviors (D-09)", () => {
  it('renders a folder chip (or "Unfiled") per row', () => {
    renderColumn()
    expect(screen.getAllByText("Finance")).toHaveLength(2)     // Q3 + Board deck
    expect(screen.getAllByText("Engineering")).toHaveLength(2) // Debug + Compare
    expect(screen.getByText("Unfiled")).toBeInTheDocument()    // Old prototype (null folder)
  })

  it("the per-row options menu opens Rename + Delete", () => {
    renderColumn()
    fireEvent.click(screen.getAllByRole("button", { name: "Thread options" })[0])
    expect(screen.getByText("Rename")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Delete Thread" })).toBeInTheDocument()
  })

  it('Delete opens the "Delete thread?" confirm dialog', () => {
    renderColumn()
    fireEvent.click(screen.getAllByRole("button", { name: "Thread options" })[0])
    fireEvent.click(screen.getByRole("button", { name: "Delete Thread" }))
    expect(screen.getByText("Delete thread?")).toBeInTheDocument()
  })

  it("the SEED-064 running dot + Stop button appear for a streaming thread", () => {
    streamingIds.add("t-today-1")
    renderColumn()
    expect(screen.getByLabelText("Run in progress")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Stop run" })).toBeInTheDocument()
  })

  it("inline rename commits on Enter", () => {
    const { props } = renderColumn()
    fireEvent.click(screen.getAllByRole("button", { name: "Thread options" })[0]) // Q3 (t-today-1)
    fireEvent.click(screen.getByText("Rename"))
    const input = screen.getByDisplayValue("Q3 revenue variance analysis")
    fireEvent.change(input, { target: { value: "Renamed thread" } })
    fireEvent.keyDown(input, { key: "Enter" })
    expect(props.onRenameThread).toHaveBeenCalledWith("t-today-1", "Renamed thread")
  })

  it("inline rename cancels on Escape without calling onRenameThread", () => {
    const { props } = renderColumn()
    fireEvent.click(screen.getAllByRole("button", { name: "Thread options" })[0])
    fireEvent.click(screen.getByText("Rename"))
    const input = screen.getByDisplayValue("Q3 revenue variance analysis")
    fireEvent.change(input, { target: { value: "Discarded" } })
    fireEvent.keyDown(input, { key: "Escape" })
    expect(props.onRenameThread).not.toHaveBeenCalled()
    expect(screen.queryByDisplayValue("Discarded")).not.toBeInTheDocument()
  })

  it("clicking a row calls onSelectThread for that thread", () => {
    const { props } = renderColumn()
    fireEvent.click(screen.getByText("Board deck outline"))
    expect(props.onSelectThread).toHaveBeenCalledWith(expect.objectContaining({ id: "t-month" }))
  })
})

describe("ChatHistoryColumn — ⌘K chip (Wave 2 / onOpenPalette seam)", () => {
  it("renders the ⌘K chip and calls onOpenPalette when clicked", () => {
    const onOpenPalette = vi.fn()
    renderColumn({ onOpenPalette })
    fireEvent.click(screen.getByRole("button", { name: "Search all chats" }))
    expect(onOpenPalette).toHaveBeenCalledTimes(1)
  })

  it("omits the ⌘K chip when onOpenPalette is not provided (optional seam — no regression)", () => {
    renderColumn()
    expect(screen.queryByRole("button", { name: "Search all chats" })).not.toBeInTheDocument()
  })
})
