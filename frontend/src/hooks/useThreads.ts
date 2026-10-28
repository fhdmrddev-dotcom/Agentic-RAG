import { useState, useCallback, useRef } from "react"
import type { Thread } from "../types"
import { listThreads, createThread, deleteThread as apiDeleteThread, renameThread as apiRenameThread } from "../lib/api"
// Phase 298-04: the org key, and the header seam read from `_core` (never the barrel, which
// suites mock wholesale — a missing export there would crash this hook).
import { getActiveOrgId } from "../lib/api/_core"
import { useActiveOrgId } from "./useActiveOrgId"

interface UseThreads {
  threads: Thread[]
  selectedThread: Thread | null
  loading: boolean
  /** Phase 298-04 (D-11 / UI-D9): true ONLY while the held answer belongs to ANOTHER org than the
   *  active one — i.e. during an org switch. False on the first render, so first paint is
   *  unchanged (BUG-261027-02 stays for Phase 299). ChatLayout drives the history column's
   *  "Loading your chats…" line with it. */
  switching: boolean
  loadThreads: () => Promise<void>
  /** Select a thread — or pass `null` to DESELECT (IN-01: clear the stale old-org
   *  selection on an org switch). Widening to `Thread | null` is backward-compatible:
   *  every existing caller still passes a `Thread`. */
  selectThread: (thread: Thread | null) => void
  /** Phase 267 (D-267-21): `activeExpertId` creates the thread WITH its Expert, in one request. */
  newThread: (folderId?: string | null, activeExpertId?: string | null) => Promise<Thread>
  deleteThread: (id: string) => Promise<void>
  renameThread: (id: string, title: string) => Promise<void>
  updateThreadTitle: (id: string, title: string) => void
  /** 267-REVIEW CR-01: write the SERVER's answer for a thread (e.g. after an Expert change) into the
   *  list and the selection, so coming back to the thread never hydrates a stale `active_expert_id`. */
  patchThread: (updated: Thread) => void
}

/** The thread rows, tagged with the org their request was SENT under (the `X-Org-Id` header). */
interface Held {
  org: string | null
  rows: Thread[]
}

const NO_THREADS: Thread[] = []

export function useThreads(): UseThreads {
  // Phase 298-04 (D-08 / D-09) — the org-tagged list. ChatLayout re-asks on an org change; the
  // rows render only while the held answer's org IS the active org, so a switch drops the old
  // org's threads at once and a slow old-org answer can never repaint (no keyed remount).
  const activeOrgId = useActiveOrgId()
  const activeOrgRef = useRef(activeOrgId)
  activeOrgRef.current = activeOrgId
  // `null` until the first answer: the list reads `[]` and `switching` is false, exactly the
  // shipped first paint.
  const [held, setHeld] = useState<Held | null>(null)
  const [selectedThread, setSelectedThread] = useState<Thread | null>(null)
  const [loading, setLoading] = useState(false)
  const reqIdRef = useRef(0)

  /** Every list write goes through here: it edits the ACTIVE org's rows only. Before the first
   *  answer (nothing held yet) a write starts the active org's list, as `[]` did before 298. */
  const setThreads = useCallback((update: (prev: Thread[]) => Thread[]) => {
    setHeld((prev) => {
      if (prev === null) return { org: activeOrgRef.current, rows: update([]) }
      if (prev.org !== activeOrgRef.current) return prev
      return { org: prev.org, rows: update(prev.rows) }
    })
  }, [])

  const loadThreads = useCallback(async () => {
    // Latest-wins: an earlier request (another org's, or a superseded one) never overwrites a later.
    const myReq = ++reqIdRef.current
    // The tag is the header this request carries (RESEARCH Pitfall 6a), read at SEND time.
    const sentUnder = getActiveOrgId()
    setLoading(true)
    try {
      const data = await listThreads()
      if (myReq !== reqIdRef.current) return
      setHeld({ org: sentUnder, rows: data })
    } catch (err) {
      // 298-review WR-03: a failed answer still settles the org it was asked under (as useFolders).
      if (myReq === reqIdRef.current) setHeld({ org: sentUnder, rows: [] })
      throw err
    } finally {
      if (myReq === reqIdRef.current) setLoading(false)
    }
  }, [])

  const selectThread = useCallback((thread: Thread | null) => {
    setSelectedThread(thread)
  }, [])

  const newThread = useCallback(async (folderId?: string | null, activeExpertId?: string | null) => {
    const thread = await createThread("New Chat", folderId, activeExpertId)
    setThreads((prev) => [thread, ...prev])
    setSelectedThread(thread)
    return thread
  }, [setThreads])

  const deleteThread = useCallback(async (id: string) => {
    await apiDeleteThread(id)
    setThreads((prev) => prev.filter((t) => t.id !== id))
    setSelectedThread((prev) => (prev?.id === id ? null : prev))
  }, [setThreads])

  const renameThread = useCallback(async (id: string, title: string) => {
    const updated = await apiRenameThread(id, title)
    setThreads((prev) => prev.map((t) => (t.id === id ? updated : t)))
    setSelectedThread((prev) => (prev?.id === id ? updated : prev))
  }, [setThreads])

  const updateThreadTitle = useCallback((id: string, title: string) => {
    setThreads((prev) => prev.map((t) => (t.id === id ? { ...t, title } : t)))
    setSelectedThread((prev) => (prev?.id === id ? { ...prev, title } : prev))
  }, [setThreads])

  const patchThread = useCallback((updated: Thread) => {
    setThreads((prev) => prev.map((t) => (t.id === updated.id ? { ...t, ...updated } : t)))
    setSelectedThread((prev) => (prev?.id === updated.id ? { ...prev, ...updated } : prev))
  }, [setThreads])

  const threads = held !== null && held.org === activeOrgId ? held.rows : NO_THREADS
  const switching = held !== null && held.org !== activeOrgId

  return { threads, selectedThread, loading, switching, loadThreads, selectThread, newThread, deleteThread, renameThread, updateThreadTitle, patchThread }
}
