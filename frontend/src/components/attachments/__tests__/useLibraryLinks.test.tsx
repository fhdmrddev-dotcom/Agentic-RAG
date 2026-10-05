/**
 * Phase 274 plan 04 Task 1 (D-11 / D-13 / D-15 / D-25 / T-274-26) — THE LIBRARY-LINKS STORE.
 *
 * One request per tick per thread, however many chips and panel rows read it; a bounded poll that
 * exists ONLY while a promoted document is still indexing; a FETCH, never Realtime (D-v2.5-03).
 * The cases below drive each of those with fake timers rather than asserting them in prose.
 */
import { act, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/api/attachments", () => ({ getLibraryLinks: vi.fn() }))
vi.mock("@/lib/api/documents", () => ({ listFolders: vi.fn() }))

// eslint-disable-next-line import/first
import { getLibraryLinks, type LibraryDocumentStatus, type LibraryLinksResponse } from "@/lib/api/attachments"
// eslint-disable-next-line import/first
import { listFolders } from "@/lib/api/documents"
// eslint-disable-next-line import/first
import {
  INDEXING_POLL_MS,
  _resetLibraryLinksForTest,
  refreshLibraryLinks,
  useLibraryLinks,
} from "../useLibraryLinks"
// eslint-disable-next-line import/first
import type { Folder } from "@/types"

const T = "thread-1"

function folder(id: string, name: string, parent_id: string | null): Folder {
  return {
    id,
    user_id: "u-1",
    name,
    parent_id,
    is_org_shared: false,
    created_at: "2026-10-01T00:00:00Z",
    updated_at: "2026-10-01T00:00:00Z",
  }
}

const FOLDERS: Folder[] = [
  folder("s1", "Suppliers", null),
  folder("s2", "Meridian", "s1"),
  folder("s3", "Pricing", "s2"),
]

function links(status: LibraryDocumentStatus | null, folderId = "s3"): LibraryLinksResponse {
  return {
    files: [
      {
        workspace_file_id: "wf-1",
        promotable: true,
        link:
          status === null
            ? null
            : {
                document_id: "doc-1",
                outcome: "saved",
                folder_id: folderId,
                document_status: status,
                filename: "Meridian-Q4-pricing.xlsx",
              },
      },
      { workspace_file_id: "wf-json", promotable: false, link: null },
    ],
  }
}

/** Let resolved mock promises settle inside act. */
async function flush() {
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
  })
}

describe("useLibraryLinks — one fetch per thread, bounded poll while indexing", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.mocked(getLibraryLinks).mockReset()
    vi.mocked(listFolders).mockReset()
    vi.mocked(listFolders).mockResolvedValue(FOLDERS)
  })

  afterEach(() => {
    _resetLibraryLinksForTest()
    vi.useRealTimers()
  })

  it("two consumers of the same thread → ONE links fetch and ONE folders fetch, the same answer", async () => {
    vi.mocked(getLibraryLinks).mockResolvedValue(links("completed"))
    const a = renderHook(() => useLibraryLinks(T))
    const b = renderHook(() => useLibraryLinks(T))
    await flush()

    expect(getLibraryLinks).toHaveBeenCalledTimes(1)
    expect(getLibraryLinks).toHaveBeenCalledWith(T)
    expect(listFolders).toHaveBeenCalledTimes(1)

    const sa = a.result.current.stateFor("wf-1")
    const sb = b.result.current.stateFor("wf-1")
    expect(sa).toEqual(sb)
    expect(sa.promotable).toBe(true)
    expect(sa.link?.document_id).toBe("doc-1")
    expect(sa.leaf).toBe("Pricing")
    expect(sa.path).toBe("Suppliers › Meridian › Pricing")
    expect(a.result.current.stateFor("wf-json").promotable).toBe(false)
  })

  it("a thread with no linked documents never starts an interval", async () => {
    vi.mocked(getLibraryLinks).mockResolvedValue(links(null))
    renderHook(() => useLibraryLinks(T))
    await flush()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(INDEXING_POLL_MS * 3)
    })
    expect(getLibraryLinks).toHaveBeenCalledTimes(1)
    expect(vi.getTimerCount()).toBe(0)
  })

  it("processing → a second fetch after 4 s; the next answer completed → no further fetch", async () => {
    expect(INDEXING_POLL_MS).toBe(4000)
    vi.mocked(getLibraryLinks).mockResolvedValueOnce(links("processing")).mockResolvedValue(links("completed"))
    const { result } = renderHook(() => useLibraryLinks(T))
    await flush()
    expect(result.current.stateFor("wf-1").link?.document_status).toBe("processing")

    await act(async () => {
      await vi.advanceTimersByTimeAsync(INDEXING_POLL_MS)
    })
    expect(getLibraryLinks).toHaveBeenCalledTimes(2)
    expect(result.current.stateFor("wf-1").link?.document_status).toBe("completed")

    await act(async () => {
      await vi.advanceTimersByTimeAsync(INDEXING_POLL_MS * 2)
    })
    expect(getLibraryLinks).toHaveBeenCalledTimes(2)
  })

  it("failed also stops polling (D-25: never `indexing…` forever)", async () => {
    vi.mocked(getLibraryLinks).mockResolvedValueOnce(links("pending")).mockResolvedValue(links("failed"))
    const { result } = renderHook(() => useLibraryLinks(T))
    await flush()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(INDEXING_POLL_MS)
    })
    expect(result.current.stateFor("wf-1").link?.document_status).toBe("failed")
    await act(async () => {
      await vi.advanceTimersByTimeAsync(INDEXING_POLL_MS * 3)
    })
    expect(getLibraryLinks).toHaveBeenCalledTimes(2)
  })

  it("a rejected poll leaves the previous state and does not throw (a missed poll is a missed hint)", async () => {
    vi.mocked(getLibraryLinks)
      .mockResolvedValueOnce(links("paused"))
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValue(links("paused"))
    const { result } = renderHook(() => useLibraryLinks(T))
    await flush()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(INDEXING_POLL_MS)
    })
    expect(getLibraryLinks).toHaveBeenCalledTimes(2)
    expect(result.current.stateFor("wf-1").link?.document_status).toBe("paused")
    // still indexing → the poll carries on
    await act(async () => {
      await vi.advanceTimersByTimeAsync(INDEXING_POLL_MS)
    })
    expect(getLibraryLinks).toHaveBeenCalledTimes(3)
  })

  it("refreshLibraryLinks(T) triggers exactly one fetch", async () => {
    vi.mocked(getLibraryLinks).mockResolvedValueOnce(links(null)).mockResolvedValue(links("completed"))
    const { result } = renderHook(() => useLibraryLinks(T))
    await flush()
    expect(result.current.stateFor("wf-1").link).toBeNull()
    await act(async () => {
      refreshLibraryLinks(T)
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(getLibraryLinks).toHaveBeenCalledTimes(2)
    expect(result.current.stateFor("wf-1").link?.outcome).toBe("saved")
  })

  it("unmounting every consumer clears the interval", async () => {
    vi.mocked(getLibraryLinks).mockResolvedValue(links("processing"))
    const a = renderHook(() => useLibraryLinks(T))
    const b = renderHook(() => useLibraryLinks(T))
    await flush()
    expect(vi.getTimerCount()).toBe(1)
    a.unmount()
    expect(vi.getTimerCount()).toBe(1) // one consumer left
    b.unmount()
    expect(vi.getTimerCount()).toBe(0)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(INDEXING_POLL_MS * 2)
    })
    expect(getLibraryLinks).toHaveBeenCalledTimes(1)
  })

  it("a folder this person cannot see yields no name (T-274-25), and a null thread fetches nothing", async () => {
    vi.mocked(getLibraryLinks).mockResolvedValue(links("completed", "someone-elses"))
    const { result } = renderHook(() => useLibraryLinks(T))
    await flush()
    const s = result.current.stateFor("wf-1")
    expect(s.link?.document_id).toBe("doc-1")
    expect(s.leaf).toBeNull()
    expect(s.path).toBeNull()

    vi.mocked(getLibraryLinks).mockClear()
    const none = renderHook(() => useLibraryLinks(null))
    await flush()
    expect(getLibraryLinks).not.toHaveBeenCalled()
    expect(none.result.current.stateFor("wf-1")).toEqual({ promotable: true, link: null, leaf: null, path: null })
  })
})
