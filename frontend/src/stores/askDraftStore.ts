/**
 * Phase 282-02 (FIX-07 / D-12 / D-24) — THE ONE DRAFT HOME for an `ask_user` pause.
 *
 * Before this store the draft (`choiceIndex`, `freeText`) lived in each `PendingAskCard`'s own
 * `useState`. One pause could render two cards (the chat column and the workspace panel), so it
 * had two drafts that disagreed (BUG-260918-01 Finding B). Now every rendering reads ONE draft
 * keyed by `tool_call_id`: the chat card, the panel card, the chat pointer's draft line and
 * WorkflowRunPage's direct card. ⛔ Nothing is copied between cards; copying is the roadmap's
 * named failure.
 *
 * ⚠ WHY THIS IS NOT IN `streamsStore.ts`: that file FIRES under G-5. A draft is UI state that
 * no other slice reads, so it gets its own small module rather than another slice there.
 *
 * ⚠ WHY GC LISTENS TO THE ASK SLICE AND NOT TO CARD UNMOUNT: a card unmounts on every thread
 * switch and on every panel↔chat handoff (the panel collapsing to the rail remounts the card in
 * the chat column). Clearing on unmount would lose the draft at exactly the moments it has to
 * survive. An ask leaving `pendingAsksByThread` is the moment its draft is dead, so the module
 * subscribes to that slice once, at load, and deletes drafts whose `tool_call_id` is no longer
 * live in ANY thread. Answer and expiry clear explicitly through `markSettled`.
 *
 * ⚠ STABLE REFERENCES: zustand v5 selectors must not return a fresh object per call, or the
 * component re-renders forever. `useAskDraft` returns the frozen module-level `EMPTY_DRAFT` for
 * an id with no draft, never `{}` (the `EMPTY_ASKS` precedent in StreamsProvider.tsx).
 *
 * Drafts are session memory only — never persisted (D-12), so a reload starts empty, as today.
 * Tests: `setupTests.ts` calls `resetAskDrafts()` after every case, because a module singleton
 * outlives `cleanup()` (D-24).
 */
import { create } from "zustand"
import { useStreamsStore } from "./streamsStore"

export interface AskDraft {
  choiceIndex: number | null
  freeText: string
  /**
   * Phase 295-06 (D-03) — the folder chosen under the found-nothing pause's "Search another
   * folder" choice. Absent until chosen; dropped with the rest of the draft on clear / settle.
   */
  folderId?: string
}

export const EMPTY_DRAFT: AskDraft = Object.freeze({ choiceIndex: null, freeText: "" }) as AskDraft

interface AskDraftState {
  /** The one draft per pending ask, keyed by `tool_call_id`. */
  drafts: Record<string, AskDraft>
  /**
   * Asks that were answered or expired in SOME rendering. The chat pointer reads it so it never
   * says "No answer yet" for an ask the panel card already answered (UI-SPEC Surface 1).
   */
  settled: Record<string, true>
  /** How many panel-home `PendingAskStack`s are mounted per thread (a refcount, never < 0). */
  panelHomes: Record<string, number>
  setChoice: (id: string, choiceIndex: number | null) => void
  setFreeText: (id: string, freeText: string) => void
  setFolder: (id: string, folderId: string) => void
  clearDraft: (id: string) => void
  markSettled: (id: string) => void
  addPanelHome: (threadId: string) => void
  removePanelHome: (threadId: string) => void
}

function without<T>(record: Record<string, T>, id: string): Record<string, T> {
  if (!(id in record)) return record
  const next = { ...record }
  delete next[id]
  return next
}

export const useAskDraftStore = create<AskDraftState>()((set) => ({
  drafts: {},
  settled: {},
  panelHomes: {},
  setChoice: (id, choiceIndex) =>
    set((s) => ({ drafts: { ...s.drafts, [id]: { ...(s.drafts[id] ?? EMPTY_DRAFT), choiceIndex } } })),
  setFreeText: (id, freeText) =>
    set((s) => ({ drafts: { ...s.drafts, [id]: { ...(s.drafts[id] ?? EMPTY_DRAFT), freeText } } })),
  setFolder: (id, folderId) =>
    set((s) => ({ drafts: { ...s.drafts, [id]: { ...(s.drafts[id] ?? EMPTY_DRAFT), folderId } } })),
  clearDraft: (id) => set((s) => ({ drafts: without(s.drafts, id) })),
  // ONE write: the draft goes and the settle is recorded together, so no reader can see a
  // settled ask that still has a draft, or a cleared draft on an ask that reads as pending.
  markSettled: (id) =>
    set((s) => ({ drafts: without(s.drafts, id), settled: { ...s.settled, [id]: true } })),
  addPanelHome: (threadId) =>
    set((s) => ({ panelHomes: { ...s.panelHomes, [threadId]: (s.panelHomes[threadId] ?? 0) + 1 } })),
  removePanelHome: (threadId) =>
    set((s) => {
      const n = (s.panelHomes[threadId] ?? 0) - 1
      if (n > 0) return { panelHomes: { ...s.panelHomes, [threadId]: n } }
      return { panelHomes: without(s.panelHomes, threadId) }
    }),
}))

/** The draft for one ask — `EMPTY_DRAFT` (same reference every time) when there is none. */
export function useAskDraft(id: string): AskDraft {
  return useAskDraftStore((s) => s.drafts[id] ?? EMPTY_DRAFT)
}

/** True once the ask was answered or expired in any rendering. */
export function useAskSettled(id: string): boolean {
  return useAskDraftStore((s) => s.settled[id] === true)
}

/** True while at least one panel-home `PendingAskStack` is mounted for this thread. */
export function usePanelHomeMounted(threadId: string | null): boolean {
  return useAskDraftStore((s) => (threadId ? (s.panelHomes[threadId] ?? 0) > 0 : false))
}

/** Empty every draft, settle and panel-home count. Called by setupTests.ts after every test. */
export function resetAskDrafts(): void {
  useAskDraftStore.setState({ drafts: {}, settled: {}, panelHomes: {} })
}

// ── GC on the ask slice (D-12 / D-24) ──────────────────────────────────────────────────────
// Runs on every change to `pendingAsksByThread`: collect every live `tool_call_id` across all
// threads and drop drafts/settles whose ask is gone. Writes only when something is dead, so an
// unrelated slice update never churns this store.
useStreamsStore.subscribe(
  (s) => s.pendingAsksByThread,
  (byThread) => {
    const live = new Set<string>()
    for (const asks of byThread.values()) for (const a of asks) live.add(a.tool_call_id)
    const { drafts, settled } = useAskDraftStore.getState()
    const deadDrafts = Object.keys(drafts).filter((id) => !live.has(id))
    const deadSettled = Object.keys(settled).filter((id) => !live.has(id))
    if (deadDrafts.length === 0 && deadSettled.length === 0) return
    useAskDraftStore.setState({
      drafts: Object.fromEntries(Object.entries(drafts).filter(([id]) => live.has(id))),
      settled: Object.fromEntries(Object.entries(settled).filter(([id]) => live.has(id))) as Record<
        string,
        true
      >,
    })
  },
)
