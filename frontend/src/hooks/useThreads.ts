import { useState, useCallback } from "react"
import type { Thread } from "../types"
import { listThreads, createThread, deleteThread as apiDeleteThread, renameThread as apiRenameThread } from "../lib/api"

interface UseThreads {
  threads: Thread[]
  selectedThread: Thread | null
  loading: boolean
  loadThreads: () => Promise<void>
  /** Select a thread — or pass `null` to DESELECT (IN-01: clear the stale old-org
   *  selection on an org switch). Widening to `Thread | null` is backward-compatible:
   *  every existing caller still passes a `Thread`. */
  selectThread: (thread: Thread | null) => void
  newThread: (folderId?: string | null) => Promise<Thread>
  deleteThread: (id: string) => Promise<void>
  renameThread: (id: string, title: string) => Promise<void>
  updateThreadTitle: (id: string, title: string) => void
}

export function useThreads(): UseThreads {
  const [threads, setThreads] = useState<Thread[]>([])
  const [selectedThread, setSelectedThread] = useState<Thread | null>(null)
  const [loading, setLoading] = useState(false)

  const loadThreads = useCallback(async () => {
    setLoading(true)
    try {
      const data = await listThreads()
      setThreads(data)
    } finally {
      setLoading(false)
    }
  }, [])

  const selectThread = useCallback((thread: Thread | null) => {
    setSelectedThread(thread)
  }, [])

  const newThread = useCallback(async (folderId?: string | null) => {
    const thread = await createThread("New Chat", folderId)
    setThreads((prev) => [thread, ...prev])
    setSelectedThread(thread)
    return thread
  }, [])

  const deleteThread = useCallback(async (id: string) => {
    await apiDeleteThread(id)
    setThreads((prev) => prev.filter((t) => t.id !== id))
    setSelectedThread((prev) => (prev?.id === id ? null : prev))
  }, [])

  const renameThread = useCallback(async (id: string, title: string) => {
    const updated = await apiRenameThread(id, title)
    setThreads((prev) => prev.map((t) => (t.id === id ? updated : t)))
    setSelectedThread((prev) => (prev?.id === id ? updated : prev))
  }, [])

  const updateThreadTitle = useCallback((id: string, title: string) => {
    setThreads((prev) => prev.map((t) => (t.id === id ? { ...t, title } : t)))
    setSelectedThread((prev) => (prev?.id === id ? { ...prev, title } : prev))
  }, [])

  return { threads, selectedThread, loading, loadThreads, selectThread, newThread, deleteThread, renameThread, updateThreadTitle }
}
