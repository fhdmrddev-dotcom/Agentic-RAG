/**
 * Phase 087 Plan 05 Task 2 — PausedRunCue (D-05, sketch 006, pending-question.md D2).
 *
 * The chat-side "blocked-on-me" cue for a paused run. `ask_user` blocks the
 * whole agent loop, so the pause is made unmissable STRUCTURALLY (amber cue +
 * locked-composer hint) rather than by hijacking the screen — calm-loud, not
 * modal. It points the user to the panel, where the real answer surface lives.
 *
 * ADDITIVE renderer (D-05): mounted as a NEW sibling next to RunCard in
 * MessageItem. It does NOT fold into the broader chat-tool-card unification —
 * BUG-260529-02 is a separate phase. It never touches RunCard / ToolCallPanel
 * internals (G-5). Amber = needs-you / paused (LOCKED color language).
 */
export interface PausedRunCueProps {
  /** Click → reveal the live panel so the user can answer. */
  onSeePanel?: () => void
}

export function PausedRunCue({ onSeePanel }: PausedRunCueProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="mt-2 flex flex-col gap-1 rounded-md border border-[hsl(var(--warning))] bg-[hsl(var(--warning)/0.12)] px-3 py-2"
    >
      <div className="flex items-center gap-1.5 font-mono text-xs text-[hsl(var(--warning))]">
        <span aria-hidden="true">⏸</span>
        <span className="min-w-0 truncate">ask_user · awaiting your answer</span>
        <button
          type="button"
          onClick={onSeePanel}
          className="ml-auto flex-none border-b border-dashed border-current/40 transition-colors hover:text-foreground"
        >
          Answer in panel →
        </button>
      </div>
      <div className="font-mono text-[10px] text-[hsl(var(--muted-foreground-dim))]">
        Agent is paused
      </div>
    </div>
  )
}

export default PausedRunCue
