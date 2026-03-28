import { useState, useEffect, useCallback, useRef } from "react"
import { supabase } from "@/lib/supabase"
import {
  listFolders,
  createFolder as apiCreateFolder,
  renameFolder as apiRenameFolder,
  deleteFolder as apiDeleteFolder,
  toggleFolderGlobal as apiToggleFolderGlobal,
} from "@/lib/api"
import type { Folder } from "@/types"

interface UseFolders {
  folders: Folder[]
  createFolder: (name: string, parentId: string | null, isGlobal?: boolean) => Promise<Folder>
  renameFolder: (id: string, name: string) => Promise<void>
  deleteFolder: (id: string) => Promise<void>
  toggleGlobal: (id: string) => Promise<void>
}

export function useFolders(): UseFolders {
  const [folders, setFolders] = useState<Folder[]>([])
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  const loadFolders = useCallback(async () => {
    const data = await listFolders()
    setFolders(data)
  }, [])

  useEffect(() => {
    loadFolders().catch(console.error)

    let cancelled = false

    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return
      if (!data.session?.user.id) return

      // No user_id filter — RLS ensures users only receive their own rows + global.
      // Omitting column filter avoids REPLICA IDENTITY FULL requirement.
      // PREREQUISITE: folders table must be in supabase_realtime publication.
      // Verify with: SELECT tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime';
      // Add with: ALTER PUBLICATION supabase_realtime ADD TABLE folders;
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
              const newFolder = payload.new as Folder
              setFolders((prev) => {
                if (prev.some((f) => f.id === newFolder.id)) return prev
                return [...prev, newFolder]
              })
            } else if (payload.eventType === "UPDATE") {
              setFolders((prev) =>
                prev.map((f) => (f.id === (payload.new as Folder).id ? (payload.new as Folder) : f)),
              )
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
  }, [loadFolders])

  const createFolder = useCallback(
    async (name: string, parentId: string | null, isGlobal = false): Promise<Folder> => {
      const folder = await apiCreateFolder(name, parentId, isGlobal)
      // Optimistic add; Realtime INSERT will reconcile
      setFolders((prev) => {
        if (prev.some((f) => f.id === folder.id)) return prev
        return [...prev, folder]
      })
      return folder
    },
    [],
  )

  const renameFolder = useCallback(async (id: string, name: string): Promise<void> => {
    await apiRenameFolder(id, name)
    // Optimistic update; Realtime UPDATE will reconcile
    setFolders((prev) => prev.map((f) => (f.id === id ? { ...f, name } : f)))
  }, [])

  const deleteFolder = useCallback(async (id: string): Promise<void> => {
    await apiDeleteFolder(id)
    // Optimistic remove; Realtime DELETE will reconcile
    setFolders((prev) => prev.filter((f) => f.id !== id))
  }, [])

  const toggleGlobal = useCallback(async (id: string): Promise<void> => {
    const updated = await apiToggleFolderGlobal(id)
    setFolders((prev) => prev.map((f) => (f.id === id ? { ...f, is_global: updated.is_global } : f)))
  }, [])

  return { folders, createFolder, renameFolder, deleteFolder, toggleGlobal }
}
