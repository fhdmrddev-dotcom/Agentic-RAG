/**
 * Phase 087 Plan 05 Task 2 — PausedRunCue (D-05, sketch 006, pending-question.md D2).
 *
 * The chat-side "blocked-on-me" cue for a paused run. `ask_user` blocks the
 * whole agent loop, so the pause is made unmissable STRUCTURALLY (amber cue +
 * locked-composer hint) rather than by hijacking the screen — calm-loud, not
 * modal.
 *
 * ⚠ IT IS A MARKER, NOT A CONTROL — and it was BOTH for a while, wrongly. This
 * docblock previously read, verbatim: "It points the user to the panel, where the
 * real answer surface lives." That sentence was TRUE at Phase 087, when the panel
 * was the only answer surface, and it ROTTED at Phase 244-12 without anyone
 * touching this file. It is quoted rather than deleted because the rot is the
 * finding.
 *
 * ⛔ THE "Answer in panel →" BUTTON IS GONE, AND IT WAS DEAD, NOT MERELY STALE.
 * MEASURED: the sole production mount (`MessageItem.tsx:624`) renders
 * `<PausedRunCue />` with NO `onSeePanel`, so `onClick` resolved to `undefined` —
 * a dashed-underline control that looked interactive and did nothing. Its copy was
 * false on top of that: since 244-12 `PendingAskStack` (`MessageList.tsx:320`)
 * renders the real answer surface in THIS column, so the button pointed away from
 * an input sitting directly beneath it.
 *
 * ⭐ WHAT IT IS NOW is exactly what D-244-12 says it is: "the IN-TRANSCRIPT marker
 * for the Deep path — it marks the ROW that paused", which is the one per-row fact
 * that genuinely belongs at message level. It takes no props and fires nothing.
 * ⚠ The WIDER question — that the chat column and the panel both render a FULL
 * `PendingAskCard`, against sketch 006's approved "chat cue is a POINTER, panel is
 * the real input" — is NOT answered here. Deferred to a UI phase, deliberately.
 * ⛔ Do not "fix" it by narrowing `PendingAskStack`'s mount condition: a narrowing
 * mount condition is what made SHELL-03 unreachable twice (see `MessageList.tsx`).
 *
 * ADDITIVE renderer (D-05): mounted as a NEW sibling next to RunCard in
 * MessageItem. It does NOT fold into the broader chat-tool-card unification —
 * BUG-260529-02 is a separate phase. It never touches RunCard / ToolCallPanel
 * internals (G-5). Amber = needs-you / paused (LOCKED color language).
 */
export function PausedRunCue() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="mt-2 flex flex-col gap-1 rounded-md border border-[hsl(var(--warning))] bg-[hsl(var(--warning)/0.12)] px-3 py-2"
    >
      <div className="flex items-center gap-1.5 font-mono text-xs text-[hsl(var(--warning))]">
        <span aria-hidden="true">⏸</span>
        <span className="min-w-0 truncate">ask_user · awaiting your answer</span>
      </div>
      <div className="font-mono text-[10px] text-[hsl(var(--muted-foreground-dim))]">
        Agent is paused
      </div>
    </div>
  )
}

export default PausedRunCue
