/**
 * Phase 271-04 (D-04 / D-06 / D-07) — the quick-add chip row inside the ONE FilterBar.
 *
 * Every dimension a person can pick is one chip that sets exactly one condition, and the
 * Version default is always visible (a filter that hides rows by default must show that it
 * does). These cases assert the WORDS on each chip and the ACTION each editor dispatches.
 */
import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { FindQuickAdd } from "@/components/library/find/FindQuickAdd"
import { initialFindState, type FindState } from "@/pages/findState"
import type { Document, Folder, ViewFilter } from "@/types"

const EMPTY: ViewFilter = { op: "and", conditions: [] }

const FOLDERS: Folder[] = [
  { id: "f1", user_id: "u1", name: "Contracts", parent_id: null, is_org_shared: false, created_at: "", updated_at: "" },
]

const DOCS = [
  {
    id: "a",
    user_id: "u1",
    folder_id: null,
    filename: "Acme MSA 2019.pdf",
    file_path: "p",
    file_size: 1,
    mime_type: "application/pdf",
    status: "completed",
    created_at: "",
    updated_at: "",
    metadata: { document_type: "Contract" },
  },
] as unknown as Document[]

function renderQA(find: Partial<FindState> = {}, filter: ViewFilter = EMPTY) {
  const dispatch = vi.fn()
  const onFilterChange = vi.fn()
  render(
    <FindQuickAdd
      find={{ ...initialFindState, ...find }}
      dispatch={dispatch}
      filter={filter}
      onFilterChange={onFilterChange}
      documents={DOCS}
      folders={FOLDERS}
    />,
  )
  return { dispatch, onFilterChange }
}

describe("FindQuickAdd — resting", () => {
  it("renders the five ＋ chips and ALWAYS a Version: Latest chip with no remove at the default", () => {
    renderQA()
    for (const name of ["＋ Document type", "＋ Added by", "＋ Date", "＋ Folder", "＋ Relationship"]) {
      expect(screen.getByRole("button", { name })).toBeInTheDocument()
    }
    expect(screen.getByRole("button", { name: "Version: Latest" })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Remove Version condition/ })).toBeNull()
  })

  it("every chip announces its popover (aria-haspopup=dialog + aria-expanded)", () => {
    renderQA()
    for (const name of ["＋ Document type", "＋ Added by", "＋ Date", "＋ Folder", "＋ Relationship", "Version: Latest"]) {
      const b = screen.getByRole("button", { name })
      expect(b).toHaveAttribute("aria-haspopup", "dialog")
      expect(b).toHaveAttribute("aria-expanded", "false")
    }
  })

  it("carries no ranking vocabulary", () => {
    renderQA()
    expect(document.body.textContent ?? "").not.toMatch(/relevance|smart|AI search|\bquery\b/i)
  })
})

describe("FindQuickAdd — set chips read as the condition they send", () => {
  it("Added by You · Folder + subfolders · Relationship · Version, each with its own ✕", () => {
    const { dispatch } = renderQA({
      addedBy: { kind: "me", connectionId: null, label: "You" },
      folder: { folderId: "f1", includeSubfolders: true },
      relationship: { verb: "superseded_by", documentId: "a", documentName: "Acme MSA 2019" },
      version: "older",
    })
    expect(screen.getByRole("button", { name: "Added by You" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Folder /Contracts + subfolders" })).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Relationship is superseded by Acme MSA 2019" }),
    ).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Version: Older versions (superseded)" })).toBeInTheDocument()

    // A set single-value dimension hides its ＋ while its chip exists.
    expect(screen.queryByRole("button", { name: "＋ Added by" })).toBeNull()
    expect(screen.queryByRole("button", { name: "＋ Folder" })).toBeNull()
    expect(screen.queryByRole("button", { name: "＋ Relationship" })).toBeNull()

    fireEvent.click(screen.getByRole("button", { name: "Remove Added by condition" }))
    expect(dispatch).toHaveBeenLastCalledWith({ type: "SET_ADDED_BY", addedBy: null })
    fireEvent.click(screen.getByRole("button", { name: "Remove Folder condition" }))
    expect(dispatch).toHaveBeenLastCalledWith({ type: "SET_FOLDER", folder: null })
    fireEvent.click(screen.getByRole("button", { name: "Remove Relationship condition" }))
    expect(dispatch).toHaveBeenLastCalledWith({ type: "SET_RELATIONSHIP", relationship: null })
    fireEvent.click(screen.getByRole("button", { name: "Remove Version condition" }))
    expect(dispatch).toHaveBeenLastCalledWith({ type: "SET_VERSION", version: "latest" })
  })

  it("Folder only (no subfolders) and Has earlier versions read as such", () => {
    renderQA({ folder: { folderId: "f1", includeSubfolders: false }, version: "has_earlier" })
    expect(screen.getByRole("button", { name: "Folder /Contracts only" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Version: Has earlier versions" })).toBeInTheDocument()
  })

  it("a file date reads WHOSE date it is, and its ✕ dispatches REMOVE_DATE", () => {
    const { dispatch } = renderQA({
      dates: [{ which: "added", op: "between", value: "2019-01-01", value2: "2019-12-31", unit: null }],
    })
    expect(
      screen.getByRole("button", { name: "Added to Agentic RAG between 1 Jan 2019 and 31 Dec 2019" }),
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Remove Date condition (Added to Agentic RAG)" }))
    expect(dispatch).toHaveBeenLastCalledWith({ type: "REMOVE_DATE", which: "added" })
  })
})

describe("FindQuickAdd — each editor dispatches exactly one condition", () => {
  it("＋ Added by → You → SET_ADDED_BY, and the popover closes", () => {
    const { dispatch } = renderQA()
    const chip = screen.getByRole("button", { name: "＋ Added by" })
    fireEvent.click(chip)
    expect(chip).toHaveAttribute("aria-expanded", "true")
    const dialog = screen.getByRole("dialog", { name: "Added by" })
    expect(dialog.parentElement?.className).toContain("max-w-[calc(100vw-2rem)]")
    fireEvent.click(screen.getByRole("radio", { name: "You" }))
    fireEvent.click(screen.getByRole("button", { name: "Apply" }))
    expect(dispatch).toHaveBeenCalledWith({
      type: "SET_ADDED_BY",
      addedBy: { kind: "me", connectionId: null, label: "You" },
    })
    expect(screen.queryByRole("dialog")).toBeNull()
  })

  it("Version: Latest → Older versions → SET_VERSION", () => {
    const { dispatch } = renderQA()
    fireEvent.click(screen.getByRole("button", { name: "Version: Latest" }))
    fireEvent.click(screen.getByRole("radio", { name: "Older versions (superseded)" }))
    fireEvent.click(screen.getByRole("button", { name: "Apply" }))
    expect(dispatch).toHaveBeenCalledWith({ type: "SET_VERSION", version: "older" })
  })

  it("＋ Document type writes into the shared FILTER, never the Find state (P-10)", () => {
    const { dispatch, onFilterChange } = renderQA()
    fireEvent.click(screen.getByRole("button", { name: "＋ Document type" }))
    fireEvent.click(screen.getByRole("checkbox", { name: "Contract" }))
    fireEvent.click(screen.getByRole("button", { name: "Apply" }))
    expect(onFilterChange).toHaveBeenCalledWith({
      op: "and",
      conditions: [{ field: "document_type", op: "eq", value: "Contract" }],
    })
    expect(dispatch).not.toHaveBeenCalled()
  })

  it("a second Document type REPLACES the first rather than AND-ing a contradiction", () => {
    const { onFilterChange } = renderQA({}, {
      op: "and",
      conditions: [
        { field: "title", op: "contains", value: "acme" },
        { field: "document_type", op: "eq", value: "Memo" },
      ],
    })
    fireEvent.click(screen.getByRole("button", { name: "＋ Document type" }))
    fireEvent.click(screen.getByRole("checkbox", { name: "Memo" }))
    fireEvent.click(screen.getByRole("checkbox", { name: "Contract" }))
    fireEvent.click(screen.getByRole("button", { name: "Apply" }))
    expect(onFilterChange).toHaveBeenCalledWith({
      op: "and",
      conditions: [
        { field: "title", op: "contains", value: "acme" },
        { field: "document_type", op: "eq", value: "Contract" },
      ],
    })
  })

  it("Esc closes the editor and returns focus to the chip that opened it", () => {
    renderQA()
    const chip = screen.getByRole("button", { name: "＋ Folder" })
    fireEvent.click(chip)
    fireEvent.keyDown(screen.getByRole("dialog", { name: "Folder" }), { key: "Escape" })
    expect(screen.queryByRole("dialog")).toBeNull()
    expect(document.activeElement).toBe(chip)
  })

  // 271-05 (G-4 drive finding): the case above dispatches Escape ON the dialog, which a real
  // keyboard cannot do unless focus is inside it. In Chromium, focus stayed on the chip after
  // opening, so Esc did nothing and Tab moved to the NEXT chip. Escape here is sent from
  // wherever focus actually is.
  it.each([
    ["＋ Document type", "Document type"],
    ["＋ Added by", "Added by"],
    ["＋ Date", "Date"],
    ["＋ Folder", "Folder"],
    ["＋ Relationship", "Relationship"],
    ["Version: Latest", "Version"],
  ])("opening %s moves focus INTO its editor, and Esc from there closes it", (chipName, dialogName) => {
    renderQA()
    const chip = screen.getByRole("button", { name: chipName })
    fireEvent.click(chip)
    const dialog = screen.getByRole("dialog", { name: dialogName })
    expect(dialog.contains(document.activeElement)).toBe(true)
    fireEvent.keyDown(document.activeElement as Element, { key: "Escape" })
    expect(screen.queryByRole("dialog")).toBeNull()
    expect(document.activeElement).toBe(chip)
  })

  it("only one editor is open at a time", () => {
    renderQA()
    fireEvent.click(screen.getByRole("button", { name: "＋ Folder" }))
    fireEvent.click(screen.getByRole("button", { name: "＋ Added by" }))
    expect(screen.getAllByRole("dialog")).toHaveLength(1)
    expect(screen.getByRole("dialog", { name: "Added by" })).toBeInTheDocument()
  })
})
