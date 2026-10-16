/**
 * Phase 284-01 Task 3 (FIX-11 / D-07 / D-12 / UI-SPEC S5) — the folder detail band takes
 * NUMBERS, not the folder's documents.
 *
 * The band used to count `documents.length` and sum `file_size` over an array the page held,
 * which only worked while the page held the whole library. It now renders the summary's count
 * and size, and says honestly when it does not have them: `…` while loading, and ONE "Count not
 * known yet" in place of both numbers after a failure — never "0 documents · 0 B".
 *
 * Content assertions on the rendered words, never the presence of a test id alone.
 */
import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { FolderDetail } from "@/components/ingestion/FolderDetail"
import { NavRow } from "@/components/ingestion/NavRow"
import { TooltipProvider } from "@/components/ui/tooltip"
import { Folder as FolderIcon } from "lucide-react"
import type { Folder } from "@/types"

const SHARED: Folder = {
  id: "f1",
  user_id: "u1",
  name: "Contracts",
  parent_id: null,
  is_org_shared: true,
  created_at: "2026-01-15T12:00:00Z",
  updated_at: "2026-01-15T12:00:00Z",
}

function band(): string {
  return document.body.textContent ?? ""
}

describe("FolderDetail — numbers in, three honest arms (UI-SPEC S5)", () => {
  it("ready renders the shipped count and formatted size", () => {
    render(<FolderDetail folder={SHARED} count={3} sizeBytes={2048} state="ready" subfolderCount={0} />)
    expect(band()).toContain("3 documents")
    expect(band()).toContain("2 KB")
  })

  it("ready with one document says document, and an empty folder says 0 B (an answered zero)", () => {
    const { unmount } = render(
      <FolderDetail folder={SHARED} count={1} sizeBytes={512} state="ready" subfolderCount={0} />,
    )
    expect(band()).toContain("1 document")
    expect(band()).not.toContain("1 documents")
    expect(band()).toContain("512 B")
    unmount()
    render(<FolderDetail folder={SHARED} count={0} sizeBytes={0} state="ready" subfolderCount={0} />)
    expect(band()).toContain("0 documents")
    expect(band()).toContain("0 B")
  })

  // 284-05 checkpoint (G-4 at 50k): the band and the folder tree printed "30000" / "10000". UI-SPEC
  // "Numbers": every count of 1,000 or more renders grouped, via `n.toLocaleString()`.
  it("counts of 1,000 or more render grouped in the band and on the folder row", () => {
    render(<FolderDetail folder={SHARED} count={10000} sizeBytes={0} state="ready" subfolderCount={1200} />)
    expect(band()).toContain("10,000 documents")
    expect(band()).toContain("1,200 subfolders")
    expect(band()).not.toContain("10000")
    render(<TooltipProvider><NavRow icon={FolderIcon} name="Big" count={30000} /></TooltipProvider>)
    expect(band()).toContain("30,000")
    expect(band()).not.toContain("30000")
  })

  it("loading renders … in both number slots and no number at all", () => {
    render(<FolderDetail folder={SHARED} count={null} sizeBytes={null} state="loading" subfolderCount={0} />)
    expect(screen.getAllByText("…")).toHaveLength(2)
    expect(band()).not.toMatch(/\d+ documents?/)
    expect(band()).not.toContain(" B")
  })

  it("failed renders ONE Count not known yet in place of both numbers", () => {
    render(<FolderDetail folder={SHARED} count={null} sizeBytes={null} state="error" subfolderCount={0} />)
    expect(screen.getAllByText("Count not known yet")).toHaveLength(1)
    expect(band()).not.toMatch(/\bdocuments?\b/)
    expect(band()).not.toContain("…")
  })

  it("the shared badge, subfolder count and Created date come from the folder and survive every arm", () => {
    for (const state of ["ready", "loading", "error"] as const) {
      const { unmount } = render(
        <FolderDetail
          folder={SHARED}
          count={state === "ready" ? 4 : null}
          sizeBytes={state === "ready" ? 10 : null}
          state={state}
          subfolderCount={2}
        />,
      )
      expect(band()).toContain("Shared with org")
      expect(band()).toContain("2 subfolders")
      expect(band()).toContain("Created")
      unmount()
    }
  })
})
