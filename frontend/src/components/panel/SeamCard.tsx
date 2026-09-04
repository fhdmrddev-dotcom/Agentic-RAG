/**
 * Phase 087 Plan 05 Task 2 — SeamCard (D-05, sketch 007, chat-panel-seam.md D3).
 * Updated in Phase 224 (Winner D):
 *
 * Deletes the write_todos and workspace_write arms. The right-hand Workspace
 * panel (useDerivedPanel and FilesSection) is the canonical durable view;
 * duplicate transcript cards produced noise without additional information.
 *
 * ask_user SURVIVES as the chat-side record of answered Q&A ("You answered <value>").
 * The header copy uses toolName(kind) ("Ask a person") without uppercase styling.
 */
import { toolName } from "@/lib/toolNames"
import type { SeamKind } from "./SeamPointer"

export interface SeamCardPayload {
  /** ask_user: the original question + the resolved answer. */
  question?: string
  answer?: string
}

export interface SeamCardProps {
  kind: SeamKind
  payload: SeamCardPayload
  /** Jump from the transcript back into the live panel. */
  onOpenPanel?: () => void
}

/** Human phrase for the card header. */
function headLabel(kind: SeamKind): string {
  return toolName(kind)
}

export function SeamCard({ kind, payload, onOpenPanel }: SeamCardProps) {
  if (kind !== "ask_user") {
    return null
  }

  return (
    <div className="mt-2 overflow-hidden rounded-md border border-border bg-card">
      <div className="flex items-center gap-1.5 border-b border-border/60 px-3 py-1.5 text-xs text-muted-foreground">
        <span className="font-medium text-foreground/80">{headLabel(kind)}</span>
        <button
          type="button"
          onClick={onOpenPanel}
          className="ml-auto text-xs text-primary transition-colors hover:text-foreground"
        >
          open panel ↗
        </button>
      </div>
      <div className="flex flex-col gap-1 px-3 py-2">
        <div className="text-[13px]">
          {payload.question && (
            <div className="mb-1 text-muted-foreground">{payload.question}</div>
          )}
          <div className="text-[hsl(var(--success))]">
            You answered{" "}
            <b className="font-semibold">{payload.answer ?? "—"}</b>
          </div>
        </div>
      </div>
    </div>
  )
}

export default SeamCard
