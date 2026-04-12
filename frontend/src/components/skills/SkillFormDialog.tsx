import { useState, useEffect, useRef } from "react"
import { Paperclip, FileText, Trash2, Loader2 } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { listSkillFiles, uploadSkillFile, deleteSkillFile } from "@/lib/api"
import type { Skill, SkillCreate, SkillUpdate, SkillFile } from "@/types"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  skill?: Skill | null
  onSave: (body: SkillCreate | SkillUpdate) => Promise<void>
  currentUserId?: string
}

export function SkillFormDialog({ open, onOpenChange, skill, onSave, currentUserId }: Props) {
  const isEdit = !!skill
  const isOwner = !!(skill && currentUserId && skill.user_id === currentUserId)

  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [instructions, setInstructions] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [files, setFiles] = useState<SkillFile[]>([])
  const [uploading, setUploading] = useState(false)
  const [fileError, setFileError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Reset fields whenever dialog opens/closes or skill changes
  useEffect(() => {
    if (open) {
      setName(skill?.name ?? "")
      setDescription(skill?.description ?? "")
      setInstructions(skill?.instructions ?? "")
      setError(null)
      setSaving(false)
      setFiles([])
      setFileError(null)
      if (skill) {
        listSkillFiles(skill.id)
          .then(setFiles)
          .catch(() => setFileError("Failed to load files. Close and reopen to retry."))
      }
    }
  }, [open, skill])

  function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !skill) return
    setUploading(true)
    setFileError(null)
    try {
      const newFile = await uploadSkillFile(skill.id, file)
      setFiles((prev) => [...prev, newFile])
    } catch (err) {
      setFileError(err instanceof Error ? err.message : "Upload failed. Try again.")
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  const handleDeleteFile = async (fileId: string) => {
    if (!skill) return
    try {
      await deleteSkillFile(skill.id, fileId)
      setFiles((prev) => prev.filter((f) => f.id !== fileId))
    } catch {
      setFileError("Failed to delete file. Try again.")
    }
  }

  const handleSave = async () => {
    if (!name.trim() || saving) return
    setSaving(true)
    setError(null)
    try {
      const body = isEdit
        ? ({ name: name.trim(), description: description.trim(), instructions: instructions.trim() } as SkillUpdate)
        : ({ name: name.trim(), description: description.trim(), instructions: instructions.trim() } as SkillCreate)
      await onSave(body)
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save skill.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Skill" : "New Skill"}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          {/* Name */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-foreground">Name</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. SQL Writer"
            />
          </div>

          {/* Description */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-foreground">Description</label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="One sentence describing what this skill does"
              rows={2}
            />
          </div>

          {/* Instructions */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-foreground">Instructions</label>
            <Textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="Step-by-step instructions the agent follows when this skill is loaded..."
              rows={8}
              className="font-mono text-sm"
            />
          </div>

          {/* Attached Files — edit mode only */}
          {isEdit && skill && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-foreground">Attached Files</label>
                {isOwner && (
                  <Button variant="ghost" size="sm" className="text-xs gap-1" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                    {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Paperclip className="h-3 w-3" />}
                    {uploading ? "Uploading..." : "Attach File"}
                  </Button>
                )}
              </div>
              <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileUpload} />
              {files.length === 0 ? (
                <p className="text-xs text-muted-foreground">No files attached.</p>
              ) : (
                <ul className="flex flex-col gap-1 overflow-y-auto max-h-48">
                  {files.map((f) => (
                    <li key={f.id} className="flex items-center justify-between text-xs bg-muted rounded px-2 py-1">
                      <span className="flex items-center gap-1 text-foreground truncate">
                        <FileText className="h-3 w-3 shrink-0" />
                        {f.filename}
                        <span className="text-muted-foreground ml-1">({formatBytes(f.file_size)})</span>
                      </span>
                      {isOwner && (
                        <Button variant="ghost" size="icon" className="h-5 w-5 hover:text-destructive shrink-0" onClick={() => handleDeleteFile(f.id)} aria-label="Delete file">
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {fileError && <p className="text-xs text-destructive">{fileError}</p>}
            </div>
          )}
        </div>

        <DialogFooter className="flex-col items-stretch gap-2">
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Discard Changes
            </Button>
            <Button onClick={handleSave} disabled={!name.trim() || saving}>
              {isEdit ? "Update Skill" : "Save Skill"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
