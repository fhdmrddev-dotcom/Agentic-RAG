import { useState, useCallback } from "react"
import type { Thread } from "../types"
import { listThreads, createThread } from "../lib/api"

interface UseThreads {
  threads: Thread[]
  selectedThread: Thread | null
  loading: boolean
  loadThreads: () => Promise<void>
  selectThread: (thread: Thread) => void
  newThread: () => Promise<Thread>
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

  const selectThread = useCallback((thread: Thread) => {
    setSelectedThread(thread)
  }, [])

  const newThread = useCallback(async () => {
    const thread = await createThread()
    setThreads((prev) => [thread, ...prev])
    setSelectedThread(thread)
    return thread
  }, [])

  return { threads, selectedThread, loading, loadThreads, selectThread, newThread }
}
