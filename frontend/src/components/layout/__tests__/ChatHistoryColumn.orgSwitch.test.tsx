/**
 * Phase 298-04 (ORG-03 / D-11 / UI-D8 / UI-D9) — the history column during an org switch.
 *
 * With `loading` (ChatLayout passes `useThreads().switching`) the column says
 * "Loading your chats…" in place of the list and never "No recent chats". Without it, the
 * shipped empty sentence is unchanged — first paint is Phase 299's (BUG-261027-02), not this
 * plan's. A thread still streaming from the org that was left is not listed, and nothing throws.
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import type { Folder, Thread } from "@/types"

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
import { LOADING_CHATS } from "@/components/org/orgItemsCopy"

const folders: Folder[] = []
function mkThread(id: string, title: string): Thread {
  const now = new Date().toISOString()
  return { id, user_id: "u", title, folder_id: null, created_at: now, updated_at: now }
}

type ColProps = React.ComponentProps<typeof ChatHistoryColumn>
function renderColumn(overrides: Partial<ColProps> = {}) {
  const props: ColProps = {
    threads: [],
    selectedThread: null,
    onSelectThread: vi.fn(),
    onNewThread: vi.fn(),
    onDeleteThread: vi.fn().mockResolvedValue(undefined),
    onRenameThread: vi.fn().mockResolvedValue(undefined),
    folders,
    ...overrides,
  }
  return render(<ChatHistoryColumn {...props} />)
}

beforeEach(() => {
  streamingIds.clear()
  stopThread.mockClear()
})

describe("ChatHistoryColumn — an org switch (298-04)", () => {
  it("loading: says 'Loading your chats…' and NEVER 'No recent chats'", () => {
    renderColumn({ loading: true })
    expect(screen.getByRole("status")).toHaveTextContent(LOADING_CHATS)
    expect(screen.getByText("Loading your chats…")).toBeInTheDocument()
    expect(screen.queryByText("No recent chats")).toBeNull()
  })

  it("loading hides any rows it is handed (no old-org row while the new org loads)", () => {
    renderColumn({ loading: true, threads: [mkThread("t-old", "Old org chat")] })
    expect(screen.queryByText("Old org chat")).toBeNull()
    expect(screen.getByText("Loading your chats…")).toBeInTheDocument()
  })

  it("not loading and empty: the shipped sentence is unchanged (first paint is Phase 299's)", () => {
    renderColumn({ loading: false })
    expect(screen.getByText("No recent chats")).toBeInTheDocument()
    expect(screen.queryByText("Loading your chats…")).toBeNull()
  })

  it("a thread still streaming from the org that was left is not listed, and the column renders", () => {
    streamingIds.add("t-streaming-old-org")
    renderColumn({ threads: [mkThread("t-new", "New org chat")] })
    expect(screen.getByText("New org chat")).toBeInTheDocument()
    // The column renders no row, chip or label for a thread its list does not hold.
    expect(document.body.innerHTML).not.toContain("t-streaming-old-org")
    expect(document.body.textContent ?? "").not.toMatch(/something went wrong/i)
  })
})
