/**
 * Phase 274 plan 04 (D-09 / D-11 / D-15 / D-19) — THE PANEL FILES ROW'S TRAILING SLOT for an
 * uploaded file (`kind === "template_input"`). `FilesSection` hands this the slot and gains one
 * import, one slot line and one key arm; nothing else of that G-5 file changes.
 *
 * Two readings, from the ONE lifetime rule (`isThreadLifeAttachment`):
 *   · THREAD-LIFE (a chat attachment, D-05): `this chat only`, then either the `⋯` (only the verb,
 *     the row is already in the panel) or — once saved — the `LibraryLinkSegment`, drawn as sketch
 *     274-A draws it: the leaf visible, the full path in the title and in screen-reader text.
 *     (Built first with the full path visible; G-4 #3 measured that squeezing the file name to
 *     zero width, so it now matches the sketch.)
 *   · TTL (a workflow template input, or a row whose wire did not say): the `Template` badge and
 *     the `expiryCaption` countdown MOVED here byte-for-byte from `FilesSection` (same classes, amber
 *     under 1 h via `isNearExpiry`), followed by the `⋯`.
 *
 * ⛔ THE TRIGGER IS `tabIndex={-1}`. The row is a `role=option` inside a `role=listbox`; an
 * interactive tab stop inside an option breaks the APG listbox (Tab must leave the list, arrows
 * move within it). Keyboard reach is the row's own `Shift+F10` / `ContextMenu` arm, which calls
 * `requestAttachmentMenu(file.id)`. A pointer or touch user taps the `⋯` directly.
 */
import { cn } from "@/lib/utils"
import { isThreadLifeAttachment } from "@/lib/attachmentLifetime"
import { expiryCaption, isNearExpiry } from "@/components/panel/FilesSection"
import type { WorkspaceFile } from "@/types"
import { AttachmentActionsMenu } from "./AttachmentActionsMenu"
import { LibraryLinkSegment } from "./LibraryLinkSegment"
import { COPY } from "./saveToLibraryCopy"
import { useLibraryLinks } from "./useLibraryLinks"

/** Re-exported so the panel row's key arm and its slot come from ONE import. */
export { requestAttachmentMenu } from "./AttachmentActionsMenu"

export interface AttachmentRowTrailingProps {
  threadId: string | null
  file: WorkspaceFile
}

export function AttachmentRowTrailing({ threadId, file }: AttachmentRowTrailingProps) {
  const { stateFor } = useLibraryLinks(threadId)
  const state = stateFor(file.id)

  const action =
    threadId && file.id ? (
      state.link ? (
        // Sketch 274-A draws the panel's mark as the chip's segment: the leaf visible, the full path
        // in the title (G-4 #3 F-1 — a visible full path squeezed the file name to zero width).
        <LibraryLinkSegment link={state.link} leaf={state.leaf} path={state.path} display="leaf" />
      ) : (
        <AttachmentActionsMenu threadId={threadId} file={file} variant="panel" triggerTabIndex={-1} />
      )
    ) : null

  if (isThreadLifeAttachment(file)) {
    return (
      <span className="flex flex-shrink-0 items-center gap-1.5">
        <span className="flex-none text-[10px] text-panel-muted-foreground">{COPY.engine.CHIP_SCOPE}</span>
        {action}
      </span>
    )
  }

  return (
    <span className="flex flex-shrink-0 items-center gap-1.5">
      <span className="rounded bg-accent px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-accent-foreground">
        Template
      </span>
      <span
        className={cn(
          "font-mono text-[10px]",
          isNearExpiry(file.expires_at)
            ? "text-amber-500"                       // needs-attention color (D-02)
            : "text-panel-muted-foreground",
        )}
      >
        {expiryCaption(file.expires_at)}
      </span>
      {action}
    </span>
  )
}

export default AttachmentRowTrailing
