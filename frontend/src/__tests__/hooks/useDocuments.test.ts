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
    mockUploadDocument.mockResolvedValue(uploadedDoc)

    const { result } = renderHook(() => useDocuments())

    await act(async () => {
      await result.current.upload(new File(["content"], "new.txt"))
    })

    expect(result.current.documents.some((d) => d.id === "d3")).toBe(true)
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
