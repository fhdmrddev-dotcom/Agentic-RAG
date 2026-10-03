/**
 * Phase 271-03 Task 1 (FIND-01 / S7 / T-271-12) — the Find request hook.
 *
 * What is pinned, each with fake timers so the debounce is measured rather than awaited:
 *   - ZERO requests at rest (a null request) — every LibraryPage mount suite depends on it;
 *   - the 300 ms debounce, and the collapse of a burst into ONE call with the latest body;
 *   - the stale-response drop (a slow first answer never overwrites a newer one);
 *   - ⛔ S7: an error KEEPS the previous rows and total and sets `error` — it never swaps the
 *     list for an unfiltered one (the shipped `resolveFilterIntoList` catch does exactly that).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { act, renderHook } from "@testing-library/react"

import type { DocumentSearchRequest, DocumentSearchResponse, DocumentSearchRow } from "@/types"

const searchDocuments = vi.fn()

vi.mock("@/lib/api/documents", () => {
  class DocumentSearchError extends Error {
    readonly status: number | "network"
    constructor(status: number | "network", message: string) {
      super(message)
      this.status = status
      this.name = "DocumentSearchError"
    }
  }
  return {
    searchDocuments: (...a: unknown[]) => searchDocuments(...a),
    DocumentSearchError,
  }
})

import { DocumentSearchError } from "@/lib/api/documents"
import { useDocumentFind } from "../useDocumentFind"

function req(name: string): DocumentSearchRequest {
  return {
    filter_expr: { op: "and", conditions: [] },
    name,
    folder: null,
    added_by: null,
    dates: [],
    relationship: null,
    version: "latest",
    sort: "added_desc",
    offset: 0,
    limit: 25,
  }
}

function row(id: string): DocumentSearchRow {
  return {
    id,
    user_id: "u1",
    folder_id: null,
    filename: `${id}.pdf`,
    file_path: `u1/${id}.pdf`,
    file_size: 1,
    mime_type: "application/pdf",
    status: "completed",
    error_message: null,
    chunk_count: 1,
    content_hash: null,
    metadata: null,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
    version_count: 1,
    has_earlier: false,
  }
}

function resp(ids: string[], total = ids.length, older = 0): DocumentSearchResponse {
  return {
    documents: ids.map(row),
    total,
    older_matches: older,
    sort: "added_desc",
    offset: 0,
    limit: 25,
  }
}

/** A promise whose settlement the test controls. */
function deferred<T>() {
  let resolve!: (v: T) => void
  let reject!: (e: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

describe("useDocumentFind", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    searchDocuments.mockReset()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it("issues ZERO requests while the request is null", async () => {
    const { result } = renderHook(() => useDocumentFind({ request: null }))
    await act(async () => {
      vi.advanceTimersByTime(1000)
    })
    expect(searchDocuments).not.toHaveBeenCalled()
    expect(result.current.rows).toEqual([])
    expect(result.current.total).toBeNull()
    expect(result.current.loading).toBe(false)
    expect(result.current.error).toBeNull()
  })

  it("debounces 300 ms: none at 299, one at 300", async () => {
    searchDocuments.mockResolvedValue(resp(["a"]))
    renderHook(() => useDocumentFind({ request: req("a") }))
    await act(async () => {
      vi.advanceTimersByTime(299)
    })
    expect(searchDocuments).not.toHaveBeenCalled()
    await act(async () => {
      vi.advanceTimersByTime(1)
    })
    expect(searchDocuments).toHaveBeenCalledTimes(1)
    expect(searchDocuments).toHaveBeenCalledWith(req("a"))
  })

  it("collapses two requests within 300 ms into ONE call with the latest body", async () => {
    searchDocuments.mockResolvedValue(resp(["ab"]))
    const { rerender } = renderHook(({ r }) => useDocumentFind({ request: r }), {
      initialProps: { r: req("a") as DocumentSearchRequest | null },
    })
    await act(async () => {
      vi.advanceTimersByTime(150)
    })
    rerender({ r: req("ab") })
    await act(async () => {
      vi.advanceTimersByTime(300)
    })
    expect(searchDocuments).toHaveBeenCalledTimes(1)
    expect(searchDocuments).toHaveBeenCalledWith(req("ab"))
  })

  it("an equal request on re-render does not re-issue (keyed on the body)", async () => {
    searchDocuments.mockResolvedValue(resp(["a"]))
    const { rerender } = renderHook(({ r }) => useDocumentFind({ request: r }), {
      initialProps: { r: req("a") as DocumentSearchRequest | null },
    })
    await act(async () => {
      vi.advanceTimersByTime(300)
    })
    rerender({ r: req("a") })
    await act(async () => {
      vi.advanceTimersByTime(1000)
    })
    expect(searchDocuments).toHaveBeenCalledTimes(1)
  })

  it("exposes loading while in flight, then the rows, total and older matches", async () => {
    const d = deferred<DocumentSearchResponse>()
    searchDocuments.mockReturnValue(d.promise)
    const { result } = renderHook(() => useDocumentFind({ request: req("a") }))
    await act(async () => {
      vi.advanceTimersByTime(300)
    })
    expect(result.current.loading).toBe(true)
    await act(async () => {
      d.resolve(resp(["a", "b"], 40, 3))
    })
    expect(result.current.loading).toBe(false)
    expect(result.current.rows.map((r) => r.id)).toEqual(["a", "b"])
    expect(result.current.total).toBe(40)
    expect(result.current.olderMatches).toBe(3)
    expect(result.current.error).toBeNull()
  })

  it("drops a slow first response that arrives after a newer one", async () => {
    const first = deferred<DocumentSearchResponse>()
    const second = deferred<DocumentSearchResponse>()
    searchDocuments.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
    const { result, rerender } = renderHook(({ r }) => useDocumentFind({ request: r }), {
      initialProps: { r: req("a") as DocumentSearchRequest | null },
    })
    await act(async () => {
      vi.advanceTimersByTime(300)
    })
    rerender({ r: req("b") })
    await act(async () => {
      vi.advanceTimersByTime(300)
    })
    expect(searchDocuments).toHaveBeenCalledTimes(2)
    await act(async () => {
      second.resolve(resp(["b"]))
    })
    await act(async () => {
      first.resolve(resp(["STALE"]))
    })
    expect(result.current.rows.map((r) => r.id)).toEqual(["b"])
    expect(result.current.loading).toBe(false)
  })

  it("on error KEEPS the previous rows and total and sets error (S7 — never an unfiltered swap)", async () => {
    searchDocuments
      .mockResolvedValueOnce(resp(["a", "b"], 2))
      .mockRejectedValueOnce(new DocumentSearchError(422, "Couldn't run this search."))
    const { result, rerender } = renderHook(({ r }) => useDocumentFind({ request: r }), {
      initialProps: { r: req("a") as DocumentSearchRequest | null },
    })
    await act(async () => {
      vi.advanceTimersByTime(300)
    })
    expect(result.current.rows.map((r) => r.id)).toEqual(["a", "b"])
    rerender({ r: req("ab") })
    await act(async () => {
      vi.advanceTimersByTime(300)
    })
    expect(result.current.error).toBeInstanceOf(DocumentSearchError)
    expect(result.current.error?.status).toBe(422)
    expect(result.current.rows.map((r) => r.id)).toEqual(["a", "b"])
    expect(result.current.total).toBe(2)
    expect(result.current.loading).toBe(false)
  })

  it("a non-DocumentSearchError rejection still surfaces as a DocumentSearchError", async () => {
    searchDocuments.mockRejectedValueOnce(new Error("boom"))
    const { result } = renderHook(() => useDocumentFind({ request: req("a") }))
    await act(async () => {
      vi.advanceTimersByTime(300)
    })
    expect(result.current.error).toBeInstanceOf(DocumentSearchError)
  })

  it("retry() re-issues the last request and clears the error on success", async () => {
    searchDocuments
      .mockRejectedValueOnce(new DocumentSearchError("network", "Couldn't run this search."))
      .mockResolvedValueOnce(resp(["a"]))
    const { result } = renderHook(() => useDocumentFind({ request: req("a") }))
    await act(async () => {
      vi.advanceTimersByTime(300)
    })
    expect(result.current.error?.status).toBe("network")
    await act(async () => {
      result.current.retry()
    })
    await act(async () => {
      vi.advanceTimersByTime(300)
    })
    expect(searchDocuments).toHaveBeenCalledTimes(2)
    expect(searchDocuments).toHaveBeenLastCalledWith(req("a"))
    expect(result.current.error).toBeNull()
    expect(result.current.rows.map((r) => r.id)).toEqual(["a"])
  })

  it("going back to null clears the error and leaves nothing stale on screen", async () => {
    searchDocuments
      .mockResolvedValueOnce(resp(["a"]))
      .mockRejectedValueOnce(new DocumentSearchError(500, "Couldn't run this search."))
    const { result, rerender } = renderHook(({ r }) => useDocumentFind({ request: r }), {
      initialProps: { r: req("a") as DocumentSearchRequest | null },
    })
    await act(async () => {
      vi.advanceTimersByTime(300)
    })
    rerender({ r: req("ab") })
    await act(async () => {
      vi.advanceTimersByTime(300)
    })
    expect(result.current.error).not.toBeNull()
    rerender({ r: null })
    await act(async () => {
      vi.advanceTimersByTime(1000)
    })
    expect(result.current.error).toBeNull()
    expect(result.current.rows).toEqual([])
    expect(result.current.total).toBeNull()
    expect(result.current.loading).toBe(false)
    expect(searchDocuments).toHaveBeenCalledTimes(2)
  })

  it("going to null while a request is in flight drops its late answer", async () => {
    const d = deferred<DocumentSearchResponse>()
    searchDocuments.mockReturnValueOnce(d.promise)
    const { result, rerender } = renderHook(({ r }) => useDocumentFind({ request: r }), {
      initialProps: { r: req("a") as DocumentSearchRequest | null },
    })
    await act(async () => {
      vi.advanceTimersByTime(300)
    })
    rerender({ r: null })
    await act(async () => {
      d.resolve(resp(["LATE"]))
    })
    expect(result.current.rows).toEqual([])
    expect(result.current.loading).toBe(false)
  })
})
