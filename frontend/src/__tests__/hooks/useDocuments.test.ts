/**
 * Tests for the useDocuments hook.
 *
 * ⭐ Phase 284-03 (D-08 / D-24): the hook no longer fetches or holds the library. The caller owns
 * the ON-PAGE rows and hands the hook their setter; Realtime merges an UPDATE into a row already
 * on the page and turns every other event into `onChange()` (the caller's debounced refetch).
 * The harness below gives the hook a real `useState` for those rows, so `result.current.documents`
 * is exactly what the caller would render.
 *
 * Mocks:
 * - @/lib/api – API functions
 * - @/lib/supabase – Supabase Realtime (channel subscription)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { renderHook, waitFor, act } from "@testing-library/react"
import { useState } from "react"
import type { Document } from "@/types"

// ── Mock API module ────────────────────────────────────────────────────────────
// vi.mock is hoisted to the top of the file by Vitest, so we use vi.hoisted()
// for any variables that the factory function references.

const { mockListDocuments, mockUploadDocument, mockDeleteDocument } = vi.hoisted(() => ({
  mockListDocuments: vi.fn(),
  mockUploadDocument: vi.fn(),
  mockDeleteDocument: vi.fn(),
}))

vi.mock("@/lib/api", () => ({
  listDocuments: mockListDocuments,
  uploadDocument: mockUploadDocument,
  deleteDocument: mockDeleteDocument,
}))

// ── Mock Supabase – channel subscription ──────────────────────────────────────
// Same hoisting requirement for the channel helpers

const { mockOn, mockSubscribe, mockChannel, mockRemoveChannel } = vi.hoisted(() => {
  const mockSubscribe = vi.fn()
  const mockOn = vi.fn()
  const mockChannel = { on: mockOn, subscribe: mockSubscribe }
  mockOn.mockReturnValue(mockChannel)
  mockSubscribe.mockReturnValue(mockChannel)
  return { mockOn, mockSubscribe, mockChannel, mockRemoveChannel: vi.fn() }
})

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: {
          session: { user: { id: "user-1" }, access_token: "token" },
        },
      }),
    },
    channel: vi.fn().mockReturnValue(mockChannel),
    removeChannel: mockRemoveChannel,
  },
}))

import { useDocuments } from "@/hooks/useDocuments"

/** The caller's side: the on-page rows, and the refetch request. */
const onChange = vi.fn()
function useHarness(initial: Document[] = []) {
  const [documents, setRows] = useState<Document[]>(initial)
  // 284-REVIEW WR-01: the hook reads the on-page rows to tell a cosmetic UPDATE from one that
  // changes which list the row belongs to.
  return { documents, ...useDocuments({ rows: documents, setRows, onChange }) }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("useDocuments", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockListDocuments.mockResolvedValue([])
    mockOn.mockReturnValue(mockChannel)
    mockSubscribe.mockReturnValue(mockChannel)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it("has correct initial state", () => {
    const { result } = renderHook(() => useHarness())
    expect(result.current.documents).toEqual([])
    expect(result.current.uploading).toBe(false)
    expect(typeof result.current.upload).toBe("function")
    expect(typeof result.current.deleteDoc).toBe("function")
  })

  // 284-03 (D-24): REWRITTEN IN PLACE. This case used to assert the hook fetched the whole
  // library on mount; the Library now pages on the server, so the property is the inverse.
  it("never fetches a list of its own — the caller's page is the list", async () => {
    const docs = [
      {
        id: "d1",
        user_id: "user-1",
        filename: "notes.txt",
        status: "completed",
        file_path: "user-1/d1/notes.txt",
        file_size: 100,
        mime_type: "text/plain",
        error_message: null,
        chunk_count: 3,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ] as Document[]
    mockListDocuments.mockResolvedValue([...docs, ...docs])

    const { result } = renderHook(() => useHarness(docs))

    await waitFor(() => {
      expect(mockOn).toHaveBeenCalled()
    })
    expect(mockListDocuments).not.toHaveBeenCalled()
    expect(result.current.documents).toHaveLength(1)
    expect(result.current.documents[0].filename).toBe("notes.txt")
  })

  it("sets uploading=true during upload and false after", async () => {
    const uploadedDoc = {
      id: "d2",
      user_id: "user-1",
      filename: "upload.txt",
      status: "pending",
      file_path: "user-1/d2/upload.txt",
      file_size: 50,
      mime_type: "text/plain",
      error_message: null,
      chunk_count: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    let resolveUpload!: (v: typeof uploadedDoc) => void
    mockUploadDocument.mockReturnValue(
      new Promise<typeof uploadedDoc>((resolve) => {
        resolveUpload = resolve
      }),
    )

    const { result } = renderHook(() => useHarness())

    // Start upload
    let uploadPromise!: Promise<unknown>
    act(() => {
      uploadPromise = result.current.upload(new File(["content"], "upload.txt"))
    })

    // uploading should be true while in-flight
    expect(result.current.uploading).toBe(true)

    // Resolve the upload
    act(() => {
      resolveUpload(uploadedDoc)
    })
    await act(async () => {
      await uploadPromise
    })

    expect(result.current.uploading).toBe(false)
  })

  // 284-03 (D-08): REWRITTEN IN PLACE. Upload used to prepend the row to the whole list. The
  // CALLER now decides whether the new row belongs on the page it shows (page 1 of its folder);
  // this hook returns the document and asks for the refetch that reconciles it.
  it("upload returns the created document and asks for a refetch — no list patch", async () => {
    const uploadedDoc = {
      id: "d3",
      user_id: "user-1",
      filename: "new.txt",
      status: "pending" as const,
      file_path: "user-1/d3/new.txt",
      file_size: 20,
      mime_type: "text/plain",
      error_message: null,
      chunk_count: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    mockUploadDocument.mockResolvedValue({ doc: uploadedDoc, isDuplicate: false })

    const { result } = renderHook(() => useHarness())

    let answer: unknown
    await act(async () => {
      answer = await result.current.upload(new File(["content"], "new.txt"))
    })

    expect(answer).toEqual({ isDuplicate: false, doc: uploadedDoc })
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(result.current.documents.some((d) => d.id === "d3")).toBe(false)
  })

  // ── Phase 217 (D-217-24) — THE REALTIME SEAM THE INGESTION STRIP SITS ON ──────────────
  //
  // `tables_stage_applies` / `images_stage_applies` are pydantic `@computed_field`s off
  // `mime_type` — there are no such DB columns, so they do NOT ride `payload.new`. They behave
  // exactly like `table_count`: the UPDATE arm's spread-merge preserves them.
  //
  // ⚠ M-1 STAYS OWED AND IS NOT CLOSED HERE. No test of this hook can prove the cold-load case
  // (a file already mid-ingest when the Library opens). These cases cover the MERGE, not the
  // LOAD — Realtime is a hint, never a source of truth (D-v2.5-03).

  /** Fire one Realtime event through the callback the hook registered on the channel. */
  const emitRealtime = (payload: unknown) => {
    const handler = mockOn.mock.calls.at(-1)?.[2] as ((p: unknown) => void) | undefined
    if (!handler) throw new Error("the hook registered no postgres_changes handler")
    act(() => {
      handler(payload)
    })
  }

  it("Realtime UPDATE — a payload without the derived flags leaves the fetched ones intact", async () => {
    const fetched = {
      id: "d5",
      user_id: "user-1",
      filename: "report.pdf",
      status: "processing" as const,
      file_path: "user-1/d5/report.pdf",
      file_size: 900,
      mime_type: "application/pdf",
      error_message: null,
      ingestion_step: "extracting",
      chunk_count: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      // server-DERIVED, present on the cold fetch only
      tables_stage_applies: true,
      images_stage_applies: true,
      table_count: 2,
    }

    const { result } = renderHook(() => useHarness([fetched as Document]))
    await waitFor(() => {
      expect(mockOn).toHaveBeenCalled()
    })
    // non-vacuity: the flags really were there before the event
    expect(result.current.documents[0].tables_stage_applies).toBe(true)

    // The row Postgres actually replicates: real columns only. No applicability, no aggregates.
    emitRealtime({
      eventType: "UPDATE",
      new: {
        id: "d5",
        user_id: "user-1",
        filename: "report.pdf",
        status: "processing",
        file_path: "user-1/d5/report.pdf",
        file_size: 900,
        mime_type: "application/pdf",
        error_message: null,
        ingestion_step: "embedding",
        chunk_count: null,
        created_at: fetched.created_at,
        updated_at: new Date().toISOString(),
      },
    })

    const merged = result.current.documents[0]
    // the REAL column advanced …
    expect(merged.ingestion_step).toBe("embedding")
    // … and the derived pair + the aggregate survived the transition
    expect(merged.tables_stage_applies).toBe(true)
    expect(merged.images_stage_applies).toBe(true)
    expect(merged.table_count).toBe(2)
  })

  // 284-03 (D-08 / T-284-16 / T-284-17): REWRITTEN IN PLACE. This case used to pin that an
  // INSERT was PREPENDED with its derived flags undefined. An INSERT or DELETE no longer patches
  // any list — it asks for a refetch, and the refetch's server row carries the flags. A payload
  // row is never shown, so a row the page does not hold cannot arrive through this door.
  it("Realtime INSERT / DELETE — no list patch, each asks the caller for a refetch", async () => {
    const onPage = {
      id: "d7",
      user_id: "user-1",
      filename: "on-page.pdf",
      status: "completed" as const,
      file_path: "user-1/d7/on-page.pdf",
      file_size: 10,
      mime_type: "application/pdf",
      error_message: null,
      chunk_count: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as Document
    const { result } = renderHook(() => useHarness([onPage]))
    await waitFor(() => {
      expect(mockOn).toHaveBeenCalled()
    })

    emitRealtime({
      eventType: "INSERT",
      new: {
        id: "d6",
        user_id: "user-1",
        filename: "from-another-tab.docx",
        status: "pending",
        file_path: "user-1/d6/from-another-tab.docx",
        file_size: 400,
        mime_type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        error_message: null,
        ingestion_step: null,
        chunk_count: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    })
    expect(result.current.documents.find((d) => d.id === "d6")).toBeUndefined()
    expect(onChange).toHaveBeenCalledTimes(1)

    emitRealtime({ eventType: "DELETE", old: { id: "d7" } })
    // The page is the server's to re-answer: the row stays until the refetch lands.
    expect(result.current.documents.map((d) => d.id)).toEqual(["d7"])
    expect(onChange).toHaveBeenCalledTimes(2)
  })

  it("removes document from list after deleteDoc", async () => {
    const existingDoc = {
      id: "d4",
      user_id: "user-1",
      filename: "to-delete.txt",
      status: "completed" as const,
      file_path: "user-1/d4/to-delete.txt",
      file_size: 30,
      mime_type: "text/plain",
      error_message: null,
      chunk_count: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    mockDeleteDocument.mockResolvedValue(undefined)

    const { result } = renderHook(() => useHarness([existingDoc as Document]))

    await waitFor(() => {
      expect(result.current.documents).toHaveLength(1)
    })

    await act(async () => {
      await result.current.deleteDoc("d4")
    })

    expect(result.current.documents.find((d) => d.id === "d4")).toBeUndefined()
    // …and the page is re-asked, so what slides up into the gap is the server's answer.
    expect(onChange).toHaveBeenCalledTimes(1)
  })

  // ── 284-REVIEW WR-01 — an UPDATE that changes which LIST a row belongs to is a refetch, not a
  // merge. A move (`folder_id`), an archive (`archived_at`), a version flip (`is_latest`) or a
  // status change takes the row off this page's list and moves the summary's buckets; merging it
  // in place left it on its OLD folder's page wearing its new folder_id. A pure field update
  // (a stage advancing, a rename) still merges in place and asks for nothing. ──
  /** The row Postgres replicates: real columns only — the server-derived `table_count` is absent. */
  const replicatedRow = (row: Document): Partial<Document> => {
    const copy: Partial<Document> = { ...row }
    delete copy.table_count
    return copy
  }
  const onPageRow = (): Document =>
    ({
      id: "m1",
      user_id: "user-1",
      folder_id: "folder-a",
      filename: "moving.pdf",
      status: "processing",
      file_path: "user-1/m1/moving.pdf",
      file_size: 10,
      mime_type: "application/pdf",
      error_message: null,
      ingestion_step: "extracting",
      chunk_count: null,
      is_latest: true,
      archived_at: null,
      created_at: "2026-10-01T00:00:00Z",
      updated_at: "2026-10-01T00:00:00Z",
      table_count: 3,
    }) as Document

  it.each([
    ["folder_id", { folder_id: "folder-b" }],
    ["folder_id → Root", { folder_id: null }],
    ["archived_at", { archived_at: "2026-10-16T00:00:00Z" }],
    ["is_latest", { is_latest: false }],
    ["status (processing → pending)", { status: "pending" }],
  ])("an UPDATE changing %s asks for ONE refetch", async (_label, change) => {
    const row = onPageRow()
    renderHook(() => useHarness([row]))
    await waitFor(() => expect(mockOn).toHaveBeenCalled())
    const replicated = replicatedRow(row)
    emitRealtime({ eventType: "UPDATE", new: { ...replicated, ...change } })
    expect(onChange).toHaveBeenCalledTimes(1)
  })

  it("a pure field UPDATE (a stage advancing) merges in place and asks for no refetch", async () => {
    const row = onPageRow()
    const { result } = renderHook(() => useHarness([row]))
    await waitFor(() => expect(mockOn).toHaveBeenCalled())
    const replicated = replicatedRow(row)
    emitRealtime({ eventType: "UPDATE", new: { ...replicated, ingestion_step: "embedding", filename: "renamed.pdf" } })
    expect(onChange).not.toHaveBeenCalled()
    expect(result.current.documents[0]).toMatchObject({ ingestion_step: "embedding", filename: "renamed.pdf", table_count: 3 })
  })

  it("a terminal status still refetches exactly once (never twice for one event)", async () => {
    const row = onPageRow()
    renderHook(() => useHarness([row]))
    await waitFor(() => expect(mockOn).toHaveBeenCalled())
    const replicated = replicatedRow(row)
    emitRealtime({ eventType: "UPDATE", new: { ...replicated, status: "completed" } })
    expect(onChange).toHaveBeenCalledTimes(1)
  })
})
