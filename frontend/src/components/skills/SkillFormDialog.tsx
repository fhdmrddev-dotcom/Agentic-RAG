import { useState, useEffect } from "react"
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
import type { Skill, SkillCreate, SkillUpdate } from "@/types"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  skill?: Skill | null
  onSave: (body: SkillCreate | SkillUpdate) => Promise<void>
}

export function SkillFormDialog({ open, onOpenChange, skill, onSave }: Props) {
  const isEdit = !!skill

  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [instructions, setInstructions] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Reset fields whenever dialog opens/closes or skill changes
  useEffect(() => {
    if (open) {
      setName(skill?.name ?? "")
      setDescription(skill?.description ?? "")
      setInstructions(skill?.instructions ?? "")
      setError(null)
      setSaving(false)
    }
  }, [open, skill])

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
