/**
 * Tests for the useDocuments hook.
 *
 * Mocks:
 * - @/lib/api – API functions
 * - @/lib/supabase – Supabase Realtime (channel subscription)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { renderHook, waitFor, act } from "@testing-library/react"

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
    const { result } = renderHook(() => useDocuments())
    expect(result.current.documents).toEqual([])
    expect(result.current.uploading).toBe(false)
    expect(typeof result.current.upload).toBe("function")
    expect(typeof result.current.deleteDoc).toBe("function")
  })

  it("fetches documents on mount", async () => {
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
    ]
    mockListDocuments.mockResolvedValue(docs)

    const { result } = renderHook(() => useDocuments())

    await waitFor(() => {
      expect(result.current.documents).toHaveLength(1)
    })
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

    const { result } = renderHook(() => useDocuments())

    // Start upload
    let uploadPromise!: Promise<void>
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

  it("adds document to list after upload", async () => {
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

    const { result } = renderHook(() => useDocuments())

    await act(async () => {
      await result.current.upload(new File(["content"], "new.txt"))
    })

    expect(result.current.documents.some((d) => d.id === "d3")).toBe(true)
  })

  // ── Phase 217 (D-217-24) — THE REALTIME SEAM THE INGESTION STRIP SITS ON ──────────────
  //
  // `tables_stage_applies` / `images_stage_applies` are pydantic `@computed_field`s off
  // `mime_type` — there are no such DB columns, so they do NOT ride `payload.new`. They behave
  // exactly like `table_count`: the UPDATE arm's spread-merge preserves them, and the INSERT arm
  // (which does no merge) cannot supply them at all.
  //
  // ⚠ M-1 STAYS OWED AND IS NOT CLOSED HERE. No test that mocks `listDocuments` can prove the
  // cold-load case (a file already mid-ingest when the Library opens). These two cases cover the
  // MERGE, not the LOAD — Realtime is a hint, never a source of truth (D-v2.5-03).

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
    mockListDocuments.mockResolvedValue([fetched])

    const { result } = renderHook(() => useDocuments())
    await waitFor(() => {
      expect(result.current.documents).toHaveLength(1)
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

  it("Realtime INSERT — no merge, so the derived flags arrive undefined (and that is renderable)", async () => {
    mockListDocuments.mockResolvedValue([])
    const { result } = renderHook(() => useDocuments())
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

    const inserted = result.current.documents.find((d) => d.id === "d6")
    expect(inserted).toBeDefined()
    // ⚠ THE DEFECT THIS PINS: undefined, not false. A `false` here would make the strip strike
    // out two stages it has no evidence were skipped.
    expect(inserted?.tables_stage_applies).toBeUndefined()
    expect(inserted?.images_stage_applies).toBeUndefined()
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
    mockListDocuments.mockResolvedValue([existingDoc])
    mockDeleteDocument.mockResolvedValue(undefined)

    const { result } = renderHook(() => useDocuments())

    await waitFor(() => {
      expect(result.current.documents).toHaveLength(1)
    })

    await act(async () => {
      await result.current.deleteDoc("d4")
    })

    expect(result.current.documents.find((d) => d.id === "d4")).toBeUndefined()
  })
})
