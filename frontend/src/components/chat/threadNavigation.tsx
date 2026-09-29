/**
 * Phase 267 plan 04 (PACK-24 · D-267-16 / T-267-46) — the thread-navigation door, as a CONTEXT.
 *
 * ⭐ WHY A CONTEXT. This app has no router: opening a thread means calling `selectThread` with the
 * thread OBJECT from the loaded list and moving the app to the chat surface. The handoff pointer
 * lives deep in the transcript (`MessageList → MessageItem → ExpertEventCard`), and threading three
 * callbacks through two hot files would widen `MessageList`'s pinned prop set for one leaf. So
 * `ChatLayout` provides the door once and the leaf reads it — `MessageList` / `MessageItem` gain
 * no prop.
 *
 * ⛔ `findThread` RESOLVES ONLY FROM THE CALLER'S LOADED LIST. A target that is not there (deleted,
 * or never the caller's) returns `null` and the pointer renders as words with no control — a link
 * to nothing is a control that does nothing (T-267-46).
 *
 * ⛔ OUTSIDE A PROVIDER `useThreadNavigation()` IS `null`, and a consumer must then render no
 * navigation control at all.
 */
import { createContext, useContext, type ReactNode } from "react"
import type { Thread } from "@/types"

export interface ThreadNavigation {
  /** The thread with this id from the loaded list, or `null`. */
  findThread: (id: string) => Thread | null
  /** Select the thread and move the app to the chat surface. */
  openThread: (thread: Thread) => void
  /** Refetch the thread list from the server (so the list and the server agree). */
  refreshThreads: () => Promise<void>
}

const ThreadNavigationContext = createContext<ThreadNavigation | null>(null)

export function ThreadNavigationProvider({
  value,
  children,
}: {
  value: ThreadNavigation
  children: ReactNode
}) {
  return <ThreadNavigationContext.Provider value={value}>{children}</ThreadNavigationContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useThreadNavigation(): ThreadNavigation | null {
  return useContext(ThreadNavigationContext)
}
