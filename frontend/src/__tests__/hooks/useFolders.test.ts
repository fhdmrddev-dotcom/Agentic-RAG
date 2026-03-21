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

import { useFolders } from "@/hooks/useFolders"
import type { Folder } from "@/types"

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeFolder(overrides: Partial<Folder> & { id: string; name: string }): Folder {
  return {
    user_id: "user-1",
    parent_id: null,
    is_global: false,
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
