/**
 * Phase 262 plan 04 (PACK-13) — the one ordered handoff from the catalog into a scoped chat.
 *
 * ⭐ THIS IS THE SAME MECHANISM PHASE 260 SHIPPED, NOT A SECOND ONE — which is exactly what the
 * criterion requires. Chat hydrates its Expert spotlight from `thread.active_expert_id`
 * (`ChatArea.tsx:234-252`), and the PATCH that sets that column is the same one the composer's
 * invite door issues. What differs is only WHO reaches it: the composer's handler is local to the
 * message input and needs a thread id, and `ChatLayout.launch.test.tsx:558-576` structurally
 * fences the chat surface out of the non-chat branch with a positive control proving the probe
 * works. ⛔ So the catalog cannot call that handler, and D-262-08's re-aim is what this file
 * implements: the same seam, reached one register lower.
 *
 * ⛔ THE ORDER IS THE REQUIREMENT, AND `refreshThreads` BEFORE `selectThread` IS LOAD-BEARING —
 * it is not tidiness. The thread-creating hook pushes the freshly-created row into its own list,
 * and that row's `active_expert_id` is null; the hook exposes no updater for that column
 * (`useThreads.ts:38-43`). Without the refetch the list keeps the PRE-PATCH row, so the moment
 * the person clicks that thread in their history the chat effect reads null and clears the
 * spotlight — while the server still holds the Expert. That is the surface disagreeing with the
 * truth, and it is cheap to prevent here and expensive to find later.
 *
 * ⛔ AND A FAILED PATCH DOES NOT NAVIGATE (T-262-15). An unscoped chat that LOOKS scoped is the
 * failure this ordering exists to prevent, so the rejection propagates to the caller rather than
 * being swallowed into a cheerful navigation.
 *
 * ⛔ EVERY SEAM IS INJECTED, and that is what makes the order testable without mounting the whole
 * chat shell. This module imports no client functions and no UI library — the two import
 * specifiers an acceptance grep proves absent are named in `262-04-SUMMARY.md` rather than here,
 * because spelling them in this comment would satisfy the very grep (the trap plans 02 and 03
 * each recorded, one wave apart).
 *
 * ⚠ THE ALTERNATIVE WAS CONSIDERED AND REJECTED ON THE RECORD. Research recommends mirroring the
 * one-shot `prefillMessage` handoff the skills surface already uses. This shape is preferred
 * because it touches zero files in the app's prop chain and therefore cannot acquire the
 * re-fire defect that cost Phase 235 a gap-closure round: there is no pending value to clear,
 * because the state lives in the thread row on the server. If a future need forces the one-shot
 * shape, the clearing rule is mandatory and its owner is the navigator.
 */

import type { ExpertBundle, Thread } from "@/types"

export interface StartScopedChatDeps {
  /** Creates the thread the conversation will happen in. */
  createThread: () => Promise<Thread>
  /** The shipped PATCH. ⛔ It RETURNS the patched row — that return is what gets selected. */
  setExpert: (threadId: string, expertId: string) => Promise<Thread>
  /** Refetches the thread list from the server, so the list and the server agree. */
  refreshThreads: () => Promise<void>
  selectThread: (thread: Thread) => void
  /** Moves the app to the chat surface. */
  navigate: () => void
  /** 262-UAT 3.6: best-effort removal of the created thread when scoping it fails, so no
   *  empty unscoped "New Chat" is left behind (the doRun WR-04 pattern). */
  discardThread?: (threadId: string) => Promise<void>
}

export async function startScopedChat(
  deps: StartScopedChatDeps,
  expert: ExpertBundle,
): Promise<Thread> {
  const created = await deps.createThread()

  // ⛔ The patched row, never `created` — `created.active_expert_id` is null, and selecting it
  // would hand chat a thread that says it has no Expert while the server says it does.
  let scoped: Thread
  try {
    scoped = await deps.setExpert(created.id, expert.id)
  } catch (err) {
    // ⛔ The ORIGINAL error is what the caller reports; a failed cleanup must not replace it.
    await deps.discardThread?.(created.id).catch(() => {})
    throw err
  }

  // ⛔ BEFORE the selection, always. See the docblock: the list row is stale until this runs.
  await deps.refreshThreads()

  deps.selectThread(scoped)
  deps.navigate()

  return scoped
}
