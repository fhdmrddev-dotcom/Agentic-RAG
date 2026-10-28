import { useState, useEffect, useCallback, useRef } from "react"
import { supabase } from "@/lib/supabase"
import {
  listFolders,
  createFolder as apiCreateFolder,
  renameFolder as apiRenameFolder,
  deleteFolder as apiDeleteFolder,
  toggleFolderOrgShared as apiToggleFolderOrgShared,
} from "@/lib/api"
// ⚠ The header seam is read from `_core` directly, never through the `@/lib/api` barrel: many
// suites mock the barrel wholesale, and a missing `getActiveOrgId` there would crash this hook.
import { getActiveOrgId } from "@/lib/api/_core"
import { useActiveOrgId } from "@/hooks/useActiveOrgId"
import { useOrgItemsVersion } from "@/lib/elsewhereCounts"
import type { Folder } from "@/types"

interface UseFolders {
  folders: Folder[]
  /** Phase 298-04 (D-09): true until the ACTIVE org's answer is held — on first load and after
   *  every org switch. A list shows its loading line while this is true, never "No folders". */
  loading: boolean
  createFolder: (name: string, parentId: string | null, isOrgShared?: boolean) => Promise<Folder>
  renameFolder: (id: string, name: string) => Promise<void>
  deleteFolder: (id: string) => Promise<void>
  toggleOrgShared: (id: string) => Promise<void>
}

/** The folder rows, tagged with the org their request was SENT under (the `X-Org-Id` header). */
interface Held {
  org: string | null
  rows: Folder[]
}

/** A Realtime payload is the RAW row, so it carries `org_id` even though `Folder` does not. */
type RealtimeFolder = Folder & { org_id?: string | null }

/** One stable empty list (a module constant, so a mismatched render never mints a new array). */
const NO_FOLDERS: Folder[] = []

/**
 * Phase 298-04 (D-10) — is this Realtime row from ANOTHER org than the active one?
 * ⛔ POLARITY: with no active org nothing is filtered (nothing narrows, so nothing is foreign),
 * and a row that carries no `org_id` key at all is never treated as foreign.
 */
function isForeign(row: RealtimeFolder, active: string | null): boolean {
  if (active === null) return false
  if (!("org_id" in row)) return false
  return row.org_id !== active
}

export function useFolders(): UseFolders {
  // Phase 298-04 (D-08 / D-09) — the org-tagged list. The effect re-asks on every org change; the
  // rows render only while the held answer's org IS the active org, so a switch drops the old
  // org's rows at once and a slow old-org answer can never repaint (no keyed remount, 297 rule).
  const activeOrgId = useActiveOrgId()
  const activeOrgRef = useRef(activeOrgId)
  activeOrgRef.current = activeOrgId
  const [held, setHeld] = useState<Held | null>(null)
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  /** Every write goes through here: it edits the ACTIVE org's rows only, and nothing else. */
  const setFolders = useCallback((update: (prev: Folder[]) => Folder[]) => {
    setHeld((prev) => {
      if (prev === null || prev.org !== activeOrgRef.current) return prev
      const rows = update(prev.rows)
      return rows === prev.rows ? prev : { org: prev.org, rows }
    })
  }, [])

  // Latest-wins: an earlier request (another org's, or a superseded one) never overwrites a later.
  const reqIdRef = useRef(0)
  const loadFolders = useCallback(async () => {
    const myReq = ++reqIdRef.current
    // The tag is the header this request carries (RESEARCH Pitfall 6a), read at SEND time.
    const sentUnder = getActiveOrgId()
    try {
      const data = await listFolders()
      if (myReq !== reqIdRef.current) return
      setHeld({ org: sentUnder, rows: data })
    } catch (err) {
      if (myReq !== reqIdRef.current) return
      // A failed read shows the shipped empty tree (as before 298), never a loader forever.
      setHeld({ org: sentUnder, rows: [] })
      throw err
    }
  }, [])

  // The list read, re-asked on every org switch (D-08) and after every move (298-05, UI-D19): a
  // background refetch, so a moved folder leaves the tree only when this answer lands.
  const moveVersion = useOrgItemsVersion()
  useEffect(() => {
    loadFolders().catch(console.error)
  }, [loadFolders, activeOrgId, moveVersion])

  useEffect(() => {
    let cancelled = false

    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return
      if (!data.session?.user.id) return

      // No user_id filter — RLS ensures users only receive their own rows + global.
      // Omitting column filter avoids REPLICA IDENTITY FULL requirement.
      // PREREQUISITE: folders table must be in supabase_realtime publication.
      // Verify with: SELECT tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime';
      // Add with: ALTER PUBLICATION supabase_realtime ADD TABLE folders;
      // Phase 298-04 (D-10): the payload is filtered by org against the ACTIVE org (read through a
      // ref, so the channel is never re-subscribed on a switch). Realtime stays a hint; the
      // refetch above is the truth (D-v2.5-03).
      const channel = supabase
        .channel("folders-changes")
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "folders",
          },
          (payload) => {
            if (payload.eventType === "INSERT") {
              const newFolder = payload.new as RealtimeFolder
              if (isForeign(newFolder, activeOrgRef.current)) return
              setFolders((prev) => {
                if (prev.some((f) => f.id === newFolder.id)) return prev
                return [...prev, newFolder]
              })
            } else if (payload.eventType === "UPDATE") {
              const updated = payload.new as RealtimeFolder
              // A row that now lives in another org (a move in another tab) LEAVES this list.
              if (isForeign(updated, activeOrgRef.current)) {
                setFolders((prev) => prev.filter((f) => f.id !== updated.id))
                return
              }
              setFolders((prev) => prev.map((f) => (f.id === updated.id ? updated : f)))
            } else if (payload.eventType === "DELETE") {
              setFolders((prev) => prev.filter((f) => f.id !== (payload.old as Folder).id))
            }
          },
        )
        .subscribe()

      channelRef.current = channel
    })

    return () => {
      cancelled = true
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
    }
  }, [setFolders])

  const createFolder = useCallback(
    async (name: string, parentId: string | null, isOrgShared = false): Promise<Folder> => {
      const folder = await apiCreateFolder(name, parentId, isOrgShared)
      // Optimistic add; Realtime INSERT will reconcile
      setFolders((prev) => {
        if (prev.some((f) => f.id === folder.id)) return prev
        return [...prev, folder]
      })
      return folder
    },
    [setFolders],
  )

  const renameFolder = useCallback(
    async (id: string, name: string): Promise<void> => {
      await apiRenameFolder(id, name)
      // Optimistic update; Realtime UPDATE will reconcile
      setFolders((prev) => prev.map((f) => (f.id === id ? { ...f, name } : f)))
    },
    [setFolders],
  )

  const deleteFolder = useCallback(
    async (id: string): Promise<void> => {
      await apiDeleteFolder(id)
      // Optimistic remove; Realtime DELETE will reconcile
      setFolders((prev) => prev.filter((f) => f.id !== id))
    },
    [setFolders],
  )

  const toggleOrgShared = useCallback(
    async (id: string): Promise<void> => {
      const updated = await apiToggleFolderOrgShared(id)
      setFolders((prev) =>
        prev.map((f) => (f.id === id ? { ...f, is_org_shared: updated.is_org_shared } : f)),
      )
    },
    [setFolders],
  )

  const current = held !== null && held.org === activeOrgId
  const folders = current ? held.rows : NO_FOLDERS
  const loading = !current

  return { folders, loading, createFolder, renameFolder, deleteFolder, toggleOrgShared }
}
