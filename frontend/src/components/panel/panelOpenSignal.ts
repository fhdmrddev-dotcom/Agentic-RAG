/**
 * Phase 087 Plan 02 — panel-open signal (additive seam wiring).
 *
 * The chat-side seam renderers (SeamPointer / SeamCard, mounted in the G-5 hot
 * file MessageItem.tsx) expose OPTIONAL onSeePanel / onOpenPanel props (Plan 05
 * left them unwired). WorkspacePanel owns the panel-open action, but MessageItem
 * is rendered deep inside ChatArea → MessageList and does NOT receive panel props.
 *
 * Re-plumbing those props through MessageList/ChatArea would touch G-5 hot-file
 * internals beyond "pass the already-declared optional props". Instead this tiny
 * module-level event bus keeps the wiring ADDITIVE:
 *   - WorkspacePanel subscribes (subscribeOpenPanel) and opens itself on signal.
 *   - MessageItem's seam handlers call requestOpenPanel() — wired via the
 *     already-declared optional props with a default that fires this signal.
 *
 * No new dependency; no shared Zustand selector that would re-render chat
 * (PANEL-06 / T-087-17). The bus carries no thread data — it is a pure "reveal
 * the panel" pulse.
 */
type Listener = () => void

const listeners = new Set<Listener>()

/** Ask the WorkspacePanel to open (called from chat-side seam affordances). */
export function requestOpenPanel(): void {
  for (const fn of listeners) fn()
}

/** WorkspacePanel subscribes; returns an unsubscribe fn for effect cleanup. */
export function subscribeOpenPanel(fn: Listener): () => void {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}
