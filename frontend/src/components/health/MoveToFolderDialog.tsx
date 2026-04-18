import { useEffect, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { listFolders, moveDocument } from "@/lib/api"
import type { Folder } from "@/types"

interface Props {
  open: boolean
  documentId: string
  documentName: string
  onClose: () => void
  onMoved: (newFolderId: string | null) => void
}

export function MoveToFolderDialog({ open, documentId, documentName, onClose, onMoved }: Props) {
  const [folders, setFolders] = useState<Folder[]>([])
  const [selectedFolderId, setSelectedFolderId] = useState<string | "root" | "">("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setSelectedFolderId("")
    setError(null)
    listFolders()
      .then(setFolders)
      .catch(() => setError("Could not load folders."))
  }, [open])

  async function handleConfirm() {
    if (!selectedFolderId) return
    setLoading(true)
    setError(null)
    try {
      const folderId = selectedFolderId === "root" ? null : selectedFolderId
      await moveDocument(documentId, folderId)
      onMoved(folderId)
      onClose()
    } catch {
      setError("Action failed. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Move to folder</DialogTitle>
        </DialogHeader>
        <div className="py-2 space-y-3">
          <p className="text-sm text-muted-foreground truncate">
            Moving: <span className="font-medium text-foreground">{documentName}</span>
          </p>
          <Select value={selectedFolderId} onValueChange={setSelectedFolderId}>
            <SelectTrigger>
              <SelectValue placeholder="Select a folder..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="root">Root (no folder)</SelectItem>
              {folders.map((f) => (
                <SelectItem key={f.id} value={f.id}>
                  {f.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Keep Document
          </Button>
          <Button onClick={handleConfirm} disabled={!selectedFolderId || loading}>
            {loading ? "Moving..." : "Move Document"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
