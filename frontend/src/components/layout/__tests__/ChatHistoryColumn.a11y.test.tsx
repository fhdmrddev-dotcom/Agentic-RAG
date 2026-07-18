/**
 * Phase 156 (POLISH-01, Wave 1) — ChatHistoryColumn a11y do-no-harm (A11Y-01).
 *
 * Replaces the Wave-0 `it.todo` scaffold. Locks the Phase-155 A11Y-01 invariants the
 * MOVE must preserve: no axe AA violations across populated / empty / filtered, real
 * <button> rows (keyboard-operable primary target), the Stop/options actions are
 * SIBLINGS of the row button (never nested buttons), and the actions container is
 * CSS-gated on group-focus-within (keyboard-reachable, never render-gated).
 *
 * StreamsProvider is MOCKED so the SEED-064 dot / Stop + ActiveRunsTray render
 * without a real provider.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, within, fireEvent, cleanup } from "@testing-library/react"
import { axe } from "vitest-axe"
import type { Thread, Folder } from "@/types"

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

const NOW = Date.now()
const iso = (msAgo: number) => new Date(NOW - msAgo).toISOString()
const HOUR = 3_600_000
const DAY = 86_400_000

const folders: Folder[] = [
  { id: "f-fin", user_id: "u", name: "Finance", parent_id: null, is_global: false, created_at: iso(90 * DAY), updated_at: iso(90 * DAY) },
]

function mkThread(id: string, title: string, folderId: string | null, msAgo: number): Thread {
  return { id, user_id: "u", title, folder_id: folderId, created_at: iso(msAgo), updated_at: iso(msAgo) }
}

const threads: Thread[] = [
  mkThread("t-today-1", "Q3 revenue variance analysis", "f-fin", 1 * HOUR),
  mkThread("t-week", "Compare GPT-5.6 vs Opus", null, 3 * DAY),
  mkThread("t-older", "Old prototype brainstorm", null, 60 * DAY),
]

type ColProps = React.ComponentProps<typeof ChatHistoryColumn>

function props(overrides: Partial<ColProps> = {}): ColProps {
  return {
    threads,
    selectedThread: null,
    onSelectThread: vi.fn(),
    onNewThread: vi.fn(),
    onDeleteThread: vi.fn().mockResolvedValue(undefined),
    onRenameThread: vi.fn().mockResolvedValue(undefined),
    folders,
    ...overrides,
  }
}

beforeEach(() => {
  streamingIds.clear()
  stopThread.mockClear()
})
afterEach(() => cleanup())

describe("ChatHistoryColumn a11y — no axe AA violations across states (A11Y-01)", () => {
  it("axe(container) reports no violations — populated", async () => {
    const { container } = render(<ChatHistoryColumn {...props()} />)
    await screen.findByText("Q3 revenue variance analysis")
    expect(await axe(container)).toHaveNoViolations()
  })

  it("axe(container) reports no violations — empty", async () => {
    const { container } = render(<ChatHistoryColumn {...props({ threads: [] })} />)
    await screen.findByText("No recent chats")
    expect(await axe(container)).toHaveNoViolations()
  })

  it("axe(container) reports no violations — filtered (mid-search)", async () => {
    const { container } = render(<ChatHistoryColumn {...props()} />)
    fireEvent.change(screen.getByPlaceholderText("Filter this list…"), { target: { value: "revenue" } })
    await screen.findByText("revenue")
    expect(await axe(container)).toHaveNoViolations()
  })
})

describe("ChatHistoryColumn a11y — keyboard-reachable rows + actions (A11Y-01 / D-09)", () => {
  it("every thread row is a real <button> (keyboard-operable primary target)", () => {
    render(<ChatHistoryColumn {...props()} />)
    expect(screen.getByRole("button", { name: /Q3 revenue variance analysis/ })).toBeInTheDocument()
  })

  it("the Stop/options actions are siblings of the row button (never nested buttons)", () => {
    render(<ChatHistoryColumn {...props()} />)
    const rowBtn = screen.getByRole("button", { name: /Q3 revenue variance analysis/ })
    // the options button is NOT a descendant of the primary row button
    expect(within(rowBtn).queryByRole("button", { name: "Thread options" })).toBeNull()
  })

  it("the row actions container is CSS-gated on group-focus-within — never render-gated", () => {
    render(<ChatHistoryColumn {...props()} />)
    const optionsBtn = screen.getAllByRole("button", { name: "Thread options" })[0]
    const actionsDiv = optionsBtn.parentElement!
    expect(actionsDiv.className).toContain("group-focus-within:opacity-100")
  })
})
