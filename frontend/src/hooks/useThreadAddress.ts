import { useCallback, useEffect, useRef } from "react"
import type { Thread } from "@/types"
// Type-only: the navigators arrive as a prop from App's ONE navigation hook (D-08).
import type { EntityLink } from "@/hooks/useAppNavigation"

export interface ThreadAddressInput {
  /** The thread the address names (`/app/chat/<id>`), lowercased; `null` anywhere else. */
  threadId: string | null
  /** True while the chat view is on screen. */
  onChatView: boolean
  /** The active org's thread list (read through a ref — a refetch never re-runs the binding). */
  threads: readonly Thread[]
  /** True until the active org's list has answered (`useThreads().pending`). */
  threadsPending: boolean
  selectedThread: Thread | null
  /** `useThreads().selectThread` — ⛔ stays a bare setState; this hook only calls it. */
  selectThread: (thread: Thread | null) => void
  /** App's entity navigators. Absent (a suite mounting ChatLayout alone): the hook is inert. */
  entityLink: EntityLink | undefined
  /** The active org — tells a person's deselect from ChatLayout's IN-01 org-change reset. */
  activeOrgId: string | null
  /** Only when `entityLink` is absent: what `openThread` calls after selecting (today's
   *  `onNavigate("chat")`), so a suite without App keeps the pre-299 behaviour exactly. */
  legacyOpenChat?: () => void
}

export interface ThreadAddress {
  /** Select a thread AND put its address on screen — one history entry. */
  openThread: (thread: Thread) => void
  /** True while a thread address is on screen and its thread is not the selection yet. The chat
   *  region shows the holding sentence instead of an empty composer (Pitfall 5). */
  holding: boolean
}

interface Seen {
  threadId: string | null
  selectedId: string | null
  onChatView: boolean
  pending: boolean
  orgId: string | null
}

/**
 * Phase 299-02 (LINK-02 / D-02, D-32; RESEARCH Pattern 3, Pitfalls 4-5) — THE OPEN THREAD LIVES IN
 * THE ADDRESS.
 *
 * ChatLayout's selected thread and `/app/chat/<id>` are bound both ways by ONE effect:
 *   • address → selection: a cold load, a refresh, Back or Forward onto `/app/chat/<id>` selects that
 *     thread once the active org's list has answered and holds it (no history write);
 *   • selection → address: picking a thread or creating one (New chat makes a REAL thread, D-32) on
 *     the chat view PUSHES its address; a person's deselect REPLACES it with `/app`;
 *   • a thread picked OFF the chat view (Ask in chat, the palette, the run page, an Expert) wins
 *     when the chat view is next entered: the address is corrected in place (a replace), so the
 *     legacy "select, then onNavigate('chat')" shape still writes one entry and never lands on the
 *     rail's remembered thread instead of the one asked for.
 *
 * ⚠ WHY ONE EFFECT, NOT TWO (a reasoned deviation from the plan's Effect 1 / Effect 2): the address
 * and the selection often change in the SAME commit (a pick that navigates, Back after a pick). Two
 * effects would each act on their half and fight — the ping-pong Pitfall 4 names. One effect keeps
 * what it last saw and decides from what CHANGED, in a fixed order.
 *
 * ⚠ WHY REFS (Pitfall 4): the list, the selection object, `selectThread` and the link are read
 * through refs, so the effect re-runs only when an INPUT changes (address, pending, selected id, view,
 * org) — never on a list refetch, which hands a new array with the same rows.
 *
 * ⚠ THE IN-01 ORG RESET IS NOT A DESELECT: ChatLayout calls `selectThread(null)` on every active-org
 * change (~:191-201, not edited). That null lands one commit AFTER the org change, so "was the org
 * changed in this same run?" cannot tell it apart. Instead an org change opens a window that closes at
 * the first deselect or when the new org's list settles; a deselect inside it leaves the address,
 * so 299-03's Switch / Stay keep `/app/chat/<id>` and the linked thread is re-selected on settle.
 *
 * ⛔ NEVER calls `setViewingThread` (ChatArea stays its sole caller), never imports the streams
 * provider or its store, never calls a router hook (D-08 — `useAppNavigation` is the only caller),
 * and writes no History entry itself: every address change goes through `entityLink`.
 */
export function useThreadAddress(input: ThreadAddressInput): ThreadAddress {
  const { threadId, onChatView, threadsPending, selectedThread, activeOrgId, entityLink } = input
  const selectedId = selectedThread?.id ?? null
  const inert = entityLink === undefined

  const threadsRef = useRef(input.threads)
  const selectRef = useRef(input.selectThread)
  const linkRef = useRef(entityLink)
  const legacyRef = useRef(input.legacyOpenChat)
  useEffect(() => {
    threadsRef.current = input.threads
    selectRef.current = input.selectThread
    linkRef.current = entityLink
    legacyRef.current = input.legacyOpenChat
  })

  const seen = useRef<Seen | null>(null)
  /** A thread selected while the chat view was not on screen, not yet put in the address. */
  const pick = useRef<string | null>(null)
  /** Open from an org change until the first deselect or the new list settling (IN-01). */
  const orgWindow = useRef(false)

  useEffect(() => {
    if (inert) return
    const link = linkRef.current
    if (!link) return
    const was = seen.current
    seen.current = { threadId, selectedId, onChatView, pending: threadsPending, orgId: activeOrgId }

    const first = was === null
    const urlChanged = first || was.threadId !== threadId
    const selChanged = !first && was.selectedId !== selectedId
    const entered = onChatView && (first || !was.onChatView)
    const settled = !threadsPending && (first || was.pending)
    if (!first && was.orgId !== activeOrgId) orgWindow.current = true

    try {
      // Off the chat view the address names no thread; only remember what was picked.
      if (!onChatView) {
        if (selChanged) pick.current = selectedId
        return
      }

      // Entering the chat view: a thread picked on the way in (or while away) wins over the address.
      if (entered) {
        if (selChanged) pick.current = selectedId
        const picked = pick.current
        pick.current = null
        if (picked && picked !== threadId) {
          link.openThread(picked, { replace: true })
          return
        }
      }

      // Address → selection.
      if (urlChanged || entered || settled) {
        if (threadId !== null) {
          if (!threadsPending && selectedId !== threadId) {
            const found = threadsRef.current.find((t) => t.id === threadId)
            if (found) selectRef.current(found)
          }
          return
        }
        // Onto the chat home (Back, a bounce) with a thread still selected: deselect.
        if (urlChanged && !first && selectedId !== null && !selChanged) {
          selectRef.current(null)
          return
        }
      }

      // Selection → address.
      if (selChanged) {
        if (selectedId !== null) {
          if (selectedId !== threadId) link.openThread(selectedId)
          return
        }
        // A deselect of the thread the address names: a person's leaves (REPLACE with /app);
        // IN-01's org-change reset does not.
        if (threadId !== null && was?.selectedId === threadId) {
          if (orgWindow.current) {
            orgWindow.current = false
            return
          }
          link.leaveThread()
        }
      }
    } finally {
      if (settled && !first) orgWindow.current = false
    }
  }, [inert, threadId, selectedId, onChatView, threadsPending, activeOrgId])

  const openThread = useCallback((thread: Thread) => {
    selectRef.current(thread)
    const link = linkRef.current
    if (link) link.openThread(thread.id)
    else legacyRef.current?.()
  }, [])

  const holding = !inert && onChatView && threadId !== null && selectedId !== threadId
  return { openThread, holding }
}
