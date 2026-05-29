/**
 * Phase 087 Plan 05 Task 2 — SeamCard (D-05, sketch 007, chat-panel-seam.md D3).
 *
 * The RELOADED chat-side renderer for the three panel-owned tools. On thread
 * reload the panel reconciles to current state and does NOT replay history, so
 * the transcript must be self-contained. SeamCard resolves each panel-owned tool
 * into a compact card so the conversation has no holes after refresh:
 *   - ask_user      → answered Q&A ("You answered <value>") — CLOSES the
 *                     documented ask_user reload gap
 *   - workspace_write → a file chip (reuses OutputFileCard's chip shape: icon +
 *                       mono filename + `· v{n}`) + "open panel ↗"
 *   - write_todos   → a final-state note ("☑ N todos · all done")
 *
 * Single source of truth (D-05): live state lives in the panel; the transcript
 * records. SeamCard renders ONLY summarized known fields as plain text — never
 * the raw tool payload, never a stringified object (T-087-13). ADDITIVE ONLY — a new
 * sibling renderer in MessageItem, never a touch of RunCard internals (G-5).
 */
import { FileText } from "lucide-react"
import type { SeamKind } from "./SeamPointer"

export interface SeamCardPayload {
  /** ask_user: the original question + the resolved answer. */
  question?: string
  answer?: string
  /** workspace_write: file path + version for the chip. */
  path?: string
  version?: number
  /** write_todos: the final completed/total counts. */
  todoTotal?: number
  todoDone?: number
}

export interface SeamCardProps {
  kind: SeamKind
  payload: SeamCardPayload
  /** Jump from the transcript back into the live panel. */
  onOpenPanel?: () => void
}

/** Uppercase mono kind label for the card header. */
function headLabel(kind: SeamKind): string {
  return kind
}

export function SeamCard({ kind, payload, onOpenPanel }: SeamCardProps) {
  return (
    <div className="mt-2 overflow-hidden rounded-md border border-border bg-card">
      <div className="flex items-center gap-1.5 border-b border-border/60 px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-[hsl(var(--muted-foreground-dim))]">
        <span>{headLabel(kind)}</span>
        <button
          type="button"
          onClick={onOpenPanel}
          className="ml-auto normal-case text-primary transition-colors hover:text-foreground"
        >
          open panel ↗
        </button>
      </div>
      <div className="flex flex-col gap-1 px-3 py-2">
        {kind === "ask_user" && (
          <div className="text-[13px]">
            {payload.question && (
              <div className="mb-1 text-muted-foreground">{payload.question}</div>
            )}
            <div className="text-[hsl(var(--success))]">
              You answered{" "}
              <b className="font-semibold">{payload.answer ?? "—"}</b>
            </div>
          </div>
        )}

        {kind === "workspace_write" && (
          <span className="inline-flex items-center gap-1.5 font-mono text-[13px] text-foreground/90">
            <FileText className="h-3.5 w-3.5 flex-none text-muted-foreground" aria-hidden="true" />
            <span className="truncate">{payload.path ?? "a file"}</span>
            {payload.version != null && (
              <span className="flex-none text-[10px] text-muted-foreground">· v{payload.version}</span>
            )}
          </span>
        )}

        {kind === "write_todos" && (
          <span className="text-[13px] text-foreground/90">
            ☑ {payload.todoTotal ?? 0} todos
            {payload.todoDone != null &&
            payload.todoTotal != null &&
            payload.todoDone === payload.todoTotal
              ? " · all done"
              : payload.todoDone != null
                ? ` · ${payload.todoDone} done`
                : ""}
          </span>
        )}
      </div>
    </div>
  )
}

export default SeamCard
