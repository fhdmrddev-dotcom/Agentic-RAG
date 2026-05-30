/**
 * Phase 087 Plan 05 Task 2 — SeamPointer (D-05, sketch 007, chat-panel-seam.md D2).
 *
 * The LIVE chat-side renderer for the three panel-owned tools (write_todos,
 * workspace_write, ask_user). While a run is in flight the panel is the
 * canonical live view, so chat shows only a quiet one-line POINTER — never a
 * rich duplicate card (single source of truth; avoids tall-transcript fatigue).
 *
 * Color language: primary indigo carries "live / pointer / link". The arrow and
 * the "see panel" affordance are primary; the body text is muted.
 *
 * ADDITIVE ONLY: this is a new sibling renderer mounted next to RunCard in
 * MessageItem — it never touches RunCard / ToolCallPanel internals (G-5,
 * BUG-260529-02 stays separate). It renders ONLY summarized known fields as
 * text — never the raw tool payload, never a stringified object (T-087-13).
 */
import { cn } from "@/lib/utils"

export type SeamKind = "write_todos" | "workspace_write" | "ask_user"

export interface SeamPointerProps {
  kind: SeamKind
  /** For workspace_write: the file path. Ignored for the other kinds. */
  label?: string
  /** Click → reveal the live panel (WorkspacePanel owns the open handler). */
  onSeePanel?: () => void
}

/** The quiet one-line copy per kind (UI-SPEC Copywriting / chat-panel-seam.md D2). */
function pointerText(kind: SeamKind, label?: string): string {
  switch (kind) {
    case "write_todos":
      return "updated todos"
    case "workspace_write":
      return `wrote ${label ?? "a file"}`
    case "ask_user":
      return "ask_user · awaiting your answer"
  }
}

export function SeamPointer({ kind, label, onSeePanel }: SeamPointerProps) {
  const isAsk = kind === "ask_user"
  // ask_user is the "blocked-on-me" pointer → amber; the others are primary "live".
  const arrowColor = isAsk ? "text-[hsl(var(--warning))]" : "text-primary"
  const linkColor = isAsk ? "text-[hsl(var(--warning))]" : "text-primary"
  const seeCopy = isAsk ? "Answer in panel" : "see panel"

  return (
    <div className="flex items-center gap-1.5 py-1 font-mono text-xs text-muted-foreground">
      <span className={cn("flex-none", arrowColor)} aria-hidden="true">
        {isAsk ? "⏸" : "→"}
      </span>
      <span className="min-w-0 truncate">{pointerText(kind, label)}</span>
      <button
        type="button"
        onClick={onSeePanel}
        className={cn(
          "flex-none border-b border-dashed border-current/40 transition-colors hover:text-foreground",
          linkColor,
        )}
      >
        {seeCopy} →
      </button>
    </div>
  )
}

export default SeamPointer
