/**
 * Phase 274 plan 03 (ATT-03 / D-09 / D-10 / D-12 / D-13 / D-14) — THE ONE Save-to-Library dialog.
 *
 * Built ONCE; 274-04 mounts it twice (the chat chip's `⋯` menu and the panel's Files row, D-09).
 * The acceptance bar is sketch 274's winner A, and this reproduces its Build Contract order:
 *
 *   title · one-line sub · file chip · folder list (no Root) · ONE slot: version warning OR refusal
 *   · [required hint] Cancel + `Save to Library` (disabled until a folder is picked)
 *
 * and, after a same-bytes confirm, the already screen: title · where the existing copy lives ·
 * the picked-elsewhere line only when the folders differ · Done + Open it.
 *
 * ⛔ THE RESULT SCREEN RENDERS THE POST ANSWER, NEVER THE PREVIEW. The preview is advisory: it is
 *   requested once per selection, only the LATEST answer renders (`reqRef`, the ScopePicker
 *   pattern), and a preview error is silent. Whether the bytes already exist is only known for
 *   certain once the minter has answered (sketch finding 3).
 * ⛔ NO ROOT, NO SENTINEL, NO IN-DIALOG MOVE. The frame is `MoveToFolderDialog`'s (Dialog + reset
 *   on open) and nothing else of it: not its top-level "no folder" item, not its move call.
 * ⛔ A REFUSAL IS THE SERVER'S SENTENCE, VERBATIM, under a plain lead line (D-12). The client never
 *   pre-filters folders by a rule of its own; the minter's 403 is the authority.
 * ⛔ Every word comes from `COPY` (the port of the sketch). No string literal is rendered here.
 */
import { useCallback, useEffect, useRef, useState } from "react"
import { AlertTriangle, Copy as CopyGlyph, Folder as FolderGlyph } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { listFolders } from "@/lib/api/documents"
import {
  PromoteError,
  getPromotePreview,
  promoteAttachment,
  type PromotePreview,
  type PromoteResult,
} from "@/lib/api/attachments"
import { attachmentDisplayName } from "@/lib/attachmentLifetime"
import { useCitationNavOptional } from "@/lib/citationNav"
import { fileIcon } from "@/lib/fileIcon"
import { formatBytes } from "@/lib/formatBytes"
import type { Folder, WorkspaceFile } from "@/types"
import { folderDisplayPath } from "./folderDisplay"
import { FolderPathListbox } from "./FolderPathListbox"
import { COPY } from "./saveToLibraryCopy"

export interface SaveToLibraryDialogProps {
  open: boolean
  onClose: () => void
  threadId: string
  file: WorkspaceFile
  /** Called once with the POST answer — `saved`, or `already` after Done / Open it. */
  onSaved: (result: PromoteResult) => void
}

type Stage = { kind: "pick" } | { kind: "already"; result: PromoteResult }

export function SaveToLibraryDialog({ open, onClose, threadId, file, onSaved }: SaveToLibraryDialogProps) {
  const [folders, setFolders] = useState<Folder[]>([])
  const [foldersFailed, setFoldersFailed] = useState(false)
  const [picked, setPicked] = useState<string | null>(null)
  const [preview, setPreview] = useState<PromotePreview | null>(null)
  const [refusal, setRefusal] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [stage, setStage] = useState<Stage>({ kind: "pick" })
  const reqRef = useRef(0)
  const nav = useCitationNavOptional()
  const labelId = useRef(`save-to-library-label-${Math.random().toString(36).slice(2)}`).current

  // Reset on open (the MoveToFolderDialog frame): a re-opened dialog never shows a stale pick.
  useEffect(() => {
    if (!open) return
    let cancelled = false
    reqRef.current++ // drop any preview still in flight from the last opening
    setPicked(null)
    setPreview(null)
    setRefusal(null)
    setSaving(false)
    setStage({ kind: "pick" })
    setFoldersFailed(false)
    listFolders().then(
      (list) => {
        if (!cancelled) setFolders(list)
      },
      () => {
        if (!cancelled) setFoldersFailed(true)
      },
    )
    return () => {
      cancelled = true
    }
  }, [open])

  // One preview per selection; a stale answer is dropped (latest wins, T-274-22).
  const choose = useCallback(
    (id: string | null) => {
      if (id === picked) return
      setPicked(id)
      setRefusal(null)
      setPreview(null)
      const req = ++reqRef.current
      if (!id || !file.id) return
      getPromotePreview(threadId, file.id, id).then(
        (p) => {
          if (req === reqRef.current) setPreview(p)
        },
        () => {
          // Advisory only: a failed preview says nothing, and the POST still decides.
        },
      )
    },
    [picked, threadId, file.id],
  )

  async function handleConfirm() {
    if (!picked || !file.id || saving) return
    setSaving(true)
    setRefusal(null)
    try {
      const result = await promoteAttachment(threadId, file.id, picked)
      if (result.outcome === "already") {
        setStage({ kind: "already", result })
      } else {
        onSaved(result)
        onClose()
      }
    } catch (e) {
      setRefusal(e instanceof PromoteError ? e.message : COPY.netNew.saveFailed)
    } finally {
      setSaving(false)
    }
  }

  function finishAlready(result: PromoteResult, openIt: boolean) {
    onSaved(result)
    if (openIt) nav?.openDocument(result.document_id)
    onClose()
  }

  function handleOpenChange(next: boolean) {
    if (next) return
    // Dismissing the already screen is Done: the link exists either way (the sketch's scrim).
    if (stage.kind === "already") finishAlready(stage.result, false)
    else onClose()
  }

  // The sketch's spelling (` › `), the same one the folder list draws (274-04, display only).
  const pathOf = (id: string | null | undefined) => folderDisplayPath(id, folders)

  const name = attachmentDisplayName(file)

  if (stage.kind === "already") {
    const { result } = stage
    const where = pathOf(result.folder_id)
    const pickedPath = pathOf(picked)
    return (
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2.5">
              <CopyGlyph size={18} aria-hidden="true" className="text-primary" />
              {COPY.shared.alreadyTitle}
            </DialogTitle>
            <DialogDescription>{COPY.shared.alreadyBody(where ?? COPY.netNew.unknownFolder)}</DialogDescription>
          </DialogHeader>
          {where && (
            <span
              data-testid="save-to-library-where"
              className="inline-flex w-fit items-center gap-1.5 rounded-full border border-amber-500/35 bg-amber-500/10 px-2.5 py-1 text-xs font-medium"
            >
              <FolderGlyph size={13} aria-hidden="true" className="text-amber-500/70" />
              {where}
            </span>
          )}
          {result.folder_id !== picked && pickedPath && (
            <p className="text-xs leading-relaxed text-muted-foreground">
              {COPY.shared.alreadyDiffFolder(pickedPath)}
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => finishAlready(result, false)}>
              {COPY.shared.done}
            </Button>
            {nav && <Button onClick={() => finishAlready(result, true)}>{COPY.shared.openDoc}</Button>}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }

  const pickedPath = pathOf(picked)
  const previewRefusal = preview && !preview.promotable ? preview.refusal : null
  const shownRefusal = refusal ?? previewRefusal
  const showVersionWarn =
    !shownRefusal &&
    preview !== null &&
    preview.duplicate_of === null &&
    preview.next_version !== null &&
    preview.next_version > 1 &&
    pickedPath !== null
  const blocked = previewRefusal !== null && refusal === null

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-[480px]">
        <DialogHeader>
          <DialogTitle>{COPY.shared.dialogTitle}</DialogTitle>
          <DialogDescription>{COPY.shared.dialogSub}</DialogDescription>
          <span
            data-testid="save-to-library-file-chip"
            className="mt-1 inline-flex w-fit items-center gap-1.5 rounded-full border border-border bg-muted px-2.5 py-1 text-xs"
          >
            {fileIcon(name, 14, { ribbon: false })}
            <span className="truncate">{name}</span>
            <span className="font-mono text-[0.68rem] text-muted-foreground">{formatBytes(file.size_bytes)}</span>
          </span>
        </DialogHeader>

        <div className="space-y-2">
          <div
            id={labelId}
            className="text-[0.68rem] font-bold uppercase tracking-[0.07em] text-muted-foreground"
          >
            {COPY.shared.folderRequired}
          </div>
          {foldersFailed ? (
            <p role="alert" className="text-xs text-destructive">
              {COPY.netNew.loadFoldersFailed}
            </p>
          ) : (
            <FolderPathListbox folders={folders} value={picked} onChange={choose} labelledBy={labelId} />
          )}

          {/* ONE slot: the refusal, or the version warning — never both. */}
          {shownRefusal ? (
            <div
              role="alert"
              className="flex gap-2.5 rounded-md border border-destructive bg-destructive/10 px-3 py-2 text-xs leading-relaxed"
            >
              <AlertTriangle size={15} aria-hidden="true" className="mt-px shrink-0 text-destructive" />
              <span>
                <b className="block">{COPY.shared.refuseLead}</b>
                <code className="mt-0.5 block font-mono text-[0.68rem] text-muted-foreground">{shownRefusal}</code>
              </span>
            </div>
          ) : showVersionWarn ? (
            <div
              data-testid="save-to-library-version-warn"
              className="flex gap-2.5 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs leading-relaxed"
            >
              <AlertTriangle size={15} aria-hidden="true" className="mt-px shrink-0 text-amber-500" />
              <span>
                {COPY.shared.versionWarn(preview!.filename, pickedPath!, preview!.next_version!)}
              </span>
            </div>
          ) : null}
        </div>

        <DialogFooter className="items-center">
          {!picked && (
            <span data-testid="save-to-library-required" className="mr-auto text-[0.68rem] text-muted-foreground">
              {COPY.shared.folderRequired}
            </span>
          )}
          <Button variant="outline" onClick={onClose}>
            {COPY.shared.cancel}
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!picked || !file.id || saving || foldersFailed || blocked}
          >
            {saving ? COPY.shared.saving : COPY.shared.confirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default SaveToLibraryDialog
