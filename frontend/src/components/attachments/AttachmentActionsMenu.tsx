/**
 * Phase 274 plan 04 (D-09 / D-15 / D-22 / D-23) — THE `⋯` ON A CHAT ATTACHMENT, built once and
 * mounted twice: the sent chat chip (`variant="chip"`) and the panel's Files row (`variant="panel"`).
 *
 * Sketch 274 winner A (operator, 2026-10-05):
 *   · The trigger is a real `<button>` that is ALWAYS visible. Touch has no hover, so a
 *     hover-revealed action is an action half the devices cannot find (the 034 a11y lesson).
 *   · The chip's menu offers `Save to Library…` and `Open in panel`; the panel row's offers only
 *     the verb (it is already in the panel).
 *   · `Open in panel` REVEALS the panel and nothing more (D-23): it does not select the file row.
 *   · A type the Library refuses (`promotable: false`, D-22) shows the verb DISABLED with its
 *     one-line reason before any dialog opens, never a failure after confirm.
 *   · Once the file is linked the verb is not offered: the segment is the after-state.
 *   · Both homes open the ONE `SaveToLibraryDialog`; its `onSaved` refreshes the thread's marks.
 *   · ⚠ 274 review WR-04/WR-05: on the panel row this menu stays MOUNTED once the file is linked
 *     (it owns the dialog, and a poll that swapped it out unmounted D-13's already screen), and it
 *     then offers `Open in Library` — the keyboard's way to the document, since the segment is not
 *     a tab stop inside `role=option`.
 *
 * ⚠ THE WRAPPER STOPS CLICK AND KEY EVENTS FROM BUBBLING, and that is load-bearing. React events
 * bubble through portals along the REACT tree, so a keystroke in the dialog's folder search (or a
 * click on a menu item) would otherwise reach the panel row's `role=option` handlers: Space would
 * be swallowed and the click would open the file preview, unmounting the dialog mid-pick.
 *
 * `requestAttachmentMenu(fileId)` opens a given file's menu from outside: the panel row's
 * `Shift+F10` / `ContextMenu` arm uses it, because the trigger inside a listbox option is not a
 * tab stop (see `AttachmentRowTrailing`). The bus is the `panelOpenSignal` shape.
 */
import { useEffect, useId, useRef, useState } from "react"
import { BookOpen, FolderPlus, MoreHorizontal, PanelRight } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { requestOpenPanel } from "@/components/panel/panelOpenSignal"
import { useCitationNavOptional } from "@/lib/citationNav"
import { cn } from "@/lib/utils"
import type { WorkspaceFile } from "@/types"
import { SaveToLibraryDialog } from "./SaveToLibraryDialog"
import { COPY } from "./saveToLibraryCopy"
import { refreshLibraryLinks, useLibraryLinks } from "./useLibraryLinks"

type MenuListener = (fileId: string) => void
const menuListeners = new Set<MenuListener>()

/** Open the `⋯` menu of the attachment with this workspace file id, wherever it is mounted. */
export function requestAttachmentMenu(fileId: string): void {
  for (const l of menuListeners) l(fileId)
}

export interface AttachmentActionsMenuProps {
  threadId: string
  file: WorkspaceFile
  variant: "chip" | "panel"
  /** `-1` inside a listbox option: an interactive tab stop inside `role=option` breaks the listbox. */
  triggerTabIndex?: number
}

function stop(e: React.SyntheticEvent) {
  e.stopPropagation()
}

export function AttachmentActionsMenu({ threadId, file, variant, triggerTabIndex }: AttachmentActionsMenuProps) {
  const { stateFor } = useLibraryLinks(threadId)
  const state = stateFor(file.id)
  const nav = useCitationNavOptional()
  const [open, setOpen] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const openingDialog = useRef(false)
  const reasonId = useId()

  useEffect(() => {
    const id = file.id
    if (!id) return
    const listener: MenuListener = (wanted) => {
      if (wanted === id) setOpen(true)
    }
    menuListeners.add(listener)
    return () => {
      menuListeners.delete(listener)
    }
  }, [file.id])

  if (!file.id) return null

  const offerVerb = state.link === null
  const linkedDoc = variant === "panel" && nav ? state.link?.document_id ?? null : null

  return (
    <span role="presentation" className="inline-flex flex-none items-center" onClick={stop} onKeyDown={stop}>
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <button
            ref={triggerRef}
            type="button"
            data-testid="attachment-more"
            aria-label={COPY.a.moreLabel}
            aria-haspopup="menu"
            tabIndex={triggerTabIndex}
            className={cn(
              "flex h-5 w-5 flex-none items-center justify-center rounded-full text-muted-foreground transition-colors",
              "hover:bg-accent hover:text-foreground focus-visible:bg-accent focus-visible:text-foreground focus-visible:outline-none",
              "data-[state=open]:bg-accent data-[state=open]:text-foreground",
            )}
          >
            <MoreHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          className="min-w-[12rem]"
          onCloseAutoFocus={(e) => {
            // The dialog takes focus next; handing it back to the trigger would fight it.
            if (openingDialog.current) {
              openingDialog.current = false
              e.preventDefault()
              return
            }
            // Inside the panel listbox, focus returns to the ROW (the trigger is not a tab stop).
            if (variant === "panel") {
              const option = triggerRef.current?.closest<HTMLElement>('[role="option"]')
              if (option) {
                e.preventDefault()
                option.focus()
              }
            }
          }}
        >
          {offerVerb && (
            <>
              <DropdownMenuItem
                disabled={!state.promotable}
                aria-describedby={state.promotable ? undefined : reasonId}
                onSelect={() => {
                  if (!state.promotable) return
                  openingDialog.current = true
                  setDialogOpen(true)
                }}
                className="gap-2 text-xs"
              >
                <FolderPlus className="h-3.5 w-3.5" aria-hidden="true" />
                {COPY.netNew.saveVerbMenu}
              </DropdownMenuItem>
              {!state.promotable && (
                <p id={reasonId} className="px-2 pb-1.5 text-[0.68rem] leading-snug text-muted-foreground">
                  {COPY.netNew.typeRefused}
                </p>
              )}
            </>
          )}
          {linkedDoc && (
            <DropdownMenuItem onSelect={() => nav?.openDocument(linkedDoc)} className="gap-2 text-xs">
              <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
              {COPY.netNew.openInLibrary}
            </DropdownMenuItem>
          )}
          {variant === "chip" && (
            <DropdownMenuItem onSelect={() => requestOpenPanel()} className="gap-2 text-xs text-muted-foreground">
              <PanelRight className="h-3.5 w-3.5" aria-hidden="true" />
              {COPY.shared.openInPanel}
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <SaveToLibraryDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        threadId={threadId}
        file={file}
        onSaved={() => refreshLibraryLinks(threadId)}
      />
    </span>
  )
}

export default AttachmentActionsMenu
