/**
 * Phase 298-04 (ORG-03 / D-11 / UI-D8 / UI-D9) — the history column during an org switch.
 *
 * With `loading` (ChatLayout passes `useThreads().switching`) the column says
 * "Loading your chats…" in place of the list and never "No recent chats". Without it, the
 * shipped empty sentence is unchanged — first paint is Phase 299's (BUG-261027-02), not this
 * plan's. A thread still streaming from the org that was left is not listed, and nothing throws.
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"
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

// Phase 298-05 (D-17 / UI-D4) — a one-line probe that proves WHERE the elsewhere line mounts. The
// real line renders nothing without 2+ orgs, so standing it in changes no other case here.
vi.mock("@/components/org/ElsewhereLine", () => ({
  ElsewhereLine: ({ kind, className }: { kind: string; className?: string }) => (
    <div data-testid="elsewhere-probe" data-kind={kind} data-class={className ?? ""} />
  ),
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

// ── Phase 298-05 (D-17 / UI-D4) — the elsewhere line's mount point ──────────────────────────
describe("ChatHistoryColumn — the elsewhere line (298-05)", () => {
  it("mounts ONE threads line at the top of the list, above the first group", () => {
    renderColumn({ threads: [mkThread("t1", "Budget chat")] })
    const probes = screen.getAllByTestId("elsewhere-probe")
    expect(probes).toHaveLength(1)
    expect(probes[0]).toHaveAttribute("data-kind", "threads")
    expect(probes[0].compareDocumentPosition(screen.getByText("Budget chat")) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it("is still there under a title filter that matches nothing (it counts more chats, not matches)", () => {
    renderColumn({ threads: [mkThread("t1", "Budget chat")] })
    fireEvent.change(screen.getByPlaceholderText("Filter this list…"), { target: { value: "zzz" } })
    expect(screen.getByText("No chats match your search.")).toBeInTheDocument()
    expect(screen.getByTestId("elsewhere-probe")).toHaveAttribute("data-kind", "threads")
  })
})
