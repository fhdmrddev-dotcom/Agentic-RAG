import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Trash2, RefreshCw, FolderInput, Loader2 } from "lucide-react"
import { getFileIcon } from "@/lib/fileIcons"
import { deleteDocument, reingestDocument } from "@/lib/api"
import { MoveToFolderDialog } from "./MoveToFolderDialog"
import { cn } from "@/lib/utils"

interface BaseDoc {
  document_id: string
  filename: string
  folder_id: string | null
}

interface Props {
  doc: BaseDoc
  metricChip: React.ReactNode
  onRemove: (id: string) => void
}

export function HealthDocumentRow({ doc, metricChip, onRemove }: Props) {
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [reingestConfirm, setReingestConfirm] = useState(false)
  const [reingestLoading, setReingestLoading] = useState(false)
  const [moveOpen, setMoveOpen] = useState(false)
  const [rowError, setRowError] = useState<string | null>(null)
  const [rowSuccess, setRowSuccess] = useState<string | null>(null)
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function showRowError(msg: string) {
    setRowSuccess(null)
    setRowError(msg)
    if (errorTimerRef.current) clearTimeout(errorTimerRef.current)
    errorTimerRef.current = setTimeout(() => setRowError(null), 4000)
  }

  function showRowSuccess(msg: string) {
    setRowError(null)
    setRowSuccess(msg)
    if (errorTimerRef.current) clearTimeout(errorTimerRef.current)
    errorTimerRef.current = setTimeout(() => setRowSuccess(null), 4000)
  }

  useEffect(() => () => { if (errorTimerRef.current) clearTimeout(errorTimerRef.current) }, [])

  async function handleDelete() {
    setDeleteLoading(true)
    try {
      await deleteDocument(doc.document_id)
      onRemove(doc.document_id)
      setDeleteOpen(false)
    } catch {
      setDeleteOpen(false)
      showRowError("Action failed. Please try again.")
    } finally {
      setDeleteLoading(false)
    }
  }

  async function handleReingest() {
    setReingestConfirm(false)
    setReingestLoading(true)
    try {
      await reingestDocument(doc.document_id)
      showRowSuccess("Re-ingestion queued.")
    } catch {
      showRowError("Action failed. Please try again.")
    } finally {
      setReingestLoading(false)
    }
  }

  return (
    <>
      <div className="group flex flex-col">
        <div className="flex items-center gap-3 px-4 py-3 hover:bg-muted/20">
          <span className="shrink-0">{getFileIcon(doc.filename)}</span>
          <span className="text-sm font-medium truncate flex-1">{doc.filename}</span>
          {metricChip}
          <div className={cn("opacity-0 group-hover:opacity-100 transition-opacity flex gap-1", reingestConfirm && "opacity-100")}>
            {reingestConfirm ? (
              <div className="flex items-center gap-1">
                <span className="text-xs text-muted-foreground">Re-ingest this document?</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs hover:text-primary"
                  onClick={handleReingest}
                >
                  Yes, Re-ingest
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => setReingestConfirm(false)}
                >
                  Never mind
                </Button>
              </div>
            ) : (
              <>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 hover:text-destructive"
                      onClick={() => setDeleteOpen(true)}
                      aria-label="Delete document"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Delete document</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 hover:text-primary"
                      onClick={() => setReingestConfirm(true)}
                      disabled={reingestLoading}
                      aria-label="Re-ingest document"
                    >
                      {reingestLoading ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                      ) : (
                        <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Re-ingest document</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                      onClick={() => setMoveOpen(true)}
                      aria-label="Move to folder"
                    >
                      <FolderInput className="h-3.5 w-3.5" aria-hidden="true" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Move to folder</TooltipContent>
                </Tooltip>
              </>
            )}
          </div>
        </div>
        {rowError && (
          <p className="text-xs text-destructive px-4 pb-2">{rowError}</p>
        )}
        {rowSuccess && (
          <p className="text-xs text-primary px-4 pb-2">{rowSuccess}</p>
        )}
      </div>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete document?</DialogTitle>
            <DialogDescription>
              This will permanently delete <strong>{doc.filename}</strong> and all its chunks. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={deleteLoading}>
              Keep Document
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleteLoading}>
              {deleteLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <MoveToFolderDialog
        open={moveOpen}
        documentId={doc.document_id}
        documentName={doc.filename}
        onClose={() => setMoveOpen(false)}
        onMoved={(_newFolderId) => setMoveOpen(false)}
      />
    </>
  )
}
