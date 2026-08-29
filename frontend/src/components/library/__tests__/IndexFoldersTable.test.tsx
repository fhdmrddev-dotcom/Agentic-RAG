/**
 * Phase 217.1 plan 10 (LIB-01 / BE-2 / D-217.1-27) — the Folders index table.
 *
 * ⛔ THE HONEST ROOT ROW is "the point of the tab" (D-217.1-31): a zero-chunk folder reads
 * `–` and `never`, never `0` and never a green/ready tick.
 */
import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { IndexSummary } from "@/lib/api"

const kickReembed = vi.fn()
vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>()
  return {
    ...actual,
    kickReembed: (...a: unknown[]) => kickReembed(...(a as [])),
  }
})

import { FoldersIndexTable } from "../indexing/FoldersIndexTable"

const summary: IndexSummary = {
  vectors: 224,
  chunks_total: 224,
  documents_without_vectors: 0,
  last_indexed: "2026-08-29T10:00:00Z",
  model: "text-embedding-3-small",
  dimensions: 1536,
  provider: "openai",
  folders: [
    {
      folder_id: "f-legal",
      name: "Legal",
      documents: 4,
      chunks: 40,
      vectors: 40,
      last_indexed: "2026-08-29T09:00:00Z",
    },
    {
      folder_id: null,
      name: "Root",
      documents: 2,
      chunks: 0,
      vectors: 0,
      last_indexed: null,
    },
  ],
}

describe("FoldersIndexTable — renders one row per folder, honestly", () => {
  it("renders a row for every folder in the summary", () => {
    render(<FoldersIndexTable summary={summary} canManage={true} />)
    expect(screen.getByText("Legal")).toBeInTheDocument()
    expect(screen.getByText("Root")).toBeInTheDocument()
  })

  it("the zero-chunk Root row reads – and never, NEVER 0 and never a tick", () => {
    render(<FoldersIndexTable summary={summary} canManage={true} />)
    const rootRow = screen
      .getAllByRole("row")
      .find((r) => r.textContent?.includes("Root"))
    expect(rootRow).toBeTruthy()
    // documents/chunks/vectors → – ; last indexed → never. No 0 anywhere in the row.
    expect(rootRow!.textContent).toContain("–")
    expect(rootRow!.textContent).toContain("never")
    expect(rootRow!.textContent).not.toContain("0")
  })
})

describe("FoldersIndexTable — the Re-index selected gate", () => {
  it("a stale non-empty folder renders Re-index selected; clicking calls kickReembed with the folder id", async () => {
    const user = userEvent.setup()
    kickReembed.mockResolvedValue({ status: "complete", remaining: 0 })
    render(<FoldersIndexTable summary={summary} canManage={true} />)
    const btn = screen.getByTestId("reindex-f-legal")
    expect(btn).toBeInTheDocument()
    await user.click(btn)
    expect(kickReembed).toHaveBeenCalledWith({ folder_ids: ["f-legal"] })
  })

  it("a zero-chunk folder's Actions cell carries NO action", () => {
    render(<FoldersIndexTable summary={summary} canManage={true} />)
    const rootRow = screen
      .getAllByRole("row")
      .find((r) => r.textContent?.includes("Root"))
    // No button, no dead control — the row's actions cell is a quiet em-dash.
    expect(screen.queryByTestId("reindex-root")).not.toBeInTheDocument()
    expect(rootRow!.textContent).toContain("—")
  })

  it("an already-current folder shows 'Already indexed with the current model.' on click (BE-3), not false success", async () => {
    const user = userEvent.setup()
    kickReembed.mockResolvedValue({
      status: "complete",
      total: 40,
      re_embedded: 0,
      remaining: 0,
      scope: "already_current",
    })
    render(<FoldersIndexTable summary={summary} canManage={true} />)
    await user.click(screen.getByTestId("reindex-f-legal"))
    expect(await screen.findByText("Already indexed with the current model.")).toBeInTheDocument()
    expect(screen.queryByText("Queued.")).not.toBeInTheDocument()
  })

  it("with canManage false, no Re-index selected button renders (VANISH, not disabled)", () => {
    render(<FoldersIndexTable summary={summary} canManage={false} />)
    expect(screen.queryByTestId("reindex-f-legal")).not.toBeInTheDocument()
    expect(screen.queryByTestId("reindex-root")).not.toBeInTheDocument()
  })
})
