/**
 * Phase 298-05 (ORG-06 / D-16 / UI-D6 / UI-D19) — the elsewhere-counts store and its client calls.
 *
 * One GET per active org feeds every mount: four lists cost one request. A switch asks again,
 * an answer for another org never writes, a move invalidates (and the lists' version moves), and
 * a failure is held as `failed` so the line renders nothing rather than a wrong number.
 *
 * The network is faked at the client seam (`getElsewhereCounts`) for the store, and at `fetch`
 * for the client functions themselves (which own the URL, the body and the refusal class).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { act, renderHook, waitFor } from "@testing-library/react"

const header = vi.hoisted(() => ({ org: null as string | null }))
vi.mock("@/lib/api/_core", () => ({
  API_BASE: "http://api.test",
  ApiError: class ApiError extends Error {
    status: number
    constructor(message: string, status: number) {
      super(message)
      this.status = status
    }
  },
  getAuthHeaders: async () => ({ Authorization: "Bearer t", ...(header.org ? { "X-Org-Id": header.org } : {}) }),
  getActiveOrgId: () => header.org,
}))

const client = vi.hoisted(() => ({ getElsewhereCounts: vi.fn() }))
vi.mock("@/lib/api/orgItems", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/orgItems")>()
  return { ...actual, getElsewhereCounts: client.getElsewhereCounts }
})

import {
  useElsewhereCounts,
  invalidateElsewhereCounts,
  noteMoved,
  useOrgItemsVersion,
  useLastMoved,
  resetElsewhereCounts,
  openMoveSheet,
  closeMoveSheet,
  useMoveSheetRequest,
} from "@/lib/elsewhereCounts"
import type { ElsewhereOrgCounts } from "@/lib/api/orgItems"

function counts(over: Partial<ElsewhereOrgCounts> = {}): ElsewhereOrgCounts {
  return { org_id: "B", org_name: "Acme Legal", folders: 2, root_documents: 5, workflows: 3, threads: 1, runs: 4, ...over }
}

function deferred<T>() {
  let resolve!: (v: T) => void
  let reject!: (e: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

beforeEach(() => {
  client.getElsewhereCounts.mockReset()
  header.org = "A"
})
afterEach(() => resetElsewhereCounts())

describe("elsewhereCounts — one request per active org (D-16)", () => {
  it("THREE concurrent mounts under the same org issue ONE GET and all read the answer", async () => {
    client.getElsewhereCounts.mockResolvedValue([counts()])
    const a = renderHook(() => useElsewhereCounts("A"))
    const b = renderHook(() => useElsewhereCounts("A"))
    const c = renderHook(() => useElsewhereCounts("A"))
    const d = renderHook(() => useElsewhereCounts("A"))
    await waitFor(() => expect(a.result.current.status).toBe("ready"))
    expect(client.getElsewhereCounts).toHaveBeenCalledTimes(1)
    for (const h of [a, b, c, d]) expect(h.result.current.orgs).toEqual([counts()])
  })

  it("reads `loading` with NO rows before the answer arrives (never a zero)", () => {
    client.getElsewhereCounts.mockReturnValue(new Promise(() => {}))
    const { result } = renderHook(() => useElsewhereCounts("A"))
    expect(result.current.status).toBe("loading")
    expect(result.current.orgs).toEqual([])
  })

  it("a switch asks again, and the previous org's late answer is DISCARDED", async () => {
    const first = deferred<ElsewhereOrgCounts[]>()
    const second = deferred<ElsewhereOrgCounts[]>()
    client.getElsewhereCounts.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
    const { result, rerender } = renderHook(({ org }) => useElsewhereCounts(org), { initialProps: { org: "A" } })
    await waitFor(() => expect(client.getElsewhereCounts).toHaveBeenCalledTimes(1))
    header.org = "B"
    rerender({ org: "B" })
    await waitFor(() => expect(client.getElsewhereCounts).toHaveBeenCalledTimes(2))
    // B answers first, then A's stale answer lands: it must not overwrite B's.
    await act(async () => second.resolve([counts({ org_id: "A", org_name: "Personal", folders: 7 })]))
    await act(async () => first.resolve([counts({ folders: 99 })]))
    expect(result.current.status).toBe("ready")
    expect(result.current.orgs).toEqual([counts({ org_id: "A", org_name: "Personal", folders: 7 })])
  })

  it("an answer whose request carried ANOTHER org's header never writes (stays loading)", async () => {
    header.org = "Z" // the header disagrees with the key the hook asked for
    client.getElsewhereCounts.mockResolvedValue([counts()])
    const { result } = renderHook(() => useElsewhereCounts("A"))
    await waitFor(() => expect(client.getElsewhereCounts).toHaveBeenCalledTimes(1))
    await act(async () => {})
    expect(result.current.status).toBe("loading")
    expect(result.current.orgs).toEqual([])
  })

  it("asks nothing for a solo user or with no active org", async () => {
    client.getElsewhereCounts.mockResolvedValue([counts()])
    const solo = renderHook(() => useElsewhereCounts("A", false))
    const none = renderHook(() => useElsewhereCounts(null))
    await act(async () => {})
    expect(client.getElsewhereCounts).not.toHaveBeenCalled()
    expect(solo.result.current.orgs).toEqual([])
    expect(none.result.current.orgs).toEqual([])
  })

  it("a failed read is `failed` with no rows, and is only warned about", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    client.getElsewhereCounts.mockRejectedValue(new Error("boom"))
    const { result } = renderHook(() => useElsewhereCounts("A"))
    await waitFor(() => expect(result.current.status).toBe("failed"))
    expect(result.current.orgs).toEqual([])
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })
})

describe("elsewhereCounts — after a move (UI-D19)", () => {
  it("invalidateElsewhereCounts() asks again and keeps the last answer on screen meanwhile", async () => {
    const later = deferred<ElsewhereOrgCounts[]>()
    client.getElsewhereCounts.mockResolvedValueOnce([counts({ folders: 1 })]).mockReturnValueOnce(later.promise)
    const { result } = renderHook(() => useElsewhereCounts("A"))
    await waitFor(() => expect(result.current.status).toBe("ready"))
    act(() => invalidateElsewhereCounts())
    await waitFor(() => expect(client.getElsewhereCounts).toHaveBeenCalledTimes(2))
    expect(result.current.orgs).toEqual([counts({ folders: 1 })])
    await act(async () => later.resolve([counts({ folders: 2 })]))
    expect(result.current.orgs).toEqual([counts({ folders: 2 })])
  })

  it("noteMoved bumps the lists' version, records what moved, and refetches the counts", async () => {
    client.getElsewhereCounts.mockResolvedValue([counts()])
    const counted = renderHook(() => useElsewhereCounts("A"))
    const version = renderHook(() => useOrgItemsVersion())
    const last = renderHook(() => useLastMoved())
    await waitFor(() => expect(counted.result.current.status).toBe("ready"))
    expect(version.result.current).toBe(0)
    expect(last.result.current).toBeNull()
    act(() => noteMoved({ kind: "folder", id: "f1", holdsSelection: true }))
    expect(version.result.current).toBe(1)
    expect(last.result.current).toEqual({ kind: "folder", id: "f1", holdsSelection: true, seq: 1 })
    await waitFor(() => expect(client.getElsewhereCounts).toHaveBeenCalledTimes(2))
  })

  it("resetElsewhereCounts() empties everything (registered in setupTests)", async () => {
    client.getElsewhereCounts.mockResolvedValue([counts()])
    const { result } = renderHook(() => useElsewhereCounts("A"))
    await waitFor(() => expect(result.current.status).toBe("ready"))
    act(() => noteMoved({ kind: "draft", id: "d1" }))
    act(() => resetElsewhereCounts())
    const version = renderHook(() => useOrgItemsVersion())
    const last = renderHook(() => useLastMoved())
    expect(version.result.current).toBe(0)
    expect(last.result.current).toBeNull()
  })
})

describe("elsewhereCounts — the open move request (the sheet host)", () => {
  it("openMoveSheet / closeMoveSheet hold one request, tagged with the org it was opened in", () => {
    const { result } = renderHook(() => useMoveSheetRequest())
    expect(result.current).toBeNull()
    act(() =>
      openMoveSheet({
        kind: "folder",
        itemId: "f1",
        itemName: "Q3 Contracts",
        targets: [{ org_id: "B", name: "Acme Legal", role: "member" }],
        openedIn: "A",
      }),
    )
    expect(result.current).toMatchObject({ kind: "folder", itemId: "f1", openedIn: "A" })
    act(() => closeMoveSheet())
    expect(result.current).toBeNull()
  })
})

describe("orgItems client — elsewhere + move (298-05)", () => {
  const fetchMock = vi.fn()
  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal("fetch", fetchMock)
  })
  afterEach(() => vi.unstubAllGlobals())

  function json(status: number, body: unknown) {
    return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } })
  }

  it("getElsewhereCounts GETs /org-items/elsewhere and returns its orgs", async () => {
    const actual = await vi.importActual<typeof import("@/lib/api/orgItems")>("@/lib/api/orgItems")
    fetchMock.mockResolvedValue(json(200, { orgs: [counts()] }))
    await expect(actual.getElsewhereCounts()).resolves.toEqual([counts()])
    expect(fetchMock.mock.calls[0][0]).toBe("http://api.test/org-items/elsewhere")
    fetchMock.mockResolvedValue(json(500, {}))
    await expect(actual.getElsewhereCounts()).rejects.toBeInstanceOf(Error)
  })

  it("getMovePreview sends kind, id and to; a refusal throws ApiRefusal with the server sentence", async () => {
    const actual = await vi.importActual<typeof import("@/lib/api/orgItems")>("@/lib/api/orgItems")
    const { ApiRefusal } = await import("@/lib/api/refusal")
    const preview = {
      kind: "folder",
      item_id: "f1",
      item_name: "Q3 Contracts",
      from_org: { id: "A", name: "Personal" },
      to_org: { id: "B", name: "Acme Legal" },
      counts: { subfolders: 2, documents: 14, earlier_versions: 0, past_runs: 0 },
      refusals: [],
    }
    fetchMock.mockResolvedValue(json(200, preview))
    await expect(actual.getMovePreview("folder", "f1", "B")).resolves.toEqual(preview)
    const url = new URL(fetchMock.mock.calls[0][0] as string)
    expect(url.pathname).toBe("/org-items/move-preview")
    expect(Object.fromEntries(url.searchParams)).toEqual({ kind: "folder", id: "f1", to: "B" })
    fetchMock.mockResolvedValue(json(403, { detail: "You're not a member of Acme Legal." }))
    const err = await actual.getMovePreview("folder", "f1", "B").catch((e) => e)
    expect(err).toBeInstanceOf(ApiRefusal)
    expect(err.status).toBe(403)
    expect(err.message).toBe("You're not a member of Acme Legal.")
  })

  it("moveOrgItem POSTs {kind, id, to_org_id}; a 409 throws ApiRefusal with the server sentence", async () => {
    const actual = await vi.importActual<typeof import("@/lib/api/orgItems")>("@/lib/api/orgItems")
    const { ApiRefusal } = await import("@/lib/api/refusal")
    fetchMock.mockResolvedValue(json(409, { detail: "“Q3 Contracts” is under a legal hold, so it stays in Personal until the hold is released." }))
    const err = await actual.moveOrgItem("folder", "f1", "B").catch((e) => e)
    expect(fetchMock.mock.calls[0][0]).toBe("http://api.test/org-items/move")
    const init = fetchMock.mock.calls[0][1] as RequestInit
    expect(init.method).toBe("POST")
    expect(JSON.parse(init.body as string)).toEqual({ kind: "folder", id: "f1", to_org_id: "B" })
    expect(err).toBeInstanceOf(ApiRefusal)
    expect(err.status).toBe(409)
    expect(err.message).toContain("legal hold")
  })
})
