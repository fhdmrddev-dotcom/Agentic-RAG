/**
 * Tests for the useFolders hook.
 *
 * Mocks:
 * - @/lib/api – folder API functions
 * - @/lib/supabase – Supabase Realtime (channel subscription)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { renderHook, waitFor, act } from "@testing-library/react"

// ── Mock API module ────────────────────────────────────────────────────────────
const { mockListFolders, mockCreateFolder, mockRenameFolder, mockDeleteFolder } = vi.hoisted(() => ({
  mockListFolders: vi.fn(),
  mockCreateFolder: vi.fn(),
  mockRenameFolder: vi.fn(),
  mockDeleteFolder: vi.fn(),
}))

vi.mock("@/lib/api", () => ({
  listFolders: mockListFolders,
  createFolder: mockCreateFolder,
  renameFolder: mockRenameFolder,
  deleteFolder: mockDeleteFolder,
}))

// ── Mock Supabase – channel subscription ──────────────────────────────────────
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

// ── Phase 298-04 (D-08 / D-09 / D-10) — a flippable active org ────────────────
// `useActiveOrgId()` reads `useOrgOptional()`; this store stands in for OrgProvider so a test
// can switch org mid-render. `setActiveOrgId` (the header seam) is flipped with it, exactly as
// OrgProvider's switchOrg does (header first, then state).
const orgStore = vi.hoisted(() => {
  let current: string | null = null
  const subs = new Set<() => void>()
  return {
    get: () => current,
    set: (v: string | null) => {
      current = v
      subs.forEach((f) => f())
    },
    subscribe: (f: () => void) => {
      subs.add(f)
      return () => {
        subs.delete(f)
      }
    },
  }
})
vi.mock("@/providers/OrgProvider", async () => {
  const { useSyncExternalStore } = await import("react")
  return {
    useOrgOptional: () => ({ activeOrgId: useSyncExternalStore(orgStore.subscribe, orgStore.get) }),
  }
})

import { useFolders } from "@/hooks/useFolders"
import { setActiveOrgId } from "@/lib/api/_core"
import type { Folder } from "@/types"

function switchOrg(next: string | null) {
  setActiveOrgId(next)
  orgStore.set(next)
}

function deferred<T>() {
  let resolve!: (v: T) => void
  const promise = new Promise<T>((res) => {
    resolve = res
  })
  return { promise, resolve }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeFolder(overrides: Partial<Folder> & { id: string; name: string }): Folder {
  return {
    user_id: "user-1",
    parent_id: null,
    is_org_shared: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("useFolders", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockListFolders.mockResolvedValue([])
    mockOn.mockReturnValue(mockChannel)
    mockSubscribe.mockReturnValue(mockChannel)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it("loads folders on mount", async () => {
    const folders = [makeFolder({ id: "f1", name: "Docs" })]
    mockListFolders.mockResolvedValue(folders)

    const { result } = renderHook(() => useFolders())

    await waitFor(() => {
      expect(result.current.folders).toHaveLength(1)
    })
    expect(result.current.folders[0].name).toBe("Docs")
  })

  it("subscribes to Realtime channel 'folders-changes' on table 'folders'", async () => {
    const { supabase } = await import("@/lib/supabase")
    renderHook(() => useFolders())

    await waitFor(() => {
      expect(supabase.channel).toHaveBeenCalledWith("folders-changes")
    })
    expect(mockOn).toHaveBeenCalledWith(
      "postgres_changes",
      expect.objectContaining({ table: "folders" }),
      expect.any(Function),
    )
  })

  it("handles Realtime INSERT — adds new folder to state", async () => {
    const initial = [makeFolder({ id: "f1", name: "Existing" })]
    mockListFolders.mockResolvedValue(initial)

    const { result } = renderHook(() => useFolders())
    await waitFor(() => expect(result.current.folders).toHaveLength(1))

    // Extract the postgres_changes callback from the mock
    const onCallback = mockOn.mock.calls[0]?.[2] as (payload: unknown) => void

    const newFolder = makeFolder({ id: "f2", name: "New Folder" })
    act(() => {
      onCallback({ eventType: "INSERT", new: newFolder, old: {} })
    })

    expect(result.current.folders.some((f) => f.id === "f2")).toBe(true)
  })

  it("handles Realtime INSERT — deduplicates if folder already in state", async () => {
    const folder = makeFolder({ id: "f1", name: "Docs" })
    mockListFolders.mockResolvedValue([folder])

    const { result } = renderHook(() => useFolders())
    await waitFor(() => expect(result.current.folders).toHaveLength(1))

    const onCallback = mockOn.mock.calls[0]?.[2] as (payload: unknown) => void
    act(() => {
      onCallback({ eventType: "INSERT", new: folder, old: {} })
    })

    expect(result.current.folders).toHaveLength(1)
  })

  it("handles Realtime UPDATE — replaces matching folder in state", async () => {
    const folder = makeFolder({ id: "f1", name: "Old Name" })
    mockListFolders.mockResolvedValue([folder])

    const { result } = renderHook(() => useFolders())
    await waitFor(() => expect(result.current.folders).toHaveLength(1))

    const onCallback = mockOn.mock.calls[0]?.[2] as (payload: unknown) => void
    const updated = { ...folder, name: "New Name" }
    act(() => {
      onCallback({ eventType: "UPDATE", new: updated, old: folder })
    })

    expect(result.current.folders[0].name).toBe("New Name")
  })

  it("handles Realtime DELETE — removes matching folder from state", async () => {
    const folder = makeFolder({ id: "f1", name: "ToDelete" })
    mockListFolders.mockResolvedValue([folder])

    const { result } = renderHook(() => useFolders())
    await waitFor(() => expect(result.current.folders).toHaveLength(1))

    const onCallback = mockOn.mock.calls[0]?.[2] as (payload: unknown) => void
    act(() => {
      onCallback({ eventType: "DELETE", new: {}, old: { id: "f1" } })
    })

    expect(result.current.folders.find((f) => f.id === "f1")).toBeUndefined()
  })

  it("createFolder calls API and adds folder to state", async () => {
    const newFolder = makeFolder({ id: "f-new", name: "Created" })
    mockCreateFolder.mockResolvedValue(newFolder)

    const { result } = renderHook(() => useFolders())

    await act(async () => {
      await result.current.createFolder("Created", null)
    })

    expect(mockCreateFolder).toHaveBeenCalledWith("Created", null, false)
    expect(result.current.folders.some((f) => f.id === "f-new")).toBe(true)
  })

  it("renameFolder calls API and updates folder name in state", async () => {
    const folder = makeFolder({ id: "f1", name: "Original" })
    mockListFolders.mockResolvedValue([folder])
    mockRenameFolder.mockResolvedValue({ ...folder, name: "Renamed" })

    const { result } = renderHook(() => useFolders())
    await waitFor(() => expect(result.current.folders).toHaveLength(1))

    await act(async () => {
      await result.current.renameFolder("f1", "Renamed")
    })

    expect(mockRenameFolder).toHaveBeenCalledWith("f1", "Renamed")
    expect(result.current.folders[0].name).toBe("Renamed")
  })

  it("deleteFolder calls API and removes folder from state", async () => {
    const folder = makeFolder({ id: "f1", name: "ToDelete" })
    mockListFolders.mockResolvedValue([folder])
    mockDeleteFolder.mockResolvedValue(undefined)

    const { result } = renderHook(() => useFolders())
    await waitFor(() => expect(result.current.folders).toHaveLength(1))

    await act(async () => {
      await result.current.deleteFolder("f1")
    })

    expect(mockDeleteFolder).toHaveBeenCalledWith("f1")
    expect(result.current.folders.find((f) => f.id === "f1")).toBeUndefined()
  })

  it("removes Realtime channel on unmount", async () => {
    const { result, unmount } = renderHook(() => useFolders())

    // Wait for the async effect to run (getSession resolves and channel is set)
    await waitFor(() => {
      expect(mockOn).toHaveBeenCalled()
    })

    unmount()

    expect(mockRemoveChannel).toHaveBeenCalledWith(mockChannel)
  })
})

// ── Phase 298-04 (D-08 / D-09 / D-10) — the folder list follows an org switch ───
describe("useFolders — follows the active org (298-04)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // mockReset, not only clear: a queued *Once answer must never leak into the next case.
    mockListFolders.mockReset()
    mockListFolders.mockResolvedValue([])
    mockOn.mockReturnValue(mockChannel)
    mockSubscribe.mockReturnValue(mockChannel)
    switchOrg("org-a")
  })
  afterEach(() => {
    switchOrg(null)
  })

  const A = makeFolder({ id: "fa", name: "Research A" })
  const B = makeFolder({ id: "fb", name: "Contracts B" })

  it("exposes loading: true until the first answer, false after", async () => {
    const gate = deferred<Folder[]>()
    mockListFolders.mockReturnValueOnce(gate.promise)
    const { result } = renderHook(() => useFolders())
    expect(result.current.loading).toBe(true)
    expect(result.current.folders).toEqual([])
    await act(async () => gate.resolve([A]))
    expect(result.current.loading).toBe(false)
    expect(result.current.folders.map((f) => f.id)).toEqual(["fa"])
  })

  it("a switch A→B drops A's folders AT ONCE and reads loading until B answers", async () => {
    mockListFolders.mockResolvedValueOnce([A])
    const { result } = renderHook(() => useFolders())
    await waitFor(() => expect(result.current.folders.map((f) => f.id)).toEqual(["fa"]))

    const gateB = deferred<Folder[]>()
    mockListFolders.mockReturnValueOnce(gateB.promise)
    act(() => switchOrg("org-b"))
    expect(result.current.folders).toEqual([])
    expect(result.current.loading).toBe(true)
    expect(mockListFolders).toHaveBeenCalledTimes(2)

    await act(async () => gateB.resolve([B]))
    expect(result.current.loading).toBe(false)
    expect(result.current.folders.map((f) => f.id)).toEqual(["fb"])
  })

  it("an A answer resolving AFTER the switch is discarded — it never repaints", async () => {
    const gateA = deferred<Folder[]>()
    const gateB = deferred<Folder[]>()
    mockListFolders.mockReturnValueOnce(gateA.promise).mockReturnValueOnce(gateB.promise)
    const { result } = renderHook(() => useFolders())
    act(() => switchOrg("org-b"))
    await act(async () => gateB.resolve([B]))
    await act(async () => gateA.resolve([A]))
    expect(result.current.folders.map((f) => f.id)).toEqual(["fb"])
    expect(result.current.loading).toBe(false)
  })

  it("createFolder after a switch lands in the NEW org's list", async () => {
    mockListFolders.mockResolvedValueOnce([A]).mockResolvedValueOnce([B])
    const { result } = renderHook(() => useFolders())
    await waitFor(() => expect(result.current.folders.map((f) => f.id)).toEqual(["fa"]))
    act(() => switchOrg("org-b"))
    await waitFor(() => expect(result.current.folders.map((f) => f.id)).toEqual(["fb"]))
    mockCreateFolder.mockResolvedValue(makeFolder({ id: "fb2", name: "New in B" }))
    await act(async () => {
      await result.current.createFolder("New in B", null)
    })
    expect(result.current.folders.map((f) => f.id)).toEqual(["fb", "fb2"])
  })

  function realtime() {
    return mockOn.mock.calls[0]?.[2] as (payload: unknown) => void
  }

  it("Realtime INSERT carrying another org's org_id is ignored (D-10)", async () => {
    mockListFolders.mockResolvedValueOnce([A])
    const { result } = renderHook(() => useFolders())
    await waitFor(() => expect(result.current.folders).toHaveLength(1))
    await waitFor(() => expect(mockOn).toHaveBeenCalled())
    act(() => realtime()({ eventType: "INSERT", new: { ...B, org_id: "org-b" }, old: {} }))
    expect(result.current.folders.map((f) => f.id)).toEqual(["fa"])
    act(() => realtime()({ eventType: "INSERT", new: { ...makeFolder({ id: "fa2", name: "A2" }), org_id: "org-a" }, old: {} }))
    expect(result.current.folders.map((f) => f.id)).toEqual(["fa", "fa2"])
  })

  it("Realtime UPDATE carrying another org's org_id REMOVES the row; an in-org UPDATE merges", async () => {
    mockListFolders.mockResolvedValueOnce([A, makeFolder({ id: "fa2", name: "Stays" })])
    const { result } = renderHook(() => useFolders())
    await waitFor(() => expect(result.current.folders).toHaveLength(2))
    await waitFor(() => expect(mockOn).toHaveBeenCalled())
    act(() => realtime()({ eventType: "UPDATE", new: { ...A, org_id: "org-b" }, old: { id: "fa" } }))
    expect(result.current.folders.map((f) => f.id)).toEqual(["fa2"])
    act(() =>
      realtime()({ eventType: "UPDATE", new: { ...makeFolder({ id: "fa2", name: "Renamed" }), org_id: "org-a" }, old: { id: "fa2" } }),
    )
    expect(result.current.folders.map((f) => f.name)).toEqual(["Renamed"])
  })

  it("with NO active org the Realtime channel filters nothing (polarity)", async () => {
    switchOrg(null)
    mockListFolders.mockResolvedValueOnce([A])
    const { result } = renderHook(() => useFolders())
    await waitFor(() => expect(result.current.folders).toHaveLength(1))
    await waitFor(() => expect(mockOn).toHaveBeenCalled())
    act(() => realtime()({ eventType: "INSERT", new: { ...B, org_id: "org-b" }, old: {} }))
    act(() => realtime()({ eventType: "UPDATE", new: { ...A, name: "A renamed", org_id: "org-z" }, old: { id: "fa" } }))
    expect(result.current.folders.map((f) => f.name)).toEqual(["A renamed", "Contracts B"])
  })
})

// ── Phase 298-05 (D-21 / UI-D19) — a move refetches; the moved folder leaves on the ANSWER ──────
describe("useFolders — after a move (298-05)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockListFolders.mockReset()
    mockOn.mockReturnValue(mockChannel)
    mockSubscribe.mockReturnValue(mockChannel)
    switchOrg("org-a")
  })
  afterEach(() => switchOrg(null))

  const Moved = makeFolder({ id: "fm", name: "Q3 Contracts" })
  const Stays = makeFolder({ id: "fs", name: "Stays" })

  it("noteMoved re-asks the list; the moved folder stays until that answer removes it", async () => {
    const { noteMoved } = await import("@/lib/elsewhereCounts")
    mockListFolders.mockResolvedValueOnce([Moved, Stays])
    const { result } = renderHook(() => useFolders())
    await waitFor(() => expect(result.current.folders.map((f) => f.id)).toEqual(["fm", "fs"]))
    const after = deferred<Folder[]>()
    mockListFolders.mockReturnValueOnce(after.promise)
    act(() => noteMoved({ kind: "folder", id: "fm" }))
    await waitFor(() => expect(mockListFolders).toHaveBeenCalledTimes(2))
    // A background refetch: no loading line, and NO optimistic removal.
    expect(result.current.loading).toBe(false)
    expect(result.current.folders.map((f) => f.id)).toEqual(["fm", "fs"])
    await act(async () => after.resolve([Stays]))
    expect(result.current.folders.map((f) => f.id)).toEqual(["fs"])
  })
})
